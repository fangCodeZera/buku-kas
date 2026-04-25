# src/utils/ — Function Reference & Date/UTC Rules

## Function Reference

---

### `src/utils/idGenerators.js` (171 lines)

```
function: generateId()
returns:  string — e.g. "1742000000000-abc1234" (timestamp + 7-char random suffix)
throws:   never
rules:    Use for all new entity IDs (transactions, contacts, adjustments, paymentHistory entries)
example:  id: generateId()
```

```
function: fmtIDR(n)
returns:  string — Indonesian Rupiah e.g. "Rp 5.215.000" using Intl.NumberFormat("id-ID")
throws:   never (handles null/undefined via || 0)
rules:    Always use for displaying monetary values. Never format manually.
example:  fmtIDR(t.value) → "Rp 5.215.000"
```

```
function: today()
returns:  string — YYYY-MM-DD in user's LOCAL timezone
throws:   never
rules:    Use for transaction.date, viewDate, form defaults.
          NEVER use for date arithmetic — use addDays/diffDays instead.
          NEVER mix with UTC — today() is local time.
example:  date: today()  →  "2026-03-15"
```

```
function: addDays(dateStr, days)
params:   dateStr: string (YYYY-MM-DD), days: number
returns:  string (YYYY-MM-DD) or null if input is invalid
throws:   never (wrapped in try/catch)
rules:    Uses T00:00:00Z and setUTCDate — always UTC, never local.
          Returns null on any error — always null-check the result.
example:  addDays("2026-03-15", 14) → "2026-03-29"
          addDays(null, 14)         → null
```

```
function: diffDays(date1Str, date2Str)
params:   date1Str: string (YYYY-MM-DD), date2Str: string (YYYY-MM-DD)
returns:  number (positive = date2 is in the future) or null on invalid input
throws:   never (wrapped in try/catch)
rules:    Both dates parsed as T00:00:00Z — UTC only.
          diffDays(today(), t.dueDate) → days until due (negative = overdue)
example:  diffDays("2026-03-15", "2026-03-29") → 14
          diffDays("2026-03-29", "2026-03-15") → -14
```

```
function: nowTime()
returns:  string — current local time as "HH:MM"
throws:   never
rules:    Use for paymentHistory[].time and transaction.time on creation.
example:  time: nowTime()  →  "14:30"
```

```
function: fmtDate(d)
params:   d: string (YYYY-MM-DD) or falsy
returns:  string — e.g. "15 Mar 2026" (Indonesian locale) or "-" if falsy
throws:   never
rules:    Always use for displaying dates. Never format dates manually.
          Parses as local midnight (T00:00:00 without Z) — correct for display.
          Source comment explains this intentional exception to the UTC rule: using
          local midnight is correct here because we want to show the date as the user
          entered it. Do NOT add Z — that would shift display dates in UTC+ zones.
example:  fmtDate("2026-03-15") → "15 Mar 2026"
          fmtDate(null)         → "-"
```

```
function: normItem(s)
params:   s: string or falsy
returns:  string — trimmed, lowercase. e.g. "bawang merah"
throws:   never
rules:    Use ONLY as stockMap key or for name comparison. Never display a normItem result to users.
example:  normItem("Bawang Merah") → "bawang merah"
          normItem(null)            → ""
```

```
function: normalizeTitleCase(s)
params:   s: string or falsy
returns:  string — title-cased with PT/CV/UD/TB uppercased. e.g. "Bawang Merah"
throws:   never
rules:    Use for all counterparty/itemName/contact name storage.
          Applied in App.js normTx() before every save.
example:  normalizeTitleCase("bawang PUTIH") → "Bawang Putih"
          normalizeTitleCase("pt. sumber jaya") → "PT. Sumber Jaya"
```

```
function: generateTxnId(transactions, dateStr)
params:   transactions: Array (pass the FULL array — function filters to income internally),
          dateStr: string (YYYY-MM-DD)
returns:  string — e.g. "26-03-00009" (YY-MM-NNNNN serial)
throws:   never
rules:    ONLY call for income transactions. The serial is based on max existing serial
          for the same YY- prefix — not count (safe after deletions).
          Serial resets each year (based on YY prefix).
          Never call for expense transactions — they use manual supplier invoice no.
example:  generateTxnId(data.transactions, "2026-03-15") → "26-03-00009"
```

```
function: toCommaDisplay(digits)
params:   digits: string (raw digit string, no commas)
returns:  string — comma-formatted e.g. "5,000,000"
throws:   never
rules:    Used internally by RupiahInput. Rarely needed directly.
```

```
function: numToDisplay(n)
params:   n: number
returns:  string — comma-formatted e.g. "5,000,000"
throws:   never
rules:    Used internally by RupiahInput.
```

