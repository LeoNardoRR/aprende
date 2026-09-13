export type DescriptiveStatistics = {
  observations: number;
  mean: number | null;
  median: number | null;
  minimum: number | null;
  maximum: number | null;
  variance: number | null;
  standardDeviation: number | null;
};

export type ProficiencyLevel = {
  code: string;
  label: string;
  lowerBound: number;
  upperBound: number;
  order: number;
};

const finite = (values: Array<number | null | undefined>) => values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

export function descriptiveStatistics(values: Array<number | null | undefined>): DescriptiveStatistics {
  const data = finite(values).sort((a, b) => a - b);
  if (!data.length) return { observations: 0, mean: null, median: null, minimum: null, maximum: null, variance: null, standardDeviation: null };
  const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
  const middle = Math.floor(data.length / 2);
  const median = data.length % 2 ? data[middle] : (data[middle - 1] + data[middle]) / 2;
  const variance = data.reduce((sum, value) => sum + (value - mean) ** 2, 0) / data.length;
  return { observations: data.length, mean, median, minimum: data[0], maximum: data.at(-1)!, variance, standardDeviation: Math.sqrt(variance) };
}

export function difficultyIndex(scores: Array<boolean | null | undefined>): number | null {
  const valid = scores.filter((score): score is boolean => typeof score === 'boolean');
  return valid.length >= 3 ? valid.filter(Boolean).length / valid.length : null;
}

export function discriminationIndex(rows: Array<{ correct: boolean; totalScore: number }>): number | null {
  const valid = rows.filter((row) => Number.isFinite(row.totalScore));
  if (valid.length < 4) return null;
  const ordered = [...valid].sort((a, b) => a.totalScore - b.totalScore);
  const groupSize = Math.max(1, Math.ceil(ordered.length * 0.27));
  const lower = ordered.slice(0, groupSize);
  const upper = ordered.slice(-groupSize);
  const proportion = (group: typeof rows) => group.filter((row) => row.correct).length / group.length;
  return proportion(upper) - proportion(lower);
}

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const x = descriptiveStatistics(xs);
  const y = descriptiveStatistics(ys);
  if (!x.standardDeviation || !y.standardDeviation || x.mean == null || y.mean == null) return null;
  const covariance = xs.reduce((sum, value, index) => sum + (value - x.mean!) * (ys[index] - y.mean!), 0) / xs.length;
  const result = covariance / (x.standardDeviation * y.standardDeviation);
  return Number.isFinite(result) ? result : null;
}

export function pointBiserialCorrelation(rows: Array<{ correct: boolean; totalScore: number }>): number | null {
  return pearsonCorrelation(rows.map((row) => row.correct ? 1 : 0), rows.map((row) => row.totalScore));
}

export function cronbachAlpha(participantItemScores: number[][]): number | null {
  const rows = participantItemScores.filter((row) => row.length > 0 && row.every(Number.isFinite));
  if (rows.length < 3) return null;
  const itemCount = rows[0].length;
  if (itemCount < 2 || rows.some((row) => row.length !== itemCount)) return null;
  const itemVariances = Array.from({ length: itemCount }, (_, index) => descriptiveStatistics(rows.map((row) => row[index])).variance ?? 0);
  const totalVariance = descriptiveStatistics(rows.map((row) => row.reduce((sum, value) => sum + value, 0))).variance;
  if (!totalVariance) return null;
  const alpha = (itemCount / (itemCount - 1)) * (1 - itemVariances.reduce((sum, value) => sum + value, 0) / totalVariance);
  return Number.isFinite(alpha) ? alpha : null;
}

export function validateProficiencyLevels(levels: ProficiencyLevel[]): boolean {
  if (levels.length < 4) return false;
  const ordered = [...levels].sort((a, b) => a.order - b.order);
  return ordered.every((level, index) => Number.isFinite(level.lowerBound) && Number.isFinite(level.upperBound)
    && level.lowerBound >= 0 && level.upperBound <= 100 && level.upperBound > level.lowerBound
    && (index === 0 || ordered[index - 1].upperBound <= level.lowerBound));
}

export function classifyProficiency(percentage: number | null, levels: ProficiencyLevel[]): ProficiencyLevel | null {
  if (percentage == null || !Number.isFinite(percentage) || !validateProficiencyLevels(levels)) return null;
  return levels.find((level) => percentage >= level.lowerBound && (percentage < level.upperBound || (level.upperBound === 100 && percentage <= 100))) ?? null;
}

export function evolution(previous: number | null, current: number | null) {
  if (previous == null || current == null || !Number.isFinite(previous) || !Number.isFinite(current)) return { absolute: null, percentage: null };
  const absolute = current - previous;
  return { absolute, percentage: previous === 0 ? null : (absolute / Math.abs(previous)) * 100 };
}
