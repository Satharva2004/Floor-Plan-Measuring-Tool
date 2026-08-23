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
      {/* h-svh + overflow-hidden caps this route's shell at exactly the
          viewport - a safety net so oversized content (a heavily zoomed PDF)
          can never grow the actual browser page and push the toolbar out of
          view. Scrolling is meant to happen only inside the viewer's own
          scroll area below. */}
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar />
        <SidebarInset className="min-h-0 min-w-0">
          <header className="flex h-12 shrink-0 items-center border-b px-2">
            <SidebarTrigger />
          </header>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </PdfLibraryProvider>
  );
}
