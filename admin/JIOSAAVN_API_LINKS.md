# JioSaavn API Links for Admin Songs

## 🎵 All Available JioSaavn API Endpoints

These are the API endpoints used in the admin panel for song search and management.

---

## 📡 Primary Provider - JioSaavn (saavn.sumit.co)

### Base URL
```
https://saavn.sumit.co/api
```

### Endpoints

#### 1. Search Songs
```
GET https://saavn.sumit.co/api/search/songs
```

**Parameters:**
- `query` (string, required) - Search query
- `page` (number, optional) - Page number (default: 1)
- `limit` (number, optional) - Results per page (default: 20, max: 50)

**Example:**
```
https://saavn.sumit.co/api/search/songs?query=arijit%20singh&page=1&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 1000,
    "start": 1,
    "results": [
      {
        "id": "song_id",
        "name": "Song Title",
        "primaryArtists": "Artist Name",
        "album": { "name": "Album Name", "id": "album_id" },
        "image": "image_url",
        "downloadUrl": [
          { "quality": "320kbps", "url": "stream_url" }
        ],
        "duration": 240,
        "year": 2024
      }
    ]
  }
}
```

---

#### 2. Global Search (All Content)
```
GET https://saavn.sumit.co/api/search
```

**Parameters:**
- `query` (string, required) - Search query

**Example:**
```
https://saavn.sumit.co/api/search?query=arijit%20singh
```

**Response:**
```json
{
  "success": true,
  "data": {
    "topQuery": {
      "results": [ /* songs */ ]
    },
    "songs": {
      "results": [ /* songs */ ]
    },
    "albums": {
      "results": [ /* albums */ ]
    },
    "artists": {
      "results": [ /* artists */ ]
    },
    "playlists": {
      "results": [ /* playlists */ ]
    }
  }
}
```

---

#### 3. Get Song Details by IDs
```
GET https://saavn.sumit.co/api/songs
```

**Parameters:**
- `ids` (string, required) - Comma-separated song IDs

**Example:**
```
https://saavn.sumit.co/api/songs?ids=song_id_1,song_id_2,song_id_3
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "song_id",
      "name": "Song Title",
      "primaryArtists": "Artist Name",
      "album": { "name": "Album Name" },
      "image": "image_url",
      "downloadUrl": [
        { "quality": "320kbps", "url": "stream_url" }
      ],
      "duration": 240,
      "year": 2024,
      "releaseDate": "2024-01-01"
    }
  ]
}
```

---

## 🔄 Backup Provider 1 - JioSaavn Backup (jiosaavn-api-privatecvc2.vercel.app)

### Base URL
```
https://jiosaavn-api-privatecvc2.vercel.app
```

### Endpoints

#### 1. Search Songs
```
GET https://jiosaavn-api-privatecvc2.vercel.app/search/songs
```

**Parameters:** Same as primary provider
- `query` (string, required)
- `page` (number, optional)
- `limit` (number, optional)

**Example:**
```
https://jiosaavn-api-privatecvc2.vercel.app/search/songs?query=arijit%20singh&page=1&limit=20
```

---

#### 2. Global Search
```
GET https://jiosaavn-api-privatecvc2.vercel.app/search
```

**Parameters:**
- `query` (string, required)

**Example:**
```
https://jiosaavn-api-privatecvc2.vercel.app/search?query=arijit%20singh
```

---

## 🔄 Backup Provider 2 - JioSaavn Backup 2 (saavn.me)

### Base URL
```
https://saavn.me
```

### Endpoints

#### 1. Search Songs
```
GET https://saavn.me/search/songs
```

**Parameters:** Same as primary provider
- `query` (string, required)
- `page` (number, optional)
- `limit` (number, optional)

**Example:**
```
https://saavn.me/search/songs?query=arijit%20singh&page=1&limit=20
```

---

#### 2. Global Search
```
GET https://saavn.me/search
```

**Parameters:**
- `query` (string, required)

**Example:**
```
https://saavn.me/search?query=arijit%20singh
```

---

## 🎯 How They're Used in Admin

### Parallel Search Strategy
The admin panel uses all 3 providers simultaneously:

```typescript
const JIOSAAVN_PROVIDERS = [
  {
    source: 'jiosaavn',
    label: 'JioSaavn',
    searchUrl: 'https://saavn.sumit.co/api/search/songs',
    globalUrl: 'https://saavn.sumit.co/api/search',
  },
  {
    source: 'jiosaavn-backup',
    label: 'JioSaavn Backup',
    searchUrl: 'https://jiosaavn-api-privatecvc2.vercel.app/search/songs',
    globalUrl: 'https://jiosaavn-api-privatecvc2.vercel.app/search',
  },
  {
    source: 'jiosaavn-backup-2',
    label: 'JioSaavn Backup 2',
    searchUrl: 'https://saavn.me/search/songs',
    globalUrl: 'https://saavn.me/search',
  },
];
```

### Search Flow
1. **User searches** for a song
2. **All 3 providers** are queried in parallel
3. **Results are merged** and deduplicated
4. **If results are weak**, global search is triggered
5. **Songs without stream URLs** are hydrated using song details endpoint
6. **Final results** are sorted by relevance and returned

---

## 📊 API Response Fields

