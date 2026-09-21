// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
const row=(o={})=>({id:'r1',full_name:'Jane Smith',email:'jane@example.com',question_id:'q-1',scheduled_date:'2026-09-21',scheduled_for:'2026-09-21T08:00:00Z',timezone:'Africa/Accra',status:'sent',sent_at:'2026-09-21T08:01:00Z',answered_at:null,is_correct:null,retry_count:0,last_error:null,retryable:false,...o});
const payload=(o={})=>({enabled:true,metrics:{total:4,scheduled:1,sent:2,pending:1,failed:1,answered:1,correct:1,incorrect:0},rows:[row()],filtered_total:120,health:{retry_pending:0,permanent_failures:1,invalid_recipients:0,unknown_outcome:0,last_sent_at:'2026-09-21T08:01:00Z',opted_in_recipients:900},recent:[{id:'a',full_name:'John Doe',status:'answered',is_correct:true,activity_at:'2026-09-21T08:14:00Z'}],...o});
const openTab=async name=>fireEvent.click(await screen.findByRole('tab',{name}));
it('admin reporting denial does not render controls', async () => {
  mock.rpc.mockResolvedValue({data:null,error:{message:'denied'}});
  render(<DailyEmailAdmin />); await screen.findByRole('alert');
  expect(screen.queryByText('Pause Daily Emails')).toBeNull(); expect(screen.queryByText('Resume Daily Emails')).toBeNull();
});
it('renders header, sending state, KPI metrics, health, attention and recent activity', async () => {
  mock.rpc.mockResolvedValue({data:payload()});
  render(<DailyEmailAdmin />);
  expect(await screen.findByRole('heading',{name:'Daily Emails'})).toBeTruthy();
  expect(screen.getByText('Sending Enabled')).toBeTruthy();
  const kpis=screen.getByRole('group',{name:/Delivery metrics/});
  expect(kpis.textContent).toContain('Correct rate'); expect(kpis.textContent).toContain('100%'); expect(kpis.textContent).toContain('4');
  expect(screen.getByText('About delivery metrics')).toBeTruthy();
  expect(screen.getByText('Sending health')).toBeTruthy(); expect(screen.getByText('Has issues')).toBeTruthy();
  expect(screen.getByText('Needs attention')).toBeTruthy(); expect(screen.getByText('John Doe')).toBeTruthy();
  expect(screen.queryByText(/Retry Delivery/)).toBeNull();
});
it('zero-denominator rates show a placeholder and a healthy queue shows the all-clear message', async () => {
  mock.rpc.mockResolvedValue({data:payload({metrics:{total:0,scheduled:0,sent:0,pending:0,failed:0,answered:0,correct:0,incorrect:0},rows:[],recent:[],filtered_total:0,health:{retry_pending:0,permanent_failures:0,invalid_recipients:0,unknown_outcome:0,opted_in_recipients:0}})});
  render(<DailyEmailAdmin />);
  const kpis=await screen.findByRole('group',{name:/Delivery metrics/});
  expect(kpis.textContent).toContain('Correct rate—'); expect(kpis.textContent).not.toContain('0%');
  expect(screen.getByText(/No email delivery issues require attention/)).toBeTruthy();
});
it('pause requires confirmation and then uses the existing update; cancel does nothing', async () => {
  mock.rpc.mockResolvedValue({data:payload()});
  render(<DailyEmailAdmin />); fireEvent.click(await screen.findByRole('button',{name:'Pause Daily Emails'}));
  const dialog=await screen.findByRole('dialog'); expect(dialog.textContent).toContain('Existing delivery history will not be deleted');
  fireEvent.click(screen.getByText('Cancel')); expect(mock.update).not.toHaveBeenCalled(); expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Pause Daily Emails'}));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button',{name:'Pause Daily Emails'}));
  await waitFor(()=>expect(mock.update).toHaveBeenCalledWith({enabled:false}));
});
it('paused state shows Resume with its own confirmation', async () => {
  mock.rpc.mockResolvedValue({data:payload({enabled:false})});
  render(<DailyEmailAdmin />); expect(await screen.findByText('Sending Paused')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Resume Daily Emails'}));
  const dialog=await screen.findByRole('dialog'); expect(dialog.textContent).toContain('Scheduled daily email processing will resume.');
  fireEvent.click(within(dialog).getByRole('button',{name:'Resume Daily Emails'}));
  await waitFor(()=>expect(mock.update).toHaveBeenCalledWith({enabled:true}));
});
it('a failed pause update is reported and Escape closes the dialog', async () => {
  mock.rpc.mockResolvedValue({data:payload()}); mock.error={message:'rls'};
  render(<DailyEmailAdmin />); fireEvent.click(await screen.findByRole('button',{name:'Pause Daily Emails'}));
  fireEvent.keyDown(document,{key:'Escape'}); expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Pause Daily Emails'}));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button',{name:'Pause Daily Emails'}));
  expect((await screen.findByRole('alert')).textContent).toContain('Could not update');
});
it('filters, reset and pagination keep server-side filters and use real counts', async () => {
  mock.rpc.mockResolvedValue({data:payload()});
  render(<DailyEmailAdmin />); await openTab('Deliveries');
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'failed'}});
  await waitFor(()=>expect(mock.rpc).toHaveBeenLastCalledWith('admin_daily_emails',expect.objectContaining({p_status:'failed',p_page:0})));
  fireEvent.change(screen.getByLabelText('User or email'),{target:{value:'jane'}}); fireEvent.click(screen.getByText('Search'));
  await waitFor(()=>expect(mock.rpc).toHaveBeenLastCalledWith('admin_daily_emails',expect.objectContaining({p_search:'jane',p_status:'failed'})));
  expect(await screen.findByText('Showing 1–1 of 120')).toBeTruthy(); expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  fireEvent.click(screen.getByText('Next'));
  await waitFor(()=>expect(mock.rpc).toHaveBeenLastCalledWith('admin_daily_emails',expect.objectContaining({p_page:1,p_search:'jane',p_status:'failed'})));
  fireEvent.click(screen.getByText('Reset filters'));
  await waitFor(()=>expect(mock.rpc).toHaveBeenLastCalledWith('admin_daily_emails',expect.objectContaining({p_page:0,p_search:'',p_status:null})));
});
it('shows a proper empty state with Clear filters, and a no-schedule message', async () => {
  mock.rpc.mockResolvedValue({data:payload({rows:[],filtered_total:0})});
  render(<DailyEmailAdmin />); await openTab('Deliveries');
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'failed'}});
  expect(await screen.findByText('No deliveries found')).toBeTruthy(); expect(screen.getByText('No email deliveries match the selected date and filters.')).toBeTruthy();
  fireEvent.click(screen.getByText('Clear filters')); await waitFor(()=>expect(screen.queryByText('Clear filters')).toBeNull());
  cleanup(); mock.rpc.mockResolvedValue({data:payload({rows:[],filtered_total:0,metrics:{total:0,scheduled:0,sent:0,pending:0,failed:0,answered:0,correct:0,incorrect:0}})});
  render(<DailyEmailAdmin />); await openTab('Deliveries');
  expect(await screen.findByText('No daily emails are scheduled for this date.')).toBeTruthy();
});
it('badges show pending, sent, failed and answered-correct states with text, not colour alone', async () => {
  mock.rpc.mockResolvedValue({data:payload({rows:[row({id:'1',status:'scheduled',sent_at:null}),row({id:'2',status:'sent'}),
    row({id:'3',status:'failed',sent_at:null,last_error:'permanent_rejection',retry_count:2,retryable:true}),row({id:'4',status:'answered',answered_at:'2026-09-21T09:00:00Z',is_correct:true}),row({id:'5',status:'answered',is_correct:false})]})});
  render(<DailyEmailAdmin />); await openTab('Deliveries');
  const table=await screen.findByRole('table');
  for (const t of ['Scheduled','Sent','Answered']) expect(within(table).getAllByText(t).length).toBeGreaterThan(0);
  expect(within(table).getByText(/Failed · retry pending/)).toBeTruthy(); expect(within(table).getByText('Permanently rejected by the mail provider')).toBeTruthy();
  expect(within(table).getAllByText('Correct').length).toBe(2); expect(within(table).getByText('Incorrect')).toBeTruthy();
});
it('detail drawer opens with grouped fields, sanitizes errors and hides secrets', async () => {
  mock.rpc.mockResolvedValue({data:payload({rows:[row({status:'failed',sent_at:null,last_error:'smtp://user:SECRET-PASS@host 535 auth failed',retryable:false,lease_token:'tok-123',provider_message_id:'pm-9'})]})});
  render(<DailyEmailAdmin />); await openTab('Deliveries');
  fireEvent.click(await screen.findByRole('button',{name:'View details for Jane Smith'}));
  const drawer=await screen.findByRole('dialog',{name:'Jane Smith'});
  for (const h of ['Recipient','Delivery','Question','Engagement','Delivery diagnostics']) expect(within(drawer).getByText(h)).toBeTruthy();
  expect(drawer.textContent).toContain('Africa/Accra'); expect(drawer.textContent).toContain('Delivery failed — see provider logs');
  expect(document.body.textContent).not.toMatch(/SECRET-PASS|tok-123|pm-9|smtp:\/\//);
  fireEvent.click(within(drawer).getByRole('button',{name:'Close delivery details'})); expect(screen.queryByRole('dialog')).toBeNull();
});
it('failures tab requests only failed deliveries', async () => {
  mock.rpc.mockResolvedValue({data:payload()});
  render(<DailyEmailAdmin />); await openTab('Failures');
  await waitFor(()=>expect(mock.rpc).toHaveBeenLastCalledWith('admin_daily_emails',expect.objectContaining({p_status:'failed'})));
});
it('mobile card layout keeps table semantics, data labels and six KPI cards', async () => {
  mock.rpc.mockResolvedValue({data:payload()});
  render(<DailyEmailAdmin />); await openTab('Deliveries');
  expect((await screen.findByRole('table')).querySelector('td[data-label="Status"]')).toBeTruthy();
  fireEvent.click(screen.getByRole('tab',{name:'Overview'})); expect(document.querySelectorAll('.eo-kpi').length).toBe(6);
});
it('admin explicitly sees that ambiguous sends require manual review', async () => {
  mock.rpc.mockResolvedValue({data:payload({enabled:false,rows:[row({status:'failed',last_error:'delivery_outcome_unknown'})]})});
  render(<DailyEmailAdmin />);
  expect((await screen.findAllByRole('status')).some(n=>n.textContent.includes('Automatic retries are blocked'))).toBe(true);
});
it('still works against the previous RPC shape without filtered_total or health', async () => {
  mock.rpc.mockResolvedValue({data:{enabled:true,metrics:{total:1,sent:1,pending:0,scheduled:0,failed:0,answered:0,correct:0,incorrect:0},rows:[row()]}});
  render(<DailyEmailAdmin />); await openTab('Deliveries');
  expect(await screen.findByText('Page 1',{selector:'span[role="status"]'})).toBeTruthy();
});
it('old RPC without health or recent still loads: attention shows failed only, no recent panel, no health extras', async () => {
  const { health, recent, filtered_total, ...old } = payload();
  mock.rpc.mockResolvedValue({data:old});
  render(<DailyEmailAdmin />);
  expect(await screen.findByText('Sending health')).toBeTruthy();
  expect(screen.queryByText('Recent delivery activity')).toBeNull(); expect(screen.queryByText('Last accepted send')).toBeNull();
  expect(screen.queryByText('Retries pending')).toBeNull(); expect(screen.getByText('Failed deliveries')).toBeTruthy();
  await openTab('Deliveries'); expect(await screen.findByText('Page 1',{selector:'span[role="status"]'})).toBeTruthy(); expect(screen.queryByText(/ of /,{selector:'span'})).toBeNull();
});
it('new RPC with every added field shows totals, page count, health and recent activity', async () => {
  mock.rpc.mockResolvedValue({data:payload({rows:Array.from({length:50},(_,i)=>row({id:'x'+i})),filtered_total:2430})});
  render(<DailyEmailAdmin />);
  expect(await screen.findByText('Last accepted send')).toBeTruthy(); expect(screen.getByText('Opted-in recipients')).toBeTruthy(); expect(screen.getByText('John Doe')).toBeTruthy();
  await openTab('Deliveries');
  expect(await screen.findByText('Showing 1–50 of 2,430')).toBeTruthy(); expect(screen.getByText('Page 1 of 49')).toBeTruthy();
});
it('rate formulas: send acceptance=sent/total, answer rate=answered/total, correct rate=correct/answered', async () => {
  mock.rpc.mockResolvedValue({data:payload({metrics:{total:130,scheduled:15,sent:87,pending:25,failed:23,answered:30,correct:20,incorrect:10}})});
  render(<DailyEmailAdmin />);
  const line=(await screen.findByText(/Send acceptance/)).closest('p');
  expect(line.textContent).toContain('Send acceptance 67%'); expect(line.textContent).toContain('Answer rate 23%'); expect(line.textContent).toContain('Correct answer rate 67%');
  cleanup(); mock.rpc.mockResolvedValue({data:payload({metrics:{total:5,scheduled:5,sent:0,pending:5,failed:0,answered:0,correct:0,incorrect:0}})});
  render(<DailyEmailAdmin />);
  const zero=(await screen.findByText(/Send acceptance/)).closest('p'); expect(zero.textContent).toContain('Send acceptance 0%'); expect(zero.textContent).toContain('Answer rate 0%'); expect(zero.textContent).toContain('Correct answer rate —');
});
it('never writes secrets or raw errors to the console or DOM', async () => {
  const spies=['log','warn','error','info'].map(k=>vi.spyOn(console,k).mockImplementation(()=>{}));
  mock.rpc.mockResolvedValue({data:payload({rows:[row({status:'failed',last_error:'SMTP_PASS=hunter2 service_role eyJhbGciOi',lease_token:'lease-1'})]})});
  render(<DailyEmailAdmin />); await openTab('Deliveries'); fireEvent.click(await screen.findByRole('button',{name:/View diagnostic|View details/}));
  await screen.findByRole('dialog');
  expect(document.body.textContent).not.toMatch(/hunter2|service_role|eyJhbGciOi|lease-1/);
  expect(spies.flatMap(s=>s.mock.calls).flat().join(' ')).not.toMatch(/hunter2|service_role|eyJhbGciOi|lease-1/);
  spies.forEach(s=>s.mockRestore());
});
