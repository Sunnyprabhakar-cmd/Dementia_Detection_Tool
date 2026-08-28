import test from 'node:test';
import assert from 'node:assert/strict';

import { runMultiAgentAnalysis } from '../services/aiService.js';

test('multi-agent ensemble returns a measurable risk band and real domain agents', () => {
  const result = runMultiAgentAnalysis({
    memory: 52,
    attention: 60,
    language: 48,
    orientation: 67,
    voice: 63
  }, 48, 58);

  assert.equal(Array.isArray(result.agents), true);
  assert.ok(result.agents.some((agent) => agent.name.toLowerCase().includes('memory')));
  assert.ok(result.agents.some((agent) => agent.name.toLowerCase().includes('voice')));
  assert.equal(typeof result.ensembleScore, 'number');
  assert.ok(result.ensembleScore >= 0 && result.ensembleScore <= 100);
  assert.ok(['low', 'moderate', 'high'].includes(result.riskBand));
  assert.ok(typeof result.modelVersion === 'string');
  assert.ok(typeof result.agentSummary === 'string');
});
