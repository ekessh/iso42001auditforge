// SPDX-License-Identifier: BUSL-1.1

/**
 * Pure statistical sample-size formulas. Kept separate from
 * `SampleSizeCalculator` (rule-based) because these are the textbook
 * formulas an auditor would defend in a peer-review or accreditation
 * inspection. No hidden risk overlay — every input is explicit.
 *
 * All return at least 1 (or 0 when N is 0 / inputs degenerate to no sampling
 * needed) and are clamped to N. NaN / Infinity inputs raise ValidationError.
 */

export interface AttributeSampleSizeInput {
  /** Population size. */
  N: number;
  /** Confidence level in (0, 1). 0.95 = 95% confidence. */
  confidence: number;
  /** Tolerable deviation rate in (0, 1). 0.05 = 5%. */
  tolerableDeviationRate: number;
  /** Expected deviation rate in [0, 1). 0.01 = 1%. */
  expectedDeviationRate: number;
}

export interface VariableSampleSizeInput {
  N: number;
  confidence: number;
  /** Standard deviation of the population (or estimate). */
  populationStdDev: number;
  /** Tolerable misstatement (absolute, in same unit as stdDev). */
  tolerableMisstatement: number;
  /** Expected misstatement (absolute). */
  expectedMisstatement: number;
}

export interface MusSampleSizeInput {
  /** Total recorded value of the population (sum of all unit values). */
  populationValue: number;
  /** Tolerable misstatement / materiality threshold. */
  materiality: number;
  /** Expected misstatement (absolute). */
  expectedMisstatement: number;
  confidence: number;
}

function ensureFinite(n: number, name: string): void {
  if (!Number.isFinite(n)) throw new Error(`${name} must be finite`);
}

function inverseStandardNormal(p: number): number {
  // Beasley-Springer-Moro approximation. Accurate to ~1e-9 for p ∈ (0, 1).
  if (p <= 0 || p >= 1) throw new Error('inverseStandardNormal: p must be in (0, 1)');
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
      ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
    );
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) /
      (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1)
    );
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(
    (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) /
    ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1)
  );
}

/** Z-score for a two-sided confidence level. confidence=0.95 → ~1.96. */
export function zScore(confidence: number): number {
  ensureFinite(confidence, 'confidence');
  if (confidence <= 0 || confidence >= 1) {
    throw new Error('confidence must be in (0, 1)');
  }
  // Two-sided.
  return inverseStandardNormal(1 - (1 - confidence) / 2);
}

/**
 * Attribute sample size (binary outcome — pass/fail). Standard formula:
 *   n = (Z^2 * p * (1 - p)) / E^2
 * Where E is the gap between tolerable and expected deviation rates.
 * Optionally finite-population corrected.
 */
export function attributeSampleSize(input: AttributeSampleSizeInput): number {
  const { N, confidence, tolerableDeviationRate, expectedDeviationRate } = input;
  ensureFinite(N, 'N');
  ensureFinite(tolerableDeviationRate, 'tolerableDeviationRate');
  ensureFinite(expectedDeviationRate, 'expectedDeviationRate');
  if (N < 0 || !Number.isInteger(N)) throw new Error('N must be a non-negative integer');
  if (tolerableDeviationRate <= 0 || tolerableDeviationRate >= 1) {
    throw new Error('tolerableDeviationRate must be in (0, 1)');
  }
  if (expectedDeviationRate < 0 || expectedDeviationRate >= 1) {
    throw new Error('expectedDeviationRate must be in [0, 1)');
  }
  if (expectedDeviationRate >= tolerableDeviationRate) {
    throw new Error('expectedDeviationRate must be < tolerableDeviationRate');
  }
  if (N === 0) return 0;
  const z = zScore(confidence);
  const p = expectedDeviationRate;
  const E = tolerableDeviationRate - expectedDeviationRate;
  const nInf = (z * z * p * (1 - p)) / (E * E);
  // Finite population correction.
  const n = nInf / (1 + (nInf - 1) / N);
  return Math.min(N, Math.max(1, Math.ceil(n)));
}

/**
 * Variable (mean) sample size:
 *   n = (Z * sigma / E)^2
 * Where E = tolerableMisstatement - expectedMisstatement.
 */
export function variableSampleSize(input: VariableSampleSizeInput): number {
  const { N, confidence, populationStdDev, tolerableMisstatement, expectedMisstatement } = input;
  ensureFinite(N, 'N');
  ensureFinite(populationStdDev, 'populationStdDev');
  ensureFinite(tolerableMisstatement, 'tolerableMisstatement');
  ensureFinite(expectedMisstatement, 'expectedMisstatement');
  if (N < 0 || !Number.isInteger(N)) throw new Error('N must be a non-negative integer');
  if (populationStdDev <= 0) throw new Error('populationStdDev must be > 0');
  if (tolerableMisstatement <= 0) throw new Error('tolerableMisstatement must be > 0');
  if (expectedMisstatement < 0) throw new Error('expectedMisstatement must be >= 0');
  if (expectedMisstatement >= tolerableMisstatement) {
    throw new Error('expectedMisstatement must be < tolerableMisstatement');
  }
  if (N === 0) return 0;
  const z = zScore(confidence);
  const E = tolerableMisstatement - expectedMisstatement;
  const nInf = Math.pow((z * populationStdDev) / E, 2);
  const n = nInf / (1 + (nInf - 1) / N);
  return Math.min(N, Math.max(1, Math.ceil(n)));
}

/**
 * Monetary-Unit Sampling sample size:
 *   n = (BV * RF) / (TM - EM * EF)
 * Where:
 *   BV = book value (populationValue)
 *   TM = tolerable misstatement (materiality)
 *   EM = expected misstatement
 *   RF = reliability factor for confidence (≈ -ln(1 - confidence))
 *   EF = expansion factor (≈ 1.6 for 95%, simplified to 1)
 */
export function musSampleSize(input: MusSampleSizeInput): number {
  const { populationValue, materiality, expectedMisstatement, confidence } = input;
  ensureFinite(populationValue, 'populationValue');
  ensureFinite(materiality, 'materiality');
  ensureFinite(expectedMisstatement, 'expectedMisstatement');
  if (populationValue <= 0) throw new Error('populationValue must be > 0');
  if (materiality <= 0) throw new Error('materiality must be > 0');
  if (expectedMisstatement < 0) throw new Error('expectedMisstatement must be >= 0');
  if (confidence <= 0 || confidence >= 1) {
    throw new Error('confidence must be in (0, 1)');
  }
  const reliabilityFactor = -Math.log(1 - confidence);
  const expansionFactor = confidence >= 0.9 ? 1.6 : 1.4;
  const denominator = materiality - expectedMisstatement * expansionFactor;
  if (denominator <= 0) {
    throw new Error('materiality must exceed expectedMisstatement * expansionFactor');
  }
  return Math.max(1, Math.ceil((populationValue * reliabilityFactor) / denominator));
}
