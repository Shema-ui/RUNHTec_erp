import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import pb from '@/lib/pocketbaseClient';
import { logActivity } from '@/lib/activity';

const AuthContext = createContext(null);

const REMEMBER_KEY = 'runhtec_remember_email';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(pb.authStore.record);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = pb.authStore.onChange((_token, record) => {
      setUser(record);
    });
    // Validate any persisted session on boot.
    const bootstrap = async () => {
      if (pb.authStore.isValid) {
        try {
          await pb.collection('users').authRefresh();
        } catch (_) {
          pb.authStore.clear();
        }
      }
      setReady(true);
    };
    bootstrap();
    return () => unsub();
  }, []);

  const login = useCallback(async (email, password, remember) => {
    const auth = await pb.collection('users').authWithPassword(email, password);
    if (remember) localStorage.setItem(REMEMBER_KEY, email);
    else localStorage.removeItem(REMEMBER_KEY);
    logActivity('Signed in', `${auth.record.email} authenticated`);
    return auth;
  }, []);

  const logout = useCallback(() => {
    logActivity('Signed out', `${pb.authStore.record?.email || ''} ended session`);
    pb.authStore.clear();
  }, []);

  const rememberedEmail = () => localStorage.getItem(REMEMBER_KEY) || '';

  const value = {
    user,
    ready,
    isAuthed: pb.authStore.isValid,
    login,
    logout,
    rememberedEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
