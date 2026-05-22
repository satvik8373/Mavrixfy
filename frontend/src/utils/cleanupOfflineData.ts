/**
 * Utility to clean up any remaining offline download data
 * This should be called once to remove any leftover data from the removed download feature
 */

export const cleanupOfflineData = async (): Promise<void> => {
  try {
    // Clean up localStorage entries
    const keysToRemove = [
      'mavrixfy_downloads',
      'offline_downloads',
      'download_queue',
      'offline_playlists'
    ];

    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        // Failed to remove localStorage key
      }
    });

    // Clean up IndexedDB
    try {
      const dbName = 'MavrixfyOffline';
      
      // Check if IndexedDB is supported
      if ('indexedDB' in window) {
        // Delete the entire offline database
        const deleteRequest = indexedDB.deleteDatabase(dbName);
        
        deleteRequest.onsuccess = () => {
          // Successfully cleaned up offline database
        };
        
        deleteRequest.onerror = () => {
          // Failed to delete offline database
        };
        
        deleteRequest.onblocked = () => {
          // Database deletion blocked - close other tabs and try again
        };
      }
    } catch (error) {
      // Failed to clean up IndexedDB
    }

    // Clean up any blob URLs that might be stored in localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          if (value && /blob:/.test(value)) {
            try {
              const parsed = JSON.parse(value);
              if (typeof parsed === 'object' && parsed !== null) {
                // Check if this object contains blob URLs and clean them
                const cleanedObject = cleanBlobUrls(parsed);
                const hasChanges = JSON.stringify(cleanedObject) !== JSON.stringify(parsed);
                if (hasChanges) {
                  localStorage.setItem(key, JSON.stringify(cleanedObject));
                }
              }
            } catch {
              // Not JSON, check if it's a direct blob URL
              if (value.startsWith('blob:')) {
                localStorage.removeItem(key);
              }
            }
          }
        }
      }
    } catch (error) {
      // Failed to clean blob URLs from localStorage
    }

    // Clean up player store if it contains blob URLs
    try {
      const playerStore = localStorage.getItem('player-store:v1');
      if (playerStore) {
        const parsed = JSON.parse(playerStore);
        if (parsed && parsed.state) {
          let hasChanges = false;
          
          // Clean current song
          if (parsed.state.currentSong && parsed.state.currentSong.audioUrl && parsed.state.currentSong.audioUrl.startsWith('blob:')) {
            parsed.state.currentSong.audioUrl = '';
            hasChanges = true;
          }
          
          // Clean queue
          if (parsed.state.queue && Array.isArray(parsed.state.queue)) {
            const originalLength = parsed.state.queue.length;
            parsed.state.queue = parsed.state.queue.filter((song: any) => 
              !song.audioUrl || !song.audioUrl.startsWith('blob:')
            );
            if (parsed.state.queue.length !== originalLength) {
              hasChanges = true;
            }
          }
          
          if (hasChanges) {
            localStorage.setItem('player-store:v1', JSON.stringify(parsed));
          }
        }
      }
    } catch (error) {
      // Failed to clean player store
    }

    // Offline data cleanup completed
  } catch (error) {
    // Error during offline data cleanup
  }
};

/**
 * Recursively clean blob URLs from an object
 */
const cleanBlobUrls = (obj: any): any => {
  if (typeof obj === 'string' && obj.startsWith('blob:')) {
    return ''; // Replace blob URLs with empty string instead of null
  }
  
  if (Array.isArray(obj)) {
    return obj.flatMap((item) => {
      const cleanedItem = cleanBlobUrls(item);
      return cleanedItem !== null && cleanedItem !== '' ? [cleanedItem] : [];
    });
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const cleanedValue = cleanBlobUrls(value);
      if (cleanedValue !== null && cleanedValue !== '') {
        cleaned[key] = cleanedValue;
      } else if (key === 'audioUrl') {
        // Keep audioUrl key but set to empty string
        cleaned[key] = '';
      }
    }
    return cleaned;
  }
  
  return obj;
};
