import { NextRequest } from 'next/server';
import { authorized, bad, fail, HttpError, isUuid, json, mustEdit, supabaseAdmin } from '@/lib/server';
export const runtime = 'nodejs';

type Folder = { id: string; project_id: string; parent_id: string | null };

async function getFolder(projectId: string, folderId: unknown): Promise<Folder> {
  bad(isUuid(folderId), 'Invalid folder ID.');
  const { data } = await supabaseAdmin().from('project_folders')
    .select('id,project_id,parent_id').eq('id', folderId).eq('project_id', projectId).maybeSingle();
  if (!data) throw new HttpError(404, 'Folder not found in this project.');
  return data as Folder;
}

export async function POST(req: NextRequest) {
  try {
    const { db, user } = await authorized(req);
    const body = await json(req);
    bad(isUuid(body.projectId), 'Invalid project ID.');
    await mustEdit(db, body.projectId);
    const admin = supabaseAdmin();
    if (body.action === 'create_folder') {
      bad(typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 120, 'Folder name must be 1-120 characters.');
      const parentId = body.parentId ?? null;
      if (parentId !== null) await getFolder(body.projectId, parentId);
      const { data, error } = await admin.from('project_folders').insert({
        project_id: body.projectId, parent_id: parentId, name: body.name.trim(), created_by: user.id,
      }).select('id').single();
      if (error) throw new HttpError(409, 'Could not create folder. A folder with this name may already exist.');
      return Response.json({ ok: true, folderId: data.id });
    }
    if (body.action === 'rename_folder') {
      await getFolder(body.projectId, body.folderId);
      bad(typeof body.name === 'string' && body.name.trim().length > 0 && body.name.trim().length <= 120, 'Invalid name.');
      const { error } = await admin.from('project_folders').update({ name: body.name.trim() }).eq('id', body.folderId).eq('project_id', body.projectId);
      if (error) throw new HttpError(409, 'Could not rename folder. Name may already exist.');
      return Response.json({ ok: true });
    }
    if (body.action === 'move_folder') {
      await getFolder(body.projectId, body.folderId);
      const target = body.targetFolderId ?? null;
      if (target !== null) await getFolder(body.projectId, target);
      if (target === body.folderId) throw new HttpError(400, 'Cannot move a folder into itself.');
      const { error } = await admin.from('project_folders').update({ parent_id: target }).eq('id', body.folderId).eq('project_id', body.projectId);
      if (error) throw new HttpError(409, 'Cannot move folder. Destination may be inside this folder.');
      return Response.json({ ok: true });
    }
    if (body.action === 'rename_asset') {
      bad(isUuid(body.assetId),'Invalid asset ID');
      bad(typeof body.name==='string'&&body.name.trim().length>0&&body.name.trim().length<=240,'File name must be 1–240 characters.');
      const {data,error}=await admin.from('assets').update({name:body.name.trim()}).eq('id',body.assetId).eq('project_id',body.projectId).select('id').maybeSingle();
      if(error||!data)throw new HttpError(404,'Cannot rename file in this project.');
      return Response.json({ok:true});
    }
    if (body.action === 'move_asset') {
      bad(isUuid(body.assetId), 'Invalid file ID.');
      const target = body.targetFolderId ?? null;
      if (target !== null) await getFolder(body.projectId, target);
      const { data, error } = await admin.from('assets').update({ folder_id: target })
        .eq('id', body.assetId).eq('project_id', body.projectId).select('id').maybeSingle();
      if (error || !data) throw new HttpError(404, 'Could not move file in this project.');
      return Response.json({ ok: true });
    }
    if (body.action === 'delete_folder') {
      await getFolder(body.projectId, body.folderId);
      const [{ count: subfolders }, { count: files }] = await Promise.all([
        admin.from('project_folders').select('id', { count: 'exact', head: true }).eq('parent_id', body.folderId),
        admin.from('assets').select('id', { count: 'exact', head: true }).eq('folder_id', body.folderId),
      ]);
      if (subfolders || files) throw new HttpError(409, 'Folder is not empty. Move files and subfolders before deleting.');
      const { error } = await admin.from('project_folders').delete().eq('id', body.folderId).eq('project_id', body.projectId);
      if (error) throw new HttpError(409, 'Could not delete folder.');
      return Response.json({ ok: true });
    }
    throw new HttpError(400, 'Unsupported folder action.');
  } catch (err) { return fail(err); }
}
