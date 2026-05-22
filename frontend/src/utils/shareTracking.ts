import { trackRecommendationEvent } from '@/services/recommendationService';

/**
 * Utility for tracking social sharing events
 */

export type SharePlatform = 
  | 'instagram-story'
  | 'instagram-feed'
  | 'whatsapp'
  | 'whatsapp-status'
  | 'facebook'
  | 'twitter'
  | 'snapchat'
  | 'telegram'
  | 'copy-link'
  | 'native-share';
export type ShareContentType = 'song' | 'playlist' | 'album' | 'profile';

interface ShareEvent {
  contentType: ShareContentType;
  contentId: string;
  platform: SharePlatform;
  userId?: string;
  timestamp: number;
}

const SHARE_EVENTS_KEY = 'share_events:v1';

const readShareEvents = (): ShareEvent[] => {
  return JSON.parse(localStorage.getItem(SHARE_EVENTS_KEY) || '[]');
};

/**
 * Track a share event
 */
export const trackShare = (
  contentType: ShareContentType,
  contentId: string,
  platform: SharePlatform,
  userId?: string
) => {
  const event: ShareEvent = {
    contentType,
    contentId,
    platform,
    userId,
    timestamp: Date.now()
  };

  // Send to Google Analytics if available
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'share', {
      content_type: contentType,
      content_id: contentId,
      method: platform,
      user_id: userId
    });
  }

  // Store locally for analytics
  try {
    const shares = readShareEvents();
    shares.push(event);
    
    // Keep only last 100 events
    if (shares.length > 100) {
      shares.shift();
    }
    
    localStorage.setItem(SHARE_EVENTS_KEY, JSON.stringify(shares));
  } catch (error) {
    // Silent error handling
  }

  // Share tracked successfully
  if (contentType === 'song') {
    void trackRecommendationEvent({
      eventType: 'share_song',
      item: {
        id: `${contentType}:${contentId}`,
        contentId,
        kind: 'song',
        source: 'catalog',
        title: contentId,
        subtitle: '',
      },
      context: { surface: platform },
    });
  }
};

/**
 * Get share statistics
 */
export const getShareStats = () => {
  try {
    const shares = readShareEvents();
    
    const stats = {
      total: shares.length,
      byPlatform: {} as Record<SharePlatform, number>,
      byContentType: {} as Record<ShareContentType, number>,
      last24Hours: 0,
      last7Days: 0
    };

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const week = 7 * day;

    shares.forEach((event: ShareEvent) => {
      // Count by platform
      stats.byPlatform[event.platform] = (stats.byPlatform[event.platform] || 0) + 1;
      
      // Count by content type
      stats.byContentType[event.contentType] = (stats.byContentType[event.contentType] || 0) + 1;
      
      // Count recent shares
      if (now - event.timestamp < day) {
        stats.last24Hours++;
      }
      if (now - event.timestamp < week) {
        stats.last7Days++;
      }
    });

    return stats;
  } catch (error) {
    return {
      total: 0,
      byPlatform: {},
      byContentType: {},
      last24Hours: 0,
      last7Days: 0
    };
  }
};

/**
 * Generate shareable URL with tracking parameters
 */
export const generateShareUrl = (
  path: string,
  source: SharePlatform,
  contentType: ShareContentType,
  contentId: string
) => {
  const baseUrl = window.location.origin;
  const url = new URL(path, baseUrl);
  
  // Add tracking parameters
  url.searchParams.set('ref', source);
  url.searchParams.set('type', contentType);
  url.searchParams.set('id', contentId);
  
  return url.toString();
};

/**
 * Parse tracking parameters from URL
 */
export const parseShareParams = () => {
  if (typeof window === 'undefined') return null;
  
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref') as SharePlatform | null;
  const type = params.get('type') as ShareContentType | null;
  const id = params.get('id');
  
  if (ref && type && id) {
    return { ref, type, id };
  }
  
  return null;
};

/**
 * Track incoming share click
 */
export const trackShareClick = () => {
  const params = parseShareParams();
  
  if (params) {
    // Track that someone clicked a shared link
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'share_click', {
        source: params.ref,
        content_type: params.type,
        content_id: params.id
      });
    }
    
    // Store for conversion tracking
    try {
      localStorage.setItem('share_source:v1', JSON.stringify(params));
    } catch (error) {
      // Silent error handling
    }
  }
};

