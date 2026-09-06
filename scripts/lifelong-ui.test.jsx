// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mock = vi.hoisted(() => ({ rows: {}, rpc: vi.fn(), failure: null }));
vi.mock('../src/services/lifelong', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, learningRequest: async callback => {
    if(mock.failure) throw new Error(mock.failure);
    return callback({ rpc: mock.rpc, from: table => {
      const builder = new Proxy({}, { get: (_, key) => key === 'then' ? (resolve) => Promise.resolve(mock.rows[table] ?? []).then(resolve) : () => builder });
      return builder;
    }});
  }};
});
import LifelongLearning from '../src/components/LifelongLearning';
import CertificateVerification from '../src/components/CertificateVerification';
import { cpdTotals, safeLearningUrl } from '../src/services/lifelong';

const session = { user: { id: 'learner' } };
beforeEach(() => { mock.rows = { learning_profiles: null, learning_taxonomy: [{ id:'cpd', kind:'program', code:'cpd',label:'CPD' }], learning_items: [], cpd_records: [], learning_completions: [] }; mock.failure=null;mock.rpc.mockReset(); });
afterEach(cleanup);
describe('professional learning workflows', () => {
  it('shows an honest empty catalog with no sample completions', async () => {
    render(<LifelongLearning session={session} view="CPD Centre" onNavigate={()=>{}} />);
    expect(await screen.findByText(/No published courses/)).toBeTruthy();
    expect(screen.queryByText('Completed · 100%')).toBeNull();
  });
  it('requires all answers and grades through the backend before displaying feedback', async () => {
    mock.rows.learning_items=[{id:'item',title:'Fixture learning',program_id:'cpd',kind:'cpd',body:'Lesson content',summary:'Practice',version:3,next_review_on:'2099-01-01'}];
    mock.rpc.mockImplementation(async name => name==='learning_questions' ? [{prompt:'Choose an answer',choices:['One','Two']}] : {score:100,passed:true,feedback:[{correct:1,rationale:'Server feedback'}]});
    render(<LifelongLearning session={session} view="CPD Centre" onNavigate={()=>{}} />);
    fireEvent.click(await screen.findByRole('button',{name:'Open learning'}));
    const submit=await screen.findByRole('button',{name:'Submit assessment'});
    expect(submit.disabled).toBe(true);expect(screen.queryByText('Server feedback')).toBeNull();
    fireEvent.click(screen.getByRole('radio',{name:'Two'}));fireEvent.click(submit);
    await screen.findByText(/Your completion, transcript and certificate/);
    expect(mock.rpc).toHaveBeenCalledWith('submit_learning_assessment',{p_item:'item',p_version:3,p_answers:[1]});
  });
  it('does not allow opening stale learning', async () => {
    mock.rows.learning_items=[{id:'item',title:'Stale',program_id:'cpd',kind:'cpd',next_review_on:'2000-01-01'}];
    render(<LifelongLearning session={session} view="CPD Centre" onNavigate={()=>{}} />);
    expect((await screen.findByRole('button',{name:'Awaiting content review'})).disabled).toBe(true);
    expect(mock.rpc).not.toHaveBeenCalled();
  });
  it('renders backend setup failures instead of sample records', async () => {
    mock.failure='Professional learning is being prepared.';
    render(<LifelongLearning session={session} view="Learning Hub" onNavigate={()=>{}} />);
    expect((await screen.findByRole('alert')).textContent).toContain('being prepared');
  });
  it('does not call an expired or revoked certificate valid', async () => {
    mock.rpc.mockResolvedValue([{title:'Fixture certificate',status:'revoked',is_verified:false}]);
    render(<CertificateVerification initialCode="NF-TEST" />);
    expect(await screen.findByText('Certificate is not currently valid')).toBeTruthy();
    expect(screen.queryByText('Valid certificate')).toBeNull();
  });
  it('keeps CPD periods and credit sources distinct', () => {
    expect(cpdTotals([{completed_on:'2026-03-01',hours:2,points:4,source:'platform'},{completed_on:'2026-04-01',hours:3,points:1,source:'external'},{completed_on:'2025-12-31',hours:20,points:20,source:'platform'}],'2026-01-01','2026-12-31')).toEqual({hours:5,points:5,verifiedHours:2});
    expect(safeLearningUrl('javascript:alert(1)')).toBeNull();
  });
});
