# FreeFrame Cloud — Supabase + Mux video + Google Drive linked media

A one-command **Next.js media-review starter**. New direct video uploads use Mux; linked video, image and audio files remain in Google Drive. Existing R2 assets remain readable when their old credentials are configured. **This is a separate, smaller cloud implementation, not a drop-in migration or a complete clone of upstream FreeFrame.** See the feature matrix below.

## Google Drive connected workflow (new)

This edition adds **Sign in with Google & Drive**, read-only Drive OAuth, encrypted server-side provider credentials, All files / My Drive / Shared / Starred browsing, search/pagination, linked video/image/audio versions, secure streaming with HTTP Range support, and existing timecoded feedback, approvals, and project sharing for linked files. **Drive file bytes stay in the user's Google Drive**; Supabase holds review metadata. **MEGA account integration is not shipped.**

**Google setup (for Drive-linked media):** Run `supabase/google-drive-migration.sql` after `supabase/schema.sql`; the Mux migration also depends on its provider column. Follow [docs/GOOGLE-DRIVE-SETUP-HINDI.md](docs/GOOGLE-DRIVE-SETUP-HINDI.md) for Google Cloud OAuth credentials, read-only scope, redirect URIs, Google test users and environment values. Google's `drive.readonly` scope is restricted and requires public-app verification and possibly a third-party security assessment before production launch.

## Quick start (Windows/macOS/Linux)

Requires Node.js 20.19+; **no Python, Redis, Docker or local PostgreSQL required**. Supabase is required. Mux credentials are required for direct video uploads; Google Cloud credentials are required for Drive-linked reviews.

```bash
npm install
cp .env.example .env.local
# Windows PowerShell: Copy-Item .env.example .env.local
# Fill .env.local, run the Supabase migrations, and configure Mux / Google Cloud as needed
npm run dev
```

Visit `http://localhost:3000`. Start in `/login` and create an account (or sign in).

> `npm install` cannot provision your external accounts. Without Supabase keys and completed SQL setup, sign-in/reviews cannot work. Follow [Mux setup](docs/MUX-SETUP-HINDI.md) for direct video uploads and [Google Drive setup](docs/GOOGLE-DRIVE-SETUP-HINDI.md) for linked media. Do not paste API secrets in chat or commit `.env.local`.

## Setup 1 — Supabase (5 steps)

1. Open https://supabase.com/dashboard and create a Supabase project.
2. Dashboard → **SQL Editor → New query**. Paste `supabase/schema.sql` and **Run**. This creates tables, policies, triggers and functions. It's designed for a fresh Supabase project.
3. Dashboard → **Project Settings → API**. Copy Project URL + publishable/anon key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Put the **service_role / secret** key into `SUPABASE_SERVICE_ROLE_KEY` (server only).
4. Dashboard → **Authentication → Providers → Email**. Enable email/password. You can enable or disable email confirmation for development. In production, **keep verification ON**, configure proper SMTP and set your production site URL/redirect URLs.
5. Dashboard → **Authentication → URL Configuration**: set Site URL to `http://localhost:3000` for local development, and add `http://localhost:3000/**` as a redirect URL (plus your future production domain). You can manage users in **Authentication → Users** and media metadata in **Table Editor**.

Existing upstream FreeFrame SQLAlchemy database rows **cannot simply be pasted into these tables**. This is a fresh schema, requiring a separate migration if you already have data.

## Setup 2 — Mux video uploads

