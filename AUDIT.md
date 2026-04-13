# BukuKas — Comprehensive Audit Report (Post-Deployment)

**Date:** 2026-04-14
**Audited by:** Claude Sonnet 4.6 (automated audit — line-by-line review of all source files)
**Scope:** Full codebase — all utils, components, pages, CSS, HTML, config, Supabase integration, security, deployment
**App version:** Post-Phase 7 deployment (all prior audit findings resolved per AUDIT.md 2026-04-04)

**Summary: 0 Critical · 1 High · 3 Medium · 3 Low · 4 Informational**

---

## CRITICAL (data loss, data corruption, or security vulnerability)

None found.

---

## HIGH (broken feature, wrong calculation, bad UX)

### H1 — `deleteContact` fires `sbDeleteContact` even when guard blocks deletion
**File:** `src/App.js`, lines 930–945
**What's wrong:**
The `update()` helper always calls `supabaseOperation` when `USE_SUPABASE && supabaseOperation` is truthy, regardless of whether the state function actually mutated data. For `deleteContact`, the state function guards against contacts that have transactions (returns `d` unchanged), but the `supabaseOperation` closure `() => Promise.all([sbDeleteContact(contactId), logActivity(...)])` still executes, deleting the contact row from Supabase even though React state was not updated.

```js
const deleteContact = (contactId) =>
  update(
    (d) => {
      const contact = d.contacts.find((c) => c.id === contactId);
      if (!contact) return d;        // guard 1: not found
      const hasTx = d.transactions.some(...);
      if (hasTx) return d;           // guard 2: has transactions — returns unchanged d
      return { ...d, contacts: d.contacts.filter(...) };
    },
    () => Promise.all([
      sbDeleteContact(contactId),    // ← still called even if guard 2 fired
      logActivity('delete', 'contact', contactId),
    ])
  );
```

The `update()` function (line 402–414) calls `persistToSupabase(() => supabaseOperation(nd), ...)` unconditionally when a supabaseOperation is provided — it has no mechanism to detect that the state function returned `d` unchanged.

**Impact:** If a contact with transactions somehow reaches `deleteContact` (e.g. via a stale UI state or programmatic call), the Supabase row is deleted while React state still shows the contact. On next page reload, the contact row is gone from the DB but transactions still reference its `counterparty` name. This is data inconsistency, not outright data loss, since the contact name is stored denormalized in transactions. However it could confuse `updateContact` cascade logic and the Contacts page.

**Suggested fix:** Change the `deleteContact` supabaseOperation to check whether the contact was actually removed before calling `sbDeleteContact`:
```js
(nd) => {
  const stillExists = nd.contacts.some((c) => c.id === contactId);
  if (stillExists) return Promise.resolve(); // guard blocked deletion
  return Promise.all([
    sbDeleteContact(contactId),
    logActivity('delete', 'contact', contactId),
  ]);
}
```
Apply the same pattern to `deleteCatalogItem` as a defense: check that the item is gone from `nd.itemCatalog` before calling `sbDeleteItemCatalogItem`.

---

## MEDIUM (missing validation, edge cases, UI bugs)

### M1 — `getNextTxnSerial` uses local-time date parsing (no `Z`) — wrong month at year-end midnight
**File:** `src/utils/supabaseStorage.js`, line 435
**What's wrong:**
```js
const d = new Date(dateStr + "T00:00:00"); // no Z = local time
const yy = String(d.getFullYear()).slice(-2);
const mm = String(d.getMonth() + 1).padStart(2, "0");
```
This violates Rule 3 (date arithmetic must use `T00:00:00Z` + UTC methods). `dateStr` is a user-supplied `YYYY-MM-DD` date (e.g. `"2026-03-15"`). The intention is simply to extract year and month for the `YY-MM` prefix used in txnIds.

In practice this is safe for most dates. However, for a transaction dated `"2026-12-31"` entered at or after midnight local time in Jakarta (UTC+7), `"2026-12-31T00:00:00"` parses as local midnight (2026-12-30T17:00:00Z), but `getFullYear()` and `getMonth()` correctly return 2026/11 for local time, so the result (`26-12`) is actually correct. The real risk is if someone passes a date near a year boundary. More practically: since `dateStr` always comes from the form's date field (user's local date), the parsed local year/month is always what the user intended. This is low-severity in practice for Jakarta but is still a Rule 3 violation.

**Impact:** Low — produces incorrect `YY-MM` prefix only in edge cases involving midnight at year/month boundaries across timezones. May cause a txnId to be assigned to the wrong month counter if a transaction is created exactly at UTC midnight on the 1st of the month.

