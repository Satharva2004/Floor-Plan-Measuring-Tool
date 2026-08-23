"use client";

import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { UploadDialog } from "@/components/upload-dialog";
import { usePdfLibrary } from "@/lib/pdf-library-context";

export default function HomePage() {
  const router = useRouter();
  const { refresh } = usePdfLibrary();

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Empty className="max-w-md border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyTitle>No plan selected</EmptyTitle>
          <EmptyDescription>
            Upload a PDF to extract wall geometry and start measuring, or pick a document from your history.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <UploadDialog
            onUploaded={(pdfId) => {
              refresh();
              router.push(`/viewer/${pdfId}`);
            }}
          />
        </EmptyContent>
      </Empty>
    </div>
  );
}
