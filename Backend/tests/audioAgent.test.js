import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeAudioAgent } from '../services/audioAgentService.js';

test('audio agent returns a structured subject-level analysis when audio features exist', async () => {
  const result = await analyzeAudioAgent();

  assert.equal(result.status, 'available');
  assert.ok(result.subject);
  assert.ok(Number.isFinite(result.anomaly_score));
  assert.ok(Array.isArray(result.evidence));
  assert.ok(result.evidence.length > 0);
  assert.ok(typeof result.model_version === 'string');
  assert.match(result.limitation, /not a dementia diagnosis|No explicit|label/i);
});
