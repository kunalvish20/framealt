import { NextRequest } from 'next/server';
import { authorized, bad, fail, HttpError, isUuid, json, mustEdit, supabaseAdmin } from '@/lib/server';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest) {
  try {
    const { db } = await authorized(req);
    const body = await json(req);
    bad(isUuid(body?.projectId) && isUuid(body?.assetId), 'Invalid file or project');
    await mustEdit(db, body.projectId);

    const status = body.status === null ? null : typeof body.status === 'string' ? body.status.trim() : undefined;
    bad(status === null || (typeof status === 'string' && status.length >= 1 && status.length <= 40 && !/[\u0000-\u001f\u007f]/.test(status)), 'Status must be 1–40 characters');

    const { data: asset } = await db.from('assets').select('id').eq('id', body.assetId).eq('project_id', body.projectId).maybeSingle();
    if (!asset) throw new HttpError(404, 'File not found in this project');

    const { data, error } = await supabaseAdmin().from('assets').update({ workflow_status: status })
      .eq('id', body.assetId).eq('project_id', body.projectId).select('id,workflow_status').single();
    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') throw new HttpError(409, 'Run supabase/workflow-status-migration.sql in Supabase first.');
      throw error;
    }
    return Response.json({ assetId: data.id, status: data.workflow_status });
  } catch (error) {
    return fail(error);
  }
}
