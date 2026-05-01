// supabaseStorage.js
// Phase 4: Complete Supabase storage layer for BukuKas.
// Replaces localStorage read/write for all 6 data collections.
// All camelCase ↔ snake_case mapping is handled here — no other file needs to know DB column names.

import supabase from './supabaseClient';
import { defaultData } from './storage';
import { checkVersion, ConflictError } from './conflictDetector';

/**
 * Wraps a Supabase query promise with a timeout.
 * If the query does not resolve within `ms` milliseconds, rejects with a
 * user-friendly timeout error. This prevents indefinite hangs on slow
 * or dropped Supabase free-tier connections.
 */
function withTimeout(promise, ms = 10000) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(
      `Koneksi ke database terlalu lama (>${ms / 1000}s). Periksa koneksi internet Anda dan coba lagi.`
    )), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Health check: returns true if the Supabase database is reachable, false if paused/unreachable.
 * Uses a lightweight query (1 row from profiles). Times out after 5 seconds.
 */
export async function isSupabaseReachable() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), 5000)
    );
    const query = supabase.from("profiles").select("id").limit(1).maybeSingle();
    const { error } = await Promise.race([query, timeout]);
    // PGRST116 = "no rows found" — DB is reachable, just empty
    if (error && error.code !== "PGRST116") return false;
    return true;
  } catch {
    return false;
  }
}

// ── Field mappers: DB row → JS object ─────────────────────────────────────────

export const mapTransaction = (row) => ({
  id:             row.id,
  type:           row.type,
  date:           row.date,
  time:           row.time,
  createdAt:      row.created_at_local,
  orderNum:       row.order_num,
  counterparty:   row.counterparty,
  itemName:       row.item_name,
  stockQty:       Number(row.stock_qty)      || 0,
  stockUnit:      row.stock_unit,
  value:          Number(row.value)           || 0,
  outstanding:    Number(row.outstanding)     || 0,
  status:         row.status,
  txnId:          row.txn_id,
  dueDate:        row.due_date,
  customDueDays:  Number(row.custom_due_days) || 0,
  notes:          row.notes,
  items: (row.items || []).map(it => ({
    ...it,
    sackQty:    Number(it.sackQty)    || 0,
    weightKg:   Number(it.weightKg)   || 0,
    pricePerKg: Number(it.pricePerKg) || 0,
    subtotal:   Number(it.subtotal)   || 0,
  })),
  paymentHistory: (row.payment_history || []).map(ph => ({
    ...ph,
    amount:            Number(ph.amount)            || 0,
    outstandingBefore: Number(ph.outstandingBefore) || 0,
    outstandingAfter:  Number(ph.outstandingAfter)  || 0,
  })),
  editLog:        row.edit_log        || [],
  version:        row.version,
  created_by:     row.created_by,
  updated_by:     row.updated_by,
});

export const mapContact = (row) => ({
  id:         row.id,
  name:       row.name,
  email:      row.email,
  phone:      row.phone,
  address:    row.address,
  archived:   row.archived,
  version:    row.version,
  created_by: row.created_by,
  updated_by: row.updated_by,
});

export const mapStockAdjustment = (row) => ({
  id:            row.id,
  itemName:      row.item_name,
  date:          row.date,
  time:          row.time,
  adjustmentQty: Number(row.adjustment_qty) || 0,
  reason:        row.reason,
  unit:          row.unit,
  adjustedBy:    row.adjusted_by_name,
  version:       row.version,
  created_by:    row.created_by,
  updated_by:    row.updated_by,
});

export const mapCatalogItem = (row) => ({
  id:               row.id,
  name:             row.name,
  code:             row.code             || '',
  defaultUnit:      row.default_unit,
  subtypes:         row.subtypes          || [],
  archived:         row.archived,
  archivedSubtypes: row.archived_subtypes || [],
  version:          row.version,
  created_by:       row.created_by,
  updated_by:       row.updated_by,
});

