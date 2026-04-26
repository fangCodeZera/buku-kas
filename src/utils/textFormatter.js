/**
 * utils/textFormatter.js
 * ASCII text layout engine for dot matrix printing.
 * Produces monospace 80-column output for use in <pre> blocks.
 *
 * Pure functions — no React, no DOM, no side effects.
 * Every output line is padded/trimmed to exactly LINE_WIDTH (80) chars.
 *
 * Exports:
 *   formatInvoice(transactions, settings) → string
 *   formatSuratJalan(transaction, settings) → string
 */
import { fmtDate } from "./idGenerators";

const LINE_WIDTH = 80;

// ─── Layout helpers ──────────────────────────────────────────────────────────

/** Pad/truncate to exact width, left-aligned */
const padRight = (str, width) => {
  const s = String(str ?? "");
  return s.length >= width ? s.slice(0, width) : s + " ".repeat(width - s.length);
};

/** Pad/truncate to exact width, right-aligned */
const padLeft = (str, width) => {
  const s = String(str ?? "");
  return s.length >= width ? s.slice(0, width) : " ".repeat(width - s.length) + s;
};

/** Center text within a given width, padded with spaces to exact width */
const centerText = (str, width = LINE_WIDTH) => {
  const s = String(str ?? "").slice(0, width);
  const pad = Math.floor((width - s.length) / 2);
  return " ".repeat(pad) + s + " ".repeat(width - pad - s.length);
};

/**
 * Word-wrap text to fit within a given character width.
 * Splits at word boundaries (spaces). Hard-truncates a single word
 * that alone exceeds the full width. Returns array of strings, each <= width chars.
 */
