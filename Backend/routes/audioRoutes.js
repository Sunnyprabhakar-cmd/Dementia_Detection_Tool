import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { getAudioAgentAnalysis, uploadAudioSample } from '../controller/audioAgentController.js';

const router = express.Router();
const supportedAudioTypes = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg'
]);

const validateAudioType = (req, res, next) => {
  const contentType = (req.get('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (supportedAudioTypes.has(contentType)) return next();

  return res.status(415).json({
    status: 'error',
    processing_status: 'rejected',
    transcription: null,
    speech_features: null,
    transcript_analysis: null,
    classifier: { status: 'unavailable', message: 'Research analysis only — classifier unavailable.' },
    error: {
      code: 'unsupported_audio_type',
      message: 'Use a supported WAV, WebM, MP3, MP4, or Ogg audio recording.'
    }
  });
};

const parseAudioBody = (req, res, next) => {
  express.raw({ type: () => true, limit: '12mb' })(req, res, (error) => {
    if (!error) return next();

    const tooLarge = error.type === 'entity.too.large';
    return res.status(tooLarge ? 413 : 400).json({
      status: 'error',
      processing_status: 'rejected',
      transcription: null,
      speech_features: null,
      transcript_analysis: null,
      classifier: { status: 'unavailable', message: 'Research analysis only — classifier unavailable.' },
      error: {
        code: tooLarge ? 'audio_too_large' : 'invalid_audio_body',
        message: tooLarge
          ? 'Audio must be 12 MB or smaller. Please record a shorter sample.'
          : 'The audio upload could not be read. Please retry the recording.'
      }
    });
  });
};

router.get('/analysis', authMiddleware, getAudioAgentAnalysis);
router.post('/upload', authMiddleware, validateAudioType, parseAudioBody, uploadAudioSample);

export default router;
