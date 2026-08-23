"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/lib/auth-context";
import { PdfLibraryProvider } from "@/lib/pdf-library-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <PdfLibraryProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <header className="flex h-12 shrink-0 items-center border-b px-2">
            <SidebarTrigger />
          </header>
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PdfLibraryProvider>
  );
}
