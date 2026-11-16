# FreeFrame Cloud — Supabase + R2 + Google Drive linked media

A one-command **Next.js media-review starter** with a secure, hosted backend. This project was built for a Supabase + Cloudflare R2 architecture after inspecting the user-provided `freeframe-main.zip` (upstream FreeFrame, MIT-licensed). **This is a separate, smaller cloud implementation, not a drop-in migration or a complete clone of upstream FreeFrame.** See the feature matrix below.

## Google Drive connected workflow (new)

This edition adds **Sign in with Google & Drive**, read-only Drive OAuth, encrypted server-side provider credentials, All files / My Drive / Shared / Starred browsing, search/pagination, linked video/image/audio versions, secure streaming with HTTP Range support, and existing timecoded feedback, approvals, and project sharing for linked files. **Drive file bytes stay in the user's Google Drive**; Supabase holds review metadata. **MEGA account integration is not shipped.**

**Google setup (mandatory):** Run `supabase/google-drive-migration.sql` after `supabase/schema.sql`. Follow [docs/GOOGLE-DRIVE-SETUP-HINDI.md](docs/GOOGLE-DRIVE-SETUP-HINDI.md) for Google Cloud OAuth credentials, read-only scope, redirect URIs, Google test users and environment values. Google's `drive.readonly` scope is restricted and requires public-app verification and possibly a third-party security assessment before production launch.

## Quick start (Windows/macOS/Linux)

Requires Node.js 20.19+; **no Python, Redis, Docker or local PostgreSQL required** for this edition. Supabase + Google Cloud accounts/credentials and one-time OAuth setup are required for Drive-connected review; R2 credentials are only needed for direct uploads.

```bash
npm install
cp .env.example .env.local
# Windows PowerShell: Copy-Item .env.example .env.local
# Fill .env.local, run both Supabase SQL files, configure Google Cloud OAuth; R2 is optional for Drive-only
npm run dev
```

Visit `http://localhost:3000`. Start in `/login` and create an account (or sign in).

> `npm install` cannot provision your external accounts. Without Supabase keys and completed SQL setup, sign-in/reviews cannot work. Google Drive requires Google OAuth setup; R2 uploads need R2 keys/CORS. Do not paste API secrets in chat or commit `.env.local`.

## Setup 1 — Supabase (5 steps)

1. Open https://supabase.com/dashboard and create a Supabase project.
2. Dashboard → **SQL Editor → New query**. Paste `supabase/schema.sql` and **Run**. This creates tables, policies, triggers and functions. It's designed for a fresh Supabase project.
3. Dashboard → **Project Settings → API**. Copy Project URL + publishable/anon key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Put the **service_role / secret** key into `SUPABASE_SERVICE_ROLE_KEY` (server only).
4. Dashboard → **Authentication → Providers → Email**. Enable email/password. You can enable or disable email confirmation for development. In production, **keep verification ON**, configure proper SMTP and set your production site URL/redirect URLs.
5. Dashboard → **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` for local development, and add `http://localhost:3000/**` as a redirect URL (plus your future production domain). You can manage users in **Authentication → Users** and media metadata in **Table Editor**.

Existing upstream FreeFrame SQLAlchemy database rows **cannot simply be pasted into these tables**. This is a fresh schema, requiring a separate migration if you already have data.

## Setup 2 — Cloudflare R2 (optional for Drive-only; 6 steps)

1. Open https://dash.cloudflare.com → **R2 Object Storage** → **Create bucket**.
2. Name the bucket `freeframe-media` (or choose your own name for `R2_BUCKET`). Use Standard storage. **Keep the bucket private**; do not enable public `r2.dev` access.
3. R2 → **Manage R2 API Tokens** → create an R2 API key for **this bucket only**, with **Object Read & Write** permissions. Copy Account ID, Access Key ID and Secret Access Key into `.env.local`.
4. Select your bucket → **Settings → CORS Policy** and paste the JSON from `docs/r2-cors.json`. For production replace `http://localhost:3000` with your actual app domain too.
5. In `docs/r2-cors.json`, `ETag` must be listed in `ExposeHeaders` or large multipart uploads cannot finish. Video playback requires GET/HEAD access and may use range requests.
6. Keep the R2 API keys **server-side**. Browser uploads go to **short-lived signed URLs**; users never get your permanent storage credentials.

