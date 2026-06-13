# 🎵 YouTube Music Integration Guide

## Overview

Your Mavrixfy backend now supports **YouTube Music** alongside JioSaavn! The integration allows you to:
- Search YouTube Music for songs, albums, artists
- Get charts, moods, and playlists
- Fetch song details, lyrics, and streaming info
- **Unified search** across both JioSaavn and YouTube Music

## Architecture

```
Client App
    ↓
Mavrixfy Backend (Express.js) :5000
    ├──→ JioSaavn API (Node.js) - https://mavrixfy-song-api.vercel.app
    └──→ YouTube Music API (Python/FastAPI) - http://localhost:8000
```

## Setup Instructions

### 1. Start the Python YouTube Music API

The Python API needs to run separately since it uses `ytmusicapi` (Python-only library).

#### Option A: Using existing setup
```bash
cd Mavrixfy_App/youtube-music-api
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
python main.py
```

#### Option B: Using the start script
```bash
cd Mavrixfy_App/youtube-music-api
start.bat  # Windows
```

The API will start on `http://localhost:8000`

### 2. Configure Backend Environment

Add to your `.env` file:
```env
YOUTUBE_MUSIC_API_BASE_URL=http://localhost:8000
```

For production (after deploying Python API):
```env
YOUTUBE_MUSIC_API_BASE_URL=https://your-youtube-api.vercel.app
```

### 3. Start Your Backend

```bash
cd Mavrixfy-web/backend
npm run dev
```

## API Endpoints

### YouTube Music Endpoints

All endpoints are prefixed with `/api/youtube-music`:

#### Search & Discovery
- `GET /api/youtube-music/search?query=arijit&filter=songs&limit=20`
  - Search YouTube Music
  - Filters: `songs`, `videos`, `albums`, `artists`, `playlists`

- `GET /api/youtube-music/search/suggestions?query=arij`
  - Get search suggestions

- `GET /api/youtube-music/charts?country=US`
  - Get trending charts by country

- `GET /api/youtube-music/moods`
  - Get mood categories

- `GET /api/youtube-music/home?limit=5`
  - Get personalized home feed

#### Content Details
- `GET /api/youtube-music/song/:videoId`
  - Get song details

- `GET /api/youtube-music/album/:browseId`
  - Get album with tracks

- `GET /api/youtube-music/artist/:channelId`
  - Get artist profile

- `GET /api/youtube-music/playlist/:playlistId`
  - Get playlist tracks

- `GET /api/youtube-music/lyrics/:browseId`
  - Get song lyrics

- `GET /api/youtube-music/watch/:videoId?limit=25&radio=true`
  - Get radio/similar songs

#### Health Check
- `GET /api/youtube-music/health`
  - Check if YouTube Music API is available

### Unified Search (NEW!)

Search **both** JioSaavn and YouTube Music at once:

```
GET /api/music/search/all?query=arijit&limit=15
```

**Response:**
```json
{
  "success": true,
  "query": "arijit",
  "total": 30,
  "sources": {
    "jiosaavn": 15,
    "youtube": 15
  },
  "results": [
    { "...": "...", "source": "jiosaavn" },
    { "...": "...", "source": "youtube" }
  ]
}
```

### Existing JioSaavn Endpoints

- `GET /api/music/search?query=arijit` - JioSaavn only
- `GET /api/music/trending` - JioSaavn trending
- `GET /api/music/bollywood` - Bollywood songs
- `GET /api/music/hollywood` - Hollywood songs
- `GET /api/music/songs/:id` - Song details
- `GET /api/music/albums/:id` - Album details

## Usage Examples

### Example 1: Unified Search

```javascript
// Search both platforms
const response = await fetch(
  'http://localhost:5000/api/music/search/all?query=love&limit=20'
);
const data = await response.json();

console.log(`Found ${data.total} songs`);
console.log(`JioSaavn: ${data.sources.jiosaavn}, YouTube: ${data.sources.youtube}`);

data.results.forEach(song => {
  console.log(`${song.title} - Source: ${song.source}`);
});
```

### Example 2: YouTube Music Only

