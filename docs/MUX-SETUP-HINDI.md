# FreeFrame mein Mux video upload setup

Naye **Upload video** button se video browser se seedha Mux par chunked upload hoti hai. Next.js server Mux API credentials se upload URL banata hai; credentials browser ko nahi bheje jaate. Mux video process karke signed playback deta hai. Supabase projects, versions, comments aur review metadata rakhta hai. Images/audio ke liye existing Google Drive **Link to review** flow use karein. Purane R2 versions tabhi chalenge jab unke R2 credentials rakhe hon.

## 1. Supabase migration

Supabase Dashboard → apna project → **SQL Editor → New query**. Agar Review Studio pehle se chal raha hai, sirf `supabase/mux-migration.sql` paste karke Run karein. Fresh database par is order mein SQL files chalayein: `schema.sql` → `google-drive-migration.sql` → `media-library-migration.sql` → `review-workflow-migration.sql` → `workflow-status-migration.sql` → `mux-migration.sql`. Pehle se populated database par base schema dobara chalane se pehle backup lein.

## 2. Mux account aur credentials

1. [Mux Dashboard](https://dashboard.mux.com/) par account banayein; **Production** environment select karein. Free plan par abhi 10 on-demand video assets ka limit hai, 10 GB quota ka promise nahi. Har naya version ek alag Mux asset count hota hai. [Current pricing](https://www.mux.com/pricing) check karein.
2. **Settings → Access Tokens → Generate token**: Mux Video **Read + Write** permissions. Token ID aur Token Secret copy karein. Ye ek hi baar dikhte hain. [Access token docs](https://www.mux.com/docs/core/make-api-requests)
3. **Settings → Signing Keys → Create signing key**: Key ID aur base64 encoded Private Key copy karein. Ye Access Token se alag hai aur private review playback ke liye zaroori hai. [Signing key docs](https://www.mux.com/docs/guides/signing-jwts)
4. Live site ke liye **Settings → Webhooks → Create endpoint** mein `https://YOUR-DOMAIN.com/api/webhooks/mux` add karein. Webhook ka signing secret copy karein. Ye `video.asset.ready` aane par video ko FreeFrame mein ready karta hai, browser band hone par bhi. [Webhook docs](https://www.mux.com/docs/core/listen-for-webhooks)

## 3. `.env.local` bharein

Project ki `.env.local` mein ye paanch placeholders already add hain. Inhe apni Mux values se replace karein:

```dotenv
MUX_TOKEN_ID=YOUR_MUX_TOKEN_ID
MUX_TOKEN_SECRET=YOUR_MUX_TOKEN_SECRET
MUX_SIGNING_KEY_ID=YOUR_MUX_SIGNING_KEY_ID
MUX_SIGNING_PRIVATE_KEY=YOUR_BASE64_ENCODED_MUX_PRIVATE_KEY
MUX_WEBHOOK_SECRET=YOUR_MUX_WEBHOOK_SIGNING_SECRET
```

`MUX_SIGNING_PRIVATE_KEY` mein Dashboard/API se mila **base64 string** rakhein, PEM lines nahi. Koi bhi Mux secret `NEXT_PUBLIC_` se start na karein. `.env.local` ko Git par commit ya chat mein paste na karein. Hosted deployment (jaise Vercel) mein bhi yehi values project ke server-side Environment Variables mein set karein. `NEXT_PUBLIC_APP_URL` ko exact deployed HTTPS URL rakhein.

## 4. Local test

1. `npm install` aur `npm run dev` chalayein.
2. `http://localhost:3000` par sign in karke project mein **Upload video** se ek chhota MP4 upload karein. Upload ke baad Mux encoding mein waqt lag sakta hai.
3. Local webhook forwarding ke liye doosre terminal mein `npx @mux/cli login` aur phir `npx @mux/cli webhooks listen --forward-to http://localhost:3000/api/webhooks/mux` chalayein. CLI jo signing secret dikhaye, use local `.env.local` ke `MUX_WEBHOOK_SECRET` mein rakhein aur dev server restart karein. Production webhook ka secret local CLI secret se alag ho sakta hai. [Mux CLI guide](https://www.mux.com/docs/core/listen-for-webhooks)
4. Upload ke dauran FreeFrame ke andar Back ya dusre project par ja sakte hain. Corner mein **Mux uploads** panel transfer dikhata rahega; project page ka **Mux uploads** section ready aur pending videos dikhata hai. File transfer poora hone tak browser tab khula rakhein. Tab close/refresh karne par browser file upload continue nahi kar sakta; pending entry ko project se cancel karke dobara upload karein. Mux processing transfer ke baad server webhook se poori hoti hai, browser band hone par bhi.
5. Video ready hone par playback, timeline, comments aur delete check karein. Production mein webhook configure karna zaroori hai.

## Video delete aur organize karna

Project ke **Mux uploads** section mein ready video ke `...` menu se file rename/move, **Delete this version**, ya **Delete entire file** chunein. File card ke `...` menu aur Review Studio ke **Delete media** button se bhi poori file delete kar sakte hain. Confirmation ke baad FreeFrame Mux API se hosted asset permanently delete karta hai, phir Supabase ki version/file aur uske review comments hataata hai. Single version delete karne par baaki versions bachte hain. Last version delete karne par file bhi hat jaati hai. Linked Google Drive original delete nahi hota.

Upload abhi pending ho to **Cancel** use karein; ready video ke delete action se active transfer nahi hatega. Mux API delete fail ho to FreeFrame Supabase record rakhta hai aur error dikhata hai, taaki aap retry kar sakein. Delete ke liye wahi server-side `MUX_TOKEN_ID` aur `MUX_TOKEN_SECRET` chahiye; alag credential nahi.

## 5. Important limits

- Mux video ko streaming format mein transcode karta hai; exact original upload file ka archive nahi. Original footage ki alag copy rakhein. [Mux source-file guidance](https://www.mux.com/docs/core/stream-video-files)
- Free plan mein **10 stored videos**, 100,000 monthly delivery minutes aur on-demand playback hai. Har version alag video hai. Mux ek asset ke liye 12-hour duration limit document karta hai. Plan badalne par pricing dobara check karein.
- New cloud upload video-only hai. Images/audio Google Drive se link ho sakte hain. Existing R2 videos ke playback/delete ke liye old R2 env values tab tak rakhein jab tak unhe migrate ya delete na kar dein.
