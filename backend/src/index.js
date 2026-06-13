import express from "express";
import dotenv from "dotenv";

// Load environment variables first
dotenv.config();

// Normalize local development defaults even if .env contains production values.
// This keeps npm run dev behavior predictable on localhost.
const isLocalRuntime = !process.env.VERCEL;
const isDevLifecycle = process.env.npm_lifecycle_event === "dev";
if (isLocalRuntime && isDevLifecycle) {
  process.env.NODE_ENV = "development";

  if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes("mavrixfy.site")) {
    process.env.FRONTEND_URL = "http://localhost:3000";
  }
}


import fileUpload from "express-fileupload";
import path from "path";
import cors from "cors";
import fs from "fs";
import { createServer } from "http";
import cron from "node-cron";

// Import Firebase admin
import admin from "./config/firebase.js";

import { initializeSocket } from "./lib/socket.js";

import userRoutes from "./routes/user.route.js";
import authRoutes from "./routes/auth.route.js";
import songRoutes from "./routes/song.route.js";
import albumRoutes from "./routes/album.route.js";
import statRoutes from "./routes/stat.route.js";
import musicRoutes from "./routes/music.route.js";
import playlistRoutes from "./routes/playlist.route.js";
import moodPlaylistRoutes from "./routes/moodPlaylist.route.js";
import uploadRoutes from "./routes/upload.route.js";
import youtubeMusicRoutes from "./routes/youtubeMusic.route.js";

import likedSongRoutes from "./routes/likedSong.route.js";
import cloudinaryRoutes from "./routes/cloudinary.route.js";
import deezerRoutes from "./routes/deezer.route.js";
import jiosaavnRoutes from "./routes/jiosaavn.route.js";
import facebookRoutes from "./routes/facebook.route.js";
import otpRoutes from "./routes/otp.route.js";
import appRoutes from "./routes/app.route.js";
import versionRoutes from "./routes/version.route.js";
import smartSearchRoutes from "./routes/smartSearch.route.js";
import recommendationRoutes from "./routes/recommendation.route.js";
import { verifyEmailConfig } from "./services/email.service.js";
import { withAuthDeadline } from "./middleware/auth.middleware.js";

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy - CRITICAL for Vercel to detect HTTPS correctly
app.set('trust proxy', 1);

const httpServer = createServer(app);
initializeSocket(httpServer);

