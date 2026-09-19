// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';

const mock = vi.hoisted(() => ({ paid: null, roles: [], permissions: [], error: null, access: null, accessError: null, rpc: vi.fn(), filter: vi.fn() }));
vi.mock('../src/services/supabase', () => ({ supabase: {
  rpc: (...args) => mock.rpc(...args),
  from: table => {
    const query = new Proxy({}, { get: (_, key) => {
      if (key === 'then') return resolve => Promise.resolve({ data: table === 'subscriptions' ? mock.paid : mock.roles }).then(resolve);
      return (...args) => { if (key === 'or') mock.filter(...args); return query; };
    } });
    return query;
  },
} }));
import { useSubscription } from '../src/hooks/useSubscription';
const session = { user: { id: 'student' } };
beforeEach(() => {
  vi.stubEnv('VITE_ACCESS_PROMOTIONS_ENABLED', 'true');
  mock.paid = null; mock.roles = []; mock.permissions = []; mock.error = null;
  mock.access = null; mock.accessError = null; mock.filter.mockReset();
  mock.rpc.mockReset().mockImplementation(async name => name === 'my_effective_permissions'
    ? { data: mock.permissions, error: mock.error } : { data: mock.access, error: mock.accessError });
});
afterEach(() => { cleanup(); vi.unstubAllEnvs(); });
it('uses server grant metadata without presenting a paid subscription', async () => {
  mock.access = { has_access: true, plan_key: 'master', source: 'admin_free_access', expires_at: '2099-01-01' };
  const { result } = renderHook(() => useSubscription(session));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.plan).toBe('master');
  expect(result.current.planLabel).toBe('Complimentary master access');
  expect(result.current.accessSource).toBe('admin_free_access');
});
it('keeps valid paid access when grant RPC fails, without granting permissions', async () => {
  mock.paid = { plan_name: '30-Day Pass', status: 'active', current_period_end: '2099-01-01' };
  mock.roles = [{ roles: { name: 'admin' } }]; mock.error = { message: 'RPC unavailable' };
  mock.accessError = { message: 'RPC unavailable' };
  const { result } = renderHook(() => useSubscription(session));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.plan).toBe('basic'); expect(result.current.permissions).toEqual([]);
  expect(mock.filter).toHaveBeenCalledWith(expect.stringContaining('current_period_end.is.null,current_period_end.gt.'));
});
it('does not replace an intentionally empty permission list with role defaults', async () => {
  mock.roles = [{ roles: { name: 'admin' } }];
  const { result } = renderHook(() => useSubscription(session));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.permissions).toEqual([]);
});
it('does not call the new RPC before controlled rollout', async () => {
  vi.stubEnv('VITE_ACCESS_PROMOTIONS_ENABLED', 'false');
  const { result } = renderHook(() => useSubscription(session));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mock.rpc).not.toHaveBeenCalledWith('my_effective_access');
});
it('ignores expired grant metadata and clears account state on logout', async () => {
  mock.access = { has_access: true, plan_key: 'faculty', source: 'trial', expires_at: '2000-01-01' };
  const { result, rerender } = renderHook(({ auth }) => useSubscription(auth), { initialProps: { auth: session } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.isFree).toBe(true);
  rerender({ auth: null });
  expect(result.current.isActive).toBe(false); expect(result.current.permissions).toEqual([]);
});
