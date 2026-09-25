# The Nightly Reader

A calm, newspaper-like personal reading program spanning contemporary ideas and enduring literature. Each automated edition pairs one current article with a poem and a classic short story. It includes complete on-site public-domain texts, clearly linked modern articles, archive/search, private local notes with CSV export and restorable backups, favorites, progress, settings, and dark mode.

## Architecture

The app is intentionally static-first and dependency-light. Semantic HTML, CSS, and ES modules render the experience; personal state is stored in the browser with `localStorage`. It deploys as static files on Vercel, Netlify, Cloudflare Pages, or any web server. No API key is needed for the seeded experience.

The data boundaries are designed to transfer directly to a small Postgres/Supabase backend:

- `data.js`: `editions`, embedded `works`, authors, tags, provenance, rights, and curriculum metadata.
- `content/full-texts.js`: bundled complete texts for the current edition and sources that do not expose a browser-safe text API. The remaining archive texts load directly from Wikisource and stay inside the reader.
- `generator.js`: pure diversity distribution, scoring, and idempotent edition-generation functions.
- `app.js`: view and personal-state layer (`reading_history`, `favorites`, `notes`, and `settings`).

For a multi-user deployment, replace the local state adapter with authenticated Supabase queries and normalize the supplied objects into `users`, `authors`, `works`, `editions`, `edition_items`, `reading_history`, `favorites`, `notes`, `tags`, and `work_tags`. Add a `pgvector` embedding column later without changing the search UI contract.

## Local setup

Requires Python 3 for the local static server and Node 20+ for checks.

```bash
npm run dev
```

Open `http://localhost:4173`. No environment variables are required for this MVP.

Run verification and produce a deployment folder:

```bash
npm test
npm run build
```

## Daily generation flow

GitHub Actions schedules `.github/workflows/daily-edition.yml` every day at 2:30 p.m. and again at 3:30 p.m. Detroit time. The second run is an idempotent backup in case GitHub delays or drops the first scheduled run. GitHub schedules are best-effort, not guaranteed exact publication times. An independent Vercel cron checks later in the afternoon. A separate 5:30 p.m. local Codex heartbeat is a final monitor while the host is available. The job:

1. Reads publisher-provided feeds from Smithsonian Magazine, Aeon, The Conversation, and The Public Domain Review.
2. Requires at least two healthy feeds and chooses an unused article published within the last 30 days.
3. Penalizes recently repeated publications, authors, and works.
4. Adds one poem and one classic short story from the verified catalog.
5. Stores modern copyrighted material only as feed metadata and a short summary with an outbound link.
6. Writes a dated edition once; reruns are idempotent.
7. Runs the integrity tests and production build before committing.
8. Pushes the generated edition to the public repository and deploys it to Vercel.

If feeds or tests fail, nothing is committed and the last valid edition remains live. Run `npm run generate:daily` for a manual edition or `node scripts/generate-daily.mjs --date=YYYY-MM-DD` for a controlled date.

### Always-on fallback

`vercel.json` also schedules a protected Vercel Function at 20:00 UTC each day. On the Hobby plan Vercel can invoke it at any point in that UTC hour (4–5 p.m. Detroit daylight time, 3–4 p.m. standard time). It checks the public edition, then the GitHub workflow runs; if today's complete edition is absent and no run is active, it dispatches the same idempotent workflow. It does not publish a second edition.

The production Vercel project needs two environment variables before this fallback is deployed:

- `CRON_SECRET`: a random secret; Vercel sends it as a bearer token to the function. This is already configured in the current project.
- `GITHUB_DISPATCH_TOKEN`: a fine-grained GitHub personal access token limited to the `jimripple/the-nightly-reader` repository, with **Actions: Read and write** and no other optional permissions. Store it as a Production environment variable in Vercel, never in the repository or chat. Renew it before its expiration date.

After both variables exist, deploy to production to register the cron. Vercel does not retry a failed cron invocation, so GitHub's two schedules and the local 5:30 p.m. monitor remain as other paths. A missing token makes the endpoint return 503 without dispatching anything.

## Copyright and sources

The classic catalog uses works labeled public domain and links to established repositories or original periodical archives. Complete texts are shown onsite where a verified public-domain source is available. Contemporary copyrighted works remain metadata plus a short publisher-feed summary and outbound link; their full text is never scraped or republished. Unknown metadata remains unknown rather than being inferred.

## Manual regeneration

The hidden **Curator** link in the footer opens the internal view. Its idempotency check demonstrates that rerunning today does not duplicate it. In production, an authenticated curator action should call the same server wrapper with either:

- normal mode: returns today’s existing edition;
- replace-item mode: validates a new candidate, writes a revision/audit record, then atomically swaps one `edition_item`;
- force-new mode: reserved for unpublished failed drafts, never an already published date.

Keep the last valid published edition visible if generation fails. Store structured logs separately from edition content.

## Deployment

Run `npm run build` and deploy `dist/` as the output directory. Configure SPA fallback to `index.html` if the host rewrites hash-free paths; this build uses hash routing and therefore needs no fallback configuration.
