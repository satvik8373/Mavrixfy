# Gemini Mood Playlist Setup

The mood playlist generator can use Gemini with Google Search grounding to plan real-world songs, then resolve those songs through the existing JioSaavn pipeline so the app only returns playable tracks.

## Backend Environment Variables

Set these on the backend deployment, for example the `spotify-api-drab` Vercel project:

```env
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MOOD_MODEL=gemini-2.5-flash
GEMINI_MOOD_TIMEOUT_MS=15000
```

Use a Gemini API model that supports Search grounding. `gemini-2.5-flash` is the default because it is fast and supports grounded search.

Do not expose `GEMINI_API_KEY` in frontend code. The browser should only call `/api/playlists/mood-generate`; the backend calls Gemini.

## Rotation Note

If a Gemini key was pasted into chat, logs, screenshots, or Git history, rotate it in Google AI Studio and deploy the new value through Vercel environment variables.

## Runtime Flow

1. Validate user mood input.
2. Ask Gemini for a grounded music plan using the `google_search` tool.
3. Resolve Gemini's suggested songs through JioSaavn search for playable audio URLs.
4. Filter remixes, lofi edits, covers, karaoke, and unavailable tracks.
5. If Gemini cannot resolve enough exact playable songs, return a clear retry/refine error. There is no standard-generator fallback.
