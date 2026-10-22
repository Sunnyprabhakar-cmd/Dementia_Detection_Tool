import test from 'node:test';
import assert from 'node:assert/strict';

import { analyzeAudioAgent } from '../services/audioAgentService.js';

test('audio analysis remains unavailable without authorized labeled speech data', async () => {
  const result = await analyzeAudioAgent();

  assert.equal(result.status, 'unavailable');
  assert.equal(result.output, null);
  assert.deepEqual(result.missing_inputs, ['authorized_participant_labeled_speech_model']);
  assert.match(result.limitation, /not dementia-related speech inference/i);
});
