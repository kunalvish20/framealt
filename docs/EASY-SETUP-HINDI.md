# FreeFrame Cloud — Easy Hinglish Setup

Naye cloud **video uploads Mux** par jaate hain. Images/audio aur existing files Google Drive se link ho sakte hain. Cloudflare R2 ki zaroorat sirf purane R2 uploads ko play/delete karne ke liye hai.

## Pehli baar setup

1. Node.js 20.19+ install karo; project folder mein `npm install` chalao.
2. Supabase project banao. Fresh database par SQL Editor mein `schema.sql` → `google-drive-migration.sql` → `media-library-migration.sql` → `review-workflow-migration.sql` → `workflow-status-migration.sql` → `mux-migration.sql` (sab `supabase/` folder se) run karo.
3. Supabase Project Settings → API se URL, publishable/anon key aur server-only service-role key `.env.local` mein bharo.
4. Mux Dashboard mein Access Token, Signing Key aur live webhook banao. Paanch Mux env values `.env.local` mein bharo. Exact clicks: [MUX-SETUP-HINDI.md](MUX-SETUP-HINDI.md).
5. Supabase Authentication → Providers → Email enable karo. URL Configuration mein local `http://localhost:3000` aur deployed domain configure karo.
6. `npm run dev` chalao; `http://localhost:3000/login` par sign in, project banao, **Upload video** try karo. Video Mux process karne ke baad review mein dikhega.

Google Drive media link karne ke liye [GOOGLE-DRIVE-SETUP-HINDI.md](GOOGLE-DRIVE-SETUP-HINDI.md) follow karo.

## Kya kahan manage hoga?

- Login, projects, review comments: Supabase
- Naye uploaded videos: Mux Dashboard → Video
- Linked files: owner ka Google Drive
- Hosting: Vercel ya koi Next.js Node host; live webhook URL `https://YOUR-DOMAIN/api/webhooks/mux`

## Common errors

- `Configure MUX_TOKEN_ID`: Mux placeholders ko real values se replace karke server restart karo.
- `source_provider check` ya `mux_playback_id` missing: Supabase mein `supabase/mux-migration.sql` run karo.
- Mux upload error: Access Token mein Mux Video Read + Write permissions aur same environment check karo.
- Upload complete, video gayab: Mux encoding pending hai. Webhook URL/secret check karo aur kuch der baad refresh karo.
- Playback error: Signing Key ID aur base64 private key same Mux environment ke hone chahiye.
- Google Drive images/audio: cloud upload button video-only hai; Drive se **Link to review** use karo.

Secrets ko `NEXT_PUBLIC_` se prefix na karo, chat mein mat bhejo, aur `.env.local` Git par commit mat karo.
