import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticHandler } from '../supabase/functions/daily-email-diagnostic/handler.js';

test('diagnostic authenticates, fixes recipient, claims once and never retries ambiguous send', async () => {
  let claimed = false, sends = 0, saved;
  const handler = diagnosticHandler({
    env: () => 'test-only',
    database: () => ({
      rpc: async () => { const first = !claimed; claimed = true; return { data: first }; },
      from: () => ({ update: value => ({ eq: async () => { saved = value; return {}; } }) }),
    }),
    sender: () => async message => {
      sends++;
      assert.equal(message.to, 'cryxtalcfc@gmail.com');
      throw new Error('smtp_timeout');
    },
  });
  const request = secret => new Request('https://example.test', {
    method: 'POST', headers: { 'x-cron-secret': secret }, body: '{"to":"unapproved@example.test"}',
  });
  assert.equal((await handler(request('wrong'))).status, 401);
  assert.equal(sends, 0);
  const responses = await Promise.all([handler(request('test-only')), handler(request('test-only'))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200,409]);
  assert.equal(sends, 1);
  assert.equal(saved.outcome, 'delivery_outcome_unknown');
  assert.equal((await handler(request('test-only'))).status, 409);
  assert.equal(sends, 1);
});

test('invalid configuration does not consume the diagnostic claim', async () => {
  let claims = 0;
  const handler = diagnosticHandler({ env: () => 'test-only',
    database: () => { claims++; throw new Error(); },
    sender: () => { throw new Error('invalid config'); },
  });
  const response = await handler(new Request('https://example.test', { method: 'POST', headers: { 'x-cron-secret': 'test-only' } }));
  assert.equal(response.status, 503);
  assert.equal(claims, 0);
  assert.equal((await response.json()).attempted, 0);
});
