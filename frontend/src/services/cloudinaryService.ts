import axios from 'axios';

// Cloudinary Configuration
const CLOUDINARY_CLOUD_NAME = 'djqq8kba8';
const CLOUDINARY_UPLOAD_PRESET = 'spotify_clone';
const CLOUDINARY_API_KEY = process.env.REACT_APP_CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.REACT_APP_CLOUDINARY_API_SECRET || '';

// Interface for the response from the backend for signature generation
interface CloudinarySignatureResponse {
  signature: string;
  timestamp: number;
  apiKey: string;
}

// Interface for the direct upload response from Cloudinary
interface CloudinaryUploadResponse {
  public_id: string;
  version: number;
  signature: string;
  width: number;
  height: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  url: string;
  secure_url: string;
  original_filename: string;
}

// Interface for Cloudinary delete response
interface CloudinaryDeleteResponse {
  result: string;
}

// Interface for image optimization options
interface OptimizationOptions {
  width?: number;
  height?: number;
  crop?: 'fill' | 'scale' | 'fit' | 'limit' | 'thumb';
  quality?: number | 'auto';
  format?: 'auto' | 'webp' | 'jpg' | 'png' | 'avif';
  blur?: number;
  radius?: number | 'max';
  effect?: string;
  background?: string;
}

/**
 * Generates an optimized Cloudinary URL based on provided options
 * @param publicIdOrUrl The public_id or full URL of the image
 * @param options Optimization options
 * @returns Optimized image URL
 */
export const getOptimizedImageUrl = (
  publicIdOrUrl: string,
  options: OptimizationOptions = {}
): string => {
  if (!publicIdOrUrl) return '';

  // If this is already a full URL, extract the public ID
  let publicId = publicIdOrUrl;
  if (publicIdOrUrl.startsWith('http')) {
    // Try to extract public ID from Cloudinary URL
    const match = publicIdOrUrl.match(/\/([^/]+)\/?([^/]+)\/([^/]+)$/);
    if (match && match[3]) {
      publicId = match[3].split('.')[0]; // Remove extension if present
    } else {
      // If we can't extract, just return the original URL
      return publicIdOrUrl;
    }
  }

  // Build transformation string
  const transformations = [];

  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);
  if (options.blur) transformations.push(`e_blur:${options.blur}`);
  if (options.radius) transformations.push(`r_${options.radius}`);
  if (options.effect) transformations.push(`e_${options.effect}`);
  if (options.background) transformations.push(`b_${options.background}`);

  const transformationString = transformations.length > 0 
    ? transformations.join(',') + '/' 
    : '';

  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformationString}${publicId}`;
};

/**
 * Inserts Cloudinary transformations into a full Cloudinary URL without losing
 * folders or version segments.
 */
export const getOptimizedCloudinaryUrl = (
  imageUrl: string,
  options: OptimizationOptions = {}
): string => {
  if (!imageUrl || !imageUrl.includes('res.cloudinary.com') || !imageUrl.includes('/image/upload/')) {
    return imageUrl;
  }

  const transformations = [];

  if (options.width) transformations.push(`w_${options.width}`);
  if (options.height) transformations.push(`h_${options.height}`);
  if (options.crop) transformations.push(`c_${options.crop}`);
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);
  if (options.blur) transformations.push(`e_blur:${options.blur}`);
  if (options.radius) transformations.push(`r_${options.radius}`);
  if (options.effect) transformations.push(`e_${options.effect}`);
  if (options.background) transformations.push(`b_${options.background}`);

  if (transformations.length === 0) return imageUrl;

  return imageUrl.replace('/image/upload/', `/image/upload/${transformations.join(',')}/`);
};

export const getOptimizedArtworkUrl = (
  imageUrl: string | undefined,
  options: OptimizationOptions = {}
): string => {
  if (!imageUrl) return '';

  if (imageUrl.includes('res.cloudinary.com')) {
    return getOptimizedCloudinaryUrl(imageUrl, {
      quality: 'auto',
      format: 'auto',
      ...options,
    });
  }

  if (/(?:c|aac|cdnx)\.saavncdn\.com/.test(imageUrl)) {
    const size = options.width && options.width <= 160 ? 150 : 500;
    return imageUrl.replace(/_\d+x\d+(\.[a-zA-Z0-9]+)(\?.*)?$/, `_${size}x${size}$1$2`);
  }

  return imageUrl;
};

/**
 * Uploads an image to Cloudinary using direct unsigned upload
 * @param file The file to upload
 * @param onProgress Optional callback for upload progress
 * @returns Promise with the upload result
 */
export const uploadImage = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
    formData.append('folder', 'spotify_clone/playlists'); // Explicitly set folder to match Asset folder setting

    const response = await axios.post<CloudinaryUploadResponse>(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        },
      }
    );

    return response.data.secure_url;
  } catch (error) {
    throw error;
  }
};

/**
 * Uploads an image from a URL
 * @param imageUrl URL of the image to upload
 * @returns Promise with the upload result URL
 */
export const uploadImageFromUrl = async (imageUrl: string): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', imageUrl);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
    formData.append('folder', 'spotify_clone/playlists'); // Explicitly set folder

    const response = await axios.post<CloudinaryUploadResponse>(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData
    );

    return response.data.secure_url;
  } catch (error) {
    throw error;
  }
};

/**
 * Gets a Cloudinary URL for an image using its public ID
 * @param publicId The public ID of the image
 * @param options Optimization options
 * @returns Cloudinary URL
 */
export const getCloudinaryUrl = (
  publicId: string,
  options: OptimizationOptions = {}
): string => {
  return getOptimizedImageUrl(publicId, options);
};

/**
 * Generates a random color hex code
 * @returns Random hex color
 */
const getRandomColor = (): string => {
  const colors = [
    '#1DB954', // Mavrixfy green
    '#3D91F4', // blue
    '#E13300', // red
    '#FFA42B', // orange
    '#8B2AC2', // purple
    '#17A398', // teal
    '#F73D93', // pink
    '#43AA8B', // sage green
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Generates a placeholder image URL with text
 * @param text The text to show in the placeholder
 * @returns URL to the generated placeholder image
 */
export const getPlaceholderImageUrl = (text: string = 'Playlist'): string => {
  const color = getRandomColor();
  const transformations = [
    'w_500',
    'h_500',
    'c_fill',
    `b_${color.replace('#', 'rgb:')}`,
    `l_text:Arial_80_bold:${encodeURIComponent(text.charAt(0).toUpperCase())}`,
    'co_white',
    'g_center'
  ].join(',');

  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${transformations}/placeholder_text`;
};

