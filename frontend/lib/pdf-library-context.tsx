"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PdfSummary } from "@/lib/types";

interface PdfLibraryContextValue {
  pdfs: PdfSummary[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  deletePdf: (id: string) => Promise<void>;
}

const PdfLibraryContext = createContext<PdfLibraryContextValue | null>(null);

export function PdfLibraryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [pdfs, setPdfs] = useState<PdfSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setPdfs([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setPdfs(await api.listPdfs(user.token));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your documents");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Covers reloading the page (or opening it in another tab) while an
  // upload from elsewhere is still processing - keeps the sidebar's status
  // badge from getting stuck once that document finishes.
  useEffect(() => {
    if (!pdfs.some((p) => p.status === "processing")) {
      return;
    }
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [pdfs, refresh]);

  const deletePdf = useCallback(
    async (id: string) => {
      if (!user) return;
      await api.deletePdf(user.token, id);
      setPdfs((prev) => prev.filter((pdf) => pdf.id !== id));
    },
    [user]
  );

  const value = useMemo(
    () => ({ pdfs, isLoading, error, refresh, deletePdf }),
    [pdfs, isLoading, error, refresh, deletePdf]
  );

  return <PdfLibraryContext.Provider value={value}>{children}</PdfLibraryContext.Provider>;
}

export function usePdfLibrary(): PdfLibraryContextValue {
  const context = useContext(PdfLibraryContext);
  if (!context) {
    throw new Error("usePdfLibrary must be used within a PdfLibraryProvider");
  }
  return context;
}
