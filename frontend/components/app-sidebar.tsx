"use client";

import { ChevronsUpDown, FileText, LogOut, MoreHorizontal, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { UploadDialog } from "@/components/upload-dialog";
import { useAuth } from "@/lib/auth-context";
import { APP_NAME } from "@/lib/constants";
import { groupPdfsByDate } from "@/lib/date-groups";
import { usePdfLibrary } from "@/lib/pdf-library-context";
import type { PdfSummary } from "@/lib/types";

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { pdfs, isLoading, error, refresh, deletePdf } = usePdfLibrary();
  const params = useParams<{ id?: string }>();
  const router = useRouter();

  const [pendingDelete, setPendingDelete] = useState<PdfSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;

    setIsDeleting(true);
    try {
      await deletePdf(target.id);
      toast.success(`"${target.filename}" was deleted.`);
      if (params.id === target.id) {
        router.replace("/");
      }
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete document. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  const groups = groupPdfsByDate(pdfs);
  const emailInitial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center gap-2 px-1 pt-1">
          <img src="https://media.licdn.com/dms/image/v2/D560BAQHRRHYRf3WZWg/company-logo_200_200/company-logo_200_200/0/1709055160728/thetailoredai_logo?e=2147483647&v=beta&t=zgoD-kt4ICmqJVq9Jrq0WTPuadyLShYpB8bPeZH0FlM" alt="Logo" className="size-8 rounded-lg" />
          <span className="truncate font-heading text-md">{APP_NAME}</span>
        </div>
        <hr />
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
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<SidebarMenuAction showOnHover />}>
                        <MoreHorizontal />
                        <span className="sr-only">Document actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(pdf)}>
                          <Trash2 />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
                <Avatar size="sm">
                  <AvatarFallback>{emailInitial}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{user?.email}</span>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onClick={logout} variant="destructive">
                  <LogOut />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <AlertDialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{pendingDelete?.filename}&rdquo;. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting && <Spinner />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sidebar>
  );
}
