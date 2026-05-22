/**
 * Platform-Specific Share Handlers
 * Handles sharing logic for each social platform
 */

import { SharePlatform, GeneratedShareCard } from './types';
import { trackShare } from '@/utils/shareTracking';

export interface ShareOptions {
  platform: SharePlatform;
  card: GeneratedShareCard;
  title: string;
  text: string;
  contentId: string;
  contentType: string;
}

/**
 * Main share handler - routes to platform-specific handlers
 */
export const handlePlatformShare = async (options: ShareOptions): Promise<void> => {
  const { platform } = options;
  
  // Track share event
  trackShare(
    options.contentType as any,
    options.contentId,
    platform,
    undefined
  );
  
  switch (platform) {
    case 'instagram-story':
      return handleInstagramStory(options);
    case 'instagram-feed':
      return handleInstagramFeed(options);
    case 'whatsapp':
      return handleWhatsApp(options);
    case 'whatsapp-status':
      return handleWhatsAppStatus(options);
    case 'facebook':
      return handleFacebook(options);
    case 'twitter':
      return handleTwitter(options);
    case 'snapchat':
      return handleSnapchat(options);
    case 'telegram':
      return handleTelegram(options);
    case 'copy-link':
      return handleCopyLink(options);
    case 'native-share':
      return handleNativeShare(options);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
};

/**
 * Instagram Story - Opens Instagram with sticker
 */
const handleInstagramStory = async (options: ShareOptions) => {
  const { card } = options;
  
  // Check if Instagram app is available (mobile only)
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // Try to open Instagram app with deep link
    const instagramUrl = `instagram://story-camera`;
    window.location.href = instagramUrl;
    
    // Fallback: Download image and show instructions
    setTimeout(() => {
      downloadImage(card.imageBlob, 'mavrixfy-share.png');
      alert('Image downloaded! Open Instagram and upload from your gallery.');
    }, 1000);
  } else {
    // Desktop: Download image with instructions
    downloadImage(card.imageBlob, 'mavrixfy-share.png');
    alert('Image downloaded! Open Instagram on your phone and upload to your story.');
  }
};

/**
 * Instagram Feed - Download image
 */
const handleInstagramFeed = async (options: ShareOptions) => {
  const { card } = options;
  downloadImage(card.imageBlob, 'mavrixfy-share.png');
  alert('Image downloaded! Open Instagram and create a new post.');
};

/**
 * WhatsApp - Share with image and link
 */
const handleWhatsApp = async (options: ShareOptions) => {
  const { text, card } = options;
  
  // Try Web Share API first (supports images on mobile)
  if (navigator.share && navigator.canShare?.({ files: [new File([card.imageBlob], 'share.png', { type: 'image/png' })] })) {
    try {
      await navigator.share({
        title: options.title,
        text: text,
        files: [new File([card.imageBlob], 'mavrixfy-share.png', { type: 'image/png' })]
      });
      return;
    } catch (error) {
      // User cancelled or error - fall through to URL method
    }
  }
  
  // Fallback: WhatsApp URL with text only
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text + '\n\n' + card.shareUrl)}`;
  window.open(whatsappUrl, '_blank');
};

/**
 * WhatsApp Status - Similar to Instagram Story
 */
const handleWhatsAppStatus = async (options: ShareOptions) => {
  const { card } = options;
  downloadImage(card.imageBlob, 'mavrixfy-share.png');
  alert('Image downloaded! Open WhatsApp and add to your status.');
};

/**
 * Facebook - Share with link
 */
const handleFacebook = async (options: ShareOptions) => {
  const { card } = options;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(card.shareUrl)}`;
  window.open(facebookUrl, '_blank', 'width=600,height=400');
};

/**
 * Twitter - Share with text and link
 */
const handleTwitter = async (options: ShareOptions) => {
  const { text, card } = options;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(card.shareUrl)}`;
  window.open(twitterUrl, '_blank', 'width=600,height=400');
};

/**
 * Snapchat - Download image with instructions
 */
const handleSnapchat = async (options: ShareOptions) => {
  const { card } = options;
  downloadImage(card.imageBlob, 'mavrixfy-share.png');
  alert('Image downloaded! Open Snapchat and upload to your story.');
};

/**
 * Telegram - Share with link
 */
const handleTelegram = async (options: ShareOptions) => {
  const { text, card } = options;
  const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(card.shareUrl)}&text=${encodeURIComponent(text)}`;
  window.open(telegramUrl, '_blank');
};

/**
 * Copy Link - Copy to clipboard with proper cleanup
 */
const handleCopyLink = async (options: ShareOptions) => {
  const { card } = options;
  
  try {
    await navigator.clipboard.writeText(card.shareUrl);
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = card.shareUrl;
    textArea.style.cssText = 'position: fixed; left: -999999px; top: 0;';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    
    try {
      textArea.select();
      textArea.setSelectionRange(0, 99999); // For mobile devices
      document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }
  }
};

/**
 * Native Share - Use Web Share API
 */
const handleNativeShare = async (options: ShareOptions) => {
  const { title, text, card } = options;
  
  if (!navigator.share) {
    // Fallback to copy link
    return handleCopyLink(options);
  }
  
  try {
    // Try sharing with image
    const file = new File([card.imageBlob], 'mavrixfy-share.png', { type: 'image/png' });
    
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title,
        text,
        files: [file]
      });
    } else {
      // Share without image
      await navigator.share({
        title,
        text,
        url: card.shareUrl
      });
    }
  } catch (error) {
    // User cancelled or error
  }
};

/**
 * Helper: Download image with proper cleanup
 */
const downloadImage = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  
  // Cleanup after a delay to ensure download starts
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
};

/**
 * Check if platform is available
 */
export const isPlatformAvailable = (platform: SharePlatform): boolean => {
  switch (platform) {
    case 'native-share':
      return !!navigator.share;
    case 'copy-link':
      return !!navigator.clipboard;
    default:
      return true; // All other platforms work via URLs
  }
};

/**
 * Get platform display name
 */
export const getPlatformName = (platform: SharePlatform): string => {
  const names: Record<SharePlatform, string> = {
    'instagram-story': 'Instagram Story',
    'instagram-feed': 'Instagram Feed',
    'whatsapp': 'WhatsApp',
    'whatsapp-status': 'WhatsApp Status',
    'facebook': 'Facebook',
    'twitter': 'Twitter',
    'snapchat': 'Snapchat',
    'telegram': 'Telegram',
    'copy-link': 'Copy Link',
    'native-share': 'Share'
  };
  
  return names[platform] || platform;
};

/**
 * Get platform icon name (for Lucide React)
 */
export const getPlatformIcon = (platform: SharePlatform): string => {
  const icons: Record<SharePlatform, string> = {
    'instagram-story': 'Instagram',
    'instagram-feed': 'Instagram',
    'whatsapp': 'MessageCircle',
    'whatsapp-status': 'MessageCircle',
    'facebook': 'Facebook',
    'twitter': 'Twitter',
    'snapchat': 'Ghost',
    'telegram': 'Send',
    'copy-link': 'Link',
    'native-share': 'Share2'
  };
  
  return icons[platform] || 'Share2';
};
