# src/utils/ — Function Reference & Date/UTC Rules

## Function Reference

---

### `src/utils/idGenerators.js`

```
function: generateId()
returns:  string — e.g. "1742000000000-abc1234" (timestamp + random suffix)
throws:   never
rules:    Use for all new entity IDs (transactions, contacts, adjustments, paymentHistory entries)
example:  id: generateId()
```

```
function: fmtIDR(n)
returns:  string — Indonesian Rupiah e.g. "Rp 5.215.000"
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
example:  fmtDate("2026-03-15") → "15 Mar 2026"
          fmtDate(null)         → "-"
```

```
function: normItem(s)
params:   s: string or falsy
returns:  string — trimmed, lowercase. e.g. "bawang merah"
throws:   never
rules:    Use ONLY as stockMap key. Never display a normItem result to users.
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
params:   transactions: Array (ONLY income transactions are counted internally),
          dateStr: string (YYYY-MM-DD)
returns:  string — e.g. "26-03-00009" (YY-MM-NNNNN serial)
throws:   never
rules:    ONLY call for income transactions. Pass the FULL transactions array —
          the function internally filters to type === "income" only.
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
example:  toCommaDisplay("5000000") → "5,000,000"
```

```
function: numToDisplay(n)
params:   n: number
returns:  string — comma-formatted e.g. "5,000,000"
throws:   never
rules:    Used internally by RupiahInput.
example:  numToDisplay(5000000) → "5,000,000"
```

```
function: displayToNum(s)
params:   s: string — comma-formatted or raw digits
returns:  number — integer e.g. 5000000
throws:   never
rules:    Used internally by RupiahInput.
example:  displayToNum("5,000,000") → 5000000
```

---

### `src/utils/statusUtils.js`

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

### `src/utils/balanceUtils.js`

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
example:  computeCashIncome(data.transactions) → 3715000
```

```
function: computeCashExpense(transactions)
params:   transactions: Array
returns:  number — sum of (value - outstanding) for all expense transactions
throws:   never
rules:    Cash-basis only.
example:  computeCashExpense(data.transactions) → 2000000
```

```
function: computeNetCash(transactions)
params:   transactions: Array
returns:  number — computeCashIncome - computeCashExpense
throws:   never
example:  computeNetCash(data.transactions) → 1715000
```

---

### `src/utils/stockUtils.js`

```
function: computeStockMap(transactions, stockAdjustments = [])
params:   transactions: Array, stockAdjustments: Array (optional, defaults to [])
returns:  Object — { [normalizedItemName]: { displayName, qty, unit, lastDate, lastTime, txCount } }
throws:   never
rules:    ALWAYS pass both arguments. Never omit stockAdjustments.
          expense (+qty), income (-qty). Processes chronologically.
          Uses normItem() as key — never use displayName as a key.
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
example:  computeStockMapForDate(data.transactions, "2026-03-01", data.stockAdjustments)
```

---

### `src/utils/categoryUtils.js`

```
function: generateCode(groupName)
params:   groupName: string
returns:  string — short uppercase code. e.g. "BP" for "Bawang Putih"
throws:   never
rules:    Multi-word: first letter of each word. Single-word: consonants, capped at 4.
          For parent-child-aware codes, use generateCodes() instead.
example:  generateCode("Bawang Putih") → "BP"
          generateCode("Ketumbar")     → "KTMB"
```

```
function: generateCodes(groupNames)
params:   groupNames: string[] — array of group name strings
returns:  Object — { [groupName]: code } map with parent-child awareness
throws:   never
rules:    If "Lada Mulya" has parent "Lada", child code = parent code + suffix.
          Process all groups together for consistent results.
example:  generateCodes(["Lada", "Lada Mulya"]) → { "Lada": "LD", "Lada Mulya": "LDM" }
```

```
function: autoDetectCategories(stockMap, existingCategories)
params:   stockMap: Object (keyed by normalized item name),
          existingCategories: Array (default [])
