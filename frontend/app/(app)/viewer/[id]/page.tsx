import { PdfViewer } from "@/components/pdf-viewer";

export default function ViewerPage({ params }: { params: { id: string } }) {
  return <PdfViewer pdfId={params.id} />;
}
