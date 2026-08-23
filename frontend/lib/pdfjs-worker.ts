import { pdfjs } from "react-pdf";

// Anything rendering <Document>/<Page> needs this configured first. Living
// here (rather than as a side effect inside one component) means every
// consumer can import it directly - relying on some other component having
// already run it is fragile once more than one place uses react-pdf, since
// Next.js code-splits per route and there's no guarantee both ended up in
// the same bundle.
pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
