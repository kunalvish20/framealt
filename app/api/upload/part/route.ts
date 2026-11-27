// R2 multipart uploads have been replaced by Mux Direct Uploads.
export const runtime = 'nodejs';
export async function POST() {
  return Response.json({ error: 'Use the Mux upload URL returned by /api/upload/start.' }, { status: 410 });
}
