export interface AuthUser {
  id: string;
  email: string;
  token: string;
}

export type ProcessingStatus = "processing" | "ready" | "error";

export type ProcessingStage =
  | "reading"
  | "extracting_content"
  | "extracting_points"
  | "finalizing"
  | "complete"
  | "error";

export interface PdfSummary {
  id: string;
  filename: string;
  page_count: number;
  status: ProcessingStatus;
  uploaded_at: string | null;
}

export interface PdfMeta extends PdfSummary {
  url: string;
  stage: ProcessingStage | null;
  pages_processed: number | null;
  pages_total: number | null;
  error: string | null;
}

export type SnapPointType = "endpoint" | "midpoint" | "intersection";

export interface SnapPoint {
  type: SnapPointType;
  x: number;
  y: number;
}

export type Segment = [x1: number, y1: number, x2: number, y2: number];
