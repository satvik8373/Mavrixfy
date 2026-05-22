import { Router } from 'express';
import { protectRoute } from '../middleware/auth.middleware.js';
import {
  buildRecommendationFeed,
  recordRecommendationEvent,
} from '../services/recommendation.service.js';

const router = Router();

router.use(protectRoute);

router.post('/events', async (req, res) => {
  try {
    const event = await recordRecommendationEvent(req.auth.uid, req.body || {});
    return res.status(202).json({
      success: true,
      accepted: {
        eventType: event.eventType,
        sessionId: event.sessionId,
        occurredAt: event.occurredAt,
      },
    });
  } catch (error) {
    const statusCode = Number(error.statusCode || 500);
    console.error('[RecommendationAPI] event ingestion failed:', error);
    return res.status(statusCode).json({
      success: false,
      message: statusCode >= 500 ? 'Failed to record recommendation event' : error.message,
    });
  }
});

router.get('/home', async (req, res) => {
  try {
    const feed = await buildRecommendationFeed(req.auth.uid, {
      forceRefresh: req.query.refresh === '1' || req.query.refresh === 'true',
      sessionId: req.query.sessionId,
      region: req.headers['x-vercel-ip-country'] || req.query.region || '',
    });

    return res.status(200).json({
      success: true,
      feed,
    });
  } catch (error) {
    console.error('[RecommendationAPI] home feed failed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to build recommendation feed',
    });
  }
});

export default router;
