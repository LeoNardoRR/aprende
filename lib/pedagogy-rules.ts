export type JourneyStepProgress = {
  required: boolean;
  completed: boolean;
  pedagogicalPoints: number;
  gamificationPoints: number;
};

export function shouldRecommendJourney(
  observedPercentage: number | null,
  thresholdPercentage: number,
): boolean {
  return (
    observedPercentage != null &&
    Number.isFinite(observedPercentage) &&
    Number.isFinite(thresholdPercentage) &&
    observedPercentage >= 0 &&
    observedPercentage <= 100 &&
    thresholdPercentage >= 0 &&
    thresholdPercentage <= 100 &&
    observedPercentage < thresholdPercentage
  );
}

export function calculateJourneyProgress(steps: JourneyStepProgress[]) {
  const required = steps.filter((step) => step.required);
  const completedRequired = required.filter((step) => step.completed).length;
  const progressPercentage = required.length
    ? (completedRequired / required.length) * 100
    : 0;
  return {
    progressPercentage,
    completed: required.length > 0 && completedRequired === required.length,
    pedagogicalScore: steps
      .filter((step) => step.completed)
      .reduce((sum, step) => sum + step.pedagogicalPoints, 0),
    gamificationPoints: steps
      .filter((step) => step.completed)
      .reduce((sum, step) => sum + step.gamificationPoints, 0),
  };
}

export function correctWordsPerMinute(
  correctWords: number,
  durationSeconds: number,
): number | null {
  if (
    !Number.isInteger(correctWords) ||
    correctWords < 0 ||
    !Number.isInteger(durationSeconds) ||
    durationSeconds <= 0
  )
    return null;
  return Math.round(((correctWords * 60) / durationSeconds) * 100) / 100;
}

export function suppressSmallGroup<T>(
  values: T[],
  minimumGroupSize: number,
): { suppressed: boolean; values: T[] | null } {
  const validMinimum = Number.isInteger(minimumGroupSize) && minimumGroupSize >= 3;
  const suppressed = !validMinimum || values.length < minimumGroupSize;
  return { suppressed, values: suppressed ? null : values };
}

export function observedEvolution(before: number | null, after: number | null) {
  if (
    before == null ||
    after == null ||
    !Number.isFinite(before) ||
    !Number.isFinite(after)
  )
    return null;
  return {
    before,
    after,
    absoluteDifference: Math.round((after - before) * 100) / 100,
    interpretation: 'Evolução observada; não demonstra causalidade.',
  };
}
