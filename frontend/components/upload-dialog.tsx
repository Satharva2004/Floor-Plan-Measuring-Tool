"use client";

import { CheckCircle2, Circle, TriangleAlert, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Document, Page } from "react-pdf";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { PdfMeta } from "@/lib/types";
import "@/lib/pdfjs-worker";

const POLL_INTERVAL_MS = 700;
const THUMBNAIL_WIDTH = 120;

// Every stage here corresponds to real work: "uploading"/"uploaded" happen on
// the client (a real XHR transfer), the rest mirror the backend's own
// `stage` field on the PDF doc, updated by the actual processing job. There
// is no stage here that isn't backed by something the app really did.
const STAGES = [
  { key: "uploading", label: "Uploading PDF" },
  { key: "uploaded", label: "Upload successful" },
  { key: "reading", label: "Reading PDF" },
  { key: "extracting_content", label: "Extracting content" },
  { key: "extracting_points", label: "Extracting points" },
  { key: "finalizing", label: "Finalizing document" },
  { key: "complete", label: "Processing complete" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];
type Phase = "selecting" | "processing";

interface UploadDialogProps {
  onUploaded: (pdfId: string) => void;
}

function PageThumbnailGrid({
  file,
  numPages,
  selectedPages,
  onNumPagesKnown,
  onTogglePage,
}: {
  file: File;
  numPages: number | null;
  selectedPages: Set<number>;
  onNumPagesKnown: (numPages: number) => void;
  onTogglePage: (pageNumber: number) => void;
}) {
  return (
    <Document
      file={file}
      onLoadSuccess={(pdf) => onNumPagesKnown(pdf.numPages)}
      loading={
        <div className="flex h-32 items-center justify-center">
          <Spinner className="size-5" />
        </div>
      }
      error={
        <Alert variant="destructive">
          <AlertDescription>Couldn&apos;t read this PDF to show a page preview.</AlertDescription>
        </Alert>
      }
    >
      {numPages != null && (
        <div className="grid max-h-[50vh] grid-cols-3 gap-3 overflow-y-auto p-1 sm:grid-cols-4">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => {
            const checked = selectedPages.has(pageNumber);
            return (
              <label
                key={pageNumber}
                className={cn(
                  "relative flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors",
                  checked ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onTogglePage(pageNumber)}
                  className="absolute top-1.5 left-1.5 z-10 bg-background"
                  aria-label={`Page ${pageNumber}`}
                />
                <Page
                  pageNumber={pageNumber}
                  width={THUMBNAIL_WIDTH}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={<Skeleton style={{ width: THUMBNAIL_WIDTH, height: THUMBNAIL_WIDTH * 1.3 }} />}
                />
                <span className="text-xs text-muted-foreground">{pageNumber}</span>
              </label>
            );
          })}
        </div>
      )}
    </Document>
  );
}

