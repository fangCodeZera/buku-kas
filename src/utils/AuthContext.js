// Phase 3: Authentication context.
// All auth state lives here. Never access supabase.auth directly outside this file.
// Exposes: { user, profile, session, loading, signIn, signOut, resetPassword, idleTimedOut, clearIdleTimedOut, passwordRecovery, updatePassword, clearPasswordRecovery }

import { createContext, useContext, useState, useEffect } from "react";
import supabase from "./supabaseClient";
import { saveActivityLog } from "./supabaseStorage";

const AuthContext = createContext(null);

const IDLE_TIMEOUT_MS  = 15 * 60 * 1000; // 15 minutes
const ACTIVITY_EVENTS  = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [session,      setSession]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  // idleTimedOut is NOT cleared by signOut() — only cleared by clearIdleTimedOut() on re-login.
  const [idleTimedOut, setIdleTimedOut] = useState(false);
  // passwordRecovery is set when the user arrives via a reset-password email link.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  // Fetch profile row from profiles table
  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return data;
  };

  // Handle session: set user/profile or sign out if inactive
  const handleSession = async (session) => {
    if (!session) {
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }
    const prof = await fetchProfile(session.user.id);
    if (prof && prof.is_active === false) {
      // Inactive account — force sign out
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }
    setSession(session);
    setUser(session.user);
    setProfile(prof);
  };

  useEffect(() => {
    // Restore existing session on mount
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        handleSession(session).finally(() => setLoading(false));
      })
      .catch(() => {
        // Network failure on load — show login screen rather than hang forever
        setLoading(false);
      });

    // Keep session in sync with Supabase auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "PASSWORD_RECOVERY") {
          setPasswordRecovery(true);
        }
        handleSession(session);
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Fetch profile to get display name for audit log (same call handleSession makes)
    const prof = await fetchProfile(data.user.id).catch(() => null);
    // Non-blocking audit log — failure must not prevent login
    saveActivityLog({
      user_name:   prof?.full_name || data.user.email || '',
      action:      'login',
      entity_type: 'auth',
      entity_id:   data.user.id,
      changes:     {},
    }, data.user.id).catch(() => {});
    return data;
  };

  const signOut = async () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    localStorage.removeItem('buku-kas-last-activity');
    await supabase.auth.signOut();
    // NOTE: idleTimedOut is intentionally NOT cleared here.
    // It survives sign-out so Login.js can show the "session expired" message.
    // Only clearIdleTimedOut() resets it, called after successful re-login.
  };

  // ── Idle timeout: auto sign-out after 15 minutes of inactivity ────────────
  // Effect depends on [user]: starts when user logs in, cleans up on logout.
  // setIdleTimedOut(true) is called AFTER signOut() so the flag survives the
  // synchronous user/session/profile clear inside signOut().
  useEffect(() => {
    if (!user) return;

    let timerId;

    const resetTimer = () => {
      clearTimeout(timerId);
      localStorage.setItem('buku-kas-last-activity', Date.now().toString());
      timerId = setTimeout(async () => {
        await signOut();
        setIdleTimedOut(true);
      }, IDLE_TIMEOUT_MS);
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const last = parseInt(localStorage.getItem('buku-kas-last-activity') || '0', 10);
        if (last > 0 && Date.now() - last > IDLE_TIMEOUT_MS) {
          await signOut();
          setIdleTimedOut(true);
        }
      }
    };

    ACTIVITY_EVENTS.forEach((ev) =>
      window.addEventListener(ev, resetTimer, { passive: true })
    );
    document.addEventListener('visibilitychange', handleVisibilityChange);
    resetTimer(); // start the initial 15-minute countdown

    return () => {
      clearTimeout(timerId);
      ACTIVITY_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, resetTimer)
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // signOut and setIdleTimedOut are stable (React setters + same-scope function);
    // omitting from deps is intentional — effect must only re-run on user change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const clearIdleTimedOut = () => setIdleTimedOut(false);

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setPasswordRecovery(false);
  };

  const clearPasswordRecovery = () => setPasswordRecovery(false);

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signOut, resetPassword, idleTimedOut, clearIdleTimedOut, passwordRecovery, updatePassword, clearPasswordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
