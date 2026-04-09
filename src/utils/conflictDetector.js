// conflictDetector.js
// Phase 5: Detects write conflicts using version field.
// First write wins — second user's save is rejected
// if version mismatch detected.

import supabase from './supabaseClient';

/**
 * ConflictError
 * Thrown when a version mismatch is detected.
 * isConflict flag allows persistToSupabase to distinguish
 * this from a regular save error.
 */
export class ConflictError extends Error {
  constructor(updatedBy) {
    super(`CONFLICT:${updatedBy}`);
    this.name = 'ConflictError';
    this.isConflict = true;
    this.updatedBy = updatedBy;
  }
}

/**
 * checkVersion(table, id, expectedVersion)
 *
 * Before saving an edit, checks if the current version
 * in Supabase matches the version we loaded.
 *
 * Returns:
 *   { conflict: false } — safe to save
 *   { conflict: true, updatedBy } — conflict detected
 *
 * @param {string} table
 * @param {string} id
 * @param {number} expectedVersion
 * @returns {Promise<{ conflict: boolean, updatedBy?: string }>}
 */
export async function checkVersion(table, id, expectedVersion) {
  try {
    const { data, error } = await supabase
      .from(table)
      .select('version, updated_by, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      // PGRST116 = row not found = new record, no conflict
      if (error.code === 'PGRST116') {
        return { conflict: false };
      }
      // Other errors — let save proceed and fail naturally
      console.error('checkVersion error:', error);
      return { conflict: false };
    }

    if (!data) return { conflict: false };

    // Compare versions
    if (data.version !== expectedVersion) {
      // Version mismatch — fetch who made the change
      let updatedByName = 'Pengguna lain';
      if (data.updated_by) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.updated_by)
          .single();
        if (profile?.full_name) {
          updatedByName = profile.full_name;
        }
      }
      return {
        conflict: true,
        updatedBy: updatedByName,
      };
    }

    return { conflict: false };

  } catch (err) {
    // Never block a save due to version check failure
    console.error('checkVersion unexpected error:', err);
    return { conflict: false };
  }
}
