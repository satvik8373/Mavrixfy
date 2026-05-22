import { v2 as cloudinary } from 'cloudinary';
import { readFileSync } from 'fs';
import multer from 'multer';
import { Readable } from 'stream';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djqq8kba8',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Helper to convert buffer to stream for Cloudinary
const bufferToStream = (buffer) => {
  const readable = new Readable({
    read() {
      this.push(buffer);
      this.push(null);
    }
  });
  return readable;
};

export const config = {
  api: {
    bodyParser: false, // Disable body parsing, we'll use multer
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Process file upload with multer
    const multerUpload = upload.single('file');
    
    // Use a Promise to handle multer processing
    const uploadedFile = await new Promise((resolve, reject) => {
      multerUpload(req, res, (err) => {
        if (err) {
          console.error('Multer error:', err);
          reject(err);
        } else {
          resolve(req.file);
        }
      });
    });

    // Check if we have a file
    if (!uploadedFile) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Get folder from request or use default
    const folder = req.query.folder || 'spotify_clone/playlists';

    // Upload to Cloudinary
    const uploadPromise = new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'image',
          upload_preset: 'spotify_clone', // Use the unsigned upload preset
          use_filename: true, // Use the filename (matches the settings in your screenshot)
          unique_filename: true, // Generate unique filenames (matches the settings in your screenshot)
          // Add any other upload options here
          transformation: [
            { width: 500, height: 500, crop: 'fill' },
            { quality: 'auto' }
          ]
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      // Convert buffer to stream and pipe to Cloudinary
      bufferToStream(req.file.buffer).pipe(stream);
    });

    const result = await uploadPromise;

    // Return success response with Cloudinary data
    return res.status(200).json({
      success: true,
      url: result.secure_url,
      public_id: result.public_id,
      version: result.version,
      resource_type: result.resource_type,
      format: result.format,
      width: result.width,
      height: result.height
    });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    return res.status(500).json({ error: 'Failed to upload image', details: error.message });
  }
} 
