# NewsDrip

NewsDrip displays original, attributed news headlines in a web interface and an Expo React Native app. Readers open the original publisher website to read an article.

The release pipeline uses documented Creative Commons sources: eligible Global Voices-created headlines and Wikinews. Wikinews is now an archive; stories older than 30 days are excluded, so the current feed comes from Global Voices. Guest and visibly restricted Global Voices partner content is excluded. No images, excerpts, AI headline rewriting, or unverified legacy publisher feeds are served.

Source and author credits, article links, and license links remain visible in both compact and detailed modes. See [the rights audit](docs/content-rights-audit.md) and [public source documentation](docs/content-sources.html).

## Run

Install root dependencies with `npm ci`, then run `npm start`. Open http://localhost:3000. The backend in `server.js` serves `apps/web/public`.

For mobile, install dependencies in `apps/mobile`, then run `npm start` there. Set `EXPO_PUBLIC_API_BASE_URL` to a device-accessible HTTPS backend for production; production EAS configuration uses https://news-8ih0.onrender.com.

## Verify

```sh
node --test tests/content-policy.test.js
node scripts/check-live-feeds.js
cd apps/mobile
EXPO_PUBLIC_API_BASE_URL=https://news-8ih0.onrender.com npx expo export --platform ios --output-dir /tmp/newsdrip-ios-export
```

The live check needs network access. An exported bundle confirms compilation, not physical-device or signed-build testing.

## API

`GET /api/news` returns `generatedAt`, `items`, and source `errors`. Each item includes the original `title`, `originalTitle`, `source`, `author`, `link`, `publishedAt`, `licenseName`, `licenseUrl`, `policyUrl`, `attribution`, and `changes`. Compatibility fields `tldr` and `image` are empty. `?refresh=1` bypasses the three-minute cache. If all publishers fail, the last successful in-process feed may be returned with `stale: true`; otherwise the endpoint returns 503.

`/healthz`, `/privacy-policy`, and `/content-sources` are public endpoints.

## Deployment and review

Render auto-deploys the configured repository using `render.yaml`. The free service can sleep when idle, increasing cold-start loading time. Verify real production headlines after deployment, not just process health.

From `apps/mobile`, authenticate the official EAS CLI and run `eas build --platform ios --profile production`. The production profile increments the build number. Upload the resulting signed build to TestFlight, test it on a physical device, and record the flow before preparing resubmission. See [review response and recording checklist](docs/app-review-response.md). Do not reuse rejected build 8 screenshots or claim AI summaries in store metadata.