const mapSettings = (row) => ({
  businessName:             row.business_name,
  address:                  row.address,
  phone:                    row.phone,
  lowStockThreshold:        Number(row.low_stock_threshold)          || 0,
  bankAccounts:             row.bank_accounts                        || [],
  maxBankAccountsOnInvoice: Number(row.max_bank_accounts_on_invoice) || 0,
  lastExportDate:           row.last_export_date,
  defaultDueDateDays:       Number(row.default_due_date_days)        || 0,
  printerType:              row.printer_type,
  version:                  row.version,
});

// ── loadDataFromSupabase ───────────────────────────────────────────────────────

/**
 * Fetches all 5 data collections from Supabase in parallel.
 * Transactions and stock_adjustments are filtered to the last 2 years to keep
 * initial load fast as data grows. Older records remain in Supabase and are
 * never deleted — they just aren't loaded on startup.
 * Returns the same shape as loadData() in storage.js.
 * @param {string} userId - current user's UUID (unused for queries, RLS handles auth)
 * @returns {Promise<Object>} full data object matching defaultData shape
 */
export async function loadDataFromSupabase(userId) {
  const [txRes, contactRes, adjRes, catalogRes, settingsRes] = await Promise.all([
    supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('contacts').select('*').order('name', { ascending: true }),
    supabase.from('stock_adjustments').select('*').order('date', { ascending: false }),
    supabase.from('item_catalog').select('*').order('name', { ascending: true }),
    supabase.from('app_settings').select('*').eq('id', 'singleton').maybeSingle(),
  ]);

  if (txRes.error)       throw new Error(`Gagal memuat transaksi: ${txRes.error.message}`);
  if (contactRes.error)  throw new Error(`Gagal memuat kontak: ${contactRes.error.message}`);
  if (adjRes.error)      throw new Error(`Gagal memuat penyesuaian stok: ${adjRes.error.message}`);
  if (catalogRes.error)  throw new Error(`Gagal memuat katalog barang: ${catalogRes.error.message}`);
  if (settingsRes.error) throw new Error(`Gagal memuat pengaturan: ${settingsRes.error.message}`);

  return {
    transactions:     (txRes.data      || []).map(mapTransaction),
    contacts:         (contactRes.data  || []).map(mapContact),
    stockAdjustments: (adjRes.data      || []).map(mapStockAdjustment),
    itemCategories:   [],
    itemCatalog:      (catalogRes.data  || []).map(mapCatalogItem),
    settings:         settingsRes.data ? mapSettings(settingsRes.data) : { ...defaultData.settings },
    _normVersion:     18,
  };
}

// ── Individual write functions ─────────────────────────────────────────────────

/**
 * Upsert a single transaction to Supabase.
 * @param {Object} tx - full camelCase transaction object
 * @param {string} userId - current user's UUID
 * @param {boolean} isEdit - if true, checks version before saving (throws ConflictError on mismatch)
 */
export async function saveTransaction(tx, userId, isEdit = false) {
  if (isEdit) {
    const result = await checkVersion('transactions', tx.id, (tx.version || 1) - 1);
    if (result.conflict) throw new ConflictError(result.updatedBy);
  }
  const { error } = await withTimeout(supabase.from('transactions').upsert({
    id:               tx.id,
    type:             tx.type,
    date:             tx.date,
    time:             tx.time,
    created_at_local: tx.createdAt,
    order_num:        tx.orderNum      || '',
    counterparty:     tx.counterparty,
    item_name:        tx.itemName,
    stock_qty:        tx.stockQty,
    stock_unit:       tx.stockUnit,
    value:            tx.value,
    outstanding:      tx.outstanding,
    status:           tx.status,
    txn_id:           tx.txnId         || '',
    due_date:         tx.dueDate       || null,
    custom_due_days:  tx.customDueDays ?? 14,
    notes:            tx.notes         || '',
    items:            tx.items         || [],
    payment_history:  tx.paymentHistory || [],
    edit_log:         tx.editLog        || [],
    version:          (tx.version || 0) + 1,
    created_by:       userId,
    updated_by:       userId,
  }, { onConflict: 'id' }));
  if (error) throw new Error(`Gagal menyimpan transaksi: ${error.message}`);
}

