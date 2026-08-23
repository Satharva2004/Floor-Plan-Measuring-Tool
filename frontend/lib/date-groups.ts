import type { PdfSummary } from "@/lib/types";

const GROUP_ORDER = ["Today", "Yesterday", "Previous 7 days", "Previous 30 days", "Older"] as const;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function groupLabel(uploadedAt: string | null, now: Date): (typeof GROUP_ORDER)[number] {
  if (!uploadedAt) {
    return "Older";
  }

  const dayDiff = (startOfDay(now) - startOfDay(new Date(uploadedAt))) / (1000 * 60 * 60 * 24);
  if (dayDiff < 1) return "Today";
  if (dayDiff < 2) return "Yesterday";
  if (dayDiff < 7) return "Previous 7 days";
  if (dayDiff < 30) return "Previous 30 days";
  return "Older";
}

/** Buckets PDFs by upload recency, e.g. "Today" / "Yesterday" / "Previous 7 days" - the
 * grouping a history sidebar conventionally uses when there's no explicit folder to file into. */
export function groupPdfsByDate(pdfs: PdfSummary[]): Array<{ label: string; pdfs: PdfSummary[] }> {
  const now = new Date();
  const buckets = new Map<string, PdfSummary[]>();

  for (const pdf of pdfs) {
    const label = groupLabel(pdf.uploaded_at, now);
    const bucket = buckets.get(label);
    if (bucket) {
      bucket.push(pdf);
    } else {
      buckets.set(label, [pdf]);
    }
  }

  return GROUP_ORDER.filter((label) => buckets.has(label)).map((label) => ({
    label,
    pdfs: buckets.get(label)!,
  }));
}
