import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { analyzeAudioAgent } from '../services/audioAgentService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

export const getAudioAgentAnalysis = async (req, res) => {
  try {
    const { subject } = req.query;
    const result = await analyzeAudioAgent({ subject: subject || null });

    return res.status(200).json({
      message: 'Audio agent analysis completed',
      result,
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Audio agent analysis failed',
    });
  }
};

export const uploadAudioSample = async (req, res) => {
  try {
    const userId = req.user?.userId || 'demo-user';
    const subject = String(req.query.subject || userId || 'demo-user').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const buffer = Buffer.from(req.body || []);

    if (!buffer.length) {
      return res.status(400).json({ message: 'No audio bytes were received.' });
    }

    const contentType = req.get('content-type') || 'audio/wav';
    const extension = contentType.includes('wav') ? 'wav' : contentType.includes('webm') ? 'webm' : contentType.includes('mpeg') || contentType.includes('mp3') ? 'mp3' : 'bin';
    const subjectDir = path.join(projectRoot, 'Backend', 'data', 'dementia', subject || 'voice_subject');
    fs.mkdirSync(subjectDir, { recursive: true });

    const fileName = `voice_sample_${Date.now()}.${extension}`;
    const filePath = path.join(subjectDir, fileName);
    fs.writeFileSync(filePath, buffer);

    try {
      execFileSync('python', ['Backend/ml/audio_pipeline.py'], {
        cwd: projectRoot,
        stdio: 'pipe'
      });
    } catch (pipelineError) {
      console.warn('Audio pipeline refresh failed after upload:', pipelineError.message);
    }

    const result = await analyzeAudioAgent({ subject: subject || null });

    return res.status(200).json({
      message: 'Voice sample saved and audio analysis refreshed.',
      file: path.relative(projectRoot, filePath),
      subject,
      result
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message || 'Audio upload failed.'
    });
  }
};
