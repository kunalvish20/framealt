import { NextRequest } from 'next/server';
import { authorized, bad, fail } from '@/lib/server';
import { googleApi, googleFile, type GoogleFile } from '@/lib/google-drive';
export const runtime='nodejs';
export async function GET(req:NextRequest) {
  try {
    const {user}=await authorized(req);
    const folder=req.nextUrl.searchParams.get('folder')||'root';
    const page=req.nextUrl.searchParams.get('page')||'';
    const search=req.nextUrl.searchParams.get('search')?.trim()||'';
    const view=req.nextUrl.searchParams.get('view')||'all';
    bad(['all','mydrive','shared','starred'].includes(view),'Invalid library view');
    bad(folder==='root'||/^[\w-]{5,256}$/.test(folder),'Invalid folder');
    bad(page.length<2000 && search.length<=120,'Invalid pagination or search');
    const q = search
      ? `name contains '${search.replace(/\\/g,'\\\\').replace(/'/g,"\\'")}' and trashed = false`
      : folder!=='root' ? `'${folder}' in parents and trashed = false`
      : view==='all' ? 'trashed = false'
      : view==='shared' ? 'sharedWithMe = true and trashed = false'
      : view==='starred' ? 'starred = true and trashed = false'
      : `'root' in parents and trashed = false`;
    const params:Record<string,string>={
      q, fields:'nextPageToken,incompleteSearch,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,parents,description)',
      pageSize:'100', orderBy:'folder,name', supportsAllDrives:'true', includeItemsFromAllDrives:'true',
      corpora:(view==='all'||!!search)?'allDrives':'user',
    };
    if(page)params.pageToken=page;
    const [response,currentFolder]=await Promise.all([
      googleApi(user.id, 'files', params),
      !search&&folder!=='root'?googleFile(user.id,folder):Promise.resolve(null),
    ]);
    const body=await response.json() as {nextPageToken?:string;incompleteSearch?:boolean;files:GoogleFile[]};
    return Response.json({files:body.files||[],nextPageToken:body.nextPageToken||null,incompleteSearch:!!body.incompleteSearch,folder:currentFolder}, {headers:{'Cache-Control':'no-store'}});
  } catch(e){return fail(e);}
}
