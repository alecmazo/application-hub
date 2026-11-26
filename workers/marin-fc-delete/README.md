# marin-fc-delete

Cloudflare Worker that accepts a one-tap Delete from the Marin FC reports hub (GitHub Pages). It checks a passcode and a report slug, then dispatches `.github/workflows/delete-report.yml` on `alecmazo/application-hub`.

CORS is limited to `https://alecmazo.github.io`. Year-to-date pages (Season Trend, Player Cards pages including fixed single-game pages, Pro-Style Analytics) and `assets` cannot be deleted this way.

## Secrets (do not commit)

Set these with `wrangler secret put` or the Cloudflare API (never commit values):

- `DELETE_PASSCODE_HASH` — SHA-256 hex of the shared passcode Alec chooses (the plaintext passcode is not stored on the Worker)
- `DELETE_GITHUB_TOKEN` — a fine-grained GitHub token on `alecmazo/application-hub` with Contents: Write and Actions: Write

The live workflow is `.github/workflows/delete-report.yml`.

The account does not yet have a `workers.dev` subdomain. The pages point at `https://marin-fc-delete.alecmazo.workers.dev`, which assumes the account subdomain is created as `alecmazo`. If Cloudflare assigns a different subdomain, update `DELETE_API_URL` in `/workspace/veo/share/build_reports.py` and rebuild the report pages.

Deploy is blocked until those secrets exist. A dry run of the package is: `npx wrangler deploy --dry-run`.
