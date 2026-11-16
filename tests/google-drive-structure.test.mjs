import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p,root),'utf8');

test('Google Drive OAuth, DB and server-side token encryption exist',()=>{
 const core=read('lib/google-drive.ts');
 assert.match(core,/createCipheriv\('aes-256-gcm'/);
 assert.match(core,/createDecipheriv\('aes-256-gcm'/);
 assert.match(core,/code_challenge_method: 'S256'/);
 assert.match(core,/DRIVE_SCOPE = 'https:\/\/www.googleapis.com\/auth\/drive.readonly'/);
 assert.match(core,/refresh_token/);
 const sql=read('supabase/google-drive-migration.sql');
 assert.match(sql,/google_drive_connections/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public.google_drive_connections from anon, authenticated/);
 assert.match(sql,/source_provider/);
 assert.match(sql,/external_owner_id/);
 const env=read('.env.example');
 for(const name of ['GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_TOKEN_ENCRYPTION_KEY'])assert.ok(env.includes(name+'='));
 for(const name of ['GOOGLE_CLIENT_SECRET','GOOGLE_TOKEN_ENCRYPTION_KEY'])assert.ok(!env.includes('NEXT_PUBLIC_'+name));
});

test('Authenticated Drive listing, import and disconnect endpoints',()=>{
 for(const route of ['app/api/integrations/google/start/route.ts','app/api/integrations/google/files/route.ts','app/api/integrations/google/import/route.ts','app/api/integrations/google/connection/route.ts','app/api/integrations/google/from-login/route.ts']){
  assert.ok(existsSync(new URL(route,root)),route);
  assert.match(read(route),/authorized\(req\)/,route);
 }
 assert.match(read('app/api/integrations/google/import/route.ts'),/mustEdit\(db,body.projectId\)/);
 assert.match(read('app/api/integrations/google/import/route.ts'),/googleFile\(user.id,body.fileId\)/);
 assert.match(read('app/api/integrations/google/files/route.ts'),/nextPageToken/);
 assert.match(read('app/api/integrations/google/files/route.ts'),/trashed = false/);
});

test('Drive playback uses signed URL and per-request membership / share revocation checks',()=>{
 const readRoute=read('app/api/media/read/route.ts');
 const stream=read('app/api/media/google/route.ts');
 assert.match(readRoute,/createPlaybackToken/);
 assert.match(stream,/verifyPlaybackToken/);
 assert.match(stream,/project_members/);
 assert.match(stream,/share_links/);
 assert.match(stream,/Range:range/);
 assert.match(stream,/googleAccessToken/);
 assert.match(read('app/api/assets/delete/route.ts'),/source_provider/);
});

test('UI and complete Google Cloud configuration guide included',()=>{
 assert.match(read('app/login/page.tsx'),/signInWithOAuth/);
 assert.match(read('app/drive/page.tsx'),/All files/);
 assert.match(read('app/project/[id]/page.tsx'),/drive\?project=/);
 assert.match(read('docs/GOOGLE-DRIVE-SETUP-HINDI.md'),/Google Cloud setup/);
});
