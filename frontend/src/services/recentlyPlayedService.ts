interface RecentlyPlayedItem {
  id: string;
  name: string;
  imageUrl?: string;
  type: 'playlist' | 'jiosaavn-playlist' | 'album' | 'song';
  lastPlayed: number;
  isPublic?: boolean;
  // Additional data for different types
  data?: any;
}

class RecentlyPlayedService {
  private readonly STORAGE_KEY = 'recently_played_items';
  private readonly MAX_ITEMS = 20;

  // Get all recently played items
  getRecentlyPlayed(): RecentlyPlayedItem[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (!saved) return [];
      
      const items: RecentlyPlayedItem[] = JSON.parse(saved);
      // Sort by most recently played
      return items.sort((a, b) => b.lastPlayed - a.lastPlayed);
    } catch (error) {
      // Error loading recently played items
      return [];
    }
  }

  // Add an item to recently played
  addToRecentlyPlayed(item: Omit<RecentlyPlayedItem, 'lastPlayed'>): void {
    try {
      const items = this.getRecentlyPlayed();
      
      // Remove if already exists to prevent duplicates
      const filteredItems = items.filter(i => i.id !== item.id || i.type !== item.type);
      
      // Add to the beginning with current timestamp
      const newItem: RecentlyPlayedItem = {
        ...item,
        lastPlayed: Date.now(),
      };
      
      filteredItems.unshift(newItem);
      
      // Keep only the most recent items
      const limitedItems = filteredItems.slice(0, this.MAX_ITEMS);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedItems));
      
      // Dispatch event for components to listen to
      window.dispatchEvent(new CustomEvent('recentlyPlayedUpdated', { 
        detail: limitedItems 
      }));
    } catch (error) {
      // Error adding to recently played
    }
  }

  // Add a regular playlist
  addPlaylist(playlist: any): void {
    this.addToRecentlyPlayed({
      id: playlist._id,
      name: playlist.name,
      imageUrl: playlist.imageUrl,
      type: 'playlist',
      isPublic: playlist.isPublic,
      data: playlist
    });
  }

  // Add a JioSaavn playlist
  addJioSaavnPlaylist(playlist: any): void {
    this.addToRecentlyPlayed({
      id: playlist.id,
      name: playlist.name,
      imageUrl: playlist.image ? this.getBestImageUrl(playlist.image) : undefined,
      type: 'jiosaavn-playlist',
      isPublic: true, // JioSaavn playlists are always public
      data: playlist
    });
  }

  // Add an album
  addAlbum(album: any): void {
    this.addToRecentlyPlayed({
      id: album._id || album.id,
      name: album.name || album.title,
      imageUrl: album.imageUrl || album.image,
      type: 'album',
      isPublic: true,
      data: album
    });
  }

  // Add a song
  addSong(song: any): void {
    this.addToRecentlyPlayed({
      id: song._id || song.id,
      name: song.name || song.title,
      imageUrl: song.imageUrl || song.image,
      type: 'song',
      isPublic: true,
      data: song
    });
  }

  // Get only public playlists for the recently played section
  getPublicRecentlyPlayed(): RecentlyPlayedItem[] {
    return this.getRecentlyPlayed().filter(item => 
      item.isPublic !== false && // Include items where isPublic is true or undefined
      (item.type === 'playlist' || item.type === 'jiosaavn-playlist' || item.type === 'album')
    );
  }

  // Get items for display in the recently played section (mix of recent and fallback)
  getDisplayItems(publicPlaylists: any[] = []): any[] {
    const recentItems = this.getPublicRecentlyPlayed();
    const items = [];
    const seenIds = new Set<string>();

    // Add recent items first
    for (const recentItem of recentItems) {
      if (items.length >= 7) break; // Limit to 7 items (+ 1 Liked Songs = 8 total)
      if (seenIds.has(recentItem.id)) continue;
      
      seenIds.add(recentItem.id);
      
      if (recentItem.type === 'playlist') {
        items.push({
          _id: recentItem.id,
          name: recentItem.name,
          imageUrl: recentItem.imageUrl,
          path: `/playlist/${recentItem.id}`,
          type: 'playlist',
          isRecent: true
        });
      } else if (recentItem.type === 'jiosaavn-playlist') {
        items.push({
          _id: recentItem.id,
          name: recentItem.name,
          imageUrl: recentItem.imageUrl,
          path: `/jiosaavn/playlist/${recentItem.id}`,
          type: 'jiosaavn-playlist',
          isRecent: true,
          data: recentItem.data
        });
      } else if (recentItem.type === 'album') {
        items.push({
          _id: recentItem.id,
          name: recentItem.name,
          imageUrl: recentItem.imageUrl,
          path: `/albums/${recentItem.id}`,
          type: 'album',
          isRecent: true
        });
      }
    }

    // If we don't have enough recent items, add public playlists as fallback
    if (items.length < 7 && publicPlaylists.length > 0) {
      const remainingSlots = 7 - items.length;
      const additional = [];
      
      for (const p of publicPlaylists) {
        if (additional.length >= remainingSlots) break;
        if (!seenIds.has(p._id)) {
          seenIds.add(p._id);
          additional.push({
            _id: p._id,
            name: p.name,
            imageUrl: p.imageUrl,
            path: `/playlist/${p._id}`,
            type: 'playlist',
            isRecent: false
          });
        }
      }
      
      items.push(...additional);
    }

    return items.slice(0, 7);
  }

  // Helper method to get best image URL for JioSaavn items
  private getBestImageUrl(image: any): string {
    if (typeof image === 'string') return image;
    if (Array.isArray(image) && image.length > 0) {
      // Get the highest quality image
      const sorted = image.sort((a, b) => {
        const qualityA = parseInt(a.quality?.replace('x', '') || '0');
        const qualityB = parseInt(b.quality?.replace('x', '') || '0');
        return qualityB - qualityA;
      });
      return sorted[0].url || sorted[0].link || '';
    }
    return '';
  }

  // Clear all recently played items
  clearRecentlyPlayed(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('recentlyPlayedUpdated', { 
        detail: [] 
      }));
    } catch (error) {
      // Error clearing recently played
    }
  }

  // Clear JioSaavn cache (utility function)
  clearJioSaavnCache(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('jiosaavn-')) {
          localStorage.removeItem(key);
        }
      });
      // JioSaavn cache cleared
    } catch (error) {
      // Error clearing JioSaavn cache
    }
  }

  // Remove a specific item
  removeItem(id: string, type: string): void {
    try {
      const items = this.getRecentlyPlayed();
      const filteredItems = items.filter(item => !(item.id === id && item.type === type));
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredItems));
      window.dispatchEvent(new CustomEvent('recentlyPlayedUpdated', { 
        detail: filteredItems 
      }));
    } catch (error) {
      // Error removing recently played item
    }
  }
}

// Export singleton instance
export const recentlyPlayedService = new RecentlyPlayedService();