import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getAudioAgentAnalysis, uploadAudioSample } from '../controller/audioAgentController.js';

const router = express.Router();

router.get('/analysis', authMiddleware, getAudioAgentAnalysis);
router.post('/upload', authMiddleware, express.raw({ type: ['audio/wav', 'audio/webm', 'audio/mpeg', 'audio/mp4'], limit: '12mb' }), uploadAudioSample);

export default router;
