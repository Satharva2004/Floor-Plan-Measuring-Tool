import type { AuthUser, PdfMeta, PdfSummary, Segment, SnapPoint } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function parseErrorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body.detail || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new ApiError(await parseErrorDetail(res), res.status);
  }
  return res.json();
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function signup(email: string, password: string): Promise<AuthUser> {
  return requestJson<AuthUser>("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthUser> {
  return requestJson<AuthUser>("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

export async function listPdfs(token: string): Promise<PdfSummary[]> {
  const data = await requestJson<{ pdfs: PdfSummary[] }>("/pdfs", { headers: authHeaders(token) });
  return data.pdfs;
}

export async function getPdfMeta(token: string, id: string): Promise<PdfMeta> {
  return requestJson<PdfMeta>(`/pdfs/${id}`, { headers: authHeaders(token) });
}

export async function deletePdf(token: string, id: string): Promise<void> {
  await requestJson<{ id: string }>(`/pdfs/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function getSegments(token: string, id: string, pageNumber: number): Promise<Segment[]> {
  const data = await requestJson<{ segments: Segment[] }>(`/pdfs/${id}/pages/${pageNumber}/segments`, {
    headers: authHeaders(token),
  });
  return data.segments;
}

export async function getSnapPoints(token: string, id: string, pageNumber: number): Promise<SnapPoint[]> {
  const data = await requestJson<{ points: SnapPoint[] }>(`/pdfs/${id}/pages/${pageNumber}/snap-points`, {
    headers: authHeaders(token),
  });
  return data.points;
}

export interface UploadResult {
  id: string;
  filename: string;
  page_count: number;
}

/**
 * Uses XMLHttpRequest (not fetch) specifically so upload progress reflects
 * real bytes transferred via `upload.onprogress` - fetch has no equivalent
 * for request bodies across browsers.
 */
export function uploadPdf(
  token: string,
  file: File,
  pages: string,
  onProgress: (fraction: number) => void
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("pages", pages);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    };

    xhr.onload = () => {
      let body: unknown;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as UploadResult);
      } else {
        const detail = (body as { detail?: string } | null)?.detail;
        reject(new ApiError(detail || "Upload failed", xhr.status));
      }
    };

    xhr.onerror = () => reject(new ApiError("Upload failed - network error", 0));

    xhr.send(formData);
  });
}
