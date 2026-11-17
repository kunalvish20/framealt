import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=(f)=>readFileSync(new URL(f,root),'utf8');
test('library has nested folder operations, version cards and access-gated API',()=>{
 const page=read('app/project/[id]/page.tsx');
 for(const term of ['create_folder','rename_folder','move_folder','move_asset','delete_folder','current_version','project_folders','FileCover'])assert.ok(page.includes(term),term);
 const api=read('app/api/library/organize/route.ts');
 assert.match(api,/await mustEdit\(db, body.projectId\)/);assert.match(api,/supabaseAdmin\(\)/);
 const sql=read('supabase/media-library-migration.sql');
 assert.match(sql,/enable row level security/);assert.match(sql,/Cannot move a folder into its own descendant/);
});
test('timecoded markup is per-version and saved with authenticated/guest comments',()=>{
 const page=read('app/project/[id]/review/page.tsx');
 assert.match(page,/setDraftMarks/);assert.match(page,/annotation:draftMarks\.length/);
 assert.match(page,/c\.annotation/);assert.match(page,/assetVersions/);
 const share=read('app/share/[token]/page.tsx');
 assert.match(share,/annotation:marks\.length/);assert.match(share,/ReviewPlayer/);
 assert.match(read('components/review/ReviewPlayer.tsx'),/MarkupLayer/);
 const api=read('app/api/public-share/[token]/comment/route.ts');
 assert.match(api,/validReviewMarks\(body.annotation\)/);
 assert.match(api,/throttle_share_comment/);
 const sql=read('supabase/review-workflow-migration.sql');
 assert.match(sql,/ADD COLUMN IF NOT EXISTS annotation jsonb/);
 assert.match(sql,/Reply must belong to the same project and video version/);
});
test('private membership and public hashed expiry/revocable links remain separate',()=>{
 const share=read('app/api/share-links/route.ts');
 assert.match(share,/hashToken\(token\)/);assert.match(share,/expires_at/);
 const media=read('app/api/media/google/route.ts');
 assert.match(media,/project_members/);assert.match(media,/revoked_at/);
 const reviewer=read('app/project/[id]/review/page.tsx');
 assert.match(reviewer,/Private review link \(login required\)/);
 assert.match(reviewer,/Public \/ Private share/);
 assert.ok(existsSync(new URL('app/api/comments/resolve/route.ts',root)));
});


test('Google Drive media file clicks open internal Review Studio instead of Drive preview',()=>{
 const page=read('app/drive/page.tsx');
 assert.match(page,/kind\(f\)\?void link\(f\):openFile\(f\)/);
 assert.match(page,/router\.push\(`\/project\/\$\{projectId\}\/review\?asset=/);
 assert.match(page,/Open in Review Studio/);
 assert.match(page,/linkedKey\(f:DriveFile\)/);
});
test('annotation-only authenticated and guest feedback is accepted by UI',()=>{
 const reviewer=read('app/project/[id]/review/page.tsx');
 const guest=read('app/share/[token]/page.tsx');
 assert.match(reviewer,/!draft\.trim\(\)\&\&!draftMarks\.length/);
 assert.match(guest,/!message\.trim\(\)\&\&!marks\.length/);
});

test('Google Drive import reopens existing asset instead of duplicating version',()=>{
 const api=read('app/api/integrations/google/import/route.ts');
 assert.match(api,/alreadyLinked:true/);
 assert.match(api,/if\(!body\.assetId\)/);
 assert.match(api,/eq\('project_id',body\.projectId\)/);
});
