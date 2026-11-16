# FreeFrame Cloud — Easy Hinglish Setup

**Google Drive se direct review chahiye?** First-time steps ke saath `supabase/google-drive-migration.sql` run karo aur `docs/GOOGLE-DRIVE-SETUP-HINDI.md` follow karo. Sign in with Google / Drive permission Google Cloud Console se configure karni hogi.

## Pehli baar setup (sirf ek baar)

1. ZIP extract karo, VS Code me folder `FreeFrame-Supabase-R2` open karo.
2. Node.js 20.19+ installed hona chahiye. Terminal me `npm install` chalao.
3. https://supabase.com/dashboard → New project banao.
4. SQL Editor → New query → `supabase/schema.sql` ka **poora** code paste karo → Run. Ye database, permissions aur admin policies create karega.
5. Supabase → Project Settings → API: Project URL aur `anon`/publishable key copy karo. Supabase ka **service_role**/secret key sirf `.env.local` me dalna hai. Kisi ko share nahi karna.
6. Cloudflare Dashboard → R2 Object Storage → Create Bucket → `freeframe-media` → **private bucket**.
7. R2 → Manage R2 API Tokens → Create (Object Read/Write, restrict to `freeframe-media`) → Account ID, Access Key ID, Secret Access Key copy karo.
8. R2 bucket → Settings → CORS Policy → `docs/r2-cors.json` ka JSON paste karo → Save. Production me `https://YOUR-APP.vercel.app` actual Vercel URL kar do.
9. Project root me `.env.example` ki copy `.env.local` banao. Usme Supabase aur R2 ki 7 values fill karo; `NEXT_PUBLIC_APP_URL=http://localhost:3000` rakho.
10. Supabase → Authentication → Providers → Email: Email/password active karo. Auth → URL Configuration: Site URL `http://localhost:3000` rakho, redirect allowlist me `http://localhost:3000/**` add karo.
11. Terminal me `npm run dev` → browser `http://localhost:3000/login` → **Create account** → sign in → Create project → video upload.

## Har roz ke liye

Bas folder open → terminal me `npm run dev` → browser me `http://localhost:3000`.

## Kya kahan manage karoge?

- **Login/users:** Supabase Dashboard → Authentication → Users
- **Projects/team/comments/approval:** Supabase → Table Editor
- **Media video/images/audio:** Cloudflare → R2 → Buckets → `freeframe-media` → Objects
- **Hosting:** Vercel (env values + same Next.js project)
- **Team roles:** Website → project → Team, existing account email add/remove
- **Client link:** Website → project → Share → days choose → copy URL; Revoke from same modal

## Common errors

- `Supabase is not configured`: `.env.local` missing/wrong or server restart nahi kiya.
- `relation public.projects does not exist`: Supabase SQL migration run nahi hua.
- `new row violates row-level security policy`: sign-in session ya wrong project role; Supabase RLS bypass mat karo.
- `R2 403`, `CORS`: Bucket CORS me localhost/production origin add karo; browser upload ka `Content-Type` signed content se same hona chahiye.
- `ETag not exposed`: Cloudflare R2 CORS `ExposeHeaders` me `ETag` add karo.
- `video plays nahi hota`: video codec browser-compatible hona chahiye; MP4 H.264/AAC easiest. ProRes/MOV ke liye FFmpeg converter alag chahiye.
- `Guest link expired`: new share create karo. Share token database me plaintext store nahi hota, isliye old link dobara copy nahi hoga.
- `Invite says not_registered`: employee ko pehle `/login` pe account create karna hoga.
- `npm install` network error: internet / NPM registry connectivity check karo. `npm run dev` se pehle packages install hone chahiye.

**Note:** Ye Supabase + R2 cloud edition hai. Original uploaded FreeFrame ka poora FFmpeg + Celery + Redis backend isme port nahi hua; exact advanced feature-parity ke liye alag migration required hai.
