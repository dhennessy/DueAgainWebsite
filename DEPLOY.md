# Deploying dueagain.com

The site is static (Ignite output) served by **Cloudflare Pages**, plus one
serverless function for invite universal links.

## Layout

- `index.html`, `css/`, `js/`, `images/`, … — the static marketing site.
- `.well-known/apple-app-site-association` — Apple App Site Association (AASA)
  for universal links. Lists app ID `4T3HN73CF5.com.peerassembly.DueAgain` and
  claims `/invite/*`.
- `_headers` — forces `Content-Type: application/json` on the AASA file (it has
  no extension, so the default type would be wrong).
- `functions/invite/[token].js` — Cloudflare Pages Function that server-renders
  the invite landing page for `https://dueagain.com/invite/<token>`. Tapping an
  invite link opens the app when installed (the OS resolves the AASA claim and
  this function never runs); otherwise it previews the task + an install CTA,
  with dynamic Open Graph tags for rich link unfurling.

## Cloudflare Pages setup (one-time)

1. Create a Pages project connected to the `dhennessy/DueAgainWebsite` repo.
   - Framework preset: **None**. Build command: empty. Output directory: `/`
     (the repo root is the static site; `functions/` is auto-detected).
2. Environment variables (Production + Preview):
   - `SUPABASE_URL` — `https://lqakhqhaxgowkoklhmvn.supabase.co`
   - `SUPABASE_ANON_KEY` — the project's public anon key (safe to expose).
3. Add `dueagain.com` (and `www`) as custom domains, then move the DNS at the
   registrar to Cloudflare. **Cutover note:** GitHub Pages and Cloudflare can't
   both serve the apex at once — switch DNS in one step. The GitHub-Pages
   `CNAME` file is ignored by Cloudflare and can stay.

## Verifying universal links

    curl -sI https://dueagain.com/.well-known/apple-app-site-association
    # → 200, Content-Type: application/json, no redirect

Then open `https://dueagain.com/invite/<a-real-pending-token>` in a browser
(task card) and paste it into Messages (rich unfurl card). On a device with the
app installed, tapping the link should open the app to invite redemption.
