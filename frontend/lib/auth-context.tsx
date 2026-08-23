"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import * as api from "@/lib/api";
import type { AuthUser } from "@/lib/types";

const STORAGE_KEY = "plan-measuring-tool.auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // Corrupted or inaccessible storage - proceed logged out.
    } finally {
      setIsLoading(false);
    }
  }, []);

  const persist = useCallback((next: AuthUser | null) => {
    setUser(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      persist(await api.login(email, password));
    },
    [persist]
  );

  const signup = useCallback(
    async (email: string, password: string) => {
      await api.signup(email, password);
      persist(await api.login(email, password));
    },
    [persist]
  );

  const logout = useCallback(() => persist(null), [persist]);

  const value = useMemo(
    () => ({ user, isLoading, login, signup, logout }),
    [user, isLoading, login, signup, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
