"use client";

import {
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  Minimize,
  StretchHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs, type PageProps } from "react-pdf";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import type { PdfMeta, Segment, SnapPoint } from "@/lib/types";

import { SnapOverlay, type PdfViewport } from "@/components/snap-overlay";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type LoadedPage = NonNullable<PageProps["onLoadSuccess"]> extends (page: infer P) => void ? P : never;

// Real-world drawing scales, as feet of real distance per inch of printed
// paper. PDF points map 1:1 to paper inches (72pt = 1in) regardless of
// on-screen zoom, so this is all that's needed to convert a measured
// distance into real feet-inches. Defaults to 1/4"=1'-0", a common
// architectural plan scale.
const SCALE_PRESETS = [
  { label: '1/16" = 1\'-0"', feetPerInch: 16 },
  { label: '1/8" = 1\'-0"', feetPerInch: 8 },
  { label: '3/16" = 1\'-0"', feetPerInch: 16 / 3 },
  { label: '1/4" = 1\'-0"', feetPerInch: 4 },
  { label: '3/8" = 1\'-0"', feetPerInch: 8 / 3 },
  { label: '1/2" = 1\'-0"', feetPerInch: 2 },
  { label: '3/4" = 1\'-0"', feetPerInch: 4 / 3 },
  { label: '1" = 1\'-0"', feetPerInch: 1 },
  { label: '1" = 10\'-0"', feetPerInch: 10 },
  { label: '1" = 20\'-0"', feetPerInch: 20 },
  { label: '1" = 50\'-0"', feetPerInch: 50 },
  { label: '1" = 100\'-0"', feetPerInch: 100 },
] as const;
const DEFAULT_SCALE_LABEL = '1/4" = 1\'-0"';
const CUSTOM_SCALE = "custom";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.2;
const FIT_PADDING_PX = 48;

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} disabled={disabled} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function PdfViewer({ pdfId }: { pdfId: string }) {
  const { user } = useAuth();

  const [meta, setMeta] = useState<PdfMeta | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageInputValue, setPageInputValue] = useState("1");

  const [points, setPoints] = useState<SnapPoint[] | null>(null);
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [pointsPage, setPointsPage] = useState<number | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);

  const [loadedPage, setLoadedPage] = useState<LoadedPage | null>(null);
  const [viewportPage, setViewportPage] = useState<number | null>(null);
  const [pageNativeSize, setPageNativeSize] = useState<{ width: number; height: number } | null>(null);

  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<"none" | "width" | "page">("width");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [showAllPoints, setShowAllPoints] = useState(false);
  const [scaleLabel, setScaleLabel] = useState<string>(DEFAULT_SCALE_LABEL);
  const [customFeetPerInch, setCustomFeetPerInch] = useState(4);

  const [isSpaceHeld, setIsSpaceHeld] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);

  const shellRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const feetPerInch =
    scaleLabel === CUSTOM_SCALE
      ? customFeetPerInch
      : SCALE_PRESETS.find((p) => p.label === scaleLabel)?.feetPerInch ?? null;

  // Fetch document metadata (also confirms ownership and processing status).
  useEffect(() => {
    if (!user) return;
    setMeta(null);
    setMetaError(null);
    api
      .getPdfMeta(user.token, pdfId)
      .then(setMeta)
      .catch((err) => setMetaError(err instanceof Error ? err.message : "Failed to load this document"));
  }, [user, pdfId]);

  // Fetch wall segments/snap points for the current page.
  useEffect(() => {
    if (!user || !meta || meta.status !== "ready") return;
    setDataError(null);
    Promise.all([api.getSnapPoints(user.token, pdfId, currentPage), api.getSegments(user.token, pdfId, currentPage)])
      .then(([pointsData, segmentsData]) => {
        setPoints(pointsData);
        setSegments(segmentsData);
        setPointsPage(currentPage);
      })
      .catch((err) => setDataError(err instanceof Error ? err.message : "Failed to load wall data for this page"));
  }, [user, meta, pdfId, currentPage]);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // The drag can end with the mouse anywhere (it doesn't have to stay over
  // the scroll area), so release on window rather than the element itself.
  useEffect(() => {
    if (!isPanning) return;
    function handleMouseUp() {
      panStateRef.current = null;
      setIsPanning(false);
    }
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [isPanning]);

  // Hold Space to pan by dragging, the same shortcut design tools and Adobe
  // Acrobat use - lets you navigate a zoomed-in plan without reaching for the
  // scrollbars. Ignored while typing in a form field so it doesn't hijack
  // the space character there.
  useEffect(() => {
    const SPACE_ACTIVATED_ROLES = ["combobox", "listbox", "option", "menuitem", "checkbox", "switch", "tab"];

    // Space also activates/opens plenty of things besides text fields
    // (buttons, our Scale <Select>, the "Show all points" checkbox) -
    // panning should only take over when focus isn't on any of those.
    function isSpaceActivatedTarget(target: EventTarget | null) {
      if (!(target instanceof HTMLElement)) return false;
      if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName)) return true;
      if (target.isContentEditable) return true;
      const role = target.getAttribute("role");
      return role !== null && SPACE_ACTIVATED_ROLES.includes(role);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space" && !isSpaceActivatedTarget(event.target)) {
        event.preventDefault();
        setIsSpaceHeld(true);
      }
    }
    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setIsSpaceHeld(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Recompute zoom for the active fit mode whenever it's possible to (page
  // size becomes known, or the mode is (re)selected).
  useEffect(() => {
    if (fitMode === "none" || !pageNativeSize || !scrollAreaRef.current) return;
    const availableWidth = scrollAreaRef.current.clientWidth - FIT_PADDING_PX;
    const availableHeight = scrollAreaRef.current.clientHeight - FIT_PADDING_PX;
    const widthZoom = availableWidth / pageNativeSize.width;
    setZoom(fitMode === "width" ? widthZoom : Math.min(widthZoom, availableHeight / pageNativeSize.height));
  }, [fitMode, pageNativeSize]);

  const goToPage = useCallback(
    (n: number) => {
      if (!meta) return;
      const clamped = Math.min(Math.max(1, n), meta.page_count);
      setCurrentPage(clamped);
      setPageInputValue(String(clamped));
    },
    [meta]
  );

  function zoomBy(factor: number) {
    setFitMode("none");
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor)));
  }

  function handlePanMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (!isSpaceHeld || !scrollAreaRef.current) return;
    event.preventDefault();
    panStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: scrollAreaRef.current.scrollLeft,
      scrollTop: scrollAreaRef.current.scrollTop,
    };
    setIsPanning(true);
  }

  function handlePanMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const pan = panStateRef.current;
    if (!pan || !scrollAreaRef.current) return;
    scrollAreaRef.current.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
    scrollAreaRef.current.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
  }

  // Ctrl/Cmd+scroll (also how browsers report trackpad pinch gestures) zooms
  // the PDF, matching the standard viewer convention - plain scroll keeps
  // panning through the page. This has to be a native, non-passive listener:
  // React registers its onWheel prop as passive by default, so
  // event.preventDefault() there silently does nothing and the browser's own
  // page-zoom fires anyway alongside ours.
  useEffect(() => {
    const node = scrollAreaRef.current;
    if (!node) return;

    function handleWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    }

    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => node.removeEventListener("wheel", handleWheel);
    // scrollAreaRef's <div> only exists once the "ready" branch below renders
    // (everything before that is a loading/error return) - depending on
    // meta.status makes this effect re-run right after that div actually
    // mounts, instead of firing once on the initial render (while the ref is
    // still null) and never again.
  }, [meta?.status]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      shellRef.current?.requestFullscreen();
    }
  }

  const onPageLoadSuccess = useCallback(
    (page: LoadedPage) => {
      setLoadedPage(page);
      setViewportPage(currentPage);
      // react-pdf calls onLoadSuccess again on every scale change, not just on
      // a real page load, handing back a brand-new object each time even when
      // the page's own dimensions haven't changed. Keeping the same object
      // reference when the values are unchanged stops that from cascading
      // into the fit-mode effect below (which depends on this value) and
      // fighting itself: fit computes a zoom -> Page reloads at that scale ->
      // onLoadSuccess fires -> fit recomputes -> ad infinitum.
      setPageNativeSize((prev) =>
        prev && prev.width === page.originalWidth && prev.height === page.originalHeight
          ? prev
          : { width: page.originalWidth, height: page.originalHeight }
      );
    },
    [currentPage]
  );

  // getViewport() doesn't depend on the scale the page originally loaded at -
  // recomputing it here (rather than only inside onLoadSuccess, which fires
  // once per page load, not per zoom change) keeps the overlay's coordinate
  // math in sync whenever the zoom level changes without a full page reload.
  const viewport = useMemo<PdfViewport | null>(
    () => (loadedPage ? loadedPage.getViewport({ scale: zoom }) : null),
    [loadedPage, zoom]
  );

  // Only render the overlay once the viewport and the wall data belong to
  // the same page - otherwise a page switch can briefly pair the new page's
  // viewport with the previous page's points, placing dots on the wrong lines.
  const overlayReady = useMemo(
    () => viewport && viewportPage === currentPage && pointsPage === currentPage && points && segments,
    [viewport, viewportPage, currentPage, pointsPage, points, segments]
  );

  if (metaError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertTitle>Couldn&apos;t load this document</AlertTitle>
          <AlertDescription>{metaError}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="flex-1" />
      </div>
    );
  }

  if (meta.status !== "ready") {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Alert className="max-w-md">
          <AlertTitle>Still processing</AlertTitle>
          <AlertDescription>
            This document is still being processed. It will become available here once that finishes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
      <div className="flex h-12 shrink-0 flex-wrap items-center gap-1 border-b px-2">
        <ToolbarButton label="Previous page" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
          <ChevronLeft />
        </ToolbarButton>
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault();
            goToPage(Number(pageInputValue));
          }}
        >
          <Input
            aria-label="Page number"
            className="h-8 w-14 text-center"
            value={pageInputValue}
            onChange={(event) => setPageInputValue(event.target.value)}
            onBlur={() => goToPage(Number(pageInputValue))}
          />
          <span className="text-sm text-muted-foreground">/ {meta.page_count}</span>
        </form>
        <ToolbarButton
          label="Next page"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= meta.page_count}
        >
          <ChevronRight />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}>
          <ZoomOut />
        </ToolbarButton>
        <span className="w-12 text-center text-sm tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
        <ToolbarButton label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>
          <ZoomIn />
        </ToolbarButton>
        <ToolbarButton label="Fit width" onClick={() => setFitMode("width")}>
          <StretchHorizontal />
        </ToolbarButton>
        <ToolbarButton label="Fit page" onClick={() => setFitMode("page")}>
          <Expand />
        </ToolbarButton>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton label={isFullscreen ? "Exit full screen" : "Full screen"} onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize /> : <Expand />}
        </ToolbarButton>
        <ToolbarButton label="Open original PDF" onClick={() => window.open(meta.url, "_blank", "noopener")}>
          <ExternalLink />
        </ToolbarButton>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={showAllPoints} onCheckedChange={setShowAllPoints} />
            Show all points{points ? ` (${points.length})` : ""}
          </label>

          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span>Scale</span>
            <Select value={scaleLabel} onValueChange={(value) => value && setScaleLabel(value)}>
              <SelectTrigger size="sm" aria-label="Drawing scale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCALE_PRESETS.map((preset) => (
                  <SelectItem key={preset.label} value={preset.label}>
                    {preset.label}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM_SCALE}>Custom…</SelectItem>
              </SelectContent>
            </Select>
            {scaleLabel === CUSTOM_SCALE && (
              <>
                <span>1&quot; =</span>
                <Input
                  type="number"
                  min={0}
                  step={0.1}
                  value={customFeetPerInch}
                  onChange={(event) => setCustomFeetPerInch(Number(event.target.value))}
                  className="h-8 w-16"
                  aria-label="Custom scale, feet per inch"
                />
                <span>ft</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        ref={scrollAreaRef}
        className={cn(
          "relative min-h-0 min-w-0 flex-1 overflow-auto",
          isPanning ? "cursor-grabbing" : isSpaceHeld && "cursor-grab"
        )}
        onMouseDown={handlePanMouseDown}
        onMouseMove={handlePanMouseMove}
      >
        {/* No items-center/justify-center here on purpose: centering an
            overflowing flex child that way makes its start-side overflow
            unreachable (scrollLeft/scrollTop can't go negative) - once
            zoomed in past the container's size, the left/top edge of the
            page becomes permanently unscrollable-to. `m-auto` on the child
            centers it the same way while degrading correctly to normal
            scrollable overflow in every direction once it no longer fits. */}
        <div className={cn("flex min-h-full min-w-full p-6", isSpaceHeld && "select-none")}>
          <div className="relative m-auto inline-block shadow-sm">
            <Document
              file={meta.url}
              loading={<Skeleton className="h-[600px] w-[460px]" />}
              error={
                <Alert variant="destructive" className="w-96">
                  <AlertTitle>Couldn&apos;t render this PDF</AlertTitle>
                  <AlertDescription>The file may be corrupted or temporarily unavailable.</AlertDescription>
                </Alert>
              }
            >
              <Page
                key={currentPage}
                pageNumber={currentPage}
                scale={zoom}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                onLoadSuccess={onPageLoadSuccess}
              />
            </Document>
            {overlayReady && viewport && points && segments && (
              <div className={isSpaceHeld ? "pointer-events-none" : undefined}>
                <SnapOverlay
                  key={currentPage}
                  viewport={viewport}
                  points={points}
                  segments={segments}
                  feetPerInch={feetPerInch}
                  showAllPoints={showAllPoints}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {dataError && (
        <div className="border-t p-2">
          <Alert variant="destructive">
            <AlertDescription>{dataError}</AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