### Song Object
```typescript
{
  id: string;                    // Unique song ID
  name: string;                  // Song title
  title: string;                 // Alternative title
  primaryArtists: string;        // Main artists
  artist: string;                // All artists
  album: {
    id: string;
    name: string;
    url: string;
  };
  image: string | Array<{        // Album artwork
    quality: string;
    url: string;
  }>;
  downloadUrl: Array<{           // Stream URLs
    quality: string;             // 320kbps, 160kbps, 96kbps
    url: string;
  }>;
  duration: number;              // In seconds
  year: number;                  // Release year
  releaseDate: string;           // ISO date
  language: string;              // Song language
  genre: string;                 // Music genre
  url: string;                   // JioSaavn page URL
}
```

---

## 🔧 Testing the APIs

### Using cURL

#### Search Songs
```bash
curl "https://saavn.sumit.co/api/search/songs?query=arijit%20singh&limit=5"
```

#### Global Search
```bash
curl "https://saavn.sumit.co/api/search?query=arijit%20singh"
```

#### Get Song Details
```bash
curl "https://saavn.sumit.co/api/songs?ids=song_id_1,song_id_2"
```

### Using JavaScript (Fetch)

```javascript
// Search songs
const searchSongs = async (query) => {
  const response = await fetch(
    `https://saavn.sumit.co/api/search/songs?query=${encodeURIComponent(query)}&limit=20`
  );
  const data = await response.json();
  return data.data.results;
};

// Global search
const globalSearch = async (query) => {
  const response = await fetch(
    `https://saavn.sumit.co/api/search?query=${encodeURIComponent(query)}`
  );
  const data = await response.json();
  return data.data;
};

// Get song details
const getSongDetails = async (ids) => {
  const response = await fetch(
    `https://saavn.sumit.co/api/songs?ids=${ids.join(',')}`
  );
  const data = await response.json();
  return data.data;
};
```

### Using Postman

1. **Create New Request**
2. **Method:** GET
3. **URL:** `https://saavn.sumit.co/api/search/songs`
4. **Params:**
   - `query`: arijit singh
   - `page`: 1
   - `limit`: 20
5. **Send**

---

## 🚀 Admin Integration

### In Promotions Page
When you click "Search & Attach Song":

```typescript
// File: Mavrixfy-web/admin/app/(dashboard)/dashboard/promotions/page.tsx

async function searchSongs() {
  const response = await fetch(
    `/api/music/search?query=${encodeURIComponent(songQuery)}&limit=10`
  );
  const data = await response.json();
  setSongResults(data.data.results);
}
```

### In Music Search API
The API route handles the parallel search:

```typescript
// File: Mavrixfy-web/admin/app/api/music/search/route.ts

export async function GET(request: NextRequest) {
  // Query all 3 providers in parallel
  const searchCalls = JIOSAAVN_PROVIDERS.map(provider => 
    fetchProviderSearch(provider, query, page, limit)
  );
  
  // Merge and deduplicate results
  const results = dedupeSongs(allResults);
  
  return NextResponse.json({ success: true, data: { results } });
}
```

---

## 📈 API Reliability

### Failover Strategy
- If **Primary** fails → **Backup 1** continues
- If **Backup 1** fails → **Backup 2** continues
- If all fail → Return partial results with warnings

### Response Times
- **Primary:** ~500-1000ms
- **Backup 1:** ~800-1500ms
- **Backup 2:** ~600-1200ms

### Rate Limits
- No official rate limits documented
- Recommended: Max 10 requests/second per provider
- Use parallel requests for better performance

---

## 🔒 Security Notes

1. **No API Key Required** - All endpoints are public
2. **CORS Enabled** - Can be called from browser
3. **HTTPS Only** - All endpoints use secure connections
4. **No Authentication** - Open access for all users

---

## 🐛 Common Issues

### Issue 1: Empty Results
**Cause:** Query too specific or misspelled
**Solution:** Try broader search terms

### Issue 2: Missing Stream URLs
**Cause:** Song not available for streaming
**Solution:** Use song details endpoint to hydrate

### Issue 3: Slow Response
**Cause:** Provider overload
**Solution:** Parallel search with multiple providers

### Issue 4: 404 Not Found
**Cause:** Provider temporarily down
**Solution:** Automatic failover to backup providers

---

## 📝 Quick Reference

### All Endpoints at a Glance

| Provider | Search Songs | Global Search | Song Details |
|----------|-------------|---------------|--------------|
| **Primary** | [saavn.sumit.co/api/search/songs](https://saavn.sumit.co/api/search/songs) | [saavn.sumit.co/api/search](https://saavn.sumit.co/api/search) | [saavn.sumit.co/api/songs](https://saavn.sumit.co/api/songs) |
| **Backup 1** | [jiosaavn-api-privatecvc2.vercel.app/search/songs](https://jiosaavn-api-privatecvc2.vercel.app/search/songs) | [jiosaavn-api-privatecvc2.vercel.app/search](https://jiosaavn-api-privatecvc2.vercel.app/search) | N/A |
| **Backup 2** | [saavn.me/search/songs](https://saavn.me/search/songs) | [saavn.me/search](https://saavn.me/search) | N/A |

---

## 🎉 Summary

✅ **3 Providers** for redundancy
✅ **Parallel Search** for speed
✅ **Auto Failover** for reliability
✅ **Deduplication** for clean results
✅ **Stream URL Hydration** for playback
✅ **No API Keys** required
✅ **HTTPS Secure** connections

All endpoints are ready to use in your admin panel for song search and attachment! 🚀
