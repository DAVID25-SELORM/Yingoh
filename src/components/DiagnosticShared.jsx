import React from 'react';
import { supabase } from '../services/supabase';

export const BAND_META = {
  strong: { label: 'Strong / Maintain', tone: 'good', mark: '●' },
  developing: { label: 'Developing', tone: 'info', mark: '◐' },
  weak: { label: 'Weak', tone: 'warn', mark: '▲' },
  critical: { label: 'Critical', tone: 'bad', mark: '■' },
  insufficient_data: { label: 'Too few questions to rate', tone: 'neutral', mark: '○' },
  no_data: { label: 'No data', tone: 'neutral', mark: '○' },
};
export const ERROR_TYPES = {
  A: 'Knowledge gap', B: 'Misread', C: 'Clinical judgment', D: 'Prioritization',
  E: 'Calculation', F: 'Test-taking reasoning', G: 'Careless error',
};
export const DIAGNOSTIC_NOTE = 'These bands are NurseFaculty internal diagnostic thresholds. They are not NCLEX passing standards and do not predict an NCLEX result.';

const KNOWN_ERRORS = [
  'Diagnostic not assigned', 'No diagnostic attempts remaining', 'Diagnostic not available', 'Select valid answer options',
  'Select one answer', 'Not authorized', 'Administrator access required', 'Form is incomplete', 'Form already has items',
  'Draft form not found', 'Question is not eligible for the diagnostic', 'Subcategory does not match the question',
  'Only missed questions can be tagged', 'Invalid error type', 'Published diagnostic forms are immutable',
];

// Calls a diagnostic RPC and turns database errors into short, safe messages.
export async function diagnosticRpc(name, args = {}) {
  if (!supabase) throw new Error('The diagnostic is unavailable right now.');
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    const known = KNOWN_ERRORS.find(message => error.message?.includes(message));
    throw new Error(known ?? 'The request could not be completed. Please try again.');
  }
  return data;
}

export function BandBadge({ band }) {
  const meta = BAND_META[band] ?? BAND_META.no_data;
  return <span className={`dx-badge dx-badge-${meta.tone}`}><span aria-hidden="true">{meta.mark}</span> {meta.label}</span>;
}

export function ScoreBar({ correct, total, band }) {
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const meta = BAND_META[band] ?? BAND_META.no_data;
  return <div className="dx-bar" role="img" aria-label={`${correct} of ${total} correct, ${pct} percent`}>
    <span className={`dx-bar-fill dx-fill-${meta.tone}`} style={{ width: `${pct}%` }} />
  </div>;
}

export function GroupTable({ title, rows, caption }) {
  if (!rows?.length) return null;
  return <section className="dx-panel" aria-label={title}>
    <h3>{title}</h3>
    {caption && <p className="dx-muted">{caption}</p>}
    <ul className="dx-groups">{rows.map(row => <li key={row.name}>
      <div className="dx-group-head"><strong>{row.name}</strong><span className="dx-count">{row.correct}/{row.total} · {Math.round(row.pct)}%</span></div>
      <ScoreBar correct={row.correct} total={row.total} band={row.band} />
      <BandBadge band={row.band} />
    </li>)}</ul>
  </section>;
}

export function ReportBody({ report }) {
  const overall = report.overall ?? {};
  return <div className="dx-report">
    <section className="dx-hero" aria-label="Overall result">
      <div><p className="dx-eyebrow">Overall</p><strong className="dx-big">{overall.pct == null ? '—' : `${Math.round(overall.pct)}%`}</strong>
        <span className="dx-count">{overall.correct}/{overall.total} correct</span></div>
      <BandBadge band={overall.band} />
    </section>
    <p className="dx-note" role="note">{report.note ?? DIAGNOSTIC_NOTE}</p>
    {report.roadmap?.length > 0 && <section className="dx-panel" aria-label="Your roadmap">
      <h3>Your roadmap</h3>
      <p className="dx-muted">Work through these in order. Critical gaps come first, then weak, then developing.</p>
      <ol className="dx-roadmap">{report.roadmap.map(item => <li key={`${item.level}-${item.name}`}>
        <span><strong>{item.name}</strong> <span className="dx-muted">({item.level === 'topic' ? 'topic' : 'client needs area'})</span></span>
        <BandBadge band={item.band} />
      </li>)}</ol>
    </section>}
    {report.roadmap?.length === 0 && <p className="dx-good" role="status">No gaps flagged. Keep practising to maintain your strengths.</p>}
    <GroupTable title="Client needs areas" rows={report.subcategories} />
    <GroupTable title="Test sections" rows={report.parts} />
    <GroupTable title="Clinical judgment steps" rows={report.clinical_judgment} caption="Steps with fewer than 4 questions are not rated." />
    <GroupTable title="Topics" rows={report.topics} caption="Topics with fewer than 4 questions are not rated." />
  </div>;
}
