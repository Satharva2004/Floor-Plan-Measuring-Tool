"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Segment, SnapPoint, SnapPointType } from "@/lib/types";

const SNAP_TOLERANCE_PX = 12;

const MARKER_COLORS: Record<string, string> = {
  endpoint: "red",
  midpoint: "blue",
  intersection: "green",
  nearest: "orange",
};

/** Only the viewport fields the overlay actually reads - avoids coupling to pdfjs-dist's exact type shape. */
export interface PdfViewport {
  width: number;
  height: number;
  scale: number;
}

interface PixelPoint {
  px: number;
  py: number;
  type: SnapPointType | "nearest";
}

interface SelectedPoint extends PixelPoint {
  pdfX: number;
  pdfY: number;
}

interface PixelSegment {
  px1: number;
  py1: number;
  px2: number;
  py2: number;
}

// PDF points map 1:1 to paper inches (72pt = 1in), so with the drawing's
// printed scale (real feet per paper inch) a point distance converts
// straight to real-world feet, formatted the way the plan's own dimensions
// are (feet-apostrophe-inches, nearest 1/8").
function formatFeetInches(feet: number): string {
  let totalEighths = Math.round(feet * 12 * 8);
  const wholeFeet = Math.floor(totalEighths / (12 * 8));
  totalEighths -= wholeFeet * 12 * 8;
  const wholeInches = Math.floor(totalEighths / 8);
  const fracEighths = totalEighths % 8;
  const fractions: Record<number, string> = { 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" };
  const inchesStr = fracEighths ? `${wholeInches} ${fractions[fracEighths]}` : `${wholeInches}`;
  return `${wholeFeet}'-${inchesStr}"`;
}

function closestPointOnSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;

  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  return { x: x1 + t * dx, y: y1 + t * dy };
}

// Drawn semi-transparent on purpose: a solid marker sitting exactly on top of
// the point someone is trying to line up with hides the very geometry (and
// the cursor) they're trying to check it against, which fights the "zoom in
// and be precise" use case. Letting the wall line show through the marker
// keeps both visible at once.
const MARKER_ALPHA = 0.55;

function drawMarker(ctx: CanvasRenderingContext2D, p: PixelPoint) {
  const color = MARKER_COLORS[p.type] || "red";
  ctx.save();
  ctx.globalAlpha = MARKER_ALPHA;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  const s = 6;

  if (p.type === "endpoint") {
    ctx.strokeRect(p.px - s, p.py - s, s * 2, s * 2);
  } else if (p.type === "midpoint") {
    ctx.beginPath();
    ctx.moveTo(p.px, p.py - s);
    ctx.lineTo(p.px - s, p.py + s);
    ctx.lineTo(p.px + s, p.py + s);
    ctx.closePath();
    ctx.stroke();
  } else if (p.type === "intersection") {
    ctx.beginPath();
    ctx.moveTo(p.px - s, p.py - s);
    ctx.lineTo(p.px + s, p.py + s);
    ctx.moveTo(p.px + s, p.py - s);
    ctx.lineTo(p.px - s, p.py + s);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(p.px, p.py, s * 0.7, 0, 2 * Math.PI);
    ctx.stroke();
  }
  ctx.restore();
}

// Architectural-style dimension line: black extension (witness) ticks at each
// end, a red double-headed arrow spanning between them, and the distance
// label floating above the midpoint — mirrors the look of Bluebeam's
// measurement tool so a mid-measurement drag reads the same way.
function drawDimensionLine(ctx: CanvasRenderingContext2D, p1: PixelPoint, p2: PixelPoint, label: string) {
  const dx = p2.px - p1.px;
  const dy = p2.py - p1.py;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  const ux = dx / len;
  const uy = dy / len;
  const perpX = -uy;
  const perpY = ux;

  const extLen = 12;
  const arrowLen = 10;
  const arrowWidth = 4;

  ctx.strokeStyle = "black";
  ctx.lineWidth = 1.5;
  for (const p of [p1, p2]) {
    ctx.beginPath();
    ctx.moveTo(p.px - perpX * extLen, p.py - perpY * extLen);
    ctx.lineTo(p.px + perpX * extLen, p.py + perpY * extLen);
    ctx.stroke();
  }

  ctx.strokeStyle = "red";
  ctx.fillStyle = "red";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.px, p1.py);
  ctx.lineTo(p2.px, p2.py);
  ctx.stroke();

  function drawArrowhead(tip: PixelPoint, dirX: number, dirY: number) {
    const backX = tip.px - dirX * arrowLen;
    const backY = tip.py - dirY * arrowLen;
    ctx.beginPath();
    ctx.moveTo(tip.px, tip.py);
    ctx.lineTo(backX + perpX * arrowWidth, backY + perpY * arrowWidth);
    ctx.lineTo(backX - perpX * arrowWidth, backY - perpY * arrowWidth);
    ctx.closePath();
    ctx.fill();
  }
  drawArrowhead(p1, -ux, -uy);
  drawArrowhead(p2, ux, uy);

  const midX = (p1.px + p2.px) / 2;
  const midY = (p1.py + p2.py) / 2;
  const labelOffset = 16;
  const labelX = midX + perpX * labelOffset;
  const labelY = midY + perpY * labelOffset;

  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const padding = 3;
  const metrics = ctx.measureText(label);
  ctx.fillStyle = "white";
  ctx.fillRect(labelX - metrics.width / 2 - padding, labelY - 8 - padding, metrics.width + padding * 2, 16 + padding * 2);
  ctx.fillStyle = "black";
  ctx.fillText(label, labelX, labelY);
}