```
function: displayToNum(s)
params:   s: string — comma-formatted or raw digits
returns:  number — integer e.g. 5000000
throws:   never
rules:    Used internally by RupiahInput.
```

---

### `src/utils/statusUtils.js` (54 lines)

```
constant: STATUS
value:    { LUNAS: "Lunas", PARTIAL_INCOME: "Belum Lunas (Piutang)", PARTIAL_EXPENSE: "Belum Lunas (Utang)" }
rules:    Reference these constants — never write raw status strings in new code.
example:  status: STATUS.LUNAS
```

```
function: deriveStatus(type, isPartial)
params:   type: "income" | "expense", isPartial: boolean
returns:  string — one of STATUS.*
throws:   never
rules:    This is the ONLY place where status strings are written.
          Call whenever computing or updating a transaction's status.
example:  deriveStatus("income", true)  → "Belum Lunas (Piutang)"
          deriveStatus("expense", false) → "Lunas"
```

```
function: isUnpaid(status)
params:   status: string
returns:  boolean
throws:   never
rules:    Use instead of string comparison for AR/AP filtering.
example:  isUnpaid("Belum Lunas (Piutang)") → true
          isUnpaid("Lunas")                  → false
```

```
constant: LEGACY_STATUS_MAP
value:    Maps old v1/v2 status strings → new STATUS.* values (or null for ambiguous)
rules:    Used ONLY inside storage.js migrateData(). Do not use elsewhere.
```

---

### `src/utils/balanceUtils.js` (72 lines)

```
function: computeARandAP(transactions)
params:   transactions: Array
returns:  { ar: number, ap: number }
throws:   never
rules:    AR = sum of outstanding for income. AP = sum of outstanding for expense.
          Both represent UNPAID amounts only (outstanding > 0).
example:  computeARandAP(data.transactions) → { ar: 1500000, ap: 0 }
```

```
function: computeCashIncome(transactions)
params:   transactions: Array
returns:  number — sum of (value - outstanding) for all income transactions
throws:   never
rules:    Cash-basis only — does NOT count uncollected outstanding amounts.
```

```
function: computeCashExpense(transactions)
params:   transactions: Array
returns:  number — sum of (value - outstanding) for all expense transactions
throws:   never
rules:    Cash-basis only.
```

```
function: computeNetCash(transactions)
params:   transactions: Array
returns:  number — computeCashIncome - computeCashExpense
throws:   never
```

---

### `src/utils/stockUtils.js` (114 lines)

```
function: computeStockMap(transactions, stockAdjustments = [])
params:   transactions: Array, stockAdjustments: Array (required — pass [] if none)
returns:  Object — { [normalizedItemName]: { displayName, qty, unit, lastDate, lastTime, txCount } }
throws:   never
rules:    ALWAYS pass both arguments. Never omit stockAdjustments.
          expense (+qty), income (-qty). Processes chronologically (oldest first).
          Uses normItem() as key — never use displayName as a key.
          stockAdjustments applied after transactions; sorted by date.
example:  computeStockMap(data.transactions, data.stockAdjustments)
          → { "bawang merah": { displayName: "Bawang Merah", qty: 45, unit: "karung", ... } }
```

```
function: computeStockMapForDate(transactions, viewDate, stockAdjustments = [])
params:   transactions: Array, viewDate: string (YYYY-MM-DD), stockAdjustments: Array
returns:  Object — same shape as computeStockMap but filtered to date <= viewDate
throws:   never
rules:    Used by Inventory.js for historical stock view.
          viewDate is inclusive (transactions ON that date are included).
          Simply filters both arrays then calls computeStockMap.
example:  computeStockMapForDate(data.transactions, "2026-03-01", data.stockAdjustments)
```

---

### `src/utils/reportUtils.js` (57 lines)

```
constant: EDIT_NOTES
value:    Set<string> — { "Detail Perubahan", "Transaksi diedit — nilai diperbarui" }
rules:    Shared across App.js, Reports.js, and ReportModal.js. Do NOT declare locally.
          Import via: import { EDIT_NOTES } from "../utils/reportUtils";
          Any new edit note type written in App.js editTransaction must be added here.
          Purpose: exclude edit-metadata entries (amount=0) from alreadyPaid sums and
          grand total payment counts. The amount>0 guard is a secondary safety net.
```

```
function: getMultiItemContribution(t, selItems)
params:   t: transaction object, selItems: string[] (active item filter names)
returns:  { filteredItems, otherItems, combinedSubtotal, combinedProportionalOutstanding,
            combinedCashValue, totalTransactionValue, totalOutstanding } | null
throws:   never
rules:    Returns null when: selItems is empty, transaction has ≤1 item, all items match filter,
          or no items match filter. Only returns non-null when there is a genuine MIX
          (some items match, some don't). Division guarded: totalTransactionValue > 0 ? ... : 0.
          Used by Reports.js (screen table) and ReportModal.js (print modal) — shared utility
          to avoid duplication across page and component layers.
example:  getMultiItemContribution(t, ["Bawang Putih Goodfarmer"])
          → { combinedSubtotal: 900000, combinedCashValue: 900000, totalTransactionValue: 11900000, ... }
          getMultiItemContribution(t, [])  → null
          getMultiItemContribution(singleItemTx, ["Item"])  → null
```

