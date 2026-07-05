function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasUsableChoices(question, minimum = 2) {
  return Array.isArray(question?.choices)
    && question.choices.filter((choice) => hasText(choice?.id) && hasText(choice?.text)).length >= minimum;
}

export function isPracticeReadyQuestion(question) {
  const type = question?.question_type;
  if (!hasText(question?.prompt)) return false;
  if (type === 'mcq') {
    return hasUsableChoices(question, 2)
      && Array.isArray(question?.correct_answer?.ids)
      && question.correct_answer.ids.length === 1;
  }
  if (type === 'sata') {
    return hasUsableChoices(question, 2)
      && Array.isArray(question?.correct_answer?.ids)
      && question.correct_answer.ids.length > 0;
  }
  if (type === 'ordered_response') {
    return hasUsableChoices(question, 2)
      && Array.isArray(question?.correct_answer?.order)
      && question.correct_answer.order.length >= 2;
  }
  if (type === 'matrix') {
    const data = question?.ngn_data ?? {};
    return Array.isArray(data.rows) && data.rows.length > 0
      && Array.isArray(data.columns) && data.columns.length >= 2
      && data.correct && typeof data.correct === 'object'
      && Object.keys(data.correct).length > 0;
  }
  if (type === 'bow_tie') {
    const data = question?.ngn_data ?? {};
    return Array.isArray(data.left_choices) && data.left_choices.length > 0
      && Array.isArray(data.right_choices) && data.right_choices.length > 0
      && Array.isArray(data.correct_left) && data.correct_left.length > 0
      && Array.isArray(data.correct_right) && data.correct_right.length > 0;
  }
  if (type === 'highlight') {
    const data = question?.ngn_data ?? {};
    return hasText(data.passage)
      && Array.isArray(data.highlights)
      && data.highlights.some((highlight) => highlight?.correct === true);
  }
  return false;
}

export function isChoiceBasedQuestion(question) {
  return ['mcq', 'sata'].includes(question?.question_type) && isPracticeReadyQuestion(question);
}