```javascript
// Search YouTube Music
const response = await fetch(
  'http://localhost:5000/api/youtube-music/search?query=coldplay&filter=songs&limit=10'
);
const data = await response.json();

console.log(`Found ${data.results.length} YouTube Music songs`);
```

### Example 3: Get YouTube Song Details

```javascript
// Get song details
const videoId = 'dQw4w9WgXcQ';
const response = await fetch(
  `http://localhost:5000/api/youtube-music/song/${videoId}`
);
const song = await response.json();

console.log(song.song);
```

### Example 4: Check YouTube Music Availability

```javascript
// Health check
const response = await fetch(
  'http://localhost:5000/api/youtube-music/health'
);
const health = await response.json();

if (health.success) {
  console.log('YouTube Music is available!');
} else {
  console.log('YouTube Music is down, using JioSaavn only');
}
```

## Deployment

### Option 1: Deploy Python API to Vercel

The Python API already has `vercel.json` configured:

```bash
cd Mavrixfy_App/youtube-music-api
vercel --prod
```

Update your backend `.env`:
```env
YOUTUBE_MUSIC_API_BASE_URL=https://your-youtube-api.vercel.app
```

### Option 2: Deploy to Railway

```bash
cd Mavrixfy_App/youtube-music-api
railway login
railway init
railway up
```

### Option 3: Deploy to Render

1. Connect GitHub repo
2. Select `Mavrixfy_App/youtube-music-api` directory
3. Auto-deploy on push

### Option 4: Keep Local (Development Only)

For local development, keep Python API running on `localhost:8000`.

## Error Handling

The integration includes graceful fallbacks:

- ✅ If YouTube Music API is down → JioSaavn still works
- ✅ If JioSaavn is down → YouTube Music still works
- ✅ Unified search catches errors from both sources
- ✅ Empty results instead of crashes

## File Structure

```
Mavrixfy-web/backend/
├── src/
│   ├── services/
│   │   └── youtubeMusicService.js      # YouTube Music API client
│   ├── controllers/
│   │   ├── music.controller.js         # Unified search + JioSaavn
│   │   └── youtubeMusic.controller.js  # YouTube Music endpoints
│   └── routes/
│       ├── music.route.js              # Music routes (unified)
│       └── youtubeMusic.route.js       # YouTube Music routes
└── .env.example                        # Environment config

Mavrixfy_App/youtube-music-api/         # Python FastAPI service
├── main.py                             # FastAPI server
├── requirements.txt                    # Python dependencies
└── start.bat                           # Windows start script
```

## Testing

### Test YouTube Music Health
```bash
curl http://localhost:5000/api/youtube-music/health
```

### Test Unified Search
```bash
curl "http://localhost:5000/api/music/search/all?query=test&limit=5"
```

### Test YouTube Search
```bash
curl "http://localhost:5000/api/youtube-music/search?query=test&limit=5"
```

## Troubleshooting

### YouTube Music API Not Available

**Problem:** `YouTube Music is unavailable` error

**Solutions:**
1. Check if Python API is running: `http://localhost:8000/healthz`
2. Check backend `.env` has correct `YOUTUBE_MUSIC_API_BASE_URL`
3. Restart Python API
4. Check firewall settings

### No Results from Unified Search

**Problem:** Empty results array

**Solutions:**
1. Check both APIs individually
2. Verify API keys/credentials
3. Check network connectivity
4. Review backend logs for errors

### Python API Won't Start

**Problem:** `ytmusicapi` import error

**Solutions:**
```bash
cd Mavrixfy_App/youtube-music-api
pip install --upgrade ytmusicapi fastapi uvicorn
python main.py
```

## Next Steps

1. ✅ **Deploy Python API** to production (Vercel/Railway/Render)
2. ✅ **Update mobile app** to use unified search endpoint
3. ✅ **Add caching** to reduce API calls
4. ✅ **Add rate limiting** to prevent abuse
5. ✅ **Monitor performance** of both APIs

## Questions?

- Python API code: `Mavrixfy_App/youtube-music-api/main.py`
- Backend integration: `Mavrixfy-web/backend/src/services/youtubeMusicService.js`
- Routes: `Mavrixfy-web/backend/src/routes/youtubeMusic.route.js`

Happy coding! 🎵
