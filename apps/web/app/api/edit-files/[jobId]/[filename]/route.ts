// Proxies apps/api's GET /files/{job_id}/{filename} so the browser only
// ever talks to this Next.js origin — apps/api stays server-to-server only
// (same reasoning as the brainstorm tools' FastAPI calls, see
// app/(app)/actions.ts). Needed for the <video> preview/final players and
// the download link in VideoEditor.tsx.
import { getCurrentUser } from "@/lib/auth";

const API_BASE = process.env.API_BASE_URL || "http://localhost:8001";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string; filename: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { jobId, filename } = await params;
  const upstream = await fetch(
    `${API_BASE}/files/${encodeURIComponent(jobId)}/${encodeURIComponent(filename)}`
  );
  if (!upstream.ok || !upstream.body) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentLength = upstream.headers.get("content-length");
  if (contentType) headers.set("Content-Type", contentType);
  if (contentLength) headers.set("Content-Length", contentLength);

  return new Response(upstream.body, { headers });
}