Cloudflare R2 Standard includes a limited free tier (10 GB-month at time of writing); a 1 TB library is **not free**. Media objects live in R2, not Supabase Storage.

## Setup 3 — Environment variables (include Google credentials from the Google guide)

| Variable | Where it comes from | Visibility |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API settings | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key | Browser-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service/secret key | SERVER ONLY |
| `R2_ACCOUNT_ID` | Cloudflare R2 Account ID | SERVER ONLY |
| `R2_ACCESS_KEY_ID` | R2 API token access ID | SERVER ONLY |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret | SERVER ONLY |
| `R2_BUCKET` | Bucket name | Server |
| `NEXT_PUBLIC_APP_URL` | Public app root, e.g. `http://localhost:3000` | Browser-safe |

**Never** prefix `SUPABASE_SERVICE_ROLE_KEY`, `R2_SECRET_ACCESS_KEY` or `R2_ACCESS_KEY_ID` with `NEXT_PUBLIC_`. Never send secrets to client components.

## Feature matrix: what is and is not included

| Capability | FreeFrame Cloud starter | Original uploaded FreeFrame |
|---|---|---|
| `npm install` then `npm run dev` (after credentials) | Yes | No; original needs Python/Redis/workers and DB |
| Supabase email/password + Google sign-in Auth | Yes | No; original has custom auth |
| Supabase Postgres + RLS | Yes | Original SQLAlchemy/Postgres; not Supabase Auth/RLS |
| Private Cloudflare R2 storage | Yes | Original S3-compatible backend (can configure R2) |
| Link user's Google Drive media without duplicating storage | **Yes** (Google read-only OAuth) | Not originally present |
| Browse/search Drive files and folders | **Yes** | Not originally present |
| Connect MEGA accounts | **No** | Not present |
| Projects + asset list | Yes | Yes |
| Direct media upload | Yes | Yes |
| Multipart video uploads (50 MiB chunks, 3 concurrent) | Yes | Yes |
| Media version uploads | Yes | Yes |
| Timecoded comments and CSV export | Yes | Yes + NLE-native exports |
| Secure expiring share links / guest comments | Yes | Yes, more granular |
| Team roles (owner, editor, viewer) | Yes, existing-account addition | Yes, full invitations |
| Approvals / changes requested | Yes, per logged-in reviewer | Yes, advanced workflow |
| Automatic FFmpeg transcoding / HLS adaptive playback | **No** | Yes |
| Drawing on video frames / threaded annotations | **No** | Yes |
| Synchronized side-by-side version comparison | **No** | Yes |
| SMTP invitation delivery and password-protected share links | **No** | Yes |
| Automated R2 retention/orphan cleanup, background jobs | **No** | Yes |

Google Drive-linked media streams from the private signed proxy, without R2 upload. The edition uses the browser's native video/audio playback: **MP4 (H.264/AAC) is a practical default**. Unsupported codecs and some MOV/ProRes footage will need preprocessing for browser playback. Large uploads are direct to R2, not routed through Vercel; high-volume production workflows still require dedicated video transcode workers, metadata extraction, retention scheduling and observability.

## How to use the app

1. Sign up at `/login` (email or Google + Drive) and create a project. Existing email users can connect Drive from `/drive`.
2. Upload a video, photo or audio file. The browser PUTs directly to the private R2 bucket, then the API checks object size before confirming metadata in Supabase.
3. Select a media asset and pause at any timecode. Leave feedback; click a timestamp to jump to that point.
4. For revisions, use **+** beside the version selector. Previous versions and comments remain accessible.
5. Click **Share** to create a guest link (1–90 day expiry). Copy the link immediately (the raw token is deliberately not stored in Supabase).
6. Reviewers can comment without an account. Signed GET URLs expire and are reissued during active viewing.
7. Team owner: **Team** → add an existing registered email as editor/viewer. Users **must register first**; this edition does not email invitations.
8. Approve/request changes on any selected version. Export review comments to CSV.

## Where is everything managed?

**Supabase**: Authentication → Users (logins), Table Editor → `projects`, `project_members`, `assets`, `asset_versions`, `comments`, `approvals`, `share_links`, `profiles`; SQL Editor to manage schema/RLS; logs & backups per plan.

**Cloudflare R2**: Bucket → Objects to browse files. Object keys begin `projects/<project-id>/<asset-id>/...`; R2 Settings for storage & billing; R2 CORS for browser uploads.

