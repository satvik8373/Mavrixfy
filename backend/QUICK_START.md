# 🚀 Quick Start - YouTube Music Integration

## ✅ Integration Complete!

Your Mavrixfy backend now has **YouTube Music** integrated! Here's how to use it.

## 🎯 One-Command Start (Windows)

```bash
start-with-youtube.bat
```

This will:
1. ✅ Check if YouTube Music API is running
2. ✅ Start it automatically if needed
3. ✅ Start your Mavrixfy backend
4. ✅ Ready to use!

## 📖 Manual Start

### Step 1: Start YouTube Music API (Python)

```bash
cd ../../Mavrixfy_App/youtube-music-api
python main.py
```

Leave this terminal running. API runs on `http://localhost:8000`

### Step 2: Start Mavrixfy Backend (Node.js)

In a **new terminal**:
```bash
cd Mavrixfy-web/backend
npm run dev
```

Backend runs on `http://localhost:5000`

### Step 3: Test It!

```bash
node test-youtube-integration.js
```

## 🎵 New Features

### 1. Unified Search (Searches BOTH platforms!)

**Endpoint:**
```
GET /api/music/search/all?query=arijit&limit=20
```

**Example:**
```bash
curl "http://localhost:5000/api/music/search/all?query=love&limit=10"
```

**Response:**
```json
{
  "success": true,
  "query": "love",
  "total": 20,
  "sources": {
    "jiosaavn": 10,
    "youtube": 10
  },
  "results": [
    { "title": "Love Story", "source": "jiosaavn", "...": "..." },
    { "title": "Lovely", "source": "youtube", "...": "..." }
  ]
}
```

### 2. YouTube Music Only

**Search:**
```
GET /api/youtube-music/search?query=coldplay&filter=songs&limit=20
```

**Charts:**
```
GET /api/youtube-music/charts?country=US
```

**Song Details:**
```
GET /api/youtube-music/song/:videoId
```

**Lyrics:**
```
GET /api/youtube-music/lyrics/:browseId
```

**And 15+ more endpoints!**

See `YOUTUBE_MUSIC_INTEGRATION.md` for full API docs.

## 🔍 Quick Test

### Test 1: Health Check
```bash
curl http://localhost:5000/api/youtube-music/health
```

Expected:
```json
{
  "success": true,
  "service": "YouTube Music API",
  "available": true
}
```

### Test 2: Unified Search
```bash
curl "http://localhost:5000/api/music/search/all?query=test&limit=5"
```

Should return results from **both** JioSaavn and YouTube Music!

### Test 3: YouTube Music Search
```bash
curl "http://localhost:5000/api/youtube-music/search?query=test&limit=5"
```

Should return YouTube Music results only.

## 📁 What Was Added

```
Mavrixfy-web/backend/
├── src/
│   ├── services/
│   │   └── youtubeMusicService.js      ← NEW: YouTube Music client
│   ├── controllers/
│   │   ├── music.controller.js         ← UPDATED: Unified search
│   │   └── youtubeMusic.controller.js  ← NEW: YouTube endpoints
│   └── routes/
│       ├── music.route.js              ← UPDATED: Unified search route
│       └── youtubeMusic.route.js       ← NEW: YouTube routes
├── YOUTUBE_MUSIC_INTEGRATION.md        ← NEW: Full docs
├── INTEGRATION_COMPLETE.md             ← NEW: What was done
├── QUICK_START.md                      ← NEW: This file
├── test-youtube-integration.js         ← NEW: Test script
└── start-with-youtube.bat              ← NEW: Auto-start script
```

## ⚙️ Configuration

Add to `.env`:
```env
YOUTUBE_MUSIC_API_BASE_URL=http://localhost:8000
```

For production (after deploying Python API):
```env
YOUTUBE_MUSIC_API_BASE_URL=https://your-youtube-api.vercel.app
```

## 🐛 Troubleshooting

### Problem: YouTube Music API not responding

**Fix:**
```bash
cd ../../Mavrixfy_App/youtube-music-api
python main.py
```

### Problem: "Cannot find module 'youtubeMusicService'"

**Fix:**
```bash
cd Mavrixfy-web/backend
npm install
```

### Problem: Empty search results

**Fix:**
1. Check Python API: `curl http://localhost:8000/healthz`
2. Check logs in both terminals
3. Test each API separately

### Problem: Python not installed

**Fix:**
Download Python 3.8+ from https://www.python.org/downloads/

## 📚 Documentation

- **Full API Docs:** `YOUTUBE_MUSIC_INTEGRATION.md`
- **Integration Details:** `INTEGRATION_COMPLETE.md`
- **Quick Start:** This file

## 🎉 You're Ready!

Your backend now supports:
- ✅ JioSaavn (existing)
- ✅ YouTube Music (new!)
- ✅ Unified search (searches both)
- ✅ 19+ new YouTube Music endpoints
- ✅ Charts, moods, lyrics, playlists

Start using it now:
```bash
start-with-youtube.bat
```

or manually:
```bash
# Terminal 1:
cd ../../Mavrixfy_App/youtube-music-api
python main.py

# Terminal 2:
cd Mavrixfy-web/backend
npm run dev

# Terminal 3:
node test-youtube-integration.js
```

Happy coding! 🎵
