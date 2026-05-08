# Enhanced Promotions System

## Overview
The promotions system has been completely redesigned with advanced features for creating engaging, interactive banners with Cloudinary integration, customizable layouts, clickable actions, and song attachments.

---

## ✨ New Features

### 1. **Cloudinary Upload Integration**
- Direct file upload to Cloudinary from the admin panel
- Supports images, videos, GIFs, and audio files
- Automatic optimization and transformation
- File size validation (max 10MB)
- Secure storage with public IDs for management

**How to use:**
1. Click "Upload to Cloudinary" button in the promotion form
2. Select your media file (image/video/audio)
3. File is automatically uploaded and optimized
4. URL is populated in the form

### 2. **Customizable Banner Layouts**
Choose from 4 different layout options:

| Layout | Description | Best For |
|--------|-------------|----------|
| **Hero Banner** | Large featured banner | Main promotions, new releases |
| **Card** | Medium card layout | Featured playlists, artists |
| **Full Width** | Spans entire width | Announcements, events |
| **Sidebar** | Compact sidebar | Quick links, small promos |

### 3. **Clickable Actions**
Make your banners interactive with 6 action types:

- **No Action** - Display only
- **External Link** - Link to any URL
- **Play Song** - Attach and play a specific song
- **Open Playlist** - Navigate to a playlist
- **View Artist** - Navigate to artist profile
- **View Album** - Navigate to album page

### 4. **Song Attachment System**
- Search and attach songs directly from JioSaavn
- Real-time song search with preview
- Display attached song info on banner
- One-click play functionality

**How to attach a song:**
1. Set Action Type to "Play Song"
2. Click "Search & Attach Song"
3. Search for your song
4. Click on the song to attach it
5. Song details are saved with the promotion

### 5. **Priority System**
- Set priority from 0-100
- Higher priority promotions appear first
- Automatic sorting by priority
- Perfect for featured content

### 6. **Platform Targeting**
- **Web** - Show on web application
- **App** - Show on mobile app
- Target specific platforms for each promotion

### 7. **Media Type Detection**
Automatically detects and displays:
- Images (JPG, PNG, WebP)
- GIFs
- Videos (MP4, WebM)
- Audio files (MP3, WAV)

### 8. **Scheduling**
- Set start and end dates
- Status management (Active, Scheduled, Ended)
- Automatic status tracking

---

## 📊 Firestore Schema

```typescript
interface Promotion {
  id: string;
  title: string;                    // Required
  description: string;
  mediaUrl?: string;                // Cloudinary URL or external URL
  mediaType?: 'image' | 'gif' | 'video' | 'audio';
  cloudinaryPublicId?: string;      // For deletion management
  platforms?: 'web' | 'app';
  status: 'active' | 'scheduled' | 'ended';
  startDate?: string;               // ISO date string
  endDate?: string;                 // ISO date string
  layout?: 'hero' | 'card' | 'full-width' | 'sidebar';
  actionType?: 'none' | 'external' | 'song' | 'playlist' | 'artist' | 'album';
  actionUrl?: string;               // For external links
  attachedSong?: {
    id: string;
    title: string;
    artist: string;
    imageUrl: string;
    streamUrl: string;
  };
  priority?: number;                // 0-100, higher = first
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 🔌 API Endpoints

### Upload Media
```
POST /api/promotions/upload
Content-Type: multipart/form-data

Body:
- file: File (required)
- folder: string (optional, default: 'mavrixfy/promotions')
- type: 'image' | 'video' | 'audio' (optional, auto-detected)

Response:
{
  success: true,
  data: {
    url: string,
    publicId: string,
    format: string,
    width: number,
    height: number,
    resourceType: string
  }
}
```

### Delete Media
```
DELETE /api/promotions/upload?publicId={id}&resourceType={type}

Response:
{
  success: true
}
```

### Search Songs
```
GET /api/music/search?query={query}&limit=10

Response:
{
  success: true,
  data: {
    total: number,
    results: Song[]
  }
}
```

---

## 🎨 UI Components

### Promotion Card Display
Shows:
- Media preview (image/video/audio)
- Title and description
- Status badge (active/scheduled/ended)
- Media type badge
- Layout type badge
- Action type badge (if clickable)
- Platform badge (web/app)
- Priority badge (if > 0)
- Attached song info (if any)
- Date range (if scheduled)

### Create/Edit Modal
Includes:
- Title input (required)
- Description textarea
- Layout selector (4 options)
- Media upload section:
  - Cloudinary upload button
  - URL input fallback
  - Live preview
  - Media type detection
- Action type selector
- External URL input (if external action)
- Song search & attach (if song action)
- Platform selector (web/app)
- Status dropdown
- Date range pickers
- Priority input (0-100)

### Song Search Modal
Features:
- Real-time search input
- Loading states
- Song results with:
  - Album artwork
  - Song title
  - Artist name
  - Click to attach

---

## 💡 Usage Examples

### Example 1: New Album Release Banner
```javascript
{
  title: "New Album: Summer Vibes 2026",
  description: "Check out the hottest tracks of the season",
  layout: "hero",
  actionType: "album",
  actionUrl: "/albums/summer-vibes-2026",
  platforms: "web",
  status: "active",
  priority: 90,
  mediaUrl: "https://res.cloudinary.com/.../banner.jpg"
}
```

### Example 2: Featured Song Promotion
```javascript
{
  title: "Song of the Day",
  description: "Listen to this amazing track",
  layout: "card",
  actionType: "song",
  attachedSong: {
    id: "song_123",
    title: "Midnight Dreams",
    artist: "The Dreamers",
    imageUrl: "...",
    streamUrl: "..."
  },
  platforms: "app",
  status: "active",
  priority: 80
}
```

### Example 3: External Partnership
```javascript
{
  title: "Concert Tickets Available",
  description: "Get your tickets now!",
  layout: "full-width",
  actionType: "external",
  actionUrl: "https://tickets.example.com/event/123",
  platforms: "web",
  status: "scheduled",
  startDate: "2026-05-01",
  endDate: "2026-05-15",
  priority: 95
}
```

---

## 🔒 Security Features

1. **File Validation**
   - Type checking (images, videos, audio only)
   - Size limit (10MB max)
   - Secure upload to Cloudinary

2. **URL Sanitization**
   - External URLs validated
   - XSS protection

3. **Firestore Rules**
   - Admin-only write access
   - Public read access for active promotions

---

## 🚀 Frontend Integration

### Fetching Active Promotions
```typescript
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

async function getActivePromotions(platform: 'web' | 'app') {
  const q = query(
    collection(db, 'promotions'),
    where('status', '==', 'active'),
    where('platforms', '==', platform),
    orderBy('priority', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
```

### Rendering Banners
```typescript
function PromotionBanner({ promotion }: { promotion: Promotion }) {
  const handleClick = () => {
    if (promotion.actionType === 'external') {
      window.open(promotion.actionUrl, '_blank');
    } else if (promotion.actionType === 'song' && promotion.attachedSong) {
      playSong(promotion.attachedSong);
    }
    // ... handle other action types
  };

  return (
    <div 
      className={`promotion-banner layout-${promotion.layout}`}
      onClick={handleClick}
      style={{ cursor: promotion.actionType !== 'none' ? 'pointer' : 'default' }}
    >
      {promotion.mediaType === 'video' ? (
        <video src={promotion.mediaUrl} autoPlay muted loop />
      ) : (
        <img src={promotion.mediaUrl} alt={promotion.title} />
      )}
      <div className="content">
        <h2>{promotion.title}</h2>
        <p>{promotion.description}</p>
      </div>
    </div>
  );
}
```

---

## 📱 Mobile App Integration

For React Native apps, use the same Firestore queries and render appropriately:

```typescript
import { Image, TouchableOpacity, Video } from 'react-native';

function PromotionCard({ promotion }) {
  const handlePress = () => {
    if (promotion.actionType === 'song') {
      playTrack(promotion.attachedSong);
    } else if (promotion.actionType === 'external') {
      Linking.openURL(promotion.actionUrl);
    }
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      {promotion.mediaType === 'video' ? (
        <Video source={{ uri: promotion.mediaUrl }} />
      ) : (
        <Image source={{ uri: promotion.mediaUrl }} />
      )}
      <Text>{promotion.title}</Text>
      <Text>{promotion.description}</Text>
    </TouchableOpacity>
  );
}
```

---

## 🎯 Best Practices

1. **Image Dimensions**
   - Hero: 1200x400px
   - Card: 600x400px
   - Full Width: 1920x300px
   - Sidebar: 300x400px

2. **File Sizes**
   - Keep images under 500KB
   - Videos under 5MB
   - Use WebP for images when possible

3. **Priority Guidelines**
   - 90-100: Critical announcements
   - 70-89: Featured content
   - 50-69: Regular promotions
   - 0-49: Low priority

4. **Scheduling**
   - Set end dates for time-sensitive promos
   - Use "scheduled" status for future campaigns
   - Mark as "ended" when campaign completes

5. **Action Types**
   - Use "song" for music discovery
   - Use "external" for partnerships
   - Use "playlist" for curated collections
   - Use "none" for informational banners

---

## 🐛 Troubleshooting

### Upload Fails
- Check file size (< 10MB)
- Verify file type is supported
- Ensure Cloudinary credentials are set

### Song Search Not Working
- Verify `/api/music/search` endpoint is accessible
- Check JioSaavn API status
- Ensure network connectivity

### Promotions Not Showing
- Check status is "active"
- Verify platform matches (web/app)
- Check date range if scheduled
- Ensure Firestore rules allow read access

---

## 🔄 Migration from Old System

If you have existing promotions, they will continue to work. New fields are optional:
- `layout` defaults to 'hero'
- `actionType` defaults to 'none'
- `priority` defaults to 0
- `platforms` defaults to 'web'

---

## 📝 Future Enhancements

Potential additions:
- A/B testing support
- Click tracking analytics
- Impression counting
- Geo-targeting
- User segment targeting
- Dynamic content based on user preferences
- Carousel/slideshow support
- Animation options

---

## 🎉 Summary

The enhanced promotions system provides:
✅ Cloudinary integration for media management
✅ 4 customizable banner layouts
✅ 6 interactive action types
✅ Song attachment with search
✅ Priority-based sorting
✅ Platform targeting (web/app)
✅ Scheduling with date ranges
✅ Auto media type detection
✅ Rich preview and management UI

Perfect for creating engaging, interactive promotional content across your music platform!
