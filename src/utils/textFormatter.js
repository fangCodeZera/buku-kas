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
 * Business header block.
 * Skips blank lines — no centered empty businessName.
 */
const formatInvoiceHeader = (settings) => {
  const lines = [];
  if (settings.businessName?.trim()) lines.push(centerText(settings.businessName.trim()));
  if (settings.address?.trim())      lines.push(centerText(settings.address.trim()));
  if (settings.phone?.trim())        lines.push(centerText("Telp: " + settings.phone.trim()));
  lines.push(SEP_MAJOR);
  return lines;
};

/**
 * Invoice meta: two-column layout (left 40 chars, right 40 chars).
 * Uses transactions[0] for invoice#, date, client, and dueDate.
 * contacts[] is used to look up the client's address.
 */
const formatInvoiceMeta = (transactions, contacts = []) => {
  const t0  = transactions[0] || {};
  const invNo    = t0.txnId       || "—";
  const dateStr  = fmtDate(t0.date) || "—";
  const client   = t0.counterparty  || "—";
  const dueStr   = t0.dueDate ? fmtDate(t0.dueDate) : "—";

  const row1Left  = "No. Invoice: " + invNo;
  const row1Right = "Tanggal    : " + dateStr;
  const row2Left  = "Klien      : " + client;
  const row2Right = "Jatuh Tempo: " + dueStr;

  const lines = [
    padRight(row1Left, 40) + padLeft(row1Right, 40),
    padRight(row2Left, 40) + padLeft(row2Right, 40),
  ];

  // Append address lines if found in contacts
  const clientAddr = contacts.find(
    (c) => (c.name || "").toLowerCase() === client.toLowerCase()
  )?.address?.trim();
  if (clientAddr) {
    const addrPrefix = "  Alamat   : ";
    const contPrefix = "             ";
    const addrWidth  = LINE_WIDTH - addrPrefix.length;
    const addrLines  = wrapText(clientAddr, addrWidth);
    lines.push(padRight(addrPrefix + (addrLines[0] || ""), LINE_WIDTH));
    for (let i = 1; i < addrLines.length; i++) {
      lines.push(padRight(contPrefix + addrLines[i], LINE_WIDTH));
    }
  }

  lines.push(SEP_MINOR);
  return lines;
};

/**
 * Items table.
 * Columns (total 80): No(3) | Barang(24) | Krg(6) | Berat(9) | Harga/Kg(10) | Subtotal(13)
 * Separators: " | " (3 chars) × 5 = 15 chars
 * Flattens all items across all transactions (same as InvoiceModal.js flatMap).
 */
const formatItemsTable = (transactions) => {
  const COL_NO       = 3;
  const COL_BARANG   = 24;
  const COL_KRG      = 6;
  const COL_BERAT    = 9;
  const COL_HARGA    = 10;
  const COL_SUBTOTAL = 13;
  const SEP          = " | ";

  const mkRow = (no, barang, krg, berat, harga, subtotal) =>
    padLeft(no, COL_NO) +
    SEP + padRight(barang, COL_BARANG) +
    SEP + padLeft(krg, COL_KRG) +
    SEP + padLeft(berat, COL_BERAT) +
    SEP + padLeft(harga, COL_HARGA) +
    SEP + padLeft(subtotal, COL_SUBTOTAL);

  const header = mkRow("No", "Barang", "Krg", "Berat", "Harga/Kg", "Subtotal");
  const divider = SEP_MINOR;

  // Flatten all items across all transactions
  const lineItems = transactions.flatMap((t) =>
    getItemsArray(t).map((it) => ({ ...it, txType: t.type }))
  );

  const rows = lineItems.flatMap((it, i) => {
    const qty      = it.sackQty != null ? it.sackQty : 0;
    const beratStr = it.weightKg ? fmtNum(it.weightKg) + " Kg" : "—";
    const hargaStr = it.pricePerKg ? fmtNum(it.pricePerKg) : "—";
    const subStr   = fmtNum(it.subtotal || 0);
    const nameLines = wrapText(it.itemName || "—", COL_BARANG);
    const firstRow = mkRow(String(i + 1), nameLines[0], fmtNum(qty), beratStr, hargaStr, subStr);
    const contRows = nameLines.slice(1).map(line => mkRow("", line, "", "", "", ""));
    return [firstRow, ...contRows];
  });

  return [header, divider, ...rows, SEP_MAJOR];
};