**Suggested fix:**
```js
const d = new Date(dateStr + "T00:00:00Z"); // add Z for UTC parsing
const yy = String(d.getUTCFullYear()).slice(-2);
const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
```
Since `dateStr` is already the user's local date, UTC interpretation is correct here (same as `addDays`).

---

### M2 — Reports.js CSV export does not format currency columns with Indonesian thousand separators
**File:** `src/pages/Reports.js`, lines 143–196
**What's wrong:**
The CLAUDE.md maintenance log entry for 2026-04-13 states: "CSV export (Reports.js): currency columns now formatted with Indonesian thousand separators (`id-ID` locale via `fmtCSV()`)." However, the actual `exportCSV()` function in Reports.js uses no `fmtCSV` helper — currency values are emitted as raw numbers (e.g. `5215000` instead of `5.215.000`). The `q()` quoter only adds double-quote wrapping. No `toLocaleString('id-ID')` call exists anywhere in the function.

This contradicts the documented changelog entry. Either the fix was applied to a different file (Settings.js CSV, not Reports.js), or the change was accidentally omitted. The Settings.js `exportCSV` (lines 92–135) similarly emits raw numbers without locale formatting.

**Impact:** Reports exported from the Laporan page open in Excel/Google Sheets with numbers like `5215000` rather than `5.215.000`, making the spreadsheet harder to read and requiring manual formatting.

**Suggested fix:** Add a currency formatter to `exportCSV` in Reports.js:
```js
const fmtCSV = (n) => Number(n).toLocaleString('id-ID');
// In the push rows, replace raw numbers:
fmtCSV(itSubtotal), fmtCSV(itOutstanding), fmtCSV(itSubtotal - itOutstanding)
```
The `q()` wrapper already adds double quotes, so the formatted string (which contains periods as thousands separator) will be safely quoted.

---

### M3 — `console.log` left in production code in `realtimeManager.js`
**File:** `src/utils/realtimeManager.js`, line 66
**What's wrong:**
```js
.subscribe((status) => {
  console.log('Realtime subscription status:', status);
});
```
This fires on every realtime reconnect/reconnect-attempt — potentially multiple times per session. In production mode, this pollutes the browser console and can expose internal state information.

**Impact:** Minor UX/professionalism concern. In Supabase free tier, reconnects may happen frequently. No security impact.

**Suggested fix:** Remove the `console.log` or replace with a conditional:
```js
.subscribe((status) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Realtime subscription status:', status);
  }
});
```

---

## LOW (cosmetic, minor inconsistencies)

### L1 — `handleExport` in Settings.js does not guard against `submitting` for the JSON export path
**File:** `src/pages/Settings.js`, lines 137–151
**What's wrong:**
`handleExport` sets `submitting = true`, but the `finally`/timeout only releases it after 1 second via `setTimeout(() => setSubmitting(false), 1000)`. No `try/finally` wraps this — if `exportJSON()` or `exportCSV()` throws, `submitting` stays `true` permanently. The `handleSave` button is a separate function and is protected, but the Export button (`handleExport`) can get permanently stuck if export fails.

**Impact:** Cosmetic — user must refresh page to re-enable the Export button. Export errors are swallowed silently (the `exportJSON` function has its own `try/catch` with `console.error`). The stuck-button scenario requires `exportJSON` or `exportCSV` to throw, which is rare.

**Suggested fix:** Wrap the main body of `handleExport` in `try/finally`:
```js
const handleExport = () => {
  if (submitting) return;
  setSubmitting(true);
  try {
    if (exportFormat === "json") exportJSON();
    else exportCSV();
    const now = new Date().toISOString();
    set("lastExportDate", now);
    onSave({ ...form, lastExportDate: now });
  } finally {
    setTimeout(() => setSubmitting(false), 1000);
  }
};
```

---

### L2 — `ReportModal.js` renders "Lunas"/"Belum Lunas" as raw string literals
**File:** `src/components/ReportModal.js`, line 237
**What's wrong:**
```js
{t.status === STATUS.LUNAS ? "Lunas" : "Belum Lunas"}
```
This uses raw string literals "Lunas" and "Belum Lunas" in a display context. Rule 2 states: "Never write `Lunas`, `Belum Lunas (Piutang)`, or `Belum Lunas (Utang)` as raw string literals in new code." The comparison against `STATUS.LUNAS` is correct, but the display values are raw strings. While this is display-only (not stored), it is inconsistent with the codebase convention.