/**
 * Delete a single transaction from Supabase.
 * @param {string} id - transaction id
 */
export async function deleteTransaction(id) {
  const { error } = await withTimeout(supabase.from('transactions').delete().eq('id', id));
  if (error) throw new Error(`Gagal menghapus transaksi: ${error.message}`);
}

/**
 * Upsert a single contact to Supabase.
 * @param {Object} contact - full camelCase contact object
 * @param {string} userId
 * @param {boolean} isEdit - if true, checks version before saving (throws ConflictError on mismatch)
 */
export async function saveContact(contact, userId, isEdit = false) {
  if (isEdit) {
    const result = await checkVersion('contacts', contact.id, (contact.version || 1) - 1);
    if (result.conflict) throw new ConflictError(result.updatedBy);
  }
  const { error } = await withTimeout(supabase.from('contacts').upsert({
    id:         contact.id,
    name:       contact.name,
    email:      contact.email    || '',
    phone:      contact.phone    || '',
    address:    contact.address  || '',
    archived:   contact.archived ?? false,
    version:    (contact.version || 0) + 1,
    created_by: userId,
    updated_by: userId,
  }, { onConflict: 'id' }));
  if (error) throw new Error(`Gagal menyimpan kontak: ${error.message}`);
}

/**
 * Delete a single contact from Supabase.
 * @param {string} id - contact id
 */
export async function deleteContact(id) {
  const { error } = await withTimeout(supabase.from('contacts').delete().eq('id', id));
  if (error) throw new Error(`Gagal menghapus kontak: ${error.message}`);
}

/**
 * Upsert a single stock adjustment to Supabase.
 * @param {Object} adj - full camelCase adjustment object
 * @param {string} userId
 */
export async function saveStockAdjustment(adj, userId) {
  const { error } = await withTimeout(supabase.from('stock_adjustments').upsert({
    id:               adj.id,
    item_name:        adj.itemName,
    date:             adj.date,
    time:             adj.time       || '00:00',
    adjustment_qty:   adj.adjustmentQty,
    reason:           adj.reason     || '',
    unit:             adj.unit       || 'karung',
    adjusted_by_name: adj.adjustedBy || null,
    version:          (adj.version || 0) + 1,
    created_by:       userId,
    updated_by:       userId,
  }, { onConflict: 'id' }));
  if (error) throw new Error(`Gagal menyimpan penyesuaian stok: ${error.message}`);
}

/**
 * Delete a single stock adjustment from Supabase.
 * @param {string} id - adjustment id
 */
export async function deleteStockAdjustment(id) {
  const { error } = await withTimeout(supabase.from('stock_adjustments').delete().eq('id', id));
  if (error) throw new Error(`Gagal menghapus penyesuaian stok: ${error.message}`);
}

/**
 * Upsert a single catalog item to Supabase.
 * @param {Object} item - full camelCase catalog item object
 * @param {string} userId
 */
export async function saveItemCatalogItem(item, userId) {
  const { error } = await withTimeout(supabase.from('item_catalog').upsert({
    id:               item.id,
    name:             item.name,
    code:             item.code             || '',
    default_unit:     item.defaultUnit      || 'karung',
    subtypes:         item.subtypes         || [],
    archived:         item.archived         ?? false,
    archived_subtypes: item.archivedSubtypes || [],
    version:          (item.version || 0) + 1,
    created_by:       userId,
    updated_by:       userId,
  }, { onConflict: 'id' }));
  if (error) throw new Error(`Gagal menyimpan katalog barang: ${error.message}`);
}

/**
 * Delete a single catalog item from Supabase.
 * @param {string} id - catalog item id
 */
export async function deleteItemCatalogItem(id) {
  const { error } = await withTimeout(supabase.from('item_catalog').delete().eq('id', id));
  if (error) throw new Error(`Gagal menghapus katalog barang: ${error.message}`);
}