interface SnapOverlayProps {
  viewport: PdfViewport;
  points: SnapPoint[];
  segments: Segment[];
  feetPerInch: number | null;
  showAllPoints: boolean;
}

export function SnapOverlay({ viewport, points, segments, feetPerInch, showAllPoints }: SnapOverlayProps) {
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const cursorRef = useRef({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<PixelPoint | null>(null);
  const [selected, setSelected] = useState<SelectedPoint[]>([]);

  // Backend coordinates come from PyMuPDF's get_drawings(), which are already
  // in top-left-origin, y-down page space (points, unscaled) — the same
  // convention as the rendered page image. That's NOT the raw bottom-left,
  // y-up PDF space that pdf.js's convertToViewportPoint expects, so using it
  // here would apply a spurious extra vertical flip. A plain scale multiply
  // is the correct conversion (assumes the page has no rotation, true here).
  const pixelPoints = useMemo<PixelPoint[]>(
    () => points.map((p) => ({ px: p.x * viewport.scale, py: p.y * viewport.scale, type: p.type })),
    [viewport, points]
  );

  const pixelSegments = useMemo<PixelSegment[]>(
    () =>
      segments.map(([x1, y1, x2, y2]) => ({
        px1: x1 * viewport.scale,
        py1: y1 * viewport.scale,
        px2: x2 * viewport.scale,
        py2: y2 * viewport.scale,
      })),
    [viewport, segments]
  );

  // Discrete snaps (endpoint/midpoint/intersection) win when close enough — an
  // exact feature is more useful than a generic point on the line. "Nearest"
  // (continuous projection onto the closest segment, like Bluebeam's Content
  // Snap "Nearest") is the fallback, so essentially any point along any wall
  // becomes snappable, not just its fixed endpoints/midpoint.
  function findSnapCandidate(x: number, y: number): PixelPoint | null {
    let nearestPoint: PixelPoint | null = null;
    let nearestPointDist = Infinity;
    for (const p of pixelPoints) {
      const dist = Math.hypot(p.px - x, p.py - y);
      if (dist < nearestPointDist) {
        nearestPointDist = dist;
        nearestPoint = p;
      }
    }

    if (nearestPoint && nearestPointDist <= SNAP_TOLERANCE_PX) {
      return nearestPoint;
    }

    let nearestOnLine: PixelPoint | null = null;
    let nearestLineDist = Infinity;
    for (const s of pixelSegments) {
      const c = closestPointOnSegment(x, y, s.px1, s.py1, s.px2, s.py2);
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist < nearestLineDist) {
        nearestLineDist = dist;
        nearestOnLine = { px: c.x, py: c.y, type: "nearest" };
      }
    }

    if (nearestOnLine && nearestLineDist <= SNAP_TOLERANCE_PX) {
      return nearestOnLine;
    }

    return null;
  }

  // Map the mouse event's CSS-pixel position to the canvas's own pixel space
  // rather than assuming they're the same. They normally are, but the moment
  // anything scales the canvas on screen (browser zoom, a container that
  // constrains its width, etc.) a 1:1 assumption drifts the hit-test away
  // from where the dot is actually drawn — exactly when someone has zoomed in
  // to place a point precisely.
  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    cursorRef.current = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };

    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const { x, y } = cursorRef.current;
      setHovered(findSnapCandidate(x, y));
    });
  }

  function toSelectedPoint(p: PixelPoint): SelectedPoint {
    return { ...p, pdfX: p.px / viewport.scale, pdfY: p.py / viewport.scale };
  }

  function distanceLabel(distPt: number): string {
    if (feetPerInch) {
      return formatFeetInches(distPt * (feetPerInch / 72));
    }
    return `${distPt.toFixed(1)} pt`;
  }

  function handleClick() {
    if (!hovered) return;
    const point = toSelectedPoint(hovered);
    setSelected((prev) => (prev.length >= 2 ? [point] : [...prev, point]));
  }

  // Static layer: the full snap-point cloud. Only depends on the fetched data
  // and the visibility toggle, so it's untouched by mouse movement — drawing
  // it fresh on every hover update was what made the overlay stall after
  // moving the cursor around for a while with thousands of points on screen.
  useEffect(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!showAllPoints) return;
    ctx.globalAlpha = MARKER_ALPHA;
    for (const p of pixelPoints) {
      ctx.beginPath();
      ctx.arc(p.px, p.py, 2, 0, 2 * Math.PI);
      ctx.fillStyle = MARKER_COLORS[p.type] || "gray";
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [pixelPoints, showAllPoints]);

  // Dynamic layer: hover marker, picked points, and the live/locked dimension
  // line. Cheap regardless of point count, so it stays responsive on every
  // mouse move.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of selected) {
      drawMarker(ctx, p);
    }

    if (selected.length === 1 && hovered) {
      const distPt = Math.hypot(hovered.px - selected[0].px, hovered.py - selected[0].py) / viewport.scale;
      drawDimensionLine(ctx, selected[0], hovered, distanceLabel(distPt));
    } else if (selected.length === 2) {
      const [a, b] = selected;
      const distPt = Math.hypot(b.pdfX - a.pdfX, b.pdfY - a.pdfY);
      drawDimensionLine(ctx, a, b, distanceLabel(distPt));
    }

    if (hovered) {
      drawMarker(ctx, hovered);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, selected, viewport, feetPerInch]);

  return (
    <>
      <canvas
        ref={staticCanvasRef}
        width={viewport.width}
        height={viewport.height}
        className="pointer-events-none absolute top-0 left-0"
      />
      <canvas
        ref={canvasRef}
        width={viewport.width}
        height={viewport.height}
        className="absolute top-0 left-0 cursor-crosshair"
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />
    </>
  );
}