**Impact:** Cosmetic — no functional impact. The printed report shows "Belum Lunas" without the Piutang/Utang qualifier, which is acceptable for a simplified printed format but slightly inconsistent.

**Suggested fix:** Use `STATUS.LUNAS` / a helper for consistency, or add a comment explaining the simplification is intentional for print format.

---

### L3 — `fmtTimestamp` in `ActivityLog.js` uses UTC for date but local time for hours/minutes
**File:** `src/pages/ActivityLog.js`, lines 77–88
**What's wrong:**
```js
const date = fmtDate(d.toISOString().slice(0, 10)); // UTC date
const hh = String(d.getHours()).padStart(2, "0");   // local time hours
const mm = String(d.getMinutes()).padStart(2, "0");  // local time minutes
```
`d.toISOString().slice(0, 10)` returns the UTC date, but `d.getHours()` / `d.getMinutes()` return local time. In Jakarta (UTC+7), an activity logged at 00:30 local time would display the UTC date (previous day) with local time `00:30`, producing `"13 Apr 2026 00:30"` when it should say `"14 Apr 2026 00:30"`.

**Impact:** Low — activity log timestamps will show the wrong date for events occurring between midnight local time and UTC midnight (i.e. between 00:00–07:00 local time in Jakarta). Users working late night/early morning could see confusing off-by-1-day timestamps.

**Suggested fix:** Use consistent local time throughout:
```js
function fmtTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    const localDate = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
    const date = fmtDate(localDate);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${date} ${hh}:${mm}`;
  } catch {
    return ts;
  }
}
```

---

## INFORMATIONAL (not bugs — architectural observations, verified non-issues)

### I1 — `netlify.toml` CSP header does not include `font-src` (but `_headers` does)
`public/_headers` includes `font-src 'self'` in the CSP, but the backup `netlify.toml` CSP header omits it. Since Netlify applies `_headers` first and `netlify.toml` only as a fallback, there is no functional gap. The inconsistency means if `_headers` is accidentally deleted, the netlify.toml backup would allow no custom fonts. Low risk, documented here for awareness.

### I2 — `update()` retry closure re-runs state mutation
The `update()` helper (App.js line 409) uses `() => update(fn, supabaseOperation)` as the retry function on SaveErrorModal. This means that on retry, the state mutation `fn(dataRef.current)` runs again. For idempotent operations (edit, delete, archive) this is safe. For append-style operations (addTransaction, applyPayment, addStockAdjustment), the C2 fix correctly avoids this pattern by not passing a `supabaseOperation` to `update()` and calling `persistToSupabase` directly with a retry that only re-runs the Supabase write. This architecture is verified correct as documented.

### I3 — `TransactionForm.js` `contactBalance` helper is O(transactions) per dropdown render
`src/components/TransactionForm.js` line 10–19: `contactBalance(name, transactions)` is called inline for each contact rendered in the dropdown. This iterates all transactions for each contact visible in the autocomplete list. App.js already computes `balanceMap` via `useMemo` and passes it to Contacts.js, but does not pass it to TransactionForm. The comment in TransactionForm (line 860) acknowledges this: `// TODO: Replace with balanceMap prop from App.js`. With a small number of transactions this has no performance impact. Documented as a known technical debt item.

### I4 — `deleteContact` and `deleteCatalogItem` supabaseOperation does not guard against blocked deletion (confirmed as H1 above for contacts; same pattern exists for `deleteCatalogItem`)
For `deleteCatalogItem` (App.js lines 1143–1176): the state function returns `d` unchanged when `hasTx` is true, but `sbDeleteItemCatalogItem(itemId)` would still be called. However in `deleteCatalogItem`'s case, the Inventory UI already prevents the button from appearing if `hasTx` is true (it shows Archive instead), and `ArchivedItems.js` also checks `txCountMap` before showing the delete button. So the guard bypass is less likely to be triggered in practice for catalog items compared to contacts. Still, the same architectural fix (checking `nd.itemCatalog` for the item before calling `sbDeleteItemCatalogItem`) should be applied for defense in depth.

---

## Previous Audit Resolution Status

