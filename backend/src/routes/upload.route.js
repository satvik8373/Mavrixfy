import { Router } from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import cloudinary from "cloudinary";

const router = Router();

// Configure Cloudinary if environment variables are available
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Upload endpoint
router.post("/", protectRoute, async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const file = req.files.file;
    
    // Check if it's an image
    if (!file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Only images are allowed" });
    }
    
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: "File too large. Max 5MB allowed." });
    }

    // Upload strategy depends on environment
    if (process.env.NODE_ENV === "production" && process.env.CLOUDINARY_CLOUD_NAME) {
      // In production, upload to Cloudinary
      try {
        // Move file to temp directory
        const tempPath = path.join(process.cwd(), "tmp", `${uuidv4()}-${file.name}`);
        await file.mv(tempPath);
        
        // Upload to cloudinary
        const result = await cloudinary.v2.uploader.upload(tempPath, {
          folder: "spotify-clone/playlists",
          resource_type: "image",
        });
        
        // Clean up temp file
        fs.unlinkSync(tempPath);
        
        return res.json({ 
          imageUrl: result.secure_url 
        });
      } catch (error) {
        console.error("Cloudinary upload error:", error);
        return res.status(500).json({ message: "Error uploading to cloud service" });
      }
    } else {
      // For development, save locally
      const fileName = `${uuidv4()}-${file.name}`;
      const uploadPath = path.join(process.cwd(), "public", "uploads", fileName);
      
      // Make sure upload directory exists
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // Move the file
      await file.mv(uploadPath);
      
      // Return URL to access the file with full API base URL
      const baseUrl = process.env.NODE_ENV === "production" 
        ? process.env.BACKEND_URL || ""
        : `${req.protocol}://${req.get("host")}`;
      const imageUrl = `${baseUrl}/uploads/${fileName}`;
      return res.json({ imageUrl });
    }
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "Error uploading file", error: error.message });
  }
});

export default router; 
