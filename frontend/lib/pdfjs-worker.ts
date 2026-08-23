import { pdfjs } from "react-pdf";

// Anything rendering <Document>/<Page> needs this configured first. Living
// here (rather than as a side effect inside one component) means every
// consumer can import it directly - relying on some other component having
// already run it is fragile once more than one place uses react-pdf, since
// Next.js code-splits per route and there's no guarantee both ended up in
// the same bundle.
//
// Loaded from cdnjs instead of bundled locally: Next.js's production Terser
// pass can't parse the worker's ESM import/export syntax when webpack pulls
// it in via `new URL(..., import.meta.url)`, which breaks `next build`. A
// CDN URL keyed to the installed pdfjs version sidesteps that entirely.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
