# Custom domain checklist

Keep every item incomplete until it has dated evidence.

- [ ] Domain purchased and renewal ownership recorded
- [ ] Authoritative DNS provider identified and access tested
- [ ] Hosting service supplied required A, AAAA, ALIAS, or CNAME records
- [ ] Conflicting DNS records removed
- [ ] DNS propagation verified from multiple resolvers
- [ ] SSL certificate active and trusted
- [ ] HTTP redirects to HTTPS
- [ ] Canonical www or non-www hostname selected and alternate redirected
- [ ] `APP_BASE_URL` matches the canonical HTTPS origin exactly
- [ ] Supabase Site URL updated
- [ ] Supabase email confirmation and password-reset redirect URLs updated
- [ ] Open Graph and canonical URLs use the production origin
- [ ] Agent provider, endpoint, health, and documentation URLs use the production origin
- [ ] Public documentation and legal URLs resolve
- [ ] CORS configuration reviewed; no unnecessary wildcard credentials access
- [ ] Authentication cookies observed as Secure, HttpOnly where applicable, and appropriate SameSite
- [ ] Security headers verified on the public origin
- [ ] No localhost, loopback, preview, temporary-port, or unsupported submission URLs exposed
- [ ] `npm run verify:deployment` passes against the canonical domain
