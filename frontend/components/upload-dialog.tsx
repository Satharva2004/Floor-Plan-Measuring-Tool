"use client";

import { CheckCircle2, Circle, TriangleAlert, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { PdfMeta } from "@/lib/types";

const POLL_INTERVAL_MS = 700;

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

interface UploadDialogProps {
  onUploaded: (pdfId: string) => void;
}

export function UploadDialog({ onUploaded }: UploadDialogProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState<StageKey>("uploading");
  const [pageProgress, setPageProgress] = useState<{ processed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setUploadProgress(0);
    setCurrentStage("uploading");
    setPageProgress(null);
    setError(null);
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

  async function handleFileSelected(file: File) {
    if (!user) return;

    reset();
    setOpen(true);

    let uploadResult;
    try {
      uploadResult = await api.uploadPdf(user.token, file, setUploadProgress);
    } catch (err) {
      setError(err instanceof api.ApiError ? err.message : "Upload failed. Please try again.");
      return;
    }

    setCurrentStage("uploaded");
    pollUntilDone(uploadResult.id);
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

      {/* Blocks closing (escape key, outside click, or the close button) until
          processing has actually failed - there's nothing useful to go back
          to mid-upload, and closing wouldn't stop the background job anyway. */}
      <Dialog open={open} onOpenChange={(next) => (next || error) && setOpen(next)}>
        <DialogContent showCloseButton={!!error}>
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
        </DialogContent>
      </Dialog>
    </>
  );
}
