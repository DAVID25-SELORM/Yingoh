// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), logs: [] }));
vi.mock('../src/services/supabase', () => ({
  nurseFacultyTables: { profiles: 'profiles' },
  checkTableAvailability: vi.fn(async () => []),
  supabase: { rpc: mock.rpc, from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: mock.logs }) }) }) }) },
}));
import SuperAdminPanel from '../src/components/SuperAdminPanel';
beforeEach(() => {
  mock.logs = []; mock.rpc.mockReset();
  mock.rpc.mockResolvedValue({ data: { total_users: 8, published_questions: 7231, draft_questions: 4, total_sessions: 12, total_attempts: 51, active_subscriptions: 0, total_revenue: 0, paid_invoices: 0, upcoming_classes: 0, total_notes: 0, total_bookmarks: 0 } });
});
afterEach(cleanup);
it('renders eight live metric cards and a compact honest empty state', async () => {
  const { container } = render(<SuperAdminPanel />);
  await screen.findAllByText('7,231');
  expect(container.querySelectorAll('.admin-stat-card')).toHaveLength(8);
  expect(screen.getByText('Pending Questions')).toBeTruthy();
  expect(screen.getByText('No recent activity yet')).toBeTruthy();
  expect(screen.getByText('Question attempts')).toBeTruthy();
});
it('quick actions use only the existing navigation callback', async () => {
  const navigate = vi.fn(); render(<SuperAdminPanel onNavigate={navigate} />);
  await screen.findAllByText('7,231');
  const routes = { 'Manage Users': 'Users', 'Manage Questions': 'AdminQuestions', Exams: 'Exam', Announcements: 'Announcements', 'Manage Classes': 'Classroom', 'Content Review': 'Content Review' };
  for (const [label, route] of Object.entries(routes)) {
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(navigate).toHaveBeenLastCalledWith(route);
  }
});
it('refresh reuses stats API and tab controls retain their selection', async () => {
  render(<SuperAdminPanel />); await screen.findAllByText('7,231');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh overview' }));
  expect(mock.rpc).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: 'System' }));
  expect(screen.getByText('Database Table Health')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe('true');
});
it('renders real audit category, actor and timestamp', async () => {
  mock.logs = [{ id: 'a1', action: 'question.publish', actor_id: 'actor-123', target_table: 'questions', created_at: '2026-09-19T12:00:00Z', details: { title: 'Reviewed question' } }];
  const { container } = render(<SuperAdminPanel />);
  await screen.findByText('question.publish');
  expect(screen.getByText(/Actor: actor-123/)).toBeTruthy();
  expect(container.querySelector('time').dateTime).toBe('2026-09-19T12:00:00Z');
  expect(screen.queryByText('No recent activity yet')).toBeNull();
});
