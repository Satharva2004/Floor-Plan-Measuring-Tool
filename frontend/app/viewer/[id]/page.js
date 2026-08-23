import PdfViewer from "@/components/PdfViewer";

export default function ViewerPage({ params }) {
  return <PdfViewer pdfId={params.id} />;
}