// CORS configuration with proper credentials support
const corsOptions = {
  origin: (origin, callback) => {
    try {
      const defaultAllowed = [
        'http://localhost:3000',
        'http://localhost:5173',
        'https://mavrixfy.site',
        'https://www.mavrixfy.site',
        'https://1d3c38b2f441.ngrok-free.app',
        process.env.FRONTEND_URL || '',
      ].filter(Boolean);

      // Allow non-browser requests (no Origin)
      if (!origin) return callback(null, true);

      // Parse hostname safely
      let hostname = '';
      try { hostname = new URL(origin).hostname; } catch { }

      const isNgrok = hostname.endsWith('.ngrok-free.app') || hostname.endsWith('.ngrok.io');
      const isMavrixfy = hostname === 'mavrixfy.site' || hostname === 'www.mavrixfy.site';
      const isAllowed = defaultAllowed.includes(origin) || isNgrok || isMavrixfy;

      console.log('CORS check:', { origin, hostname, isNgrok, isMavrixfy, isAllowed });
      return callback(isAllowed ? null : new Error('Not allowed by CORS'), isAllowed);
    } catch (e) {
      // Fallback: deny if anything goes wrong
      return callback(new Error('CORS error'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true, // Allow cookies to be sent with requests
  maxAge: 600
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle OPTIONS preflight requests for all routes
app.options('*', cors(corsOptions));

app.use(express.json()); // to parse req.body



// Firebase authentication middleware
app.use(async (req, res, next) => {
  // Initialize req.auth if not set
  req.auth = req.auth || {};

  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.split('Bearer ')[1];

    try {
      const decodedToken = await withAuthDeadline(admin.auth().verifyIdToken(idToken));
      req.auth = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        firebase: decodedToken
      };
      console.log(`Firebase auth successful for user: ${decodedToken.uid}`);
    } catch (error) {
      // Check if it's a Firebase initialization error
      if (error.code === 'auth-timeout') {
        console.error('Firebase auth verification timed out before route handling.');
      } else if (error.message.includes('Unable to detect a Project Id')) {
        console.error('Firebase Project ID not configured properly. Please check your environment variables.');
        console.error('To fix this, set FIREBASE_PROJECT_ID=spotify-8fefc in your environment variables.');
      } else {
        console.log("Firebase auth failed, continuing with other auth methods:", error.message);
      }
      // Don't fail the request - allow other auth methods to be checked
    }
  }

  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Use file upload middleware in all environments.
// On Vercel, keep uploads in memory (no temp filesystem dependency).
const uploadUsesTempFiles = !process.env.VERCEL;
app.use(
  fileUpload({
    useTempFiles: uploadUsesTempFiles,
    ...(uploadUsesTempFiles ? { tempFileDir: path.join(__dirname, "tmp") } : {}),
    createParentPath: uploadUsesTempFiles,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
  })
);

// Temp file cleanup is only needed when temp files are enabled.
if (uploadUsesTempFiles) {
  const tempDir = path.join(process.cwd(), "tmp");
  cron.schedule("0 * * * *", () => {
    if (fs.existsSync(tempDir)) {
      fs.readdir(tempDir, (err, files) => {
        if (err) {
          console.log("error", err);
          return;
        }
        for (const file of files) {
          fs.unlink(path.join(tempDir, file), () => { });
        }
      });
    }
  });
}

// API test routes


app.use("/api/users", userRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/stats", statRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/youtube-music", youtubeMusicRoutes);
app.use("/api/playlists", moodPlaylistRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/liked-songs", likedSongRoutes);
app.use("/api/cloudinary", cloudinaryRoutes);
app.use("/api/deezer", deezerRoutes);
app.use("/api/jiosaavn", jiosaavnRoutes);
app.use("/api/facebook", facebookRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/app", appRoutes);
app.use("/api/version", versionRoutes);
app.use("/api/search", smartSearchRoutes);
app.use("/api/recommendations", recommendationRoutes);

// Add a root route handler
app.get('/', (req, res) => {
  res.json({
    message: 'Mavrixfy API - Welcome! Use /api/playlists, /api/songs, etc.',
    environment: process.env.NODE_ENV || 'development',
    vercel: process.env.VERCEL ? 'yes' : 'no',
    timestamp: new Date().toISOString(),
    testEndpoint: '/api/test/health'
  });
});

// Health check endpoint to verify Firebase initialization
app.get('/api/test/health', (req, res) => {
  try {
    const firebaseInitialized = admin.apps.length > 0;
    const hasFirestore = firebaseInitialized ? !!admin.firestore : false;
    
    res.json({
      status: 'ok',
      firebase: {
        initialized: firebaseInitialized,
        firestoreAvailable: hasFirestore,
        projectId: process.env.FIREBASE_PROJECT_ID || 'not set',
        hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
        hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      firebase: {
        initialized: false
      }
    });
  }
});

if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../frontend", "dist", "index.html"));
  });
}

// Add error handling middleware with CORS headers
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Ensure CORS headers are set even on errors
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://mavrixfy.site',
    'https://www.mavrixfy.site'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.status(err.status || 500).json({
    message: process.env.NODE_ENV === "production"
      ? "An error occurred"
      : err.message,
    error: process.env.NODE_ENV === "development" ? err : {}
  });
});

let startupResolved = false;

const logStartupStatus = (port, fallbackReason = "") => {
  console.log(`Server is running on port ${port}`);
  if (fallbackReason) {
    console.log(`Port fallback: ${fallbackReason}`);
  }
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'Not set'}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Running on Vercel: ${process.env.VERCEL ? 'Yes' : 'No'}`);

  // Verify email configuration
  verifyEmailConfig().then(isReady => {
    if (isReady) {
      console.log('✓ Email service configured and ready');
    } else {
      console.log('⚠ Email service not configured - OTP will be shown in console only');
    }
  });
};

const startServer = (port, fallbackReason = "") => {
  httpServer.listen(port, () => {
    if (startupResolved) return;
    startupResolved = true;
    const address = httpServer.address();
    const activePort = typeof address === 'object' && address ? address.port : port;
    logStartupStatus(activePort, fallbackReason);
  });
};

httpServer.on('error', (error) => {
  if (error?.code === 'EADDRINUSE' && !startupResolved) {
    console.warn(`Port ${PORT} is already in use. Retrying with a random open port...`);
    setTimeout(() => {
      startServer(0, `Primary port ${PORT} was busy`);
    }, 100);
    return;
  }

  console.error('Server startup error:', error);
  process.exit(1);
});

startServer(PORT);
