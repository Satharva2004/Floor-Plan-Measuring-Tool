"use client";

import { FileText, LogOut, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { UploadDialog } from "@/components/upload-dialog";
import { useAuth } from "@/lib/auth-context";
import { groupPdfsByDate } from "@/lib/date-groups";
import { usePdfLibrary } from "@/lib/pdf-library-context";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { pdfs, isLoading, error, refresh } = usePdfLibrary();
  const params = useParams<{ id?: string }>();
  const router = useRouter();

  const groups = groupPdfsByDate(pdfs);

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <UploadDialog
          onUploaded={(pdfId) => {
            refresh();
            router.push(`/viewer/${pdfId}`);
          }}
        />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>History</SidebarGroupLabel>
          <SidebarGroupContent>
            {isLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                <Spinner className="size-3.5" />
                Loading your documents…
              </div>
            )}

            {!isLoading && error && (
              <p className="px-3 py-2 text-sm text-destructive">{error}</p>
            )}

            {!isLoading && !error && pdfs.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No documents yet. Upload a PDF to get started.
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.pdfs.map((pdf) => (
                  <SidebarMenuItem key={pdf.id}>
                    <SidebarMenuButton
                      isActive={params.id === pdf.id}
                      disabled={pdf.status !== "ready"}
                      tooltip={pdf.filename}
                      render={pdf.status === "ready" ? <Link href={`/viewer/${pdf.id}`} /> : undefined}
                    >
                      <FileText />
                      <span>{pdf.filename}</span>
                    </SidebarMenuButton>
                    {pdf.status === "processing" && (
                      <SidebarMenuBadge>
                        <Spinner className="size-3.5" />
                      </SidebarMenuBadge>
                    )}
                    {pdf.status === "error" && (
                      <SidebarMenuBadge>
                        <TriangleAlert className="size-3.5 text-destructive" />
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="truncate px-3 py-1 text-sm text-sidebar-foreground/80">{user?.email}</div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Log out">
              <LogOut />
              <span>Log out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
