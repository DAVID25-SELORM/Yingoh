export const EMPTY_STRUCTURED_EXPLANATION = {
  correct_answer_explanation: '',
  option_explanations: {},
  immediate_response: '',
  reference_urls: [],
};

export function isHttpsUrl(value) {
  try {
    return new URL(String(value)).protocol === 'https:';
  } catch {
    return false;
  }
}

export function syncOptionExplanations(choices = [], correctIds = [], current = {}) {
  const correct = new Set(correctIds.map((id) => String(id).toLowerCase()));
  return Object.fromEntries(choices.map((choice) => {
    const id = String(choice.id ?? '').toLowerCase();
    return [id, {
      is_correct: correct.has(id),
      explanation: String(current?.[id]?.explanation ?? ''),
    }];
  }).filter(([id]) => id));
}

export function structuredExplanationComplete(question) {
  return validateStructuredExplanation(question, { requireReviewer: false }).length === 0;
}

export function validateStructuredExplanation(question, { requireReviewer = true } = {}) {
  const errors = [];
  const choices = Array.isArray(question?.choices) ? question.choices.filter((choice) => String(choice?.text ?? '').trim()) : [];
  const correctIds = Array.isArray(question?.correct_answer?.ids)
    ? question.correct_answer.ids.map((id) => String(id).toLowerCase())
    : [];
  const explanations = question?.option_explanations && typeof question.option_explanations === 'object' && !Array.isArray(question.option_explanations)
    ? question.option_explanations
    : {};
  const references = Array.isArray(question?.reference_urls) ? question.reference_urls : [];

  if (!String(question?.prompt ?? '').trim()) errors.push('Question prompt is required.');
  if (['mcq', 'sata'].includes(question?.question_type) && choices.length < 2) errors.push('At least two visible answer options are required.');
  if (question?.question_type === 'mcq' && correctIds.length !== 1) errors.push('Multiple-choice questions require exactly one correct option.');
  if (question?.question_type === 'sata' && correctIds.length < 1) errors.push('Select-all-that-apply questions require at least one correct option.');
  if (!String(question?.correct_answer_explanation ?? '').trim()) errors.push('Explain why the correct answer is correct.');

  for (const choice of choices) {
    const id = String(choice.id).toLowerCase();
    const entry = explanations[id];
    if (!String(entry?.explanation ?? '').trim()) errors.push(`Option ${id.toUpperCase()} needs an explanation.`);
    if (typeof entry?.is_correct !== 'boolean' || entry.is_correct !== correctIds.includes(id)) {
      errors.push(`Option ${id.toUpperCase()} explanation does not match the answer key.`);
    }
  }

  if (!references.length) errors.push('Add at least one clinical reference.');
  references.forEach((reference, index) => {
    const label = `Reference ${index + 1}`;
    if (!String(reference?.title ?? '').trim()) errors.push(`${label} needs a title.`);
    if (!String(reference?.organization ?? '').trim()) errors.push(`${label} needs an organization.`);
    if (!isHttpsUrl(reference?.url)) errors.push(`${label} must use a valid HTTPS URL.`);
    const accessedAt = String(reference?.accessed_at ?? '');
    const accessedDate = /^\d{4}-\d{2}-\d{2}$/.test(accessedAt) ? new Date(`${accessedAt}T00:00:00Z`) : null;
    if (!accessedDate || Number.isNaN(accessedDate.getTime())) errors.push(`${label} needs a valid access date.`);
    else if (accessedDate > new Date()) errors.push(`${label} access date cannot be in the future.`);
  });

  if (requireReviewer) {
    if (!question?.reviewed_by) errors.push('An accountable reviewer is required.');
    if (!question?.reviewed_at) errors.push('A clinical review date is required.');
    else if (new Date(question.reviewed_at) > new Date()) errors.push('Clinical review date cannot be in the future.');
  }
  return [...new Set(errors)];
}

export function feedbackModel(question, selectedIds = []) {
  const choices = Array.isArray(question?.choices) ? question.choices : [];
  const correctIds = Array.isArray(question?.correct_answer?.ids) ? question.correct_answer.ids.map(String) : [];
  const selected = selectedIds.map(String);
  const optionExplanations = question?.option_explanations && typeof question.option_explanations === 'object'
    ? question.option_explanations
    : {};
  const references = Array.isArray(question?.reference_urls) && question.reference_urls.length
    ? question.reference_urls
    : (question?.reference_url ? [{ title: 'Clinical reference', organization: '', url: question.reference_url }] : []);

  return {
    selectedChoices: choices.filter((choice) => selected.includes(String(choice.id))),
    correctChoices: choices.filter((choice) => correctIds.includes(String(choice.id))),
    correctAnswerExplanation: String(question?.correct_answer_explanation || question?.rationale || ''),
    optionRows: choices.map((choice) => ({
      ...choice,
      is_correct: correctIds.includes(String(choice.id)),
      explanation: String(optionExplanations?.[String(choice.id).toLowerCase()]?.explanation ?? ''),
    })).filter((choice) => choice.explanation),
    immediateResponse: String(question?.immediate_response ?? ''),
    strategy: String(question?.strategy ?? ''),
    references,
    reviewedAt: question?.reviewed_at ?? null,
    usesLegacyFallback: !String(question?.correct_answer_explanation ?? '').trim(),
  };
}
