import test from 'node:test';
import assert from 'node:assert/strict';

import { upsertAssessmentResult, getAssessmentHistory } from '../services/screeningService.js';

test('assessment result is idempotent for the same screening session', async () => {
  const screeningId = `screen_${Date.now()}_history_test`;
  const userId = 'history-user';
  const payload = {
    screeningId,
    overallScore: 72,
    riskScore: 28,
    riskLevel: 'Low risk',
    recommendation: 'Routine monitoring',
    taskScores: { memory: 80, attention: 75, language: 68, orientation: 70 }
  };

  const first = await upsertAssessmentResult(screeningId, userId, payload);
  const second = await upsertAssessmentResult(screeningId, userId, payload);

  assert.equal(first.id, second.id);
  assert.equal(first.screening_id, screeningId);
  assert.equal(first.user_id, userId);
  assert.equal((await getAssessmentHistory(userId)).length >= 1, true);
});