Run `supabase/google-drive-migration.sql` and then `supabase/mux-migration.sql` after the base schema. Create a Mux Video Read/Write access token, a signing key and a production webhook. Put their five values in `.env.local` and your hosted server environment. Full dashboard steps: [docs/MUX-SETUP-HINDI.md](docs/MUX-SETUP-HINDI.md). New cloud upload accepts **video only**. Each video version counts as a separate Mux asset; check the [current free-plan limit](https://www.mux.com/pricing).

## Setup 3 — Environment variables (include Google credentials from the Google guide)

| Variable | Where it comes from | Visibility |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API settings | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key | Browser-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service/secret key | SERVER ONLY |
| `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` | Mux Access Token | SERVER ONLY |
| `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_PRIVATE_KEY` | Mux Signing Key | SERVER ONLY |
| `MUX_WEBHOOK_SECRET` | Mux Webhook signing secret | SERVER ONLY |
| `R2_*` | Only for legacy R2 versions | SERVER ONLY |
| `NEXT_PUBLIC_APP_URL` | Public app root, e.g. `http://localhost:3000` | Browser-safe |

**Never** prefix `SUPABASE_SERVICE_ROLE_KEY`, any Mux secret or R2 secret with `NEXT_PUBLIC_`. Never send secrets to client components.

## Feature matrix: what is and is not included

| Capability | FreeFrame Cloud starter | Original uploaded FreeFrame |
|---|---|---|
| `npm install` then `npm run dev` (after credentials) | Yes | No; original needs Python/Redis/workers and DB |
| Supabase email/password + Google sign-in Auth | Yes | No; original has custom auth |
| Supabase Postgres + RLS | Yes | Original SQLAlchemy/Postgres; not Supabase Auth/RLS |
| Private Mux video streaming | Yes, signed playback | Original S3-compatible backend |
| Link user's Google Drive media without duplicating storage | **Yes** (Google read-only OAuth) | Not originally present |
| Browse/search Drive files and folders | **Yes** | Not originally present |
| Connect MEGA accounts | **No** | Not present |
| Projects + asset list | Yes | Yes |
| Direct video upload | Yes, Mux chunked upload | Yes |
| Direct image/audio upload | No; use linked Google Drive files | Yes |
| Media version uploads | Yes | Yes |
| Timecoded comments and CSV export | Yes | Yes + NLE-native exports |
| Secure expiring share links / guest comments | Yes | Yes, more granular |
| Team roles (owner, editor, viewer) | Yes, existing-account addition | Yes, full invitations |
| Approvals / changes requested | Yes, per logged-in reviewer | Yes, advanced workflow |
| HLS adaptive playback | **Yes, via Mux for new video uploads** | Yes |
| Drawing on video frames / threaded annotations | **No** | Yes |
| Synchronized side-by-side version comparison | **No** | Yes |
| SMTP invitation delivery and password-protected share links | **No** | Yes |
| Automated orphan cleanup / background jobs | **No** | Yes |

Google Drive-linked media streams from the private signed proxy. Mux accepts direct browser video uploads and produces HLS playback. Google Drive media still uses the browser's native codecs; MP4 (H.264/AAC) is a practical default. Large video bytes go from the browser to Mux, not through the Next.js server.

## How to use the app

1. Sign up at `/login` (email or Google + Drive) and create a project. Existing email users can connect Drive from `/drive`.
2. Upload a video to Mux, or link video/image/audio from Google Drive. Mux processing may take a few minutes before playback is ready.
3. Select a media asset and pause at any timecode. Leave feedback; click a timestamp to jump to that point.
4. For revisions, use **+** beside the version selector. Previous versions and comments remain accessible.
5. Click **Share** to create a guest link (1–90 day expiry). Copy the link immediately (the raw token is deliberately not stored in Supabase).
6. Reviewers can comment without an account. Playback URLs are signed and expire; the player refreshes them as needed.
7. Team owner: **Team** → add an existing registered email as editor/viewer. Users **must register first**; this edition does not email invitations.
8. Approve/request changes on any selected version. Export review comments to CSV.

## Where is everything managed?

**Supabase**: Authentication → Users (logins), Table Editor → `projects`, `project_members`, `assets`, `asset_versions`, `comments`, `approvals`, `share_links`, `profiles`; SQL Editor to manage schema/RLS; logs & backups per plan.

**Mux**: Dashboard → Video for uploaded videos; Settings for Access Tokens, Signing Keys and Webhooks. Legacy R2 objects remain in Cloudflare R2 if you used the old uploader.

**Vercel**: Deploy with repo root as app root; add the same environment variables in Project Settings → Environment Variables; set `NEXT_PUBLIC_APP_URL=https://your-domain.com`, update Supabase Auth URL configuration and set the Mux webhook URL to `https://your-domain.com/api/webhooks/mux`. Node.js runtime is required for Mux JWT signing.

## Security details

- Supabase Auth tokens are verified server-side using `auth.getUser(jwt)`. All user-facing DB read policies are enforced using Postgres RLS. Membership or a valid guest share is checked before issuing signed Mux playback URLs.
- The **service-role key** is used only from server-side code, where explicit authorization checks precede privileged operations.
- New Mux videos use signed playback IDs. Treat temporary playback links as bearer tokens; anybody holding one can use it until expiry. Legacy R2 objects still use signed URLs.
- Share tokens are cryptographically random and stored only as SHA-256 hashes; the plain token is shown once.
- Share guest comments are rate-limited in PostgreSQL. **For high-traffic production**, add Cloudflare WAF/Turnstile protection, trusted IP handling at your ingress and quotas/abuse reporting.
- Only signed-in project members can view project records or create member comments. Owner/editor can upload and generate shares. Owner can add members.
- Mux asset-ready webhooks are signature-verified before marking a video ready in Supabase. The uploader also polls Mux while its page remains open.
- Supabase Free tier may pause inactive databases. Production should plan automated DB backups and retain original footage separately from Mux.

## Limitations / work before a paid production launch

- Mux transcodes new video uploads for HLS playback; it does not preserve the exact original file. True frame-accurate SMPTE timecode and original-format download are not implemented.
- No scheduled cleanup for abandoned Mux uploads or stale Supabase `asset_versions`. Mux direct upload URLs expire after one day.
- No interactive asset annotations, per-comment thread replies, mention notifications, granular password-protected links or advanced audit logs.
- Chunk retries work during the open browser session; upload restoration after browser reload is not implemented.
- Live Mux/Supabase integration requires your own credentials and webhook configuration; it cannot be verified from the repository alone.
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
Next.js -> Mux API (create direct upload, check asset status)
Browser -> Mux Direct Upload (video chunks)
Mux -> Next.js webhook (signed asset-ready event)
Next.js -> Supabase (mark version ready, save Mux playback ID)
Member/guest -> Next.js (authorized signed Mux playback URL)
Guest -> Next.js /api/public-share/<token> (hash lookup + restrictions)
```

### Credits

Upstream inspiration: https://github.com/Techiebutler/freeframe — MIT License. This is a new hosted-backend implementation built for a different stack; the original full-stack backend has **not** been ported wholesale. The included FreeFrame logo asset comes from the user-supplied archive under that project's MIT license.


### Google-only deployment

If using **only linked Google Drive** media, Mux credentials may remain unset. R2 credentials are needed only for old R2 versions. Google OAuth, Supabase project permissions and Drive streaming still require Google/Supabase credentials and SQL migration.

## Review Studio V2 (new)

For the new dark grid, folders, V1/V2/V3 review stacks, drawing annotations, version-specific comments, reply/resolve controls, and public/private share workflows, see **`docs/REVIEW-STUDIO-V2-HINDI.md`**.

Existing database: run any missing **`supabase/media-library-migration.sql`**, **`supabase/review-workflow-migration.sql`**, **`supabase/workflow-status-migration.sql`**, then **`supabase/mux-migration.sql`** in the same Supabase project. Do not rerun the base schema on a populated database without a backup. Original Google Drive files stay in Google Drive.

**Note:** live Mux upload/playback and webhook delivery require valid external credentials. Browser playback for Google Drive-linked originals still depends on the source codec.
