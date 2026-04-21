/**
 * utils/categoryUtils.js
 * Item category/group utilities for stock reports.
 * Pure functions — no React, no component imports.
 */
import { generateId, normItem } from "./idGenerators";

/**
 * Generate a short code from a single group name (no parent-child awareness).
 * Multi-word: first letter of each word, uppercase. "Bawang Putih" → "BP"
 * Single-word: consonants only, uppercase, capped at 4 chars. "Ketumbar" → "KTMB"
 *
 * Note: For parent-child-aware codes (e.g. "Lada" → LD, "Lada Mulya" → LDM),
 * use generateCodes() instead which processes all groups together.
 *
 * @param {string} groupName
 * @returns {string}
 */
export const generateCode = (groupName) => _generateBaseCode(groupName);

/** Internal base code generator */
const _generateBaseCode = (groupName) => {
  if (!groupName || !groupName.trim()) return "";
  const words = groupName.trim().split(/\s+/);

  if (words.length > 1) {
    // Multi-word: first letter of each word
    return words.map((w) => w.charAt(0).toUpperCase()).join("");
  }

  // Single-word: remove vowels, uppercase, cap at 4
  const consonants = words[0].replace(/[aeiouAEIOU]/g, "").toUpperCase();
  if (consonants.length <= 1) {
    // Too short — use first 2 characters of the word instead
    return words[0].slice(0, 2).toUpperCase();
  }
  return consonants.slice(0, 4);
};

/**
 * Generate codes for multiple groups with parent-child awareness.
 * If a multi-word group's leading words match another group's full name,
 * the child's code = parent's code + first letter of each remaining word.
 *
 * Example: ["Lada", "Lada Mulya"] → { "Lada": "LD", "Lada Mulya": "LDM" }
 *
 * @param {string[]} groupNames - array of group name strings
 * @returns {Object} map of groupName → code
 */
export const generateCodes = (groupNames) => {
  if (!Array.isArray(groupNames) || groupNames.length === 0) return {};

  // First pass: generate base codes for all groups
  const codes = {};
  for (const name of groupNames) {
    codes[name] = _generateBaseCode(name);
  }

  // Build a set of all group names (lowercased) for fast lookup
  const nameSet = new Set(groupNames.map((n) => n.toLowerCase()));

  // Second pass: for each multi-word group, check if a parent group exists
  for (const name of groupNames) {
    const words = name.trim().split(/\s+/);
    if (words.length < 2) continue;

    // Check prefixes from longest to shortest (excluding the full name itself)
    for (let i = words.length - 1; i >= 1; i--) {
      const parentName = words.slice(0, i).join(" ");
      if (nameSet.has(parentName.toLowerCase())) {
        // Found a parent — find its actual name (preserving case) to get its code
        const parentActual = groupNames.find(
          (n) => n.toLowerCase() === parentName.toLowerCase()
        );
        if (parentActual && codes[parentActual]) {
          const remainingWords = words.slice(i);
          const suffix = remainingWords
            .map((w) => w.charAt(0).toUpperCase())
            .join("");
          codes[name] = codes[parentActual] + suffix;
          break;
        }
      }
    }
  }

  return codes;
};

