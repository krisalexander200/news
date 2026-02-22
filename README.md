# Minimal News Aggregator

A clean, fast news aggregator inspired by Drudge-style scanning, without clutter.

## What it does
- Pulls stories from multiple RSS feeds.
- Deduplicates links across sources.
- Produces an ultra-short TLDR for each story.
- Renders a minimal single-page news wire.

## Default sources
- BBC World
- NPR
- NYTimes Home
- Al Jazeera

You can edit sources in `/Users/us3r-2022/Code/Projects/News/server.js` (`SOURCES` array).

## Run

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## API

`GET /api/news`

Returns:
- `generatedAt`
- `items[]` with `source`, `title`, `link`, `publishedAt`, `tldr`
- `errors[]` if any feed fails

Force refresh cache:

`GET /api/news?refresh=1`

## Notes
- Requires Node 18+ for built-in `fetch`.
- Feed fetches are cached for 3 minutes to keep UI responsive.
