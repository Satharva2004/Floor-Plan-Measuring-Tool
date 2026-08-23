"use client";

import { useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { getPdfMeta, getSegments, getSnapPoints } from "@/lib/api";
import SnapOverlay from "@/components/SnapOverlay";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const SCALE = 1.5;

// Architectural/engineering drawing scales, as real-world feet per inch of
// printed paper. PDF points map 1:1 to paper inches (72pt = 1in) regardless
// of on-screen zoom, so this is all that's needed to convert a measured
// distance into real-world feet-inches. Defaults to 1/4"=1'-0" since that's
// this sample sheet's printed scale (see the "SCALE:" note on the plan).
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
  { label: '1" = 30\'-0"', feetPerInch: 30 },
  { label: '1" = 40\'-0"', feetPerInch: 40 },
  { label: '1" = 50\'-0"', feetPerInch: 50 },
  { label: '1" = 100\'-0"', feetPerInch: 100 },
];
const DEFAULT_SCALE_LABEL = '1/4" = 1\'-0"';

export default function PdfViewer({ pdfId }) {
  const [meta, setMeta] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [points, setPoints] = useState(null);
  const [segments, setSegments] = useState(null);
  const [pointsKey, setPointsKey] = useState(null);
  const [viewport, setViewport] = useState(null);
  const [viewportPage, setViewportPage] = useState(null);
  const [error, setError] = useState(null);
  const [scaleLabel, setScaleLabel] = useState(DEFAULT_SCALE_LABEL);
  const [customFeetPerInch, setCustomFeetPerInch] = useState(4);

  const feetPerInch =
    scaleLabel === "custom"
      ? customFeetPerInch
      : SCALE_PRESETS.find((p) => p.label === scaleLabel)?.feetPerInch;

  useEffect(() => {
    getPdfMeta(pdfId)
      .then(setMeta)
      .catch((err) => setError(err.message));
  }, [pdfId]);

  useEffect(() => {
    Promise.all([getSnapPoints(pdfId, currentPage), getSegments(pdfId, currentPage)])
      .then(([pointsData, segmentsData]) => {
        setPoints(pointsData.points);
        setSegments(segmentsData.segments);
        setPointsKey(currentPage);
      })
      .catch((err) => setError(err.message));
  }, [pdfId, currentPage]);

  function goToPage(n) {
    if (!meta || n < 1 || n > meta.page_count) return;
    setCurrentPage(n);
    setPageInput(String(n));
  }

  // Only render the overlay once both the viewport and the points belong to
  // the same page — otherwise a page switch can briefly pair the new page's
  // viewport with the previous page's points, placing dots on the wrong lines.
  const overlayReady = viewport && viewportPage === currentPage && pointsKey === currentPage;

  if (error) return <p style={{ color: "red" }}>{error}</p>;
  if (!meta) return <p>Loading...</p>;

  return (
    <main>
      <h1>{meta.filename}</h1>
      <div>
        <button disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
          Previous
        </button>
        <span> Page </span>
        <form
          style={{ display: "inline" }}
          onSubmit={(e) => {
            e.preventDefault();
            goToPage(Number(pageInput));
          }}
        >
          <input
            type="number"
            min={1}
            max={meta.page_count}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={() => goToPage(Number(pageInput))}
            style={{ width: "3.5em" }}
          />
        </form>
        <span> / {meta.page_count} </span>
        <button disabled={currentPage >= meta.page_count} onClick={() => goToPage(currentPage + 1)}>
          Next
        </button>
        <label style={{ marginLeft: "1.5em" }}>
          Scale:{" "}
          <select value={scaleLabel} onChange={(e) => setScaleLabel(e.target.value)}>
            {SCALE_PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
            <option value="custom">Custom…</option>
          </select>
        </label>
        {scaleLabel === "custom" && (
          <label style={{ marginLeft: "0.5em" }}>
            1" ={" "}
            <input
              type="number"
              min="0"
              step="0.1"
              value={customFeetPerInch}
              onChange={(e) => setCustomFeetPerInch(Number(e.target.value))}
              style={{ width: "4em" }}
            />{" "}
            ft
          </label>
        )}
      </div>
      <div style={{ position: "relative", display: "inline-block" }}>
        <Document file={meta.url}>
          <Page
            pageNumber={currentPage}
            scale={SCALE}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            onLoadSuccess={(page) => {
              setViewport(page.getViewport({ scale: SCALE }));
              setViewportPage(currentPage);
            }}
          />
        </Document>
        {overlayReady && (
          <SnapOverlay
            key={currentPage}
            viewport={viewport}
            points={points}
            segments={segments}
            feetPerInch={feetPerInch}
          />
        )}
      </div>
    </main>
  );
}
