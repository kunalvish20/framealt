import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const root = new URL('../',import.meta.url);
const read = (p) => readFileSync(new URL(p,root),'utf8');

test('server-only secrets are not NEXT_PUBLIC env vars',()=>{
 const env=read('.env.example');
 assert.ok(env.includes('SUPABASE_SERVICE_ROLE_KEY='));
 assert.ok(env.includes('MUX_TOKEN_SECRET='));
 assert.ok(env.includes('MUX_SIGNING_PRIVATE_KEY='));
 assert.ok(env.includes('MUX_WEBHOOK_SECRET='));
 assert.ok(!env.includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'));
 assert.ok(!env.includes('NEXT_PUBLIC_MUX_TOKEN_SECRET'));
});

test('Postgres RLS and role authorization exist',()=>{
 const sql=read('supabase/schema.sql');
 for(const table of ['profiles','projects','project_members','assets','asset_versions','comments','approvals','share_links'])assert.ok(sql.includes(`alter table public.${table} enable row level security`));
 assert.ok(sql.includes('my_project_role'));
 assert.ok(sql.includes('can_edit_project'));
 assert.ok(sql.includes('throttle_share_comment'));
});

test('upload endpoints verify session and project role',()=>{
 const start=read('app/api/upload/start/route.ts');
 const complete=read('app/api/upload/complete/route.ts');
 for(const file of [start,complete]){assert.match(file,/authorized\(req\)/);assert.match(file,/mustEdit\(db,/);}
 assert.match(start,/createMuxUpload/);
 assert.match(complete,/finalizeMuxAsset/);
 assert.match(read('app/api/webhooks/mux/route.ts'),/verifyMuxWebhook/);
});

test('public share API validates access and hashes token',()=>{
 assert.match(read('lib/shares.ts'),/hashToken\(token\)/);
 assert.match(read('app/api/media/read/route.ts'),/resolveShare\(token\)/);
 assert.match(read('app/api/public-share/[token]/comment/route.ts'),/throttle_share_comment/);
});

test('one command local launcher and Mux migration exist',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.scripts.dev,'node scripts/dev.mjs');
 const launcher=read('scripts/dev.mjs');
 assert.match(launcher,/NODE_ENV: 'development'/);
 assert.match(launcher,/'dev', '-H', '0\.0\.0\.0'/);
 assert.ok(existsSync(new URL('supabase/mux-migration.sql',root)));
 assert.match(read('supabase/mux-migration.sql'),/mux_playback_id/);
});
