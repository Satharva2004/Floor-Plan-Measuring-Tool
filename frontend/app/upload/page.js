"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPdf } from "@/lib/api";

export default function UploadPage() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setSubmitting(true);
    setError(null);
    try {
      const { id } = await uploadPdf(file);
      router.push(`/viewer/${id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Upload a Plan</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0])}
        />
        <button type="submit" disabled={!file || submitting}>
          {submitting ? "Uploading..." : "Upload"}
        </button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}