/**
 * Deletes an image from Cloudinary
 * @param publicId Public ID of the image to delete
 * @returns Promise with the delete result
 */
export const deleteImage = async (publicId: string): Promise<boolean> => {
  try {
    // This would typically call a backend endpoint that handles authentication
    const response = await axios.delete<CloudinaryDeleteResponse>(
      `/api/cloudinary/delete?publicId=${encodeURIComponent(publicId)}`
    );
    
    return response.data.result === 'ok';
  } catch (error) {
    return false;
  }
};

/**
 * Extracts public ID from a Cloudinary URL
 * @param url Full Cloudinary URL
 * @returns Public ID or null if can't be extracted
 */
export const getPublicIdFromUrl = (url: string): string | null => {
  if (!url) return null;
  
  try {
    const regex = new RegExp(`${CLOUDINARY_CLOUD_NAME}/image/upload/([^/]+/)*([^/.]+)`);
    const match = url.match(regex);
    return match ? match[2] : null;
  } catch (error) {
    return null;
  }
};

/**
 * Generates a responsive picture element with multiple source formats
 * @param publicId The public ID of the image
 * @param alt Alt text for the image
 * @param className Optional class name for the img element
 * @returns Responsive picture HTML string
 */
export const getResponsiveImageHtml = (
  publicId: string,
  alt: string,
  className: string = ''
): string => {
  return `
    <picture>
      <source
        srcset="${getOptimizedImageUrl(publicId, { format: 'webp', width: 400 })}"
        type="image/webp"
      />
      <source
        srcset="${getOptimizedImageUrl(publicId, { format: 'jpg', width: 400 })}"
        type="image/jpeg"
      />
      <img
        src="${getOptimizedImageUrl(publicId, { width: 400 })}"
        alt="${alt}"
        class="${className}"
        loading="lazy"
      />
    </picture>
  `;
}; 
