# Pre-launch checklist

- [ ] SQL executed on the intended Supabase project; RLS enabled for every table
- [ ] Supabase Auth email verification enabled; SMTP configured
- [ ] Supabase Auth site URL and redirect allowlist set to your exact domain
- [ ] `supabase/mux-migration.sql` run; Mux Video Read/Write token and Signing Key belong to the same environment
- [ ] Mux webhook points to `https://YOUR-DOMAIN/api/webhooks/mux`; webhook signing secret set on the server
- [ ] Secret keys never exposed in frontend bundles / Git / messages
- [ ] Test member vs. nonmember project reads and signed Mux playback access
- [ ] Test share expiry, share revocation and comment abuse/rate limiting
- [ ] Test small and large video uploads, Mux processing, signed HLS playback and thumbnails
- [ ] Add WAF protections for public guest comment endpoint and request signing API
- [ ] Add abandoned Mux upload and expired metadata maintenance
- [ ] Retain original footage separately; add database backups and monitoring
- [ ] Test Mux transcoding for the actual source codecs you accept
- [ ] Stress test concurrent version uploads and optimistic-version collision behavior
- [ ] Confirm Mux asset count, delivery limits and any spend alerts
- [ ] Test upload rollback when Mux or Postgres errors occur

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