---

### `src/utils/paymentUtils.js` (20 lines)

```
function: computePaymentProgress(value, outstanding)
params:   value: number (total transaction value),
          outstanding: number (remaining outstanding)
returns:  { percent: number } | null  (null if value is 0)
throws:   never
rules:    Uses Number() coercion + division zero-guard.
          percent = Math.round(((value - outstanding) / value) * 100)
example:  computePaymentProgress(5000000, 1500000) → { percent: 70 }
          computePaymentProgress(0, 0)              → null
```

---

### `src/utils/printUtils.js` (30 lines)

```
function: printWithPortal(htmlString)
params:   htmlString: string — full HTML to print (may include <style> tags)
returns:  void
throws:   never (fallback to window.print() if portal not found)
rules:    1. Sets innerHTML of #print-portal
          2. Adds body.print-portal-active class
          3. window.print() (synchronous — blocks until dialog closes)
          4. Cleans up in finally{}
          Components using this MUST use 100% inline styles on printable content.
          Do NOT use CSS class names in printed HTML — they won't resolve.
```

---

## The UTC vs Local Date Rule

This is the **most common bug source** in this codebase. Incorrect date handling causes off-by-1 errors in Jakarta (UTC+7) and other UTC+ timezones.

### USE UTC (`T00:00:00Z` + `getUTCDate` / `setUTCDate`)

```
addDays(dateStr, days)        — date arithmetic
diffDays(date1, date2)        — days between dates
dueDate calculations          — always UTC
Badge counts (todayMs)        — new Date(today() + "T00:00:00Z").getTime()
```

**Why:** Jakarta is UTC+7. `new Date("2026-03-15T00:00:00")` in Jakarta = `"2026-03-14T17:00:00Z"`. Adding 14 days UTC-aware gives `"2026-03-29"`. Without Z, you get `"2026-03-28"` — one day early.

### USE LOCAL (`getFullYear()` / `getMonth()` / `getDate()`)

```
today()                       — must return user's local date
transaction.date field        — what date the user sees on their clock
viewDate (TransactionPage/Inventory) — calendar date the user is viewing
```

**Why:** User in Jakarta at 2AM on March 15 sees "March 15" on their calendar. `new Date().toISOString().slice(0,10)` would return `"2026-03-14"` (UTC). Wrong.

### NEVER DO THIS

```js
// No Z = local time = off-by-1 in UTC+ zones
new Date(dateStr + "T00:00:00")

// Returns UTC date, not local
new Date().toISOString().slice(0, 10)
```

### Correct patterns (copy exactly from idGenerators.js)

```js
// Date arithmetic — always UTC:
const d = new Date(dateStr + "T00:00:00Z");  // Z mandatory
d.setUTCDate(d.getUTCDate() + days);          // UTC methods mandatory
return d.toISOString().slice(0, 10);

// Today's date — always local:
const now = new Date();
return [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");
```

**Exception:** `fmtDate()` parses as local midnight (T00:00:00 without Z) — this is intentional for display formatting and does not cause off-by-1 in display context. Do not change it.

---

## Stock Computation Rules

- `expense` transactions → `+qty` (purchase adds to stock)
- `income` transactions → `−qty` (sale removes from stock)
- Multi-item: use `items[]` if `Array.isArray(t.items) && t.items.length > 0`; fall back to `t.itemName`/`t.sackQty ?? t.stockQty ?? 0`
- Manual adjustments applied AFTER transaction-derived quantities
- Stock map key = `normItem(itemName)` (lowercase, trimmed) — never use displayName as key
- `computeStockMapForDate` filters by `date <= viewDate` (string comparison — YYYY-MM-DD format sorts correctly)

---

## Adding a New Utility Function

- [ ] Add to the correct file by domain:
  - ID/formatting/dates → `idGenerators.js`
  - Status → `statusUtils.js`
  - Balance/AR/AP → `balanceUtils.js`
  - Stock → `stockUtils.js`
  - Payment progress → `paymentUtils.js`
  - Print → `printUtils.js`
- [ ] Pure function — **no React imports, no component imports**
- [ ] Wrap date/number operations in `try/catch` returning `null` on failure
- [ ] Export with named export
- [ ] Write one JSDoc `@param` + `@returns` comment above the function
- [ ] Add to Function Reference section in this file
- [ ] Run `npm run build` — zero errors
