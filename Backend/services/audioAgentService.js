import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const featurePath = path.join(projectRoot, 'artifacts', 'models', 'audio', 'baseline_v1', 'audio_subject_features.csv');

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const readSubjectRows = () => {
  if (!fs.existsSync(featurePath)) {
    return [];
  }

  const csv = fs.readFileSync(featurePath, 'utf-8');
  const rows = csv.trim().split('\n');
  if (rows.length < 2) {
    return [];
  }

  const headers = rows[0].split(',');
  return rows.slice(1).map((line) => {
    const values = line.split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
};

const getNumericStats = (row) => {
  const numericEntries = Object.entries(row).filter(([key, value]) => {
    if (['subject', 'recording_count'].includes(key)) return false;
    return !Number.isNaN(Number(value));
  });

  const values = numericEntries.map(([, value]) => toNumber(value));
  if (!values.length) return { mean: 0, std: 0, median: 0 };

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    std: Math.sqrt(values.reduce((sum, value) => sum + (value - (values.reduce((total, v) => total + v, 0) / values.length)) ** 2, 0) / Math.max(1, values.length)),
    median,
  };
};

export const analyzeAudioAgent = async ({ subject = null } = {}) => {
  const rows = readSubjectRows();
  if (!rows.length) {
    return {
      status: 'insufficient_data',
      subject: subject || 'unknown',
      model_name: 'audio_subject_anomaly_agent',
      model_version: 'audio_subject_v1',
      anomaly_score: 0,
      screening_indicator: 'insufficient_data',
      evidence: ['No subject-level audio feature matrix was found.'],
      limitation: 'Audio features exist, but there is no valid subject-level dataset to score yet.',
      data_quality: 'insufficient_data',
      modality: 'audio',
      probability_calibrated: false,
      created_at: new Date().toISOString(),
    };
  }

  const candidates = subject ? rows.filter((row) => String(row.subject).toLowerCase() === String(subject).toLowerCase()) : rows;
  const target = candidates[0] || rows[0];

  if (!target) {
    return {
      status: 'insufficient_data',
      subject: subject || 'unknown',
      model_name: 'audio_subject_anomaly_agent',
      model_version: 'audio_subject_v1',
      anomaly_score: 0,
      screening_indicator: 'insufficient_data',
      evidence: ['No subject row matched the requested audio profile.'],
      limitation: 'Audio labels are unavailable; the agent provides an unsupervised pattern observation only.',
      data_quality: 'insufficient_data',
      modality: 'audio',
      probability_calibrated: false,
      created_at: new Date().toISOString(),
    };
  }

  const stats = getNumericStats(target);
  const recordingCount = toNumber(target.recording_count, 0);
  const durationMean = toNumber(target.duration_seconds_mean, 0);
  const silenceRatio = toNumber(target.silence_ratio_mean, 0);
  const zcr = toNumber(target.zcr_mean_mean, 0);
  const rms = toNumber(target.rms_mean_mean, 0);

  const rawAnomaly = Math.min(
    1,
    (Math.abs(silenceRatio - 0.4) * 2.5 + Math.abs(zcr - 0.06) * 6 + Math.abs(rms - 0.04) * 8 + Math.abs(durationMean - 60) / 100) / 2
  );

  const anomalyScore = Math.max(0, Math.min(100, rawAnomaly * 100));
  const screeningIndicator = anomalyScore >= 65 ? 'high' : anomalyScore >= 35 ? 'moderate' : 'low';

  return {
    status: 'available',
    subject: target.subject,
    model_name: 'audio_subject_anomaly_agent',
    model_version: 'audio_subject_v1',
    modality: 'audio',
    anomaly_score: Number(anomalyScore.toFixed(2)),
    screening_indicator: screeningIndicator,
    probability_calibrated: false,
    evidence: [
      `Audio subject profile for ${target.subject} was generated from ${recordingCount} recordings.`,
      `Mean duration was ${durationMean.toFixed(2)} seconds; mean silence ratio was ${silenceRatio.toFixed(4)}.`,
      `Feature dispersion summary: mean=${stats.mean.toFixed(3)}, std=${stats.std.toFixed(3)}, median=${stats.median.toFixed(3)}.`
    ],
    data_quality: recordingCount > 0 ? 'complete' : 'insufficient_data',
    features_used: Object.keys(target).filter((key) => key !== 'subject' && key !== 'recording_count'),
    limitation: 'This is an unsupervised audio pattern score and is not a dementia diagnosis. No explicit patient-level dementia labels exist in the current dataset.',
    created_at: new Date().toISOString(),
  };
};

export default { analyzeAudioAgent };
