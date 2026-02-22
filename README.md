# DripWire

DripWire is a multi-source news aggregator with two user surfaces:
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

## Run Mobile Surface (Started)

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

### Mobile API Base URL

The mobile app reads `EXPO_PUBLIC_API_BASE_URL`.

Defaults:
- iOS simulator: `http://localhost:3000`
- Android emulator: `http://10.0.2.2:3000`

For a physical device, set your LAN IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.50:3000 npm start
```

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
- Mobile implementation is now bootstrapped and connected to the API; next steps are native polish and platform packaging.