/**
 * Upsert app settings (singleton row) to Supabase.
 * @param {Object} settings - full camelCase settings object
 * @param {string} userId
 */
export async function saveSettings(settings, userId) {
  const { error } = await withTimeout(supabase.from('app_settings').upsert({
    id:                          'singleton',
    business_name:               settings.businessName,
    address:                     settings.address                  || '',
    phone:                       settings.phone                    || '',
    low_stock_threshold:         settings.lowStockThreshold        ?? 10,
    bank_accounts:               settings.bankAccounts             || [],
    max_bank_accounts_on_invoice: settings.maxBankAccountsOnInvoice ?? 1,
    last_export_date:            settings.lastExportDate           || null,
    default_due_date_days:       settings.defaultDueDateDays       ?? 14,
    printer_type:                settings.printerType              || 'A4',
    version:                     (settings.version || 0) + 1,
    created_by:                  userId,
    updated_by:                  userId,
  }, { onConflict: 'id' }));
  if (error) throw new Error(`Gagal menyimpan pengaturan: ${error.message}`);
}

// ── Phase 6: Activity Log ─────────────────────────────────────────────────────

/**
 * Insert one activity log entry. Failures are intentionally non-blocking —
 * callers should `.catch()` and warn rather than surface to SaveErrorModal.
 * @param {{ user_name, action, entity_type, entity_id, changes }} entry
 * @param {string} userId
 */
export async function saveActivityLog(entry, userId) {
  const { error } = await supabase.from('activity_log').insert({
    user_id:     userId || null,
    user_name:   entry.user_name   || '',
    action:      entry.action,
    entity_type: entry.entity_type,
    entity_id:   entry.entity_id   || null,
    changes:     entry.changes     || {},
  });
  if (error) throw new Error(`Gagal menyimpan log aktivitas: ${error.message}`);
}

const PAGE_SIZE = 50;

/**
 * Fetch activity log entries with optional filters and pagination.
 * Returns newest-first, PAGE_SIZE rows per page.
 * @param {{ userId?, action?, entityType?, dateFrom?, dateTo?, page? }} filters
 * @returns {Promise<{ rows: Array, hasMore: boolean }>}
 */
export async function loadActivityLog(filters = {}) {
  const page   = filters.page || 0;
  const offset = page * PAGE_SIZE;
  let q = supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE);
  if (filters.userId)     q = q.eq('user_id', filters.userId);
  if (filters.action)     q = q.eq('action', filters.action);
  if (filters.entityType) q = q.eq('entity_type', filters.entityType);
  if (filters.dateFrom)   q = q.gte('created_at', filters.dateFrom + 'T00:00:00Z');
  if (filters.dateTo)     q = q.lte('created_at', filters.dateTo + 'T23:59:59Z');
  const { data, error } = await q;
  if (error) throw new Error(`Gagal memuat log aktivitas: ${error.message}`);
  const fetched = data || [];
  return {
    rows:    fetched.slice(0, PAGE_SIZE),
    hasMore: fetched.length > PAGE_SIZE,
  };
}

/**
 * H2 LONG-TERM FIX: Atomically get the next invoice serial from the Supabase
 * txn_counters table via the next_txn_serial() Postgres function.
 * Uses INSERT ... ON CONFLICT DO UPDATE ... RETURNING — safe under concurrent writes.
 *
 * @param {string} dateStr - Transaction date "YYYY-MM-DD"
 * @returns {Promise<string>} txnId in format "YY-MM-NNNNN"
 */
export async function getNextTxnSerial(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const prefix = `${yy}-${mm}`;

  const { data, error } = await supabase.rpc("next_txn_serial", { p_prefix: prefix });
  if (error) throw new Error(`Gagal mendapatkan nomor faktur: ${error.message}`);

  const serial = String(data).padStart(5, "0");
  return `${prefix}-${serial}`;
}
