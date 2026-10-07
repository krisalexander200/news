# NewsDrip

NewsDrip displays original, attributed news headlines in a web interface and an Expo React Native app. Readers open the original publisher website to read an article.

The release pipeline uses documented Creative Commons sources: eligible Global Voices-created headlines and Wikinews. Wikinews is now an archive; stories older than 30 days are excluded, so the current feed comes from Global Voices. Guest and visibly restricted Global Voices partner content is excluded. No images, excerpts, AI headline rewriting, or unverified legacy publisher feeds are served.

Source and author credits, article links, and license links remain visible beneath each headline. See [the rights audit](docs/content-rights-audit.md) and [public source documentation](docs/content-sources.html).

## Current headline feed

28 sources are configured in `config/news-sources.json`. The backend displays original headlines, publication names and links, without article text or summaries; feed-supplied images are displayed when available. The Sources page lists every configured publication. Drudge uses a third-party FeedPress feed; Reuters uses Google News search RSS rather than a direct Reuters feed agreement.

Risk ratings are operational judgments, not legal clearance. High means restrictive conditions or an unverified intermediary; Medium means applicable native-app reuse permission remains unresolved; Low requires explicit applicable permission. Public feed access alone is not permission. No configured publisher currently has a Low rating.

The live check on October 6 returned 280 headlines from 26 sources. CNN failed to fetch and Politico returned HTTP 403. Each feed is checked independently; failures do not suppress working publishers. Stories older than seven days are excluded. Balanced selection prevents one outlet from crowding out the others.

## Run and verify

Install dependencies, then run `npm start`. The web app and API use the same backend. Run `node --test tests/content-policy.test.js` and `node scripts/check-live-feeds.js` to verify parsing, freshness, source variety and actual publisher access.

`GET /api/news` returns `generatedAt`, `items`, `errors`, and per-source `sourceStatus`. `?refresh=1` bypasses the three-minute cache. If every publisher fails, a previous in-process response may be returned with `stale: true`; otherwise the endpoint returns 503. `/healthz`, `/privacy-policy`, and `/content-sources` are public endpoints.

## Release

Render auto-deploys main. EAS production builds use the production Render API. Physical-device checks, revised store screenshots, publisher rights decisions and App Review submission remain separate release steps. Do not describe this expanded feed as fully licensed or reuse the old TLDR screenshots.

Feed image display was enabled by user request on October 6. The headline-only risk workbook does not establish image reuse permission. Pictures come only from explicit RSS/Atom image fields, without scraping article pages; unavailable pictures collapse.