const wrapText = (str, width) => {
  const s = String(str ?? "").trim();
  if (s.length <= width) return [s];
  const words = s.split(/\s+/);
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    if (currentLine === "") {
      if (word.length > width) {
        let remaining = word;
        while (remaining.length > width) {
          lines.push(remaining.slice(0, width));
          remaining = remaining.slice(width);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    } else if (currentLine.length + 1 + word.length <= width) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      if (word.length > width) {
        let remaining = word;
        while (remaining.length > width) {
          lines.push(remaining.slice(0, width));
          remaining = remaining.slice(width);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
};

/** Format number without Rp prefix: 5215000 → "5.215.000" */
const fmtNum = (n) => Math.round(Number(n) || 0).toLocaleString("id-ID");

/** Format number with Rp prefix: 5215000 → "Rp 5.215.000" */
const fmtRp = (n) => "Rp " + fmtNum(n);

const SEP_MAJOR = "=".repeat(LINE_WIDTH);
const SEP_MINOR = "-".repeat(LINE_WIDTH);

// ─── Item array helper ───────────────────────────────────────────────────────

/**
 * Returns items array from a transaction, falling back to legacy single-item fields.
 * Matches the same fallback logic used in InvoiceModal.js.
 */
const getItemsArray = (t) => {
  if (Array.isArray(t.items) && t.items.length > 0) return t.items;
  return [{
    itemName:   t.itemName   || "—",
    sackQty:    t.sackQty    != null ? t.sackQty : (t.stockQty || 0),
    weightKg:   t.weightKg   || 0,
    pricePerKg: t.pricePerKg || 0,
    subtotal:   t.value      || 0,
  }];
};

// ─── Invoice sub-formatters ──────────────────────────────────────────────────

/**
 * Invoice header: "I N V O I C E" centered (left 69 chars) + "Page 1 of 1" right (11 chars).
 * No business name, address, or phone.
 */
const formatInvoiceHeader = () => {
  const title   = "I N V O I C E";
  const pageNum = "Page 1 of 1";
  return [centerText(title, LINE_WIDTH - pageNum.length) + pageNum];
};

/**
 * Invoice meta: two-column layout (left 40 / right 40).
 * Lines 1–2: blank left + Invoice No / Date right-aligned.
 * Line 3: "Kepada :" left + "Note       : [note]" right.
 * Line 4: client name (no label), left-aligned.
 * Line 5+: client address (no label), left-aligned, if found in contacts.
 * Minor separator after meta.
 *
 * @param {Object[]} transactions
 * @param {Object[]} contacts
 * @param {string}   note — session-only invoice note (from DotMatrixPrintModal)
 */
const formatInvoiceMeta = (transactions, contacts = [], note = "") => {
  const t0      = transactions[0] || {};
  const invNo   = t0.txnId        || "—";
  const dateStr = fmtDate(t0.date) || "—";
  const client  = t0.counterparty  || "—";

  const lines = [
    padRight("", 40) + padLeft("Invoice No: " + invNo,              40),
    padRight("", 40) + padLeft("Date       : " + dateStr,           40),
    padRight("Kepada :", 40) + padLeft("Note       : " + note.trim(), 40),
    padRight(client, LINE_WIDTH),
  ];

  // Client address — left-aligned, no label, wrapped to full width
  const clientAddr = contacts.find(
    (c) => (c.name || "").toLowerCase() === client.toLowerCase()
  )?.address?.trim();
  if (clientAddr) {
    wrapText(clientAddr, LINE_WIDTH).forEach((line) =>
      lines.push(padRight(line, LINE_WIDTH))
    );
  }

  lines.push(SEP_MINOR);
  return lines;
};

/**
 * Items table — 5 columns, no Krg column.
 * Columns (total 80): No(6) + Jenis Barang(32) + Berat(14) + Harga(14) + Total(14)
 * No trailing separator — formatInvoiceFooter adds SEP_MAJOR after total row.
 * Flattens all items across all transactions.
 */
const formatItemsTable = (transactions) => {
  const COL_NO     = 6;
  const COL_BARANG = 32;
  const COL_BERAT  = 14;
  const COL_HARGA  = 14;
  const COL_TOTAL  = 14;
  // 6 + 32 + 14 + 14 + 14 = 80

  const mkRow = (no, barang, berat, harga, total) =>
    padRight(no,    COL_NO)    +
    padRight(barang, COL_BARANG) +
    padLeft(berat,  COL_BERAT) +
    padLeft(harga,  COL_HARGA) +
    padLeft(total,  COL_TOTAL);

  const header  = mkRow("No", "Jenis Barang", "Berat (Kg)", "Harga", "Total");
  const divider = SEP_MINOR;

  // Flatten all items across all transactions
  const lineItems = transactions.flatMap((t) =>
    getItemsArray(t).map((it) => ({ ...it, txType: t.type }))
  );

  const rows = lineItems.flatMap((it, i) => {
    const beratStr = it.weightKg   ? fmtNum(it.weightKg)   + " kg" : "—";
    const hargaStr = it.pricePerKg ? "Rp " + fmtNum(it.pricePerKg) : "—";
    const totalStr = "Rp " + fmtNum(it.subtotal || 0);
    const nameLines = wrapText(it.itemName || "—", COL_BARANG);
    const firstRow  = mkRow(String(i + 1), nameLines[0], beratStr, hargaStr, totalStr);
    const contRows  = nameLines.slice(1).map((line) => mkRow("", line, "", "", ""));
    return [firstRow, ...contRows];
  });

  return [header, divider, ...rows];
};

/**
 * Invoice footer: total row + major separator + bank accounts + signature block.
 * No LUNAS/SISA TAGIHAN — removed per new format.
 * No notes — note is now shown in formatInvoiceMeta.
 */
const formatInvoiceFooter = (transactions, settings) => {
  const total = transactions.reduce((a, t) => a + (Number(t.value) || 0), 0);
  const lines = [];

  // Total row right-aligned, then major separator
  lines.push(padLeft("TOTAL    : " + fmtRp(total), LINE_WIDTH));
  lines.push(SEP_MAJOR);

  // Bank accounts
  const bankAccounts = (settings.bankAccounts || []).filter((a) => a.showOnInvoice);
  const maxShow = settings.maxBankAccountsOnInvoice ?? 1;
  const shown   = maxShow > 0 ? bankAccounts.slice(0, maxShow) : [];

  if (shown.length > 0) {
    shown.forEach((acct, idx) => {
      if (idx > 0) lines.push("");
      if (acct.bankName)      lines.push(padRight("NAME BANK        : " + acct.bankName,      LINE_WIDTH));
      if (acct.accountNumber) lines.push(padRight("ACCOUNT NUMBER   : " + acct.accountNumber, LINE_WIDTH));
      if (acct.accountName)   lines.push(padRight("ACCOUNT NAME     : " + acct.accountName,   LINE_WIDTH));
    });
    lines.push("");
  }

  // Signature block
  const sigLine =
    padRight("(" + " ".repeat(26) + ")", 40) +
    padLeft("(" + " ".repeat(26) + ")", 40);

  lines.push(
    padRight("      Tanda terima", 40) + padLeft("Hormat kami,", 40),
    "",
    "",
    "",
    sigLine,
  );

  return lines;
};

// ─── Surat Jalan sub-formatters ──────────────────────────────────────────────

/**
 * Surat jalan header block.
 * Shows only "SURAT JALAN" centered — no company name.
 */
const formatSuratJalanHeader = () => {
  return [centerText("SURAT JALAN"), SEP_MAJOR];
};

/**
 * Surat jalan meta: two-column layout.
 * Row 1: "KEPADA YTH :" (left) + "TANGGAL : [date]" (right)
 * Row 2: client name full-width (no label)
 * Row 3: client address left-half + "PLAT MOBIL : [plat]" right-half (same line)
 *         Continuation address lines appear full-width below.
 * contacts[] is used to look up the recipient's address.
 */
const formatSuratJalanMeta = (transaction, platNomor = "", contacts = []) => {
  const tglStr   = "TANGGAL : " + (fmtDate(transaction.date) || "—");
  const clientNm = transaction.counterparty || "—";
  const platStr  = "PLAT MOBIL : " + platNomor.trim();
  const invStr   = "NO. INVOICE : " + (transaction.txnId || "—");

  // Look up client address
  const clientAddr = contacts.find(
    (c) => (c.name || "").toLowerCase() === clientNm.toLowerCase()
  )?.address?.trim();

  const lines = [
    padRight("KEPADA YTH :", 40) + padLeft(tglStr, 40),  // row 1
    padRight(clientNm, 40)       + padLeft(invStr, 40),   // row 2
  ];

  if (clientAddr) {
    const addrLines = wrapText(clientAddr, 40);
    lines.push(padRight(addrLines[0] || "", 40) + padLeft(platStr, 40));
    for (let i = 1; i < addrLines.length; i++) {
      lines.push(padRight(addrLines[i], LINE_WIDTH));
    }
  } else {
    lines.push(padRight("", 40) + padLeft(platStr, 40));
  }

  lines.push(SEP_MINOR);
  return lines;
};

/**
 * Surat jalan items table — 3-column layout.
 * Columns (total 80): NO.(3) | JENIS BARANG(50) | JUMLAH BARANG(21)
 * Separators: " | " (3 chars) × 2 = 6 chars → 3 + 6 + 50 + 21 = 80
 */
const formatSuratJalanItems = (transaction) => {
  const COL_NO     = 3;
  const COL_BARANG = 50;
  const COL_JML    = 21;
  const SEP        = " | ";

  const mkRow = (no, barang, jml) =>
    padLeft(no, COL_NO) +
    SEP + padRight(barang, COL_BARANG) +
    SEP + padRight(jml, COL_JML);

  const header  = mkRow("NO.", "JENIS BARANG", "JUMLAH BARANG");
  const divider = SEP_MINOR;

  const unit = transaction.stockUnit || "karung";
  const items = getItemsArray(transaction).flatMap((it, i) => {
    const qty = it.sackQty != null ? it.sackQty : 0;
    const jmlStr = fmtNum(qty) + " " + unit;
    const nameLines = wrapText(it.itemName || "—", COL_BARANG);
    const firstRow = mkRow(String(i + 1), nameLines[0], jmlStr);
    const contRows = nameLines.slice(1).map(line => mkRow("", line, ""));
    return [firstRow, ...contRows];
  });

  return [header, divider, ...items, SEP_MAJOR];
};

/**
 * Surat jalan footer: signature blocks for Tanda Terima and Hormat Kami.
 * Each side gets 2 blank lines for signature space.
 */
const formatSuratJalanFooter = (catatanPengiriman = "") => {
  const leftLabel  = padRight("TANDA TERIMA,", 40);
  const rightLabel = padLeft("HORMAT KAMI,", 40);
  const blankLine  = " ".repeat(LINE_WIDTH);
  const sigLine    =
    padRight("(" + " ".repeat(26) + ")", 40) +
    padLeft("(" + " ".repeat(26) + ")", 40);

  const lines = [];

  if (catatanPengiriman.trim()) {
    const prefix = "Catatan: ";
    const firstLineWidth = LINE_WIDTH - prefix.length;
    const noteLines = wrapText(catatanPengiriman.trim(), firstLineWidth);
    lines.push(padRight(prefix + (noteLines[0] || ""), LINE_WIDTH));
    for (let i = 1; i < noteLines.length; i++) {
      lines.push(padRight("  " + noteLines[i], LINE_WIDTH));
    }
    lines.push(blankLine);
  }

  lines.push(leftLabel + rightLabel, blankLine, blankLine, sigLine);
  return lines;
};

// ─── Public exports ──────────────────────────────────────────────────────────

/**
 * Format a full invoice as an 80-column ASCII string.
 * Matches InvoiceModal's behavior: all items across all transactions
 * are flattened into a single invoice (same as transactions.flatMap()).
 *
 * @param {Object[]} transactions - array of transaction objects
 * @param {Object}   settings     - app settings (businessName, bankAccounts, etc.)
 * @returns {string} formatted invoice text, lines joined by "\n"
 */
export const formatInvoice = (transactions, settings, options = {}, contacts = []) => {
  const txs        = Array.isArray(transactions) ? transactions : [transactions];
  const s          = settings || {};
  const { note = "" } = options;

  const lines = [
    ...formatInvoiceHeader(),
    ...formatInvoiceMeta(txs, contacts, note),
    ...formatItemsTable(txs),
    ...formatInvoiceFooter(txs, s),
  ];

  return lines.join("\n");
};

/**
 * Format a full surat jalan as an 80-column ASCII string.
 *
 * @param {Object} transaction - single transaction object
 * @param {Object} settings    - app settings (businessName, etc.)
 * @returns {string} formatted surat jalan text, lines joined by "\n"
 */
export const formatSuratJalan = (transaction, _settings, options = {}, contacts = []) => {
  const t = transaction || {};
  const { platNomor = "", catatanPengiriman = "" } = options;

  const lines = [
    ...formatSuratJalanHeader(),
    ...formatSuratJalanMeta(t, platNomor, contacts),
    ...formatSuratJalanItems(t),
    ...formatSuratJalanFooter(catatanPengiriman),
  ];

  return lines.join("\n");
};
