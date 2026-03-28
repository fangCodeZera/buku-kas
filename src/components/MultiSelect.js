/**
 * components/MultiSelect.js
 * Zero-dependency multi-select dropdown styled to match the BukuKas blue theme.
 *
 * Props:
 *   options        {string[]}          — full list of selectable values
 *   selected       {string[]}          — currently selected values
 *   onChange       (newSelected) => void
 *   placeholder    string              — shown when nothing selected
 *   allLabel       string              — label for "select all / clear" option
 *   searchable?    boolean             — show search box inside dropdown (default true)
 *   maxHeight?     number              — dropdown max-height px (default 220)
 */
import React, { useState, useRef, useEffect, useMemo } from "react";

const MultiSelect = ({
  options = [],
  selected = [],
  onChange,
  placeholder = "Pilih...",
  allLabel = "Semua",
  searchable = true,
  maxHeight = 220,
}) => {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef  = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search input when opening
  useEffect(() => {
    if (open && searchable && inputRef.current) inputRef.current.focus();
  }, [open, searchable]);

  const filtered = useMemo(() =>
    query.trim()
      ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
      : options,
    [options, query]
  );

  const allSelected = selected.length === options.length && options.length > 0;

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter((v) => v !== val));
    else onChange([...selected, val]);
  };

  const toggleAll = () => {
    onChange(allSelected ? [] : [...options]);
  };

  // Trigger label
  const triggerLabel = () => {
    if (selected.length === 0)          return <span className="ms-placeholder">{placeholder}</span>;
    if (selected.length === options.length) return <span className="ms-all-label">{allLabel}</span>;
    if (selected.length === 1)          return <span className="ms-value">{selected[0]}</span>;
    return <span className="ms-value">{selected.length} dipilih</span>;
  };

  return (
    <div className="ms-wrap" ref={wrapRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`ms-trigger${open ? " ms-trigger--open" : ""}${selected.length > 0 ? " ms-trigger--active" : ""}`}
        onClick={() => { setOpen((o) => !o); setQuery(""); }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {triggerLabel()}
        <span className={`ms-chevron${open ? " ms-chevron--open" : ""}`} aria-hidden="true">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="ms-dropdown" role="listbox" aria-multiselectable="true">
          {/* Search box */}
          {searchable && (
            <div className="ms-search-wrap">
              <input
                ref={inputRef}
                className="ms-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari..."
                aria-label="Cari opsi"
              />
              {query && (
                <button className="ms-search-clear" onClick={() => setQuery("")} aria-label="Hapus pencarian">✕</button>
              )}
            </div>
          )}

          {/* Select all row — only when no query active */}
          {!query && (
            <div
              className={`ms-option ms-option--all${allSelected ? " ms-option--checked" : ""}`}
              role="option"
              aria-selected={allSelected}
              onMouseDown={(e) => { e.preventDefault(); toggleAll(); }}
            >
              <span className="ms-checkbox" aria-hidden="true">{allSelected ? "☑" : "☐"}</span>
              <span>{allLabel}</span>
              {allSelected && <span className="ms-count-badge">{options.length}</span>}
            </div>
          )}

          {/* Divider */}
          {!query && <div className="ms-divider" />}

          {/* Options */}
          <div style={{ maxHeight, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div className="ms-empty">Tidak ditemukan</div>
            ) : (
              filtered.map((opt) => {
                const checked = selected.includes(opt);
                return (
                  <div
                    key={opt}
                    className={`ms-option${checked ? " ms-option--checked" : ""}`}
                    role="option"
                    aria-selected={checked}
                    onMouseDown={(e) => { e.preventDefault(); toggle(opt); }}
                  >
                    <span className="ms-checkbox" aria-hidden="true">{checked ? "☑" : "☐"}</span>
                    <span className="ms-option-label">{opt}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;