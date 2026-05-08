# Promotions Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Step 1: Access Promotions
Navigate to **Dashboard → Promotions** in the admin panel.

---

### Step 2: Create Your First Promotion

Click **"Create Promotion"** button (top right).

---

### Step 3: Fill in the Details

#### **Basic Information**
```
Title: "Summer Hits 2026" (required)
Description: "Check out the hottest tracks of the season"
```

#### **Choose Layout**
Select one of 4 options:
- 🎯 **Hero Banner** - Large featured banner (recommended for main promos)
- 📦 **Card** - Medium card layout
- 📏 **Full Width** - Spans entire width
- 📱 **Sidebar** - Compact sidebar

#### **Upload Media**
Two options:

**Option A: Upload to Cloudinary (Recommended)**
1. Click "Upload to Cloudinary"
2. Select your image/video/audio file
3. Wait for upload (shows progress)
4. Preview appears automatically

**Option B: Use External URL**
1. Paste URL in "Or paste URL" field
2. Media type detected automatically
3. Preview appears

#### **Set Click Action**
Choose what happens when users click:

| Action | When to Use | Required Fields |
|--------|-------------|-----------------|
| **No Action** | Display only | None |
| **External Link** | Link to website | URL |
| **Play Song** | Play specific song | Attach song |
| **Open Playlist** | Show playlist | Playlist ID |
| **View Artist** | Show artist page | Artist ID |
| **View Album** | Show album page | Album ID |

**To Attach a Song:**
1. Select "Play Song" action
2. Click "Search & Attach Song"
3. Search for your song
4. Click on the song to attach
5. Preview appears with song details

#### **Configure Display**
```
Platform: Web or App
Status: Active (show now) / Scheduled (show later) / Ended
Start Date: (optional) When to start showing
End Date: (optional) When to stop showing
Priority: 0-100 (higher = shows first)
```

#### **Save**
Click **"Create"** button.

---

## 📋 Common Use Cases

### Use Case 1: New Album Release
```
Title: "New Album: Midnight Dreams"
Description: "Available now on all platforms"
Layout: Hero Banner
Media: Upload album cover (1200x400px)
Action: View Album
Platform: Web
Status: Active
Priority: 90
```

### Use Case 2: Featured Song of the Day
```
Title: "Song of the Day"
Description: "Listen to this amazing track"
Layout: Card
Media: Upload banner image
Action: Play Song
  → Search: "Midnight Dreams"
  → Attach song
Platform: App
Status: Active
Priority: 80
```

### Use Case 3: Concert Tickets
```
Title: "Live Concert - Get Tickets!"
Description: "Limited seats available"
Layout: Full Width
Media: Upload concert poster
Action: External Link
  → URL: https://tickets.example.com
Platform: Web
Status: Scheduled
Start Date: 2026-05-01
End Date: 2026-05-15
Priority: 95
```

### Use Case 4: Playlist Promotion
```
Title: "Chill Vibes Playlist"
Description: "Perfect for relaxing"
Layout: Card
Media: Upload playlist cover
Action: Open Playlist
Platform: Both (create 2 promotions)
Status: Active
Priority: 70
```

---

## 🎨 Design Tips

### Image Dimensions
| Layout | Recommended Size | Aspect Ratio |
|--------|------------------|--------------|
| Hero Banner | 1200 x 400px | 3:1 |
| Card | 600 x 400px | 3:2 |
| Full Width | 1920 x 300px | 6.4:1 |
| Sidebar | 300 x 400px | 3:4 |

### File Guidelines
- **Format:** JPG, PNG, WebP (images) / MP4, WebM (videos)
- **Size:** Under 500KB for images, under 5MB for videos
- **Quality:** High resolution, optimized for web
- **Colors:** High contrast for readability

### Content Tips
- **Title:** Keep under 50 characters
- **Description:** Keep under 100 characters
- **Call-to-Action:** Use action words (Listen, Discover, Explore)

---

## ⚡ Quick Actions

### Edit Promotion
1. Find promotion in list
2. Click **Edit** icon (pencil)
3. Make changes
4. Click **"Save Changes"**

### Delete Promotion
1. Find promotion in list
2. Click **Delete** icon (trash)
3. Confirm deletion

### Change Priority
1. Edit promotion
2. Scroll to "Priority" field
3. Enter number 0-100
4. Save

### Schedule for Later
1. Edit promotion
2. Set Status to "Scheduled"
3. Set Start Date
4. Set End Date (optional)
5. Save

---

## 🔍 Understanding the List View

Each promotion shows:

```
[Preview Image] Title                    [Status] [Type] [Layout] [Action] [Platform] [Priority]
                Description
                🎵 Attached Song (if any)
                📅 Date Range (if scheduled)
                                                                    [Edit] [Delete]
```

**Badges Explained:**
- 🟢 **Active** - Currently showing
- 🔵 **Scheduled** - Will show in future
- ⚪ **Ended** - No longer showing
- 🖼️ **Image/GIF/Video/Audio** - Media type
- 🎯 **Hero/Card/Full/Sidebar** - Layout type
- 🔗 **External/Song/Playlist** - Click action
- 🌐 **Web** - Shows on web app
- 📱 **App** - Shows on mobile app
- ⭐ **Priority: 90** - Display priority

---

## 🎯 Priority System Explained

Priority determines the order promotions appear:

| Priority | Use For | Example |
|----------|---------|---------|
| **90-100** | Critical announcements | New features, major releases |
| **70-89** | Featured content | Album releases, top playlists |
| **50-69** | Regular promotions | Daily picks, recommendations |
| **0-49** | Low priority | Evergreen content, fillers |

**Default:** 0 (lowest priority)

---

## 🐛 Troubleshooting

### Upload Not Working
- ✅ Check file size (must be < 10MB)
- ✅ Check file type (images, videos, audio only)
- ✅ Verify internet connection
- ✅ Check Cloudinary credentials in settings

### Song Search Not Working
- ✅ Check internet connection
- ✅ Try different search terms
- ✅ Verify JioSaavn API is accessible

### Promotion Not Showing
- ✅ Check status is "Active"
- ✅ Verify platform matches (web/app)
- ✅ Check date range if scheduled
- ✅ Ensure priority is set

### Preview Not Loading
- ✅ Check media URL is valid
- ✅ Verify file format is supported
- ✅ Try re-uploading the file

---

## 📊 Best Practices

### ✅ DO:
- Use high-quality images
- Keep titles short and catchy
- Set appropriate priorities
- Schedule time-sensitive promos
- Test on both web and app
- Use Cloudinary for better performance
- Attach songs for music discovery
- Set end dates for limited campaigns

### ❌ DON'T:
- Use low-resolution images
- Create too many high-priority promos
- Forget to set end dates for limited offers
- Use external URLs from unreliable sources
- Exceed file size limits
- Leave descriptions empty
- Create duplicate promotions

---

## 🎓 Pro Tips

1. **Batch Create:** Create multiple promotions at once for campaigns
2. **A/B Testing:** Create 2 versions with different priorities
3. **Seasonal Content:** Schedule promos for holidays in advance
4. **Mobile First:** Test on app platform first
5. **Analytics:** Track which promotions get most clicks
6. **Refresh Content:** Update promotions weekly
7. **Use Templates:** Save successful promotion formats
8. **Optimize Images:** Use WebP format for smaller file sizes

---

## 📞 Need Help?

- 📖 **Full Documentation:** See `PROMOTIONS_ENHANCED.md`
- 🔧 **Technical Details:** See `PROMOTIONS_UPGRADE_SUMMARY.md`
- 💬 **Support:** Contact your admin team

---

## ✨ Summary

**Creating a promotion is as easy as:**
1. Click "Create Promotion"
2. Add title and description
3. Choose layout
4. Upload media or paste URL
5. Set click action (optional)
6. Configure display settings
7. Save!

**Your promotion is now live!** 🎉

---

## 🎬 Video Tutorial (Coming Soon)

Watch a step-by-step video guide on creating your first promotion.

---

**Happy Promoting! 🚀**
