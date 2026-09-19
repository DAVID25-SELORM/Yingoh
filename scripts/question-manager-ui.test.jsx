// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
vi.mock('../src/services/supabase', () => ({ supabase: null }));
// A small deterministic inventory keeps DOM queries independent of demo-bank size.
vi.mock('../src/data/demoQuestions', () => ({ DEMO_QUESTIONS: [
  { id: 'published-fixture', topic: 'Pharmacology', question_type: 'mcq', prompt: 'Published fixture question', status: 'published', choices: [], correct_answer: { ids: [] } },
  { id: 'draft-fixture', topic: 'Pharmacology', question_type: 'sata', prompt: 'Draft fixture question', status: 'draft', choices: [], correct_answer: { ids: [] } },
] }));
import QuestionManager from '../src/components/QuestionManager';
afterEach(() => { cleanup(); sessionStorage.clear(); });
it('shows inventory cards, labelled filters and all row actions', async () => {
  const { container } = render(<QuestionManager />);
  expect(screen.getByText('Total Questions')).toBeTruthy();
  expect(container.querySelectorAll('.qm-stat')).toHaveLength(3);
  expect(screen.getByLabelText('Filter by topic')).toBeTruthy();
  const row = within(container.querySelector('.qm-question-row'));
  for (const name of ['Preview question','Edit question','Delete question']) {
    expect(row.getByRole('button', { name })).toBeTruthy();
  }
  fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
  expect(screen.getByRole('button', { name: 'Draft' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: 'Previous' }).disabled).toBe(true);
});
it('preserves import and authoring entry points', () => {
  render(<QuestionManager />);
  fireEvent.click(screen.getByRole('button', { name: 'New Question' }));
  expect(screen.getByText('Submit for Clinical Review')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Import CSV' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Explanation Audit' })).toBeTruthy();
});
