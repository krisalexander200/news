# NewsDrip

NewsDrip is a multi-source news aggregator with two user surfaces:
- Web app (`apps/web/public`)
- Native mobile app (`apps/mobile`, Expo React Native)

A Node API at the repo root aggregates feeds, deduplicates stories, generates short TLDRs, and serves both clients.

## Project Structure

- `/Users/us3r-2022/Code/Projects/News/server.js`: API + static web host
- `/Users/us3r-2022/Code/Projects/News/apps/web/public`: web UI files
- `/Users/us3r-2022/Code/Projects/News/apps/mobile`: Expo mobile app

## Run Web Surface

```bash
cd /Users/us3r-2022/Code/Projects/News
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Run Mobile Surface

Start the API first:

```bash
cd /Users/us3r-2022/Code/Projects/News
npm start
```

Then start Expo:

```bash
cd /Users/us3r-2022/Code/Projects/News/apps/mobile
npm install
npm start
```

Or from root:

```bash
npm run start:mobile
```

Run API + mobile together:

```bash
cd /Users/us3r-2022/Code/Projects/News
npm run dev:mobile
```

### Mobile API Base URL

The mobile app reads `EXPO_PUBLIC_API_BASE_URL`.

Defaults:
- iOS simulator: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000`

For a physical device, set your LAN IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000 npm start
```

If mobile says it cannot reach the API, open `http://<your-lan-ip>:3000/api/news` in iPhone Safari first.

For production/store builds, set `EXPO_PUBLIC_API_BASE_URL` to your deployed API (for example Render/Railway/Fly).

Important: production/TestFlight builds cannot use `localhost`. Build with a public API URL, for example:

```bash
cd /Users/us3r-2022/Code/Projects/News/apps/mobile
EXPO_PUBLIC_API_BASE_URL=https://your-deployed-api.example.com npx eas-cli build --platform ios --profile production
```

### Deploy API to Render (Blueprint)

This repo includes `/Users/us3r-2022/Code/Projects/News/render.yaml` for one-click API deploy.

1. In Render, create a new Blueprint/Web Service from this GitHub repo.
2. Deploy the `newsdrip-api` service.
3. After deploy, copy the service URL (example: `https://newsdrip-api.onrender.com`).
4. Confirm API is live:
   - `https://<your-render-url>/api/news`
5. Set that URL for mobile production builds:

```bash
cd /Users/us3r-2022/Code/Projects/News/apps/mobile
npx eas-cli secret:create --scope project --name EXPO_PUBLIC_API_BASE_URL --value https://<your-render-url>
```

6. Rebuild and submit:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --latest
```

## Build for iOS and Android (EAS)

1. Install and authenticate EAS CLI:

```bash
npx eas-cli login
```

2. Set mobile env vars:

```bash
cp /Users/us3r-2022/Code/Projects/News/apps/mobile/.env.example /Users/us3r-2022/Code/Projects/News/apps/mobile/.env
```

Edit `/Users/us3r-2022/Code/Projects/News/apps/mobile/.env` and set:
- `EXPO_PUBLIC_API_BASE_URL` to your deployed API URL
- Optional IDs: `EXPO_PUBLIC_IOS_BUNDLE_ID`, `EXPO_PUBLIC_ANDROID_PACKAGE`

3. Initialize EAS project once:

```bash
cd /Users/us3r-2022/Code/Projects/News/apps/mobile
npx eas-cli init
```

Copy the generated project ID into `EXPO_PUBLIC_EAS_PROJECT_ID` (in `.env` or your shell).

4. Build production binaries:

```bash
cd /Users/us3r-2022/Code/Projects/News
npm run mobile:build:ios
npm run mobile:build:android
```

5. Submit to stores:

```bash
npm run mobile:submit:ios
npm run mobile:submit:android
```

Notes:
- iOS requires an Apple Developer account.
- Android submission uses Google Play Console.
- EAS will guide credential setup (certificates/keystores) on first run.

## API

`GET /api/news`

Returns:
- `generatedAt`
- `items[]` with `source`, `title`, `link`, `publishedAt`, `tldr`, `image`
- `errors[]`

Force refresh cache:

`GET /api/news?refresh=1`

## Notes

- Requires Node 18+.
- Feed fetches are cached for 3 minutes.
- Mobile surface is production-build ready through Expo + EAS.