returns:  Array — merged categories: existing (updated) + new auto-detected
throws:   never
rules:    Groups uncategorized items by shared word-level prefix (capped at 2 words).
          Merges into existing categories when group name matches.
          Preserves user overrides in existingCategories.
example:  autoDetectCategories(stockMap, []) → [{ id, groupName: "Bawang Merah", code: "BM", items: [...] }, ...]
```

```
function: getCategoryForItem(normalizedItemName, categories)
params:   normalizedItemName: string (output of normItem()),
          categories: Array
returns:  Object | null — matching category, or null if uncategorized
throws:   never
rules:    Linear scan through categories[].items. Returns first match.
example:  getCategoryForItem("bawang putih kating", categories) → { id, groupName: "Bawang Putih", ... }
```

---

### `src/utils/paymentUtils.js`

```
function: computePaymentProgress(value, outstanding)
params:   value: number (total transaction value),
          outstanding: number (remaining outstanding)
returns:  { percent: number } | null (null if value is 0)
throws:   never
rules:    Uses Number() coercion + division zero-guard.
          percent = Math.round(((value - outstanding) / value) * 100)
example:  computePaymentProgress(5000000, 1500000) → { percent: 70 }
          computePaymentProgress(0, 0)              → null
```

---

## The UTC vs Local Date Rule

This is the **most common bug source** in this codebase. Incorrect date handling causes off-by-1 errors in Jakarta (UTC+7) and other UTC+ timezones.

### USE UTC (`T00:00:00Z` + `getUTCDate` / `setUTCDate`)

```
✓ addDays(dateStr, days)        — date arithmetic
✓ diffDays(date1, date2)        — days between dates
✓ dueDate calculations          — always UTC
✓ Any "date + N days" operation
```

**Why:** Jakarta is UTC+7. `new Date("2026-03-15T00:00:00")` in Jakarta = `"2026-03-14T17:00:00Z"`. Adding 14 days UTC-aware gives `"2026-03-29"`. Without Z, you get `"2026-03-28"` — one day early.

### USE LOCAL (`getFullYear()` / `getMonth()` / `getDate()`)

```
✓ today()                       — must return user's local date
✓ transaction.date field        — what date the user sees on their clock
✓ viewDate (Dashboard/Inventory) — calendar date the user is viewing
```

**Why:** User in Jakarta at 2AM on March 15 sees "March 15" on their calendar. `new Date().toISOString().slice(0,10)` would return `"2026-03-14"` (UTC). Wrong.

### NEVER DO THIS

```js
// ✗ No Z = local time = off-by-1 in UTC+ zones
new Date(dateStr + "T00:00:00")

// ✗ Returns UTC date, not local
new Date().toISOString().slice(0, 10)

// ✗ Returns UTC date
new Date().toUTCString().slice(5, 16)

// ✗ Local midnight arithmetic (unreliable across DST)
new Date(date).setDate(new Date(date).getDate() + days)
```

### Correct pattern (copy exactly from idGenerators.js)

```js
// Date arithmetic — always UTC:
const d = new Date(dateStr + "T00:00:00Z");  // ← Z mandatory
d.setUTCDate(d.getUTCDate() + days);          // ← UTC methods mandatory
return d.toISOString().slice(0, 10);

// Today's date — always local:
const now = new Date();
return [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");
```

---

## Adding a New Utility Function

- [ ] Add to the correct file by domain:
  - ID/formatting/dates → `idGenerators.js`
  - Status → `statusUtils.js`
  - Balance/AR/AP → `balanceUtils.js`
  - Stock → `stockUtils.js`
- [ ] Pure function — **no React imports, no component imports**
- [ ] Wrap date/number operations in `try/catch` returning `null` on failure
- [ ] Export with named export
- [ ] Write one JSDoc `@param` + `@returns` comment above the function
- [ ] Add to Function Reference section in this file
- [ ] Run `npm run build` — zero errors
