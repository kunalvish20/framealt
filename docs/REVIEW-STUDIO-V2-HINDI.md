# FreeFrame Review Studio V2 — Hindi Setup & Usage

## Kya change hua

- Project open karne par Frame-style **dark Files Grid** dikhta hai.
- Nested folders: **New / Rename / Move / Delete empty folder**. Folders ki organization Supabase mein save hoti hai, asli Drive files move nahi hoti.
- Video cards par **V1, V2, V3** badges aur versions ka count hota hai. Latest version card ke andar dikhta hai.
- Google Drive videos ke liye Drive metadata se thumbnail aur duration lene ki koshish hoti hai. Browser/Drive preview na mile to fallback icon aata hai.
- File open karne par full-screen dark review UI with native play/pause/seek and previous version selector.
- Pen, arrow, box, circle, pin draw karo, usi video time par **comment submit** karo. Markup comment aur version se linked rehta hai.
- Team comments automatically ~12 seconds par refresh; version change se har version ke separate comments/approval decisions dikhte hain.
- Comments reply, resolve/reopen, CSV export; owner/editor approved/needs changes manage kar sakte hain.
- Public review links no login (expiring/revocable); guest comment + markup optional. Private reviewer URL login aur project membership ke bina open nahi hogi.

## First-time Supabase SQL order

Apna **correct Supabase project** select karo. SQL Editor mein ye files sequence mein run karna:

1. `supabase/schema.sql` — sirf fresh DB ke liye. Existing data ho to dobara run karne se pehle backups/checks.
2. `supabase/google-drive-migration.sql` — existing Google Drive-linked integration. Agar pehle run ho chuka, skip.
3. `supabase/media-library-migration.sql` — new folder table aur asset folder pointer (IMPORTANT).
4. `supabase/review-workflow-migration.sql` — markups, comment replies/resolved statuses, version duration (IMPORTANT).
5. `supabase/workflow-status-migration.sql` — Files Grid ke editable status labels ke liye.

Existing project mein pehle 2 SQL already applied hain to **step 3, 4 aur 5** run karo. Agar 3 aur 4 pehle ho chuke hain to sirf step 5 run karo. `asset_versions does not exist` error ka matlab first schema missing ya wrong Supabase project.

## .env.local

Existing Google OAuth aur Supabase values **unchanged** rakho; `.env.example` ke hisab se fill karo:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_PRIVATE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=YOUR_PRIVATE_CLIENT_SECRET
GOOGLE_TOKEN_ENCRYPTION_KEY=YOUR_RANDOM_32_PLUS_CHAR_SECRET
```

Mux env values are needed for direct video uploads; Google Drive-linked media does not require Mux. R2 env values are only for legacy R2 assets. No Docker required.

## Run

```bash
npm install
npm run dev
```

- `http://localhost:3000` — public homepage
- `http://localhost:3000/dashboard` — login ke baad Projects dashboard
- `http://localhost:3000/drive` — Google Drive files
- Projects → chosen project — Files Grid
- Video card click → Video Review

## Daily workflow

1. `Projects` se project create/open karo.
2. File manager me `+` se folder banao, folder cards double? **Single click** open karta hai.
3. `From Google Drive` kholo, **Review destination** mein project select karo, phir video filename ya **Open in Review Studio** dabao. Video automatically project mein link hokar review player mein khulega. Imported video root mein aayega; card `...` → Move to folder.
4. Video card open karo, review player mein sahi version select karo.
5. Video 00:13 par pause karo, pen/arrow/circle/pin tool select karke draw karo, comment type kar ke **Post** dabao. Markup comment ke saath store hoga.
6. Editor ko invite: `Team` button → existing FreeFrame user email → `Editor`; invitee ke paas account banana zaroori hai.
7. Next cut V2: Review top toolbar `+` → direct Mux video upload (Mux enabled ho) OR Google Drive cloud icon → V2 link. New version pe old comments automatically copy nahi hote; old versions dropdown se accessible hain.
8. Private access: `Public / Private share` → Copy private link. Invitee ko project member hona padega; private project membership grants project-wide review access.
9. Public client link: `Public / Private share` → expiration & guest-comment toggle → Create secure link. Guest comment/markup editor ko same version par dikhega. Active share revoke bhi kar sakte ho.
10. Files Grid ke **Status** sidebar mein label search/select karo to matching files dikhenge. Owner/editor file card ke status button se Needs Review, In Progress, Approved, Attention, Discard, Uploaded ya custom label set kar sakte hain. Viewer filter dekh sakta hai, status badal nahi sakta. "Use review decision" se manual label remove hota hai; per-version approval decisions alag rehte hain.

## Kya abhi Frame.io ke barabar nahi hai

- Yeh **review/annotation** app hai, Adobe Premiere/DaVinci jaisa actual footage trim/render/color-grade editor nahi.
- Google Drive MOV/HEVC/H.265 browser playback unsupported ho sakta hai. Drive video original rehta hai; no HLS transcoding pipeline present. H.264 MP4 browser-friendly hai.
- Thumbnail Google API se mile to dikhega; nahi mila to placeholder, no server-side thumbnail conversion.
- Version stacking supported per asset via V1/V2/V3, but drag multiple video cards to create a stack is NOT implemented; new versions Google Drive / upload flow se link karne hain.
- Team invite existing FreeFrame account ko add karta hai; automatic email invitations nahi bhejta. Public share link manually copy karna hai.
- Real-time presence, sound waveform, region-aware comments beyond on-frame markup, deep NLE integrations, advanced search filters, SSO and email notifications not implemented.
- Full Next.js build/real OAuth/browser playback require installing dependencies and using your live credentials. Automated source checks don't prove production readiness.

## Security notes

- Google OAuth scopes: `drive.readonly`. Google credentials/tokens server-side, encrypted tokens in Supabase table; browser sees short-lived media/thumbnail URLs.
- Public guest comments throttled by DB function. Share token hashed, expiry/revocation checked on media requests.
- Public share URL is a bearer link. Jis ke paas URL hai woh expiry tak dekh sakta hai; sensitive links accidentally share mat karna.
- Private review link authenticated PROJECT members ke liye hai. Viewer access asset-level restricted nahi, poora project visible hota hai.
- Supabase service role key aur Google Client Secret `.env.local` / server-only.
- Real production launch se pehle RLS, app permissions, OAuth verification, media MIME tests, regression tests, browser QA aur Vercel logs verify karein.

## Review Studio direct-click fix (V2.1)

- Google Drive ki supported video/image/audio file par click karoge to external Drive video nahi khulega. Pehle **Review destination** project select karo, phir file name ya **Open in Review Studio** par click karo. File attach hokar internal `/project/<id>/review?asset=<id>` view khulta hai.
- Project ke dark **Files Grid** mein video thumbnail/card par click karne se bhi same internal review route open hota hai.
- Existing linked video phir open karne ke liye **Projects → project → video card** use karo. File ko baar-baar Drive se import mat karo.
- Non-media Google files (e.g. Docs) ab bhi Google Drive mein open hongi.
- Pen/arrow/circle/pin mark karke sirf annotation bhi post kar sakte ho; comment textbox optional hai.
- Browser cache purani UI dikhaye to server stop karke `npm run dev` restart karo. SQL migration order same hai.
