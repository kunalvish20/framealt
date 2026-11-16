# Pre-launch checklist

- [ ] SQL executed on the intended Supabase project; RLS enabled for every table
- [ ] Supabase Auth email verification enabled; SMTP configured
- [ ] Supabase Auth site URL and redirect allowlist set to your exact domain
- [ ] R2 bucket private; R2 token scoped to only the correct bucket
- [ ] R2 CORS limited to actual frontend origins
- [ ] Secret keys never exposed in frontend bundles / Git / messages
- [ ] Test member vs. nonmember project reads and R2 signed URL access
- [ ] Test share expiry, share revocation and comment abuse/rate limiting
- [ ] Test 50 MB, 150 MB and 1 GB file upload, ETag CORS, large-file completion
- [ ] Test browser-supported MP4 playback with range requests
- [ ] Add WAF protections for public guest comment endpoint and request signing API
- [ ] Add abandoned multipart cleanup and expired metadata maintenance
- [ ] Add R2 lifecycle, database backups and alerting/monitoring
- [ ] Add proper FFmpeg rendition workers before claiming HLS/ProRes support
- [ ] Stress test concurrent version uploads and optimistic-version collision behavior
- [ ] Confirm storage/operation usage limits & spend alerts
- [ ] Test upload rollback when R2 or Postgres errors occur

## Google Drive release readiness
- [ ] `supabase/google-drive-migration.sql` run and `google_drive_connections` browser access denied
- [ ] Google Cloud Drive API enabled and OAuth test user approved
- [ ] Google OAuth client ID/secret matches Supabase Google provider
- [ ] All redirect URLs exact and production website HTTPS
- [ ] Drive scope `drive.readonly` restricted-scope verification / security assessment (where applicable) complete
- [ ] Test Google account sign-in and existing email user Connect flow
- [ ] Test pagination, file revocation, refresh, disconnect and sharing access
- [ ] Test seek/range requests on large MP4s via actual production streaming host
- [ ] Publish privacy policy, terms, data deletion process and Google restricted-scope compliance
