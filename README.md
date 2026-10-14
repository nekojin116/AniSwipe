# ⚡ AniSwipe

Swipe through anime and log what you've watched straight to your **AniList** list — a Tinder-style
deck for backfilling your watch history in seconds.

- **→ / right swipe** → marked as **Completed** on AniList (watched / read)
- **↑ / up swipe** → added as **Plan to watch** (plan to read)
- **← / left swipe** → skip
- **Z** → undo your last add

Decks per media type: **Popular**, **Top rated**, **This season / Ongoing**, and **Search** — with
an experimental **Manga** section alongside anime, including an origin filter
(**All / 🇯🇵 Manga / 🇰🇷 Manhwa / 🇨🇳 Manhua**). Titles already on your AniList are hidden by
default (requires login — the filter uses your authenticated list).

## Stack

- [Vite](https://vitejs.dev/) + React + TypeScript
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- [Framer Motion](https://www.framer.com/motion/) for the swipe physics
- [AniList GraphQL API](https://docs.anilist.co/) for all anime data + list mutations
- One tiny serverless function (`api/token.mjs`) for the OAuth token exchange — the client secret
  never reaches the browser
- Deploys to [Vercel](https://vercel.com/) as a Vite app + serverless function

## 1. Create an AniList application

1. Go to <https://anilist.co/settings/developer> → **Create New Application**.
2. Name it whatever you like (e.g. `AniSwipe`).
3. Set the **Redirect URL** exactly to the origin you'll run it on:
   - Local dev: `http://localhost:5173/`
   - Production: `https://your-app.vercel.app/` *(no path, trailing slash included)*
4. Save. You'll get a **Client ID** and a **Client Secret**. The secret is used server-side only
   (by `api/token.mjs`) to exchange the authorization code — never put it in a `VITE_` variable.

> **Note:** AniList's docs still describe the Implicit Grant (`response_type=token`), but the live
> API now rejects it with `unsupported_grant_type`. This app uses the Authorization Code Grant.

> AniList allows one redirect URL per app. For local dev + production, either create two
> applications (recommended) or update the redirect URL when you deploy.

## 2. Configure environment

```bash
cp .env.example .env
```

```dotenv
VITE_ANILIST_CLIENT_ID=1234
VITE_ANILIST_REDIRECT_URI=http://localhost:5173/
ANILIST_CLIENT_SECRET=your_client_secret
```

## 3. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:5173/>, click **Continue with AniList**, approve, and swipe.

## 4. Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Or push the repo to GitHub and **import it on [vercel.com](https://vercel.com)** — Vercel detects
Vite automatically (`npm run build` → `dist/`).

Then set the project's **Environment Variables**:

| Key | Value |
| --- | --- |
| `VITE_ANILIST_CLIENT_ID` | your client id |
| `VITE_ANILIST_REDIRECT_URI` | `https://your-app.vercel.app/` |
| `ANILIST_CLIENT_SECRET` | your client secret (**no** `VITE_` prefix) |

and make sure the same URL is the Redirect URL in the AniList developer settings.

The `api/token.mjs` file is deployed automatically as a serverless function — no extra config.

## How it works

- **Auth**: OAuth2 [Authorization Code Grant](https://docs.anilist.co/guide/auth/authorization-code).
  "Continue with AniList" redirects to `anilist.co/api/v2/oauth/authorize?response_type=code`; the
  returned `?code=` is POSTed to `/api/token`, which holds the client secret (Vercel function in
  production, Vite middleware in dev) and exchanges it with AniList for an access token. The token
  lives in `localStorage` (~1 year) and is sent as an `Authorization: Bearer` header. The endpoint
  rejects cross-origin callers and unregistered redirect URIs.
- **Decks**: paginated `Page.media` queries typed `ANIME`/`MANGA`, sorted by `POPULARITY_DESC`,
  `SCORE_DESC`, `TRENDING_DESC` (airing / ongoing) or `SEARCH_MATCH`, excluding upcoming
  (`NOT_YET_RELEASED`) entries.
- **Manga origin filter**: manga decks pass AniList's server-side `countryOfOrigin: CountryCode`
  argument (`JP`/`KR`/`CN`) so Popular/Top rated/Ongoing/Search all return pure manga, manhwa, or
  manhua pages. "All" omits the variable entirely — AniList treats an explicit `null` as "match
  nothing". The choice persists in `localStorage` (`aniswipe.region`) and card meta lines render
  the region-correct term (`🇯🇵 Manga` / `🇰🇷 Manhwa` / `🇨🇳 Manhua`).
- **Already-added filter**: logged-in sessions fetch the viewer's full list once per media type
  (`Page.mediaList` → `mediaId` set) and filter every deck page against it, merged with the
  per-card `mediaListEntry` field — either source alone hides your titles, and "On your list"
  badges are backfilled if the API returns a null entry. The snapshot updates optimistically on
  every save/undo. **Guest mode cannot filter**: `mediaListEntry` requires authentication, so the
  UI shows an explicit "Filter off in guest mode" notice instead.
- **Swipes**: `SaveMediaListEntry(mediaId, status)` mutation; undo runs
  `DeleteMediaListEntry(id)` (or restores the previous status if the entry already existed).
- **Rate limits**: AniList allows 90 req/min (currently 30/min during degraded service). Decks fetch
  40 titles per request and auto-pause + retry on `429`.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `←` | Skip |
| `→` | Mark as watched |
| `↑` | Plan to watch |
| `Z` | Undo last add |