**Vercel**: Deploy with repo root as app root; add the same environment variables in Project Settings → Environment Variables; set `NEXT_PUBLIC_APP_URL=https://your-domain.com`, update Supabase Auth URL configuration and R2 CORS. Node.js runtime is required for AWS SDK signing.

## Security details

- Supabase Auth tokens are verified server-side using `auth.getUser(jwt)`. All user-facing DB read policies are enforced using Postgres RLS. User membership is checked before issuing **any** R2 signature.
- The **service-role key** is used only from server-side code, where explicit authorization checks precede privileged operations.
- R2 objects are private. Signed GET URLs last 30 minutes, signed upload URLs 15 minutes. Treat signed links as temporary bearer tokens; anybody holding one can use it while valid.
- Share tokens are cryptographically random and stored only as SHA-256 hashes; the plain token is shown once.
- Share guest comments are rate-limited in PostgreSQL. **For high-traffic production**, add Cloudflare WAF/Turnstile protection, trusted IP handling at your ingress and quotas/abuse reporting.
- Only signed-in project members can view project records or create member comments. Owner/editor can upload and generate shares. Owner can add members.
- Uploader completion checks object size with R2 HEAD before publishing version metadata.
- Supabase Free tier may pause inactive databases. Production should plan automated DB backups and R2 replication/versioning.

## Limitations / work before a paid production launch

- No FFmpeg/HLS processor, MP4 proxy renditions, thumbnails, 4K adaptive streaming or true frame-accurate SMPTE timecode. Add an async processor (Cloudflare Queues + container worker / VM) before supporting professional original formats.
- No transactional bulk-delete workflow or automated lifecycle cleanup for abandoned multipart uploads. **Set a Cloudflare R2 lifecycle rule to abort incomplete multipart uploads**, e.g. after 7 days; implement a scheduled cleanup of stale Supabase `asset_versions`.
- No interactive asset annotations, per-comment thread replies, mention notifications, granular password-protected links or advanced audit logs.
- No true resumable uploads after browser reload (multipart supports per-part retry during same session). Persistent upload restoration requires a separate state machine.
- `npm run dev` was built for the standard Node package ecosystem; **no live Supabase/R2 credentials were supplied in this session** so external integration could not be verified here.
- Do not use the default Supabase email provider for high-volume production email: add SMTP.

## Developers

```bash
npm run dev       # Next.js frontend and route handlers
npm run build     # Production build
npm start         # Run production bundle
npm run lint      # TypeScript check
npm test          # Basic Node tests
```

### Data and storage flow

```text
Browser -> Supabase Auth (email/password)
Browser -> Supabase PostgREST (RLS protected project/review data)
Browser -> Next.js /api/* (verified Auth, project role check)
Next.js -> Cloudflare R2 (sign upload/GET; objects never public)
Browser -> R2 presigned PUT (direct file chunks)
Next.js -> R2 HEAD & Supabase metadata update
Guest -> Next.js /api/public-share/<token> (hash lookup + restrictions)
```

### Credits

Upstream inspiration: https://github.com/Techiebutler/freeframe — MIT License. This is a new hosted-backend implementation built for a different stack; the original full-stack backend has **not** been ported wholesale. The included FreeFrame logo asset comes from the user-supplied archive under that project's MIT license.


### Google-only deployment

If using **only linked Google Drive** media, R2 credentials may remain unset: R2 is called only for direct uploads and R2-backed assets. Keep AWS SDK dependencies installed. Google OAuth, Supabase project permissions and Drive streaming still require Google/Supabase credentials and SQL migration. To enable **Upload media** to R2 as well, fill and configure R2 credentials and CORS.

## Review Studio V2 (new)

For the new dark grid, folders, V1/V2/V3 review stacks, drawing annotations, version-specific comments, reply/resolve controls, and public/private share workflows, see **`docs/REVIEW-STUDIO-V2-HINDI.md`**.

Existing database: run **`supabase/media-library-migration.sql`**, then **`supabase/review-workflow-migration.sql`** in the same Supabase project. Do not rerun the base schema on a populated database without a backup. Original Google Drive files stay in Google Drive. R2 remains optional for local-computer uploads.

**Note:** full integration/production build has not been verified without installing dependencies and connecting valid cloud credentials. Browser video codecs (e.g. some MOV/HEVC) may need a conversion/transcoding service beyond this release.
