import { supabase } from './supabase';

export async function learningRequest(query) {
  if (!supabase) throw new Error('Sign in to connect your learning records.');
  const { data, error } = await query(supabase);
  if (error) throw new Error(['42P01', 'PGRST205', 'PGRST202'].includes(error.code)
    ? 'Professional learning is being prepared. Please try again later.' : error.message);
  return data;
}

export function exportLearningCsv(filename, rows) {
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function cpdTotals(records, start, end) {
  return records.filter(r => r.completed_on >= start && r.completed_on <= end).reduce((sum, r) => ({
    hours: sum.hours + Number(r.hours || 0),
    points: sum.points + Number(r.points || 0),
    verifiedHours: sum.verifiedHours + (r.source === 'platform' ? Number(r.hours || 0) : 0),
  }), { hours: 0, points: 0, verifiedHours: 0 });
}

export function safeLearningUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
