import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

export default function DailyEmailSettings({ session }) {
  const [preference, setPreference] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const zones = [...new Set(['Africa/Accra', 'UTC', ...(Intl.supportedValuesOf?.('timeZone') ?? []), preference?.timezone].filter(Boolean))].sort();
  useEffect(() => {
    let active = true;
    supabase.from('user_email_preferences').select('daily_question_enabled,daily_question_time,timezone').eq('user_id', session.user.id).single()
      .then(({ data, error }) => { if (active) { setPreference(data); setError(error ? 'Email settings could not be loaded. Please try again.' : ''); } });
    return () => { active = false; };
  }, [session.user.id]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      new Intl.DateTimeFormat('en', { timeZone: preference.timezone });
      const { data, error } = await supabase.from('user_email_preferences').update(preference).eq('user_id', session.user.id).select('daily_question_enabled,daily_question_time,timezone').single();
      if (error) throw error;
      setPreference(data); setMessage('Daily email preferences saved.');
    } catch { setError('Could not save preferences. Check the time and timezone and try again.'); }
    finally { setBusy(false); }
  }
  return <section className="content-band"><h2>Daily NCLEX Question</h2><p>Receive one practice question each day with an active paid subscription. Security and account emails are unaffected.</p>
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
    {!preference ? !error && <p role="status">Loading email preferences…</p> : <form onSubmit={save} style={{ display: 'grid', gap: 16, maxWidth: 440 }}>
      <label><input type="checkbox" checked={preference.daily_question_enabled} onChange={e => setPreference({ ...preference, daily_question_enabled: e.target.checked })} /> Daily question emails enabled</label>
      <label>Delivery time<input style={{ display: 'block', width: '100%' }} type="time" required value={preference.daily_question_time.slice(0, 5)} onChange={e => setPreference({ ...preference, daily_question_time: e.target.value })} /></label>
      <label>Time zone<select style={{ display: 'block', width: '100%' }} required value={preference.timezone} onChange={e => setPreference({ ...preference, timezone: e.target.value })}>{zones.map(zone => <option key={zone}>{zone}</option>)}</select></label>
      <p>Delivery is approximately at your selected local time. Confirm your timezone when travelling.</p>
      <button className="primary-btn" disabled={busy}>{busy ? 'Saving…' : 'Save email preferences'}</button>
    </form>}
  </section>;
}
