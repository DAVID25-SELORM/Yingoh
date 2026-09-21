// Contract: Hubtel's official Android UnifiedCheckoutApiService + request and
// TransactionStatusInfo models. Server-only Mobile Money prompt integration.
// No browser SDK or merchant Basic-auth value is exposed to clients.
export interface PaymentInput {
  id: string; amount_minor: number; currency: string;
  phone: string; channel: string; description: string;
}
export interface VerificationInput {
  id: string; amount_minor: number; currency: string; provider_reference: string | null;
}
export type PaymentState = 'successful' | 'processing' | 'failed' | 'expired';
export class ProviderError extends Error {
  constructor(public code: string) { super(code); this.name = 'ProviderError'; }
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ProviderError('provider_invalid_response');
  return value as Record<string, unknown>;
}
function nonempty(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw new ProviderError('provider_invalid_response');
  return value;
}
export function normalizeStatus(status: unknown): PaymentState {
  switch (typeof status === 'string' ? status.toLowerCase() : '') {
    case 'paid': return 'successful';
    case 'expired': return 'expired';
    case 'failed': return 'failed';
    // Unpaid is not proof of terminal failure: a phone prompt may be pending.
    default: return 'processing';
  }
}
// A mobile-money prompt that the provider still reports as unpaid a full day later is abandoned.
// Only a matched, independently verified provider answer plus this age releases the order; age alone never does.
export const STALE_PROCESSING_MS = 24 * 60 * 60 * 1000;
export function settlementState(state: PaymentState, createdAt: string | null | undefined, now = Date.now()): PaymentState {
  if (state !== 'processing') return state;
  const created = createdAt ? Date.parse(createdAt) : NaN;
  return Number.isFinite(created) && now - created > STALE_PROCESSING_MS ? 'expired' : state;
}
export const errorCode = (error: unknown) => error instanceof ProviderError ? error.code : 'unknown';
export function readHubtelConfiguration(get: (key: string) => string | undefined) {
  const keys = ['HUBTEL_CLIENT_ID','HUBTEL_CLIENT_SECRET','HUBTEL_MERCHANT_ID','HUBTEL_API_BASE_URL','HUBTEL_CALLBACK_URL'];
  const values = keys.map(key => get(key)?.trim());
  if (values.some(v => !v)) throw new ProviderError('provider_configuration_missing');
  const [clientId,clientSecret,merchantId,baseUrl,callbackUrl] = values as string[];
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(merchantId) || /[:\r\n]/.test(clientId) || /[\r\n]/.test(clientSecret)) {
    throw new ProviderError('provider_configuration_invalid');
  }
  let base: URL, callback: URL;
  try { base = new URL(baseUrl); callback = new URL(callbackUrl); }
  catch { throw new ProviderError('provider_configuration_invalid'); }
  if (base.protocol !== 'https:' || !(base.hostname === 'hubtel.com' || base.hostname.endsWith('.hubtel.com')) ||
    base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
    callback.protocol !== 'https:' || callback.username || callback.password || callback.search || callback.hash) {
    throw new ProviderError('provider_configuration_invalid');
  }
  return { clientId,clientSecret,merchantId,baseUrl:base.origin,callbackUrl:callback.href };
}
export class HubtelProvider {
  constructor(private config: ReturnType<typeof readHubtelConfiguration>, private fetcher: typeof fetch = fetch) {}
  private async request(path: string, body?: unknown): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await this.fetcher(this.config.baseUrl + path, {
        method: body ? 'POST' : 'GET', redirect:'error', signal:AbortSignal.timeout(12000),
        headers:{Authorization:'Basic '+btoa(this.config.clientId+':'+this.config.clientSecret),'Content-Type':'application/json'},
        ...(body ? {body:JSON.stringify(body)} : {}),
      });
      // Do not attach provider bodies, URLs or credentials to logs/errors.
      if (!response.ok) throw new ProviderError('provider_request_unconfirmed');
      const text = await response.text();
      if (text.length > 64000) throw new ProviderError('provider_invalid_response');
      const parsed = record(JSON.parse(text));
      if (parsed.error === true) throw new ProviderError('provider_request_unconfirmed');
      return record(parsed.data);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError('provider_request_unconfirmed');
    }
  }
  async createPayment(input: PaymentInput) {
    if (!Number.isSafeInteger(input.amount_minor) || input.amount_minor <= 0 || input.currency !== 'GHS' ||
      !/^233[0-9]{9}$/.test(input.phone) || !['mtn-gh','vodafone-gh','tigo-gh'].includes(input.channel)) {
      throw new ProviderError('invalid_payment');
    }
    const callback = new URL(this.config.callbackUrl);
    callback.searchParams.set('order',input.id);
    const data = await this.request('/api/v1/merchant/'+encodeURIComponent(this.config.merchantId)+'/unifiedcheckout/receive/mobilemoney/prompt',{
      Amount:input.amount_minor/100,Channel:input.channel,ClientReference:input.id,
      CustomerMsisdn:input.phone,Description:input.description,PrimaryCallbackUrl:callback.href,
    });
    if (data.clientReferenceId != null && data.clientReferenceId !== input.id) throw new ProviderError('provider_reference_mismatch');
    return { reference:nonempty(data.transactionId),state:'processing' as const };
  }
  async verifyPayment(input: VerificationInput) {
    const data = await this.request('/api/v1/merchant/'+encodeURIComponent(this.config.merchantId)+
      '/unifiedcheckout/statuscheck?clientReference='+encodeURIComponent(input.id));
    if (data.clientReference !== input.id || typeof data.currencyCode !== 'string' || data.currencyCode.toUpperCase() !== input.currency) {
      throw new ProviderError('provider_verification_mismatch');
    }
    const amount = data.transactionAmount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || Math.abs(amount*100-input.amount_minor)>0.000001) {
      throw new ProviderError('provider_verification_mismatch');
    }
    const reference=nonempty(data.transactionId);
    if (input.provider_reference && input.provider_reference !== reference) throw new ProviderError('provider_verification_mismatch');
    const state=normalizeStatus(data.status);
    if (state==='successful' && (data.disputed !== false || data.totalAmountRefunded !== 0)) {
      throw new ProviderError('provider_payment_needs_review');
    }
    return {reference,state,amountMinor:input.amount_minor,currency:input.currency};
  }
  // Callback payload is only a wake-up signal. Never trust its amount/status.
  handleCallback(input: VerificationInput) { return this.verifyPayment(input); }
}