/** Strip quotes and parens from a word for prefix comparison */
const _cleanWord = (w) => w.replace(/["'()\u201C\u201D\u2018\u2019]/g, "");

/** Split displayName into cleaned words for prefix comparison */
const _cleanWords = (displayName) =>
  displayName.split(/\s+/).map(_cleanWord).filter(Boolean);

/**
 * Auto-detect item categories from a stockMap, preserving existing user overrides.
 *
 * Algorithm:
 *  1. Collect uncategorized items (not already in existingCategories)
 *  2. Group by longest shared word-level prefix (capped at 2 words)
 *     — words are cleaned (quotes/parens stripped) before prefix comparison
 *  3. Items whose full name equals a shared prefix become standalone groups
 *  4. Items with no shared prefix become single-item groups
 *  5. If a new group's name matches an existing category, items are merged
 *     into the existing category instead of creating a duplicate
 *
 * @param {Object} stockMap - keyed by normalized item name, values have .displayName
 * @param {Array}  existingCategories - previously saved category objects
 * @returns {Array} merged categories: existing (updated with merges) + new auto-detected
 */
export const autoDetectCategories = (stockMap, existingCategories = []) => {
  // Performance: O(n²) worst case for large item catalogs. Fine for <200 items.
  // If inventory grows beyond 500 items, consider memoizing separately
  // from date-dependent computations or adding a debounce.

  // Build set of already-categorized normalized item names
  const categorized = new Set();
  for (const cat of existingCategories) {
    for (const item of cat.items) {
      categorized.add(item);
    }
  }

  // Collect uncategorized items: { normName, displayName }
  const uncategorized = [];
  for (const normName of Object.keys(stockMap)) {
    if (!categorized.has(normName)) {
      uncategorized.push({
        normName,
        displayName: stockMap[normName].displayName || normName,
      });
    }
  }

  if (uncategorized.length === 0) return [...existingCategories];

  // Sort alphabetically by displayName for consistent prefix detection
  uncategorized.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Build prefix → set of normNames map (capped at 2 words)
  // Uses cleaned words (quotes/parens stripped) for prefix keys
  const prefixMap = {}; // cleaned prefix string → Set of normNames
  for (const item of uncategorized) {
    const words = _cleanWords(item.displayName);
    const maxPrefixWords = Math.min(words.length, 2);
    for (let i = 1; i <= maxPrefixWords; i++) {
      const prefix = words.slice(0, i).join(" ");
      if (!prefixMap[prefix]) prefixMap[prefix] = new Set();
      prefixMap[prefix].add(item.normName);
    }
  }

  // Build a lookup: normName → displayName
  const displayNameMap = {};
  for (const item of uncategorized) {
    displayNameMap[item.normName] = item.displayName;
  }

  // Also count items from existing categories toward prefix sharing,
  // so uncategorized items can be matched to existing group prefixes
  for (const cat of existingCategories) {
    const catWords = _cleanWords(cat.groupName);
    if (catWords.length === 0) continue;
    const catPrefix = catWords.slice(0, Math.min(catWords.length, 2)).join(" ");
    if (!prefixMap[catPrefix]) prefixMap[catPrefix] = new Set();
    for (const item of cat.items) {
      prefixMap[catPrefix].add(item);
    }
  }

  // For each item, find the longest prefix (up to 2 words) shared by 2+ items
  const itemGroup = {}; // normName → cleaned group prefix string
  for (const item of uncategorized) {
    const words = _cleanWords(item.displayName);
    let bestPrefix = null;

    // Check from longest to shortest prefix (up to 2 words)
    const maxPrefixWords = Math.min(words.length, 2);
    for (let i = maxPrefixWords; i >= 1; i--) {
      const prefix = words.slice(0, i).join(" ");
      if (prefixMap[prefix] && prefixMap[prefix].size >= 2) {
        bestPrefix = prefix;
        break;
      }
    }

    if (bestPrefix) {
      itemGroup[item.normName] = bestPrefix;
    } else {
      // No shared prefix — standalone group using full display name
      itemGroup[item.normName] = item.displayName;
    }
  }

  // Refinement pass: promote 1-word prefix groups to 2-word prefixes.
  // E.g. "Kacang Hijau India" and "Kacang Kupas 41/51" share "Kacang" (1 word) but their
  // 2-word prefixes differ — promote each to its 2-word group name.
  // Also handles single-member 1-word groups (e.g. "Bawang Putih" alone in "Bawang"
  // after siblings were assigned to "Bawang Merah") — promote to its 2-word name.
  const groupMembers = {}; // prefix → [normNames]
  for (const [normName, prefix] of Object.entries(itemGroup)) {
    if (!groupMembers[prefix]) groupMembers[prefix] = [];
    groupMembers[prefix].push(normName);
  }

  for (const [prefix, members] of Object.entries(groupMembers)) {
    const prefixWordCount = prefix.split(/\s+/).length;
    if (prefixWordCount !== 1) continue;

    // Single-member 1-word group: promote to its 2-word prefix (or full name if single-word item)
    if (members.length === 1) {
      const n = members[0];
      const words = _cleanWords(displayNameMap[n]);
      itemGroup[n] = words.length >= 2 ? words.slice(0, 2).join(" ") : displayNameMap[n];
      continue;
    }

    // Multi-member 1-word group: check if multi-word members have distinct 2-word prefixes.
    // Single-word items (e.g. "Lada") stay in the 1-word group — they don't have a 2-word prefix.
    const subPrefixes = {}; // 2-word prefix → [normNames]
    for (const n of members) {
      const words = _cleanWords(displayNameMap[n]);
      // Single-word items keep the current 1-word prefix (they belong to this group)
      const sub = words.length >= 2 ? words.slice(0, 2).join(" ") : prefix;
      if (!subPrefixes[sub]) subPrefixes[sub] = [];
      subPrefixes[sub].push(n);
    }
    // Only split if there are truly divergent 2-word prefixes among multi-word members
    // (ignoring single-word items that stay with the group prefix)
    const distinctSubs = Object.keys(subPrefixes).filter((s) => s !== prefix);
    if (distinctSubs.length > 1) {
      // Members have divergent 2-word prefixes — promote each to its 2-word group
      for (const [sub, subMembers] of Object.entries(subPrefixes)) {
        for (const n of subMembers) {
          itemGroup[n] = sub;
        }
      }
    }
  }

  // Collect groups: groupPrefix → [normNames]
  const finalGroups = {};
  for (const [normName, prefix] of Object.entries(itemGroup)) {
    if (!finalGroups[prefix]) finalGroups[prefix] = [];
    finalGroups[prefix].push(normName);
  }

  // Build a lookup: cleaned groupName → existing category index (case-insensitive)
  // for merging new items into existing groups instead of creating duplicates
  const existingGroupIndex = {}; // cleaned lowercase prefix → index in mergedCats
  const mergedCats = existingCategories.map((c) => ({ ...c, items: [...c.items] }));
  for (let i = 0; i < mergedCats.length; i++) {
    const cleanedKey = _cleanWords(mergedCats[i].groupName).join(" ").toLowerCase();
    if (cleanedKey) existingGroupIndex[cleanedKey] = i;
  }

  // Separate new groups into: merge-into-existing vs truly-new
  const trulyNewGroups = {};
  for (const [groupPrefix, items] of Object.entries(finalGroups)) {
    const lookupKey = groupPrefix.toLowerCase();
    if (lookupKey in existingGroupIndex) {
      // Merge items into the existing category (immutable — already cloned above)
      const idx = existingGroupIndex[lookupKey];
      const existingItems = new Set(mergedCats[idx].items);
      const newItems = items.filter((item) => !existingItems.has(item));
      if (newItems.length > 0) {
        mergedCats[idx] = {
          ...mergedCats[idx],
          items: [...mergedCats[idx].items, ...newItems].sort(),
        };
      }
    } else {
      trulyNewGroups[groupPrefix] = items;
    }
  }

  // Generate codes with parent-child awareness across all groups (existing + new)
  const allGroupNames = [
    ...mergedCats.map((c) => c.groupName),
    ...Object.keys(trulyNewGroups),
  ];
  const codeMap = generateCodes(allGroupNames);

  // Build category objects for truly new groups
  const newCategories = Object.entries(trulyNewGroups).map(([groupName, items]) => ({
    id: generateId(),
    groupName,
    code: codeMap[groupName] || _generateBaseCode(groupName),
    items: items.sort(), // consistent ordering
  }));

  // Sort new categories alphabetically by groupName
  newCategories.sort((a, b) => a.groupName.localeCompare(b.groupName));

  return [...mergedCats, ...newCategories];
};

/**
 * Find the category that contains a given normalized item name.
 *
 * @param {string} normalizedItemName - result of normItem(), e.g. "bawang putih kating"
 * @param {Array}  categories - array of category objects
 * @returns {Object|null} the matching category, or null if uncategorized
 */
export const getCategoryForItem = (normalizedItemName, categories) => {
  if (!normalizedItemName || !Array.isArray(categories)) return null;
  for (const cat of categories) {
    if (Array.isArray(cat.items) && cat.items.includes(normalizedItemName)) {
      return cat;
    }
  }
  return null;
};

/**
 * Returns true if another category (not catId) has the same normalized name.
 * Empty/blank names are never duplicates.
 * @param {Array} categories
 * @param {string} catId
 * @param {string} name
 */
export function isDuplicateCategoryName(categories, catId, name) {
  const normTarget = normItem(name.trim());
  if (!normTarget) return false;
  return categories.some(
    (c) => c.id !== catId && normItem(c.groupName) === normTarget
  );
}

/**
 * Returns true if another category (not catId) already uses this code.
 * Empty codes are never duplicates (multiple "" codes allowed).
 * @param {Array} categories
 * @param {string} catId
 * @param {string} code
 */
export function isDuplicateCategoryCode(categories, catId, code) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return false;
  return categories.some((c) => c.id !== catId && c.code === trimmed);
}

/**
 * Updates the code for editedCatId, then cascades the new code prefix to any
 * child category whose normalized name starts with the parent name + " ".
 *
 * Pure function — returns a new categories array. Does NOT mutate input.
 * Does NOT touch any manual-edit tracking ref — caller is responsible.
 *
 * @param {Array} categories
 * @param {string} editedCatId
 * @param {string} newCode
 * @returns {Array}
 */
export function cascadeCodeUpdate(categories, editedCatId, newCode) {
  const trimmed = newCode.trim().toUpperCase();
  const withEdit = categories.map((c) =>
    c.id === editedCatId ? { ...c, code: trimmed } : c
  );
  const editedGroup = withEdit.find((c) => c.id === editedCatId);
  if (!editedGroup) return withEdit;
  const editedName = editedGroup.groupName;
  const normEdited = normItem(editedName);
  if (!normEdited) return withEdit;
  return withEdit.map((c) => {
    if (c.id === editedCatId) return c;
    const normChild = normItem(c.groupName);
    if (!normChild.startsWith(normEdited + " ")) return c;
    const remainingWords = c.groupName.slice(editedName.length).trim().split(/\s+/);
    const suffix = remainingWords.map((w) => w[0].toUpperCase()).join("");
    return { ...c, code: trimmed + suffix };
  });
}
