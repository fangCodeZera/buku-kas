// Phase 3: Authentication context.
// All auth state lives here. Never access supabase.auth directly outside this file.
// Exposes: { user, profile, session, loading, signIn, signOut }

import { createContext, useContext, useState, useEffect } from "react";
import supabase from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

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
      (_event, session) => {
        handleSession(session);
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
