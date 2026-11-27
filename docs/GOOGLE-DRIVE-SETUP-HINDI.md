# FreeFrame × Google Drive — Complete setup (Hinglish)

Is implementation mein **Google login + read-only Google Drive access + project review** integrate hua hai. Google Drive media ko Mux ya R2 par dobara upload nahi karna padta. Supabase mein comments / approvals / memberships / versions ki metadata store hoti hai. Drive owner connection disconnect kare ya file permission revoke kare to linked media playback band ho jayega.

## 1. Database (sirf first-time)

- New Supabase project hai to pehle `supabase/schema.sql` SQL Editor mein run karo.
- **Uske baad** `supabase/google-drive-migration.sql` SQL Editor mein run karo.
- Old project already setup hai to bas second migration run karna hai. Migration repeat kar sakte ho.
- `google_drive_connections` table par RLS enabled hai aur browser ko access nahi diya gaya. Tokens encrypted form mein table mein store hote hain.

## 2. Google Cloud setup (zaroori)

1. https://console.cloud.google.com/ open karo → same Google Cloud project select / create.
2. **APIs & Services → Library** mein **Google Drive API** enable karo.
3. **Google Auth Platform → Branding** mein app name/support email fill karo.
4. **Audience**: testing mein `External` + test users mein apna Gmail add karo (ya approved internal setup).
5. **Data Access / Scopes** mein `https://www.googleapis.com/auth/drive.readonly` request karo. Is scope mein **full read-only Drive list/download** permission milti hai; app aapke files delete/edit nahi karega. Scope restricted hai: public launch se pehle Google verification aur possible annual security assessment required ho sakta hai. See official [scope guide](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).
6. **Clients → Create Client → Web application**: name `FreeFrame Web`.
7. **Authorized JavaScript origins**:
   - `http://localhost:3000`
   - production mein `https://YOUR-DOMAIN.COM`
8. **Authorized redirect URIs** mein **do local callback destinations** add karo:
   - `https://YOUR-SUPABASE-PROJECT.supabase.co/auth/v1/callback` — Supabase Google Login
   - `http://localhost:3000/api/integrations/google/callback` — existing logged-in users ke liye Drive connect
   - Live domain ke liye `https://YOUR-DOMAIN.COM/api/integrations/google/callback` bhi add karo
9. Google Web Client ID aur Client Secret copy karo.

> Supabase Auth → Providers → **Google enable** karo aur **same Google Web Client ID / Secret** use karo. Supabase Auth → URL Configuration mein `http://localhost:3000/login?google=1`, `http://localhost:3000/**` aur production callback URL allowlist mein add karo. Google settings mein Supabase callback URI exact match honi chahiye.

## 3. Environment variables

`.env.example` copy karke `.env.local` banao. Supabase credentials ke saath ye 4 Google fields fill karo. Mux credentials direct video upload ke liye alag se chahiye:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=123456789012-xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
GOOGLE_TOKEN_ENCRYPTION_KEY=GENERATE_A_RANDOM_64_OR_MORE_CHAR_SECRET
```

Security key generator (terminal):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Output jo mile use `GOOGLE_TOKEN_ENCRYPTION_KEY` mein paste karo. Is key ko change karne par existing Google tokens decrypt nahi honge aur users ko reconnect karna hoga. **Mux + Supabase secret keys `NEXT_PUBLIC_` ke saath kabhi nahi rakho.**

## 4. Run and try

```bash
npm install
npm run dev
```

1. `http://localhost:3000/login` → **Continue with Google & Drive**.
2. Google consent par Drive read-only access allow karo; automatic connection successful ho to `/drive` open hoga.
3. Existing email/password user: website ke sidebar → **Google Drive → Connect Google Drive**.
4. Drive library mein All files / My Drive / Shared with me / Starred, folders, search, 100-per-page pagination available hai.
5. **Review destination** project select karo → Video/image/audio file par **Link to review** click karo.
6. Project open karo → video par play/pause, timestamp comment, approve/change request, version attach, team member, secure guest review link.
7. Project mein **Google Drive** button ya version toolbar mein cloud icon se directly import kar sakte ho. New version ke liye same media kind choose karo.
8. Ek Drive folder ke sab videos ko ek version stack banana ho to folder kholo, review destination select karo, aur **Import folder videos as versions** dabao. Drive `createdTime` ke ascending order mein V1, V2, V3 assign honge. Naya video add hone par isi button ko dobara dabao; already linked videos duplicate nahi honge aur naya video next version banega. Is action ke liye folder ko manually resync karna padta hai.
9. **Disconnect** karne par Google files delete nahi hongi; linked file playback connection restore hone tak unavailable rahega.

## 5. File behaviour

- **Google Docs / Sheets / Slides, PDFs, ZIP, folders** library mein dikhte hain; review ke liye direct import **sirf browser-compatible video / audio / image** supported hai. Docs ko **View** se Google Drive mein khol sakte ho.
- **Google Drive origin file** Drive mein hi rehta hai; linked review metadata Supabase mein hai. Naye direct video uploads Mux par jaate hain; R2 sirf purane uploaded assets ke liye hai.
- **Google Drive editor/owner permissions** app supersede nahi kar sakta. Owner file delete / permission remove kare to preview fail ho sakta hai.
- Playback backend proxy pe byte ranges use karta hai; Google download quotas, browser codecs aur hosting provider ki transfer/time limits apply hongi. MP4 (H.264/AAC) browser playback ke liye practical hai. **High-volume 4K / large-video serving ke liye streaming-capable Node host and transcoding/CDN pipeline needed.**
- MEGA ka **Google jaisa same OAuth flow is edition mein ready nahi hai**. MEGA account/file API + decrypting SDK integration alag build, provider approvals aur review workflow validation maangta hai. Current UI MEGA connected hone ka claim nahi karti.

## 6. Production requirements

- Google OAuth publishing / restricted-scope verification and (if applicable) third-party security assessment complete karo.
- Verified HTTPS domain, privacy policy, data deletion instructions, token revocation / disconnect UX, server logging redaction, provider rate limits, WAF, data retention policy set karo.
- Google consent **Testing** mode ka refresh token expire ho sakta hai (Google may limit to 7 days), so demo users ko reconnect karna padega.
- Supabase project's Google provider settings, Google redirect URIs, `.env.local` production origin, Mux webhook URL and Supabase Redirect URLs synchronize karo.
- **We have not run live OAuth/Drive requests**, because this ZIP contains placeholders and no Google or Supabase credentials were provided. Run the integration end-to-end with a test Google account before production.
