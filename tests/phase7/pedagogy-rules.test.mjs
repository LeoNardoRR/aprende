import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateJourneyProgress,
  correctWordsPerMinute,
  observedEvolution,
  shouldRecommendJourney,
  suppressSmallGroup,
} from '../../lib/pedagogy-rules.ts';

test('regra de recomendação é configurável, explicável e rejeita percentuais inválidos', () => {
  assert.equal(shouldRecommendJourney(42, 60), true);
  assert.equal(shouldRecommendJourney(60, 60), false);
  assert.equal(shouldRecommendJourney(null, 60), false);
  assert.equal(shouldRecommendJourney(Number.NaN, 60), false);
});

test('progresso separa resultado pedagógico de pontos de gamificação', () => {
  const result = calculateJourneyProgress([
    { required: true, completed: true, pedagogicalPoints: 8, gamificationPoints: 10 },
    { required: true, completed: false, pedagogicalPoints: 8, gamificationPoints: 20 },
    { required: false, completed: true, pedagogicalPoints: 2, gamificationPoints: 5 },
  ]);
  assert.deepEqual(result, {
    progressPercentage: 50,
    completed: false,
    pedagogicalScore: 10,
    gamificationPoints: 15,
  });
});

test('palavras corretas por minuto usa tempo real e nunca retorna NaN ou Infinity', () => {
  assert.equal(correctWordsPerMinute(90, 75), 72);
  assert.equal(correctWordsPerMinute(10, 0), null);
  assert.equal(correctWordsPerMinute(-1, 60), null);
});

test('grupos pequenos são suprimidos segundo limite configurado', () => {
  assert.deepEqual(suppressSmallGroup([1, 2], 3), { suppressed: true, values: null });
  assert.deepEqual(suppressSmallGroup([1, 2, 3], 3), { suppressed: false, values: [1, 2, 3] });
});

test('comparação pós-intervenção descreve evolução observada sem causalidade', () => {
  assert.deepEqual(observedEvolution(42, 58.25), {
    before: 42,
    after: 58.25,
    absoluteDifference: 16.25,
    interpretation: 'Evolução observada; não demonstra causalidade.',
  });
  assert.equal(observedEvolution(null, 50), null);
});
