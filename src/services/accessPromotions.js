import { supabase } from './supabase';

export async function accessRpc(name, args = {}) {
  if (!supabase) throw new Error('Access management is unavailable.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const known = ['Not authorized', 'Complimentary access is disabled', 'Admin duration limit exceeded',
      'Overlapping complimentary access', 'Preview changed; review again', 'No eligible recipients',
      'Invalid extension', 'Idempotency conflict', 'Grant must expire in the future', 'Notification request conflict',
      'Invalid promotion', 'Promotion not found', 'Promotion changed; reload', 'Used promotion is immutable; duplicate instead',
      'Promotions are paused', 'Invalid promo code', 'Promotion inactive', 'Promotion not started', 'Promotion expired',
      'Promotion not valid for plan', 'Minimum purchase not reached', 'Promotion limit reached', 'Promotion already used',
      'Promotion is for new subscribers only', 'Payment required', 'Plan unavailable', 'Plan configuration mismatch'];
    throw new Error(known.includes(error.message) ? error.message : 'The request could not be completed. Check setup and try again.');
  }
  return data;
}

// Bounded CSV parsing with quoted fields; never evaluates spreadsheet formulas.
export function parseBulkEntries(text, csv = false) {
  if (typeof text !== 'string' || text.length > 100000) throw new Error('Upload a file smaller than 100 KB.');
  if (!csv) return text.split(/[\n;,]+/).map(value => value.trim()).filter(Boolean);
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (ch === ',' || ch === '\n')) {
      row.push(value.replace(/\r$/, '').trim()); value = '';
      if (ch === '\n') { rows.push(row); row = []; }
    } else value += ch;
  }
  if (quoted) throw new Error('The CSV has an unfinished quoted field.');
  if (value || row.length) { row.push(value.replace(/\r$/, '').trim()); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0].map(v => v.replace(/^\uFEFF/, '').toLowerCase());
  const email = header.indexOf('email');
  if (email < 0) throw new Error('CSV must include an email column.');
  const entries=rows.slice(1).filter(r=>r.some(Boolean)).map(r=>r[email]??'');
  if(entries.some(value=>!value))throw new Error('Every nonempty CSV row must include an email.');
  return entries;
}
export function grantDates(start, days) {
  const from = new Date(start); const duration = Number(days);
  if (!Number.isFinite(from.getTime()) || !Number.isInteger(duration) || duration < 1 || duration > 3650) {
    throw new Error('Choose a valid start and 1–3650 days.');
  }
  return { start: from.toISOString(), end: new Date(from.getTime() + duration * 86400000).toISOString() };
}
export function localDateTime(date = new Date()) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

// Unambiguous alphabet (no 0/O/1/I/L) so codes are easy to read out and type.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function generatePromoCode(prefix = 'NF', length = 6) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  // 256 is not a multiple of the alphabet size; reject the biased tail so every character is uniform.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let out = '';
  for (let i = 0; out.length < length; i++) {
    if (i >= bytes.length) { globalThis.crypto.getRandomValues(bytes); i = 0; }
    if (bytes[i] < limit) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return prefix + '-' + out;
}