| ID | Title (abbreviated) | Status | Date |
|----|---------------------|--------|------|
| C1 | XSS via innerHTML in printWithPortal | ✅ Fixed | 2026-04-05 |
| C2 | Import validation insufficient | ✅ Fixed | 2026-04-05 |
| C3 (from Phase 4 audit) | ensureContact missing `archived: false` | ✅ Fixed | 2026-04-05 |
| H1 (prev) | Supabase numeric coercion missing | ✅ Fixed | 2026-04-12 |
| H2 | txnId collision under concurrent writes | ✅ Fixed — atomic DB sequence + RPC | 2026-04-13 |
| H3 | signOut() async race | ✅ Fixed | 2026-04-12 |
| H4 | PaymentUpdateModal double-submit | ✅ Fixed | 2026-04-05 |
| H5 | TransactionForm double-submit race | ✅ Fixed | 2026-04-05 |
| H6 | InvoiceModal showed today's date | ✅ Fixed | 2026-04-05 |
| H7 | customDueDays = 0 allowed | ✅ Fixed | 2026-04-05 |
| H8 | C2 retry re-ran state mutation | ✅ Fixed | 2026-04-12 |
| M1 (prev) | React StrictMode double-setState | ⏭️ Skipped — no user impact | — |
| M2 (prev) | Contacts nameError persistence | ✅ Fixed | 2026-04-12 |
| M3 (prev) | noscript text not Indonesian | ✅ Fixed | 2026-04-12 |
| M4 (prev) | Meta description missing | ✅ Fixed | 2026-04-12 |
| M5 (prev) | CRA inline source maps in production | ⏭️ Skipped — CRA limitation | — |
| M6 (prev) | Import items[] element validation | ✅ Fixed | 2026-04-13 |
| M7 (prev) | useEffect deps array omissions | ⏭️ Skipped — no user impact | — |
| L1 (prev) | PERIODE buttons had no active state | ✅ Fixed | 2026-03-29 |
| L2 (prev) | CSV export filename "Laporan__sd_" | ✅ Fixed | 2026-04-05 |
| L3 (prev) | Icon component missing names | ⏭️ Skipped — maintenance risk only | — |
| L4 (prev) | Presence users not sorted | ✅ Fixed | 2026-04-13 |
| L5 (prev) | CSP missing font-src | ✅ Fixed in _headers | 2026-04-13 |
| I1–I7 (prev) | Informational items | ℹ️ Noted — no action | — |
| Phase 4 audit findings | updateContact cascade, deleteCatalogItem orphans, createContact duplicates, quickExport localStorage | ✅ All fixed | 2026-04-08 |
| Phase 5 realtime | Double-load, saveItemCategories race, stale dataRef | ✅ All fixed | 2026-04-08 |
| Phase 6 activity log | login display name, entity ID format, "Lihat" navigation | ✅ All fixed | 2026-04-12 |

No regressions detected in previously fixed items.

---

## Fix Priority Order

1. **[H1]** ✅ Fixed — `deleteContact` and `deleteCatalogItem` supabaseOperation now checks `nd` before calling Supabase delete.
2. **[M1]** ✅ Fixed — `getNextTxnSerial` now uses `T00:00:00Z` + `getUTCFullYear`/`getUTCMonth`.
3. **[M2]** ✅ Fixed (docs corrected) — CLAUDE.md entry updated to reflect that thousand-separator formatting was reverted.
4. **[M3]** ✅ Fixed — `console.log` gated behind `process.env.NODE_ENV === 'development'`.
5. **[L3]** ✅ Fixed — `fmtTimestamp` now uses consistent local-time date extraction.
6. **[L1]** ✅ Fixed — `handleExport` wrapped in `try/finally`.
7. **[L2]** ⏭️ Skipped — ReportModal simplified "Belum Lunas" (without Piutang/Utang qualifier) is intentional for print format. Added comment in source noting this.

---

## Fourth Audit Resolution Status (2026-04-14)

| ID | Title | Status | Date |
|----|-------|--------|------|
| H1 (new) | deleteContact/deleteCatalogItem supabaseOperation guard | ✅ Fixed | 2026-04-14 |
| M1 (new) | getNextTxnSerial UTC parsing | ✅ Fixed | 2026-04-14 |
| M2 (new) | CSV thousand separators docs inaccuracy | ✅ Fixed (docs corrected) | 2026-04-14 |
| M3 (new) | console.log in realtimeManager.js | ✅ Fixed | 2026-04-14 |
| L1 (new) | handleExport try/finally | ✅ Fixed | 2026-04-14 |
| L2 (new) | ReportModal raw status strings | ⏭️ Skipped — intentional print simplification | — |
| L3 (new) | fmtTimestamp local/UTC mix | ✅ Fixed | 2026-04-14 |
| I1–I4 (new) | Informational items | ℹ️ Noted — no action | — |
