// @vitest-environment jsdom
import React from 'react';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
const mock=vi.hoisted(()=>({allowed:true,enabled:true,rpc:vi.fn()}));
vi.mock('../src/hooks/useSubscription',()=>({useSubscription:()=>({loading:false,hasAdminAccess:mock.allowed,can:()=>mock.allowed})}));
vi.mock('../src/services/supabase',()=>({supabase:{from:()=>{
  const q=new Proxy({}, {get:(_,key)=>key==='then'?resolve=>Promise.resolve({data:[{id:'plan',name:'180-Day Master Plan'}]}).then(resolve):()=>q});return q;
}}}));
vi.mock('../src/services/accessPromotions',async original=>({...await original(),accessRpc:(...args)=>mock.rpc(...args)}));
import AccessPromotions from '../src/components/AccessPromotions';
import {parseBulkEntries,grantDates} from '../src/services/accessPromotions';
beforeEach(()=>{
  mock.allowed=true;mock.enabled=true;mock.rpc.mockReset().mockImplementation(async name=>{
    if(name==='admin_access_dashboard')return {enabled:mock.enabled,active:0,expiring:0,scheduled:0};
    if(name==='admin_access_grants'||name==='admin_access_history'||name==='admin_access_activity')return {rows:[],total:0};
    if(name==='admin_access_users')return [{id:'student',full_name:'Fixture Student',email:'student@example.test'}];
    if(name==='admin_preview_bulk_access')return {preview_hash:'hash',summary:{submitted:1,eligible:1},rows:[{entry:'student@example.test',status:'eligible'}]};
    return 'saved';
  });
});
afterEach(cleanup);
it('denies missing permissions without loading private reports',()=>{
  mock.allowed=false;render(<AccessPromotions session={{user:{id:'user'}}}/>);
  expect(screen.getByRole('alert').textContent).toContain('permission');expect(mock.rpc).not.toHaveBeenCalled();
});
it('disables mutations while the server control is paused',async()=>{
  mock.enabled=false;render(<AccessPromotions/>);
  await screen.findByText(/paused server-side/);
  expect(screen.getByRole('button',{name:'Grant access'}).disabled).toBe(true);
  expect(screen.getByRole('button',{name:'Bulk grant'}).disabled).toBe(true);
});
it('requires review then confirmation before granting to a selected profile',async()=>{
  render(<AccessPromotions initialUser={{id:'student',full_name:'Fixture Student'}}/>);
  const review=await screen.findByRole('button',{name:'Review before granting'});
  fireEvent.change(screen.getByLabelText('Reason'),{target:{value:'Scholarship'}});
  fireEvent.click(review);
  const confirm=await screen.findByRole('button',{name:'Confirm access grant'});
  expect(mock.rpc.mock.calls.some(([name])=>name==='admin_issue_access')).toBe(false);
  fireEvent.click(confirm);fireEvent.click(confirm);
  await screen.findByText(/Saved. Access history/);
  const mutations=mock.rpc.mock.calls.filter(([name])=>name==='admin_issue_access');
  expect(mutations).toHaveLength(1);
  expect(mutations[0][1]).toMatchObject({p_user_id:'student',p_plan_id:'plan',p_reason:'Scholarship',p_notify:false});
  expect(mutations[0][1].p_request_key).toMatch(/^[a-f0-9-]{36}$/);
});
it('previews bulk entries without executing until confirmation',async()=>{
  render(<AccessPromotions/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Bulk grant'}).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button',{name:'Bulk grant'}));
  fireEvent.change(screen.getByLabelText('Email addresses or selected IDs'),{target:{value:'student@example.test'}});
  fireEvent.change(screen.getByLabelText('Reason'),{target:{value:'Cohort support'}});
  fireEvent.click(screen.getByRole('button',{name:'Review before granting'}));
  const confirm=await screen.findByRole('button',{name:'Confirm access grant'});
  expect(mock.rpc).toHaveBeenCalledWith('admin_preview_bulk_access',{p_entries:['student@example.test']});
  expect(mock.rpc.mock.calls.some(([name])=>name==='admin_execute_bulk_access')).toBe(false);
  fireEvent.click(confirm);await screen.findByText(/Saved. Access history/);
  expect(mock.rpc.mock.calls.find(([name])=>name==='admin_execute_bulk_access')[1]).toMatchObject({p_preview_hash:'hash',p_entries:['student@example.test']});
});
it('read-only preview prevents grant forms',async()=>{
  render(<AccessPromotions readOnly initialUser={{id:'student'}}/>);
  await screen.findByText('Read-only preview');
  expect(screen.getByRole('button',{name:'Grant access'}).disabled).toBe(true);
  expect(screen.queryByRole('button',{name:'Review before granting'})).toBeNull();
});
it('parses quoted CSV and rejects malformed files and invalid durations',()=>{
  expect(parseBulkEntries('name,email\r\n"Student, One","one@example.test"\r\n',true)).toEqual(['one@example.test']);
  expect(parseBulkEntries('one@example.test; two@example.test\nthree@example.test')).toHaveLength(3);
  expect(()=>parseBulkEntries('name,value\none,two',true)).toThrow(/email column/);
  expect(()=>parseBulkEntries('email\n"unfinished',true)).toThrow(/unfinished/);
  expect(()=>grantDates('invalid',30)).toThrow();
  expect(()=>grantDates('2026-01-01',0)).toThrow();
  expect(grantDates('2026-01-01T00:00:00Z',30).end).toBe('2026-01-31T00:00:00.000Z');
});
