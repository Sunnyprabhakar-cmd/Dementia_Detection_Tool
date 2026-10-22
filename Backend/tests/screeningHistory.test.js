import test from 'node:test';
import assert from 'node:assert/strict';

import { pool } from '../config/db.js';
import {
  buildDescriptiveTaskSummary,
  buildCognitiveTaskScore,
  buildVoiceAnalysisSummary,
  upsertAssessmentResult,
  getAssessmentHistory
} from '../services/screeningService.js';

test('descriptive task index is the arithmetic mean of only measured supported tasks', () => {
  const complete = buildDescriptiveTaskSummary({
    memory: { score: 80 },
    attention: { score: 60 },
    orientation: { score: 100 },
    language: { score: 35 }
  });
  const partial = buildDescriptiveTaskSummary({ memory: { score: 0 } });
  const unavailable = buildDescriptiveTaskSummary({ language: { score: 90 } });

  assert.equal(complete.index_percent, 80);
  assert.deepEqual(complete.included_tasks, ['memory', 'attention', 'orientation']);
  assert.equal(partial.index_percent, 0);
  assert.deepEqual(partial.not_measured_tasks, ['attention', 'orientation']);
  assert.equal(unavailable.index_percent, null);
  assert.equal(unavailable.status, 'unavailable');
  assert.match(complete.limitation, /not a validated instrument/);
});

test('cognitive task score handles boundaries and does not invent language scoring', () => {
  assert.equal(buildCognitiveTaskScore({
    memory: { score: 100 },
    attention: { score: 0 },
    orientation: { score: 50 },
    language: { score: 90 }
  }).index_percent, 50);
  assert.equal(buildCognitiveTaskScore({ memory: { score: 0 } }).index_percent, 0);
  assert.equal(buildCognitiveTaskScore({ language: { score: 90 } }).index_percent, null);
});

test('voice indicator uses available descriptive components, not feature coverage alone', () => {
  const summary = buildVoiceAnalysisSummary({
    measurements: {
      status: 'completed',
      speech_features: {
        features: {
          transcript_word_count: 10,
          sentence_count: 2,
          filler_word_count: 0,
          filler_word_ratio_percent: 0,
          adjacent_repeated_word_count: 1,
          pause_count: 2,
          lexical_diversity: 0.8,
          speech_rate_words_per_minute: 120
        }
      }
    }
  });
  assert.equal(summary.score_percent, 87.5);
  assert.deepEqual(summary.available_score_components, [
    'filler_control',
    'repetition_control',
    'pause_observation',
    'lexical_diversity'
  ]);
  assert.equal(summary.feature_coverage_percent, 70);
  assert.match(summary.method, /equal-weight arithmetic mean/);
  assert.match(summary.limitation, /not a voice diagnosis/);
});

test('voice indicator is unavailable for empty transcripts and tolerates missing pauses', () => {
  const empty = buildVoiceAnalysisSummary({
    measurements: { status: 'empty', speech_features: { features: {} } }
  });
  assert.equal(empty.score_percent, null);
  const noPauses = buildVoiceAnalysisSummary({
    measurements: {
      status: 'partial',
      speech_features: {
        features: {
          transcript_word_count: 5,
          filler_word_ratio_percent: 0,
          adjacent_repeated_word_count: 0,
          lexical_diversity: 1,
          speech_rate_words_per_minute: 100
        }
      }
    }
  });
  assert.equal(noPauses.score_percent, 100);
  assert.equal(noPauses.score_components.pause_observation, undefined);
});

test('assessment result upsert is idempotent and history is scoped to the owner', async (t) => {
  const screeningId = 101;
  const userId = 202;
  let savedRecord = null;
  let nextRecordId = 1;
  const fakeClient = {
    async query(sql, values = []) {
      if (sql.includes('SELECT id') && sql.includes('screening_sessions')) {
        return { rows: [{ id: screeningId }] };
      }
      if (sql.includes('SELECT id') && sql.includes('screening_results')) {
        return { rows: savedRecord ? [{ id: savedRecord.id }] : [] };
      }
      if (sql.includes('INSERT INTO screening_results')) {
        savedRecord = {
          id: nextRecordId++,
          screening_id: screeningId,
          user_id: userId,
          task_scores: JSON.parse(values[8])
        };
        return { rows: [savedRecord] };
      }
      if (sql.includes('UPDATE screening_results')) {
        savedRecord.task_scores = JSON.parse(values[8]);
        return { rows: [savedRecord] };
      }
      return { rows: [] };
    },
    release() {}
  };
  t.mock.method(pool, 'connect', async () => fakeClient);
  t.mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /WHERE s\.user_id = \$1/);
    assert.deepEqual(values, [userId]);
    return { rows: [savedRecord] };
  });

  const payload = {
    overallScore: 75,
    recommendation: 'Research prototype; not a diagnosis.',
    taskScores: { memory: 80, attention: 75, orientation: 70 },
    cognitiveTaskScore: { index_percent: 75, status: 'complete' },
    voiceAnalysisSummary: {
      score_percent: 87.5,
      feature_coverage_percent: 70,
      status: 'completed'
    },
    modelOutput: {
      status: 'unavailable',
      model_version: null,
      output: null,
      evaluation_status: 'not_run',
      missing_inputs: ['compatible_trained_model'],
      reason: 'No compatible model artifact is installed.',
      limitations: ['Research use only.']
    }
  };

  const first = await upsertAssessmentResult(screeningId, userId, payload);
  const second = await upsertAssessmentResult(screeningId, userId, payload);

  assert.equal(first.id, second.id);
  assert.equal(first.screening_id, screeningId);
  assert.equal(second.screening_id, screeningId);
  assert.deepEqual(
    first.task_scores.__modelOutput,
    payload.modelOutput
  );
  assert.deepEqual(first.task_scores.__cognitiveTaskScore, payload.cognitiveTaskScore);
  assert.deepEqual(first.task_scores.__voiceAnalysisSummary, payload.voiceAnalysisSummary);
  assert.equal(first.task_scores.__cognitiveTaskScore.index_percent, 75);
  assert.deepEqual(await getAssessmentHistory(userId), [savedRecord]);
});
