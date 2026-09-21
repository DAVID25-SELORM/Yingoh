// @vitest-environment jsdom
import React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
vi.mock('../src/services/supabase',()=>({
 supabase:null,clearUserPermissionOverride:vi.fn(),adminCreateOrInviteUser:vi.fn(),
 getUserPermissionOverrides:vi.fn(),sendPasswordResetEmail:vi.fn(),
 setUserPermissionOverride:vi.fn(),startImpersonationSession:vi.fn(),
}));
import UserManagement from '../src/components/UserManagement';
afterEach(cleanup);
it('does not offer ignored instructor status or fictional onboarding email controls',()=>{
 render(<UserManagement/>);
 fireEvent.click(screen.getByRole('button',{name:'Add / Invite User'}));
 const select=screen.getAllByRole('combobox').find(el=>Array.from(el.options).some(o=>o.value==='instructor'));
 fireEvent.change(select,{target:{value:'instructor'}});
 expect(screen.getByText('Initial status')).toBeTruthy();
 expect(screen.queryByText('Account Status')).toBeNull();
 expect(screen.queryByText(/redirect instructor to create first classroom/)).toBeNull();
 expect(screen.getByText(/Inbox delivery is not guaranteed/)).toBeTruthy();
});