export function UploadDialog({ onUploaded }: UploadDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("selecting");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<StageKey>("uploading");
  const [pageProgress, setPageProgress] = useState<{ processed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelected(file: File) {
    setSelectedFile(file);
    setNumPages(null);
    setSelectedPages(new Set());
    setPhase("selecting");
    setUploadProgress(0);
    setCurrentStage("uploading");
    setPageProgress(null);
    setError(null);
    setOpen(true);
  }

  function handleNumPagesKnown(pages: number) {
    setNumPages(pages);
    setSelectedPages(new Set(Array.from({ length: pages }, (_, i) => i + 1)));
  }

  function togglePage(pageNumber: number) {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageNumber)) {
        next.delete(pageNumber);
      } else {
        next.add(pageNumber);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (!numPages) return;
    setSelectedPages((prev) =>
      prev.size === numPages ? new Set() : new Set(Array.from({ length: numPages }, (_, i) => i + 1))
    );
  }

  function pollUntilDone(pdfId: string) {
    const interval = setInterval(async () => {
      if (!user) return;

      let meta: PdfMeta;
      try {
        meta = await api.getPdfMeta(user.token, pdfId);
      } catch {
        return; // transient network hiccup - try again on the next tick
      }

      if (meta.status === "error") {
        clearInterval(interval);
        setError(meta.error || "Processing failed.");
        return;
      }

      if (meta.stage && meta.stage !== "error") {
        setCurrentStage(meta.stage);
      }
      if (meta.pages_processed != null && meta.pages_total != null) {
        setPageProgress({ processed: meta.pages_processed, total: meta.pages_total });
      }

      if (meta.status === "ready") {
        clearInterval(interval);
        setTimeout(() => {
          setOpen(false);
          onUploaded(pdfId);
        }, 500);
      }
    }, POLL_INTERVAL_MS);
  }

  async function confirmUpload() {
    if (!user || !selectedFile || selectedPages.size === 0) return;

    setPhase("processing");
    const pagesParam =
      numPages && selectedPages.size === numPages
        ? "all"
        : Array.from(selectedPages)
            .sort((a, b) => a - b)
            .join(",");

    let uploadResult;
    try {
      uploadResult = await api.uploadPdf(user.token, selectedFile, pagesParam, setUploadProgress);
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : "Upload failed. Please try again.");
      return;
    }

    setCurrentStage("uploaded");
    pollUntilDone(uploadResult.id);
  }

  function closeAndReset() {
    setOpen(false);
    setSelectedFile(null);
    setNumPages(null);
  }

  function stageStatus(stageKey: StageKey): "done" | "active" | "pending" {
    const currentIndex = STAGES.findIndex((s) => s.key === currentStage);
    const stageIndex = STAGES.findIndex((s) => s.key === stageKey);
    if (stageIndex < currentIndex) return "done";
    if (stageIndex === currentIndex) return "active";
    return "pending";
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) handleFileSelected(file);
        }}
      />
      <Button className="w-full" onClick={() => fileInputRef.current?.click()}>
        <Upload />
        Upload PDF
      </Button>

      {/* Free to close while still picking pages - nothing has started yet.
          Once processing begins, closing is blocked (escape key, outside
          click, or the close button) until it actually fails: there's
          nothing useful to go back to mid-upload, and closing wouldn't stop
          the background job anyway. */}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (next) return;
          if (phase === "selecting") closeAndReset();
          else if (error) setOpen(false);
        }}
      >
        <DialogContent
          showCloseButton={phase === "selecting" || !!error}
          className={phase === "selecting" ? "sm:max-w-xl" : undefined}
        >
          {phase === "selecting" ? (
            <>
              <DialogHeader>
                <DialogTitle>Select pages to process</DialogTitle>
                <DialogDescription>
                  {selectedFile?.name} — {numPages ?? "…"} page{numPages === 1 ? "" : "s"}
                </DialogDescription>
              </DialogHeader>

              {selectedFile && (
                <PageThumbnailGrid
                  file={selectedFile}
                  numPages={numPages}
                  selectedPages={selectedPages}
                  onNumPagesKnown={handleNumPagesKnown}
                  onTogglePage={togglePage}
                />
              )}

              <DialogFooter className="items-center sm:justify-between">
                <Button variant="ghost" size="sm" onClick={toggleSelectAll} disabled={!numPages}>
                  {numPages && selectedPages.size === numPages ? "Deselect all" : "Select all"}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeAndReset}>
                    Cancel
                  </Button>
                  <Button onClick={confirmUpload} disabled={selectedPages.size === 0}>
                    Upload {selectedPages.size} page{selectedPages.size === 1 ? "" : "s"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Processing your plan</DialogTitle>
                <DialogDescription>This stays open until your PDF is ready to view.</DialogDescription>
              </DialogHeader>

              {error ? (
                <Alert variant="destructive">
                  <TriangleAlert />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : (
                <div className="flex flex-col gap-3">
                  {STAGES.map((stage) => {
                    const status = stageStatus(stage.key);
                    const detail =
                      status === "active" &&
                      (stage.key === "extracting_content" || stage.key === "extracting_points") &&
                      pageProgress
                        ? `page ${pageProgress.processed} of ${pageProgress.total}`
                        : null;

                    return (
                      <div key={stage.key} className="flex items-center gap-3 text-sm">
                        {status === "done" && <CheckCircle2 className="size-4 shrink-0 text-primary" />}
                        {status === "active" && <Spinner className="size-4 shrink-0 text-primary" />}
                        {status === "pending" && <Circle className="size-4 shrink-0 text-muted-foreground" />}
                        <span className={status === "pending" ? "text-muted-foreground" : ""}>{stage.label}</span>
                        {detail && <span className="ml-auto text-xs text-muted-foreground">{detail}</span>}
                      </div>
                    );
                  })}
                  {currentStage === "uploading" && (
                    <Progress value={Math.round(uploadProgress * 100)} className="mt-1" />
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
