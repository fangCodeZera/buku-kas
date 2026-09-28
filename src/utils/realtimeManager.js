// realtimeManager.js
// Phase 5: Manages Supabase Realtime subscriptions for
// live data sync across all users.
// Subscribes to: transactions, contacts,
//   stock_adjustments, item_catalog
// Does NOT subscribe to: item_categories, app_settings

import supabase from './supabaseClient';

/**
 * subscribeToChanges(onUpdate)
 *
 * Sets up realtime subscriptions for all 4 tables.
 * onUpdate is called with (table, eventType, record)
 * whenever a change is detected.
 *
 * eventType: 'INSERT' | 'UPDATE' | 'DELETE'
 * record: the new record (for INSERT/UPDATE) or
 *         old record (for DELETE)
 *
 * Returns a cleanup function that removes all subscriptions.
 *
 * T110: onStatus (optional) receives every subscription state change —
 * 'SUBSCRIBED' | 'TIMED_OUT' | 'CLOSED' | 'CHANNEL_ERROR'. These were previously
 * logged in development only and discarded in production, so a dead sync channel
 * was completely invisible to the user. Callers must tolerate a trailing 'CLOSED'
 * arriving after their own cleanup ran (removeChannel triggers it).
 *
 * @param {(table: string, eventType: string, record: Object) => void} onUpdate
 * @param {(status: string, err?: Error) => void} [onStatus]
 * @returns {() => void} cleanup function
 */
export function subscribeToChanges(onUpdate, onStatus) {
  const channel = supabase
    .channel('bukukas-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions' },
      (payload) => onUpdate(
        'transactions',
        payload.eventType,
        payload.new || payload.old
      )
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'contacts' },
      (payload) => onUpdate(
        'contacts',
        payload.eventType,
        payload.new || payload.old
      )
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'stock_adjustments' },
      (payload) => onUpdate(
        'stock_adjustments',
        payload.eventType,
        payload.new || payload.old
      )
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'item_catalog' },
      (payload) => onUpdate(
        'item_catalog',
        payload.eventType,
        payload.new || payload.old
      )
    )
    .subscribe((status, err) => {
      if (process.env.NODE_ENV === 'development') {
        console.log('Realtime subscription status:', status, err || '');
      }
      if (onStatus) onStatus(status, err);
    });

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * subscribeToPresence(userId, userInfo, onPresenceChange)
 *
 * Tracks which users are currently online.
 * userInfo: { id, name, role }
 * onPresenceChange: called with array of online users
 *   [{ id, name, role }] whenever someone joins/leaves
 *
 * Returns a cleanup function.
 *
 * @param {string} userId
 * @param {{ id: string, name: string, role: string }} userInfo
 * @param {(users: Array<{ id: string, name: string, role: string }>) => void} onPresenceChange
 * @returns {() => void} cleanup function
 */
export function subscribeToPresence(userId, userInfo, onPresenceChange) {
  const channel = supabase.channel('bukukas-presence', {
    config: { presence: { key: userId } },
  });

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const seen = new Set();
      const onlineUsers = Object.values(state)
        .flat()
        .map((u) => ({ id: u.id, name: u.name, role: u.role }))
        .filter((u) => {
          if (seen.has(u.id)) return false;
          seen.add(u.id);
          return true;
        });
      onPresenceChange(onlineUsers);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          id:   userId,
          name: userInfo.name,
          role: userInfo.role,
        });
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
