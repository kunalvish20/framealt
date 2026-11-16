# FreeFrame Review Studio V2.1 — Video par click se Review Studio

## Issue aur fix

Purane V2 Google Drive browser me video filename par click karne se Google Drive ka normal player khulta tha. Ab **video / image / audio filename** aur **Open in Review Studio** button, dono chosen project ke internal full Review Studio ko open karte hain.

## Ab kaise use karein

1. Google Drive connect rehna chahiye; `http://localhost:3000/drive` par jao.
2. Upar **Review destination** mein pehle FreeFrame **Project** select karo.
3. Apne media ke naam (jaise `IMG_1646.MOV`) ya **Open in Review Studio** par click karo.
4. Video pehle se project me linked hai, toh wahi versioned asset open hoga; nayi duplicate copy nahi banegi.
5. Full dark review screen URL `/project/<project-id>/review?asset=<asset-id>` hoga.
6. Video pause karo, upar markup toolbar se **Pen / Arrow / Box / Circle / Pin** select karo, video par draw karo aur comment **Post** karo.
7. **Version 1 / 2 / 3** dropdown se previous cuts khol sakte ho. New version: review se Google Drive icon, existing asset ko target karke another file link karo.
8. **Share** se public expiring review link ya private login-required team link manage karo.
9. Files Grid dekhna ho toh **Back to files**. Projects ke andar video cards se Review Studio khulta hai.

## Install

V2.1 ZIP ko naye folder mein extract karo, purane `.env.local` keys (private) safely copy karo, phir `npm install` aur `npm run dev`. Purane database mein V2 ka `media-library-migration.sql` aur `review-workflow-migration.sql` pehle run hona chahiye. Agar already applied hai toh SQL dobara chalane ki zarurat nahi.

## Scope / limitations

Yeh **review/annotation** platform hai, Adobe Premiere jaise actual video trimming/rerendering editor nahi. Browser-compatible video codecs required (Google Drive `MOV`/HEVC videos directly play na bhi karein). UI source checks/tests pass, but without your Google/Supabase credentials full live login/playback QA verify nahi hai.
