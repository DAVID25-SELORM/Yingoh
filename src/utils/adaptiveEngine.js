// Empirical-proxy CAT engine: no IRT item-bank calibration exists, so difficulty
// is derived from historical answer correctness (classical test-theory p-value)
// instead of a stored difficulty parameter. Pure functions only — no React/Supabase
// imports — so this can be driven with hand-built fixtures before any UI exists.

export const PASSING_THETA = 0.5;

const THETA_MIN = 0.05;
const THETA_MAX = 0.95;
const CONFIDENCE_MARGIN = 0.12;
const CONFIDENCE_WINDOW = 5;
const STEP_DECAY = 0.85;
const MIN_STEP = 0.02;
const NEAR_TIE_BAND = 0.05;
const SHORTLIST_SIZE = 10;

export function initialTheta() {
  return 0.5;
}

export function initialStep() {
  return 0.24;
}

function clampTheta(value) {
  return Math.min(THETA_MAX, Math.max(THETA_MIN, value));
}

export function topicKeyFor(question) {
  return question?.client_need || question?.topic || 'general';
}

export function computeDifficultyStats(rawAnswerRows) {
  const stats = new Map();
  for (const row of rawAnswerRows ?? []) {
    const id = row?.question_id;
    if (!id) continue;
    const entry = stats.get(id) ?? { attempts: 0, correct: 0, pValue: 0.5 };
    entry.attempts += 1;
    if (row.is_correct) entry.correct += 1;
    entry.pValue = entry.correct / entry.attempts;
    stats.set(id, entry);
  }
  return stats;
}

export function tierForQuestion(question, statsMap, { minSample = 5 } = {}) {
  const entry = statsMap?.get(question?.id);
  if (!entry || entry.attempts < minSample) return 0.5;
  return clampTheta(1 - entry.pValue);
}

export function nextTheta(theta, correct, step) {
  const direction = correct ? 1 : -1;
  return {
    theta: clampTheta(theta + direction * step),
    step: Math.max(MIN_STEP, step * STEP_DECAY),
  };
}

export function pickNextQuestion(pool, askedIds, targetTheta, statsMap, topicCounts) {
  const asked = askedIds instanceof Set ? askedIds : new Set(askedIds ?? []);
  const candidates = (pool ?? []).filter((q) => q?.id && !asked.has(q.id));
  if (!candidates.length) return null;

  const scored = candidates
    .map((question) => ({
      question,
      distance: Math.abs(tierForQuestion(question, statsMap) - targetTheta),
      topicCount: topicCounts?.get(topicKeyFor(question)) ?? 0,
    }))
    .sort((a, b) => a.distance - b.distance);

  const closest = scored[0].distance;
  const shortlist = scored
    .filter((entry) => entry.distance <= closest + NEAR_TIE_BAND)
    .slice(0, SHORTLIST_SIZE)
    .sort((a, b) => a.topicCount - b.topicCount || a.distance - b.distance);

  return shortlist[0].question;
}

export function shouldStop(history, minItems, maxItems) {
  const n = history?.length ?? 0;
  if (n < minItems) return { stop: false, reason: 'min_not_reached', passed: null };

  if (n >= maxItems) {
    const finalTheta = history[n - 1].theta;
    return { stop: true, reason: 'max_reached', passed: finalTheta >= PASSING_THETA };
  }

  const window = history.slice(-CONFIDENCE_WINDOW);
  if (window.length === CONFIDENCE_WINDOW) {
    if (window.every((item) => item.theta >= PASSING_THETA + CONFIDENCE_MARGIN)) {
      return { stop: true, reason: 'confidence_pass', passed: true };
    }
    if (window.every((item) => item.theta <= PASSING_THETA - CONFIDENCE_MARGIN)) {
      return { stop: true, reason: 'confidence_fail', passed: false };
    }
  }

  return { stop: false, reason: null, passed: null };
}

export function tierLabel(difficulty) {
  if (difficulty <= 0.35) return 'easy';
  if (difficulty >= 0.65) return 'hard';
  return 'medium';
}