/**
 * Invoice footer: totals (right-aligned), bank accounts, notes.
 * Totals are summed across all transactions.
 */
const formatInvoiceFooter = (transactions, settings, note = "") => {
  const total      = transactions.reduce((a, t) => a + (Number(t.value)       || 0), 0);
  const outstanding = transactions.reduce((a, t) => a + (Number(t.outstanding) || 0), 0);
  const lines = [];

  lines.push(padLeft("TOTAL: " + fmtRp(total), LINE_WIDTH));

  if (outstanding > 0) {
    lines.push(padLeft("SISA TAGIHAN: " + fmtRp(outstanding), LINE_WIDTH));
  } else {
    lines.push(padLeft("LUNAS", LINE_WIDTH));
  }

  // Bank accounts
  const bankAccounts = (settings.bankAccounts || []).filter((a) => a.showOnInvoice);
  const maxShow = settings.maxBankAccountsOnInvoice ?? 1;
  const shown   = maxShow > 0 ? bankAccounts.slice(0, maxShow) : [];

  if (shown.length > 0) {
    lines.push("");
    lines.push("Pembayaran ke:");
    shown.forEach((acct) => {
      const parts = [
        acct.bankName        || "",
        acct.accountNumber   ? "- " + acct.accountNumber : "",
        acct.accountName     ? "a.n. " + acct.accountName : "",
      ].filter(Boolean);
      lines.push(padRight("  " + parts.join(" "), LINE_WIDTH));
    });
  }

  // Notes from first transaction
  const notes = (transactions[0] || {}).notes;
  if (notes?.trim()) {
    lines.push("");
    lines.push("Catatan: " + notes.trim());
  }

  // Session-only invoice note (entered at print time, not saved to data)
  if (note.trim()) {
    lines.push("");
    const prefix = "Catatan Invoice: ";
    const firstLineWidth = LINE_WIDTH - prefix.length;
    const noteLines = wrapText(note.trim(), firstLineWidth);
    lines.push(padRight(prefix + (noteLines[0] || ""), LINE_WIDTH));
    for (let i = 1; i < noteLines.length; i++) {
      lines.push(padRight("  " + noteLines[i], LINE_WIDTH));
    }
  }

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

  // Row 1: KEPADA YTH left + TANGGAL right
  const row1 = padRight("KEPADA YTH :", 40) + padLeft(tglStr, 40);
  // Row 2: client name (no label)
  const row2 = padRight(clientNm, LINE_WIDTH);

  // Look up client address
  const clientAddr = contacts.find(
    (c) => (c.name || "").toLowerCase() === clientNm.toLowerCase()
  )?.address?.trim();

  const lines = [row1, row2];

  if (clientAddr) {
    // Wrap address to 40 chars for left half of row 3
    const addrLines = wrapText(clientAddr, 40);
    // First address line left + plat right on same row
    lines.push(padRight(addrLines[0] || "", 40) + padLeft(platStr, 40));
    // Continuation address lines (no plat beside them)
    for (let i = 1; i < addrLines.length; i++) {
      lines.push(padRight(addrLines[i], LINE_WIDTH));
    }
  } else {
    // No address: blank left + plat right
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
    ...formatInvoiceHeader(s),
    ...formatInvoiceMeta(txs, contacts),
    ...formatItemsTable(txs),
    ...formatInvoiceFooter(txs, s, note),
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
