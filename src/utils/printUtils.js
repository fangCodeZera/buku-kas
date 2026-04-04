/**
 * utils/printUtils.js
 * Prints HTML content via #print-portal (outside #root).
 *
 * How it works:
 *   1. Sets innerHTML of #print-portal to the provided HTML string
 *   2. Adds body.print-portal-active class — @media print CSS then hides
 *      #root and shows #print-portal (no screen effect, class-only scoped)
 *   3. window.print() is SYNCHRONOUS — blocks until dialog closes
 *   4. Removes class + clears portal in finally{} — zero double-fire risk
 *
 * @param {string} htmlString — full HTML to print (may include <style> tags)
 */
/**
 * Escapes HTML special characters for safe insertion into raw HTML strings built
 * via template literals outside of React's rendering pipeline.
 * NOTE: Not needed for React JSX text nodes — React escapes those automatically
 * before .outerHTML serialization. Applying this to JSX {variables} would cause
 * double-encoding and display literal entities (e.g. &amp;) to users.
 * @param {*} str
 * @returns {string}
 */
export const escapeHtml = (str) =>
  String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const printWithPortal = (htmlString) => {
  const portal = document.getElementById("print-portal");
  if (!portal) {
    // Fallback: no portal div found (shouldn't happen in prod)
    console.error("printWithPortal: #print-portal not found in DOM");
    window.print();
    return;
  }
  portal.innerHTML = htmlString;
  document.body.classList.add("print-portal-active");
  try {
    window.print();
  } finally {
    document.body.classList.remove("print-portal-active");
    portal.innerHTML = "";
  }
};
