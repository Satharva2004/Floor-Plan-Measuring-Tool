const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function uploadPdf(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error((await res.json()).detail || "Upload failed");
  return res.json();
}

export async function getPdfMeta(id) {
  const res = await fetch(`${API_URL}/pdfs/${id}`);
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to load PDF");
  return res.json();
}

export async function getSnapPoints(id, pageNumber) {
  const res = await fetch(`${API_URL}/pdfs/${id}/pages/${pageNumber}/snap-points`);
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to load snap points");
  return res.json();
}

export async function getSegments(id, pageNumber) {
  const res = await fetch(`${API_URL}/pdfs/${id}/pages/${pageNumber}/segments`);
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to load segments");
  return res.json();
}
