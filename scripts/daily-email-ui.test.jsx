// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mock = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn(), row: null, error: null }));
vi.mock('../src/services/supabase', () => ({ supabase: {
  rpc: mock.rpc,
  from: () => {
    const builder = {
      select: () => builder, eq: () => builder,
      update: data => { mock.update(data); mock.row = data; return builder; },
      single: async () => ({ data: mock.row, error: mock.error }),
    };
    return builder;
  },
} }));
import DailyEmailSettings from '../src/components/DailyEmailSettings';
import DailyEmailAdmin from '../src/components/DailyEmailAdmin';
import QuestionOfTheDayView from '../src/components/QuestionOfTheDayView';
const session = { user: { id: 'owner' } };
beforeEach(() => { mock.rpc.mockReset(); mock.update.mockReset(); mock.error=null; mock.row={daily_question_enabled:true,daily_question_time:'07:00:00',timezone:'Africa/Accra'}; });
afterEach(cleanup);
it('settings saves time, timezone and opt-out with feedback', async () => {
  render(<DailyEmailSettings session={session} />);
  fireEvent.change(await screen.findByLabelText('Delivery time'),{target:{value:'09:30'}});
  fireEvent.change(screen.getByLabelText('Time zone'),{target:{value:'America/New_York'}});
  fireEvent.click(screen.getByLabelText('Daily question emails enabled'));
  fireEvent.click(screen.getByText('Save email preferences'));
  await screen.findByText('Daily email preferences saved.');
  expect(mock.update).toHaveBeenCalledWith({daily_question_enabled:false,daily_question_time:'09:30',timezone:'America/New_York'});
});
it('settings shows loading errors and does not silently claim saved state', async () => {
  mock.row=null; mock.error={message:'unavailable'};
  render(<DailyEmailSettings session={session} />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('could not be loaded'));
});
it('assigned question hides answer until server submission and uses the delivery RPC', async () => {
  const data={id:'delivery',scheduled_date:'2026-09-18',question:{id:'q',topic:'Safety',question_type:'mcq',prompt:'What is the next step?',choices:[{id:'a',text:'Assess'},{id:'b',text:'Wait'}]}};
  mock.rpc.mockResolvedValueOnce({data}).mockResolvedValueOnce({data:{...data,answered_at:'now',is_correct:true,selected_answer:{ids:['a']},question:{...data.question,correct_answer:{ids:['a']},rationale:'Server-only rationale'}}});
  render(<QuestionOfTheDayView session={session} deliveryId="delivery" />);
  await screen.findByText('What is the next step?'); expect(screen.queryByText('Server-only rationale')).toBeNull();
  fireEvent.click(screen.getByText('Assess')); fireEvent.click(screen.getByText('Submit Answer'));
  await waitFor(()=>expect(mock.rpc).toHaveBeenCalledWith('answer_daily_delivery',{p_id:'delivery',p_ids:['a']}));
  await screen.findByText('Server-only rationale');
});
it('foreign delivery reports unavailable without leaking question content', async () => {
  mock.rpc.mockResolvedValue({data:null,error:{message:'unavailable'}});
  render(<QuestionOfTheDayView session={session} deliveryId="foreign" />);
  await screen.findByText('This assigned question is unavailable for your account.');
});
it('admin reporting denial does not render controls', async () => {
  mock.rpc.mockResolvedValue({data:null,error:{message:'denied'}});
  render(<DailyEmailAdmin />); await screen.findByRole('alert');
  expect(screen.queryByText('Enable daily emails')).toBeNull();
});
it('admin can pause and filter paginated delivery history', async () => {
  mock.rpc.mockResolvedValue({data:{enabled:true,metrics:{total:0,sent:0,answered:0,correct:0},rows:[]}});
  render(<DailyEmailAdmin />); fireEvent.click(await screen.findByText('Pause daily emails'));
  await waitFor(()=>expect(mock.update).toHaveBeenCalledWith({enabled:false}));
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'failed'}});
  await waitFor(()=>expect(mock.rpc).toHaveBeenLastCalledWith('admin_daily_emails',expect.objectContaining({p_status:'failed',p_page:0})));
});
it('admin explicitly sees that ambiguous sends require manual review', async () => {
  mock.rpc.mockResolvedValue({data:{enabled:false,metrics:{total:1,sent:0,answered:0,correct:0},rows:[{id:'held',status:'failed',last_error:'delivery_outcome_unknown'}]}});
  render(<DailyEmailAdmin />);
  expect(await screen.findByRole('status')).toHaveProperty('textContent',expect.stringContaining('Automatic retries are blocked'));
});
