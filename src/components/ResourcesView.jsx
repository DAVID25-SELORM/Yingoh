import React, { useState } from 'react';
import { BookOpen, Bookmark, BookmarkCheck, Heart, Pill, Activity, ShieldCheck, FlaskConical, FileText, Search } from 'lucide-react';
import { saveItem } from '../services/supabase';

const TABS = [
  { key: 'care-plans',  label: 'Care Plans',          icon: FileText },
  { key: 'drugs',       label: 'Drug Handbook',        icon: Pill },
  { key: 'labs',        label: 'Lab Values',           icon: FlaskConical },
  { key: 'ecg-abg',    label: 'ECG / ABG',            icon: Activity },
  { key: 'isolation',  label: 'Isolation Precautions', icon: ShieldCheck },
  { key: 'cardiac',    label: 'Cardiac / Vitals',      icon: Heart },
];

const CARE_PLANS = [
  { diagnosis: 'Impaired Gas Exchange', related: 'Ventilation-Perfusion Mismatch', goals: 'Patient will maintain SpO₂ ≥ 95%', interventions: ['Administer O₂ as ordered', 'Position in high-Fowler\'s', 'Monitor RR and breath sounds Q2h', 'Encourage incentive spirometry 10×/hr', 'Suction PRN', 'ABG monitoring'], color: '#2b8a7d' },
  { diagnosis: 'Decreased Cardiac Output', related: 'Impaired Myocardial Contractility', goals: 'BP within normal limits, HR 60-100, adequate urine output', interventions: ['Monitor vital signs Q2h', 'Assess for edema, JVD, S3 gallop', 'Administer diuretics as ordered', 'Daily weights same time same scale', 'Restrict sodium and fluids per order', 'Monitor I&Os'], color: '#e94868' },
  { diagnosis: 'Acute Pain', related: 'Tissue Damage / Inflammation', goals: 'Patient will rate pain ≤ 3/10 within 30 minutes of intervention', interventions: ['Assess pain Q4h using PQRST', 'Administer analgesics as ordered', 'Non-pharmacologic: positioning, ice/heat, distraction', 'Reassess 30 min after intervention', 'Educate on pain scale'], color: '#c17f44' },
  { diagnosis: 'Risk for Infection', related: 'Impaired Skin Integrity / Invasive Lines', goals: 'Patient will remain free of infection signs (no fever, WBC normal)', interventions: ['Strict handwashing / hand hygiene', 'Sterile technique for wound care and IV access', 'Monitor for redness, warmth, drainage, fever', 'Culture per order before antibiotics', 'Change IV tubing per protocol'], color: '#8b5cf6' },
  { diagnosis: 'Deficient Knowledge', related: 'New Diagnosis / Medication Regimen', goals: 'Patient will verbalize understanding of disease and medications', interventions: ['Assess baseline knowledge', 'Teach using simple language / teach-back method', 'Provide written materials', 'Include family in teaching', 'Document teaching and comprehension'], color: '#29b7a3' },
  { diagnosis: 'Activity Intolerance', related: 'Weakness / Imbalance of O₂ Supply and Demand', goals: 'Patient will tolerate activity with no significant vital sign changes', interventions: ['Schedule rest periods between activities', 'Assist with ADLs as needed', 'Monitor vitals before, during, after activity', 'Progress activity gradually', 'Encourage use of assistive devices'], color: '#e3a72f' },
];

const HIGH_ALERT_DRUGS = [
  { name: 'Heparin', class: 'Anticoagulant', uses: 'DVT, PE, ACS prophylaxis', nursing: 'Monitor aPTT (goal 60-100s), assess for bleeding, antidote = Protamine Sulfate', color: '#e94868' },
  { name: 'Warfarin (Coumadin)', class: 'Anticoagulant', uses: 'A-fib, DVT, PE prevention', nursing: 'Monitor PT/INR (goal 2-3), antidote = Vitamin K + FFP, many drug/food interactions', color: '#e94868' },
  { name: 'Digoxin', class: 'Cardiac Glycoside', uses: 'Heart failure, A-fib rate control', nursing: 'Apical pulse for 1 full minute before giving, hold if <60 bpm, monitor K⁺ (hypokalemia increases toxicity)', color: '#e94868' },
  { name: 'Insulin', class: 'Antidiabetic', uses: 'Type 1 DM, hyperkalemia, DKA', nursing: 'Check BG before, verify dose with 2 nurses, only clear insulin IV push, monitor for hypoglycemia', color: '#e94868' },
  { name: 'Morphine / Opioids', class: 'Opioid Analgesic', uses: 'Severe pain, MI, pulmonary edema', nursing: 'Monitor RR (hold if <12), antidote = Naloxone, assess sedation level', color: '#c17f44' },
  { name: 'Potassium (IV)', class: 'Electrolyte', uses: 'Hypokalemia replacement', nursing: 'NEVER give IV push, max rate 10 mEq/hr peripheral (40 mEq/hr central), continuous cardiac monitoring', color: '#e94868' },
  { name: 'Furosemide (Lasix)', class: 'Loop Diuretic', uses: 'Edema, CHF, hypertension', nursing: 'Monitor K⁺ (causes hypokalemia), I&Os, daily weights, listen for S3', color: '#29b7a3' },
  { name: 'Metoprolol', class: 'Beta-Blocker', uses: 'HTN, A-fib, CHF, post-MI', nursing: 'Hold if HR <60, monitor BP, do NOT stop abruptly (may cause rebound tachycardia)', color: '#2b8a7d' },
  { name: 'Amiodarone', class: 'Antiarrhythmic', uses: 'V-fib, V-tach, A-fib', nursing: 'Photosensitivity, thyroid/pulmonary toxicity long-term, requires ECG monitoring', color: '#c17f44' },
  { name: 'Lithium', class: 'Mood Stabilizer', uses: 'Bipolar disorder', nursing: 'Therapeutic range 0.6-1.2 mEq/L, narrow margin, toxicity >1.5, monitor renal function and sodium', color: '#8b5cf6' },
];

const LAB_VALUES = [
  { name: 'Sodium (Na⁺)', normal: '135-145 mEq/L', low: 'Hyponatremia: confusion, seizures, cerebral edema', high: 'Hypernatremia: thirst, dry membranes, confusion', color: '#2b8a7d' },
  { name: 'Potassium (K⁺)', normal: '3.5-5.0 mEq/L', low: 'Hypokalemia: muscle weakness, dysrhythmias, U-wave on ECG', high: 'Hyperkalemia: peaked T waves, wide QRS, cardiac arrest', color: '#e94868' },
  { name: 'Glucose (fasting)', normal: '70-100 mg/dL', low: 'Hypoglycemia <70: tremors, diaphoresis, confusion', high: 'Hyperglycemia >180: polyuria, polydipsia, ketones (DKA)', color: '#e3a72f' },
  { name: 'Hemoglobin', normal: 'M: 13.5-17.5 g/dL, F: 12-15.5 g/dL', low: 'Anemia: fatigue, SOB, tachycardia, pallor', high: 'Polycythemia: thrombus risk, ruddy complexion', color: '#c17f44' },
  { name: 'WBC', normal: '4,500-11,000 /µL', low: 'Leukopenia: infection risk, neutropenia precautions', high: 'Leukocytosis: infection, inflammation, leukemia', color: '#29b7a3' },
  { name: 'Platelets', normal: '150,000-400,000 /µL', low: 'Thrombocytopenia <20K: spontaneous bleeding, petechiae', high: 'Thrombocytosis: clotting risk', color: '#8b5cf6' },
  { name: 'Creatinine', normal: '0.6-1.2 mg/dL', low: 'Low muscle mass, pregnancy', high: 'Renal failure, rhabdomyolysis', color: '#607478' },
  { name: 'BUN', normal: '7-20 mg/dL', low: 'Liver disease, overhydration', high: 'Dehydration, GI bleed, renal failure', color: '#607478' },
  { name: 'pH (arterial)', normal: '7.35-7.45', low: 'Acidosis <7.35: Kussmaul breathing (metabolic), CO₂ retention (respiratory)', high: 'Alkalosis >7.45: carpopedal spasm, hypokalemia', color: '#e94868' },
  { name: 'INR', normal: '0.8-1.2 (therapeutic: 2-3)', low: 'Clotting risk', high: '>3 = bleeding risk; >4 = hold warfarin, contact provider', color: '#e3a72f' },
];

const ECG_RHYTHMS = [
  { rhythm: 'Normal Sinus Rhythm', rate: '60-100 bpm', p_wave: 'Present, upright, before each QRS', pr_interval: '0.12-0.20s', qrs: '0.06-0.10s', action: 'No intervention needed' },
  { rhythm: 'Sinus Bradycardia', rate: '<60 bpm', p_wave: 'Present', pr_interval: 'Normal', qrs: 'Normal', action: 'Monitor; if symptomatic: atropine 0.5-1mg IV, pacing' },
  { rhythm: 'Sinus Tachycardia', rate: '>100 bpm', p_wave: 'Present', pr_interval: 'Normal', qrs: 'Normal', action: 'Treat cause (pain, fever, hypovolemia)' },
  { rhythm: 'Atrial Fibrillation', rate: 'Irregular, 350-600 atrial', p_wave: 'Absent — fibrillatory baseline', pr_interval: 'Not measurable', qrs: 'Normal but irregular', action: 'Rate control, anticoagulation, cardioversion if hemodynamically unstable' },
  { rhythm: 'Ventricular Tachycardia', rate: '100-250 bpm', p_wave: 'Absent or dissociated', pr_interval: 'Not measurable', qrs: 'Wide (>0.12s), bizarre', action: 'If pulseless: CPR + defibrillation. If stable: amiodarone' },
  { rhythm: 'Ventricular Fibrillation', rate: 'Chaotic, no pattern', p_wave: 'None', pr_interval: 'None', qrs: 'Chaotic waves', action: 'IMMEDIATE defibrillation + CPR. No pulse — code!' },
  { rhythm: '3rd Degree (Complete) Heart Block', rate: 'Atrial 60-100, ventricular 20-40', p_wave: 'Present but no relationship to QRS', pr_interval: 'Variable (no consistent conduction)', qrs: 'Wide (ventricular escape)', action: 'Transcutaneous pacing immediately, prepare for permanent pacemaker' },
];

const ABG_INTERPRETATION = [
  { step: '1. pH', normal: '7.35-7.45', interpretation: '<7.35 = Acidosis | >7.45 = Alkalosis' },
  { step: '2. PaCO₂', normal: '35-45 mmHg', interpretation: '>45 = Respiratory Acidosis | <35 = Respiratory Alkalosis' },
  { step: '3. HCO₃⁻', normal: '22-26 mEq/L', interpretation: '<22 = Metabolic Acidosis | >26 = Metabolic Alkalosis' },
  { step: '4. Determine Primary', normal: '', interpretation: 'Match pH direction with CO₂ or HCO₃⁻ direction' },
  { step: '5. Compensation?', normal: 'PaO₂: 80-100 mmHg', interpretation: 'Is the other component moving to correct the pH? Full vs partial compensation' },
];

const ISOLATION_TABLE = [
  { type: 'Standard Precautions', icon: '🧤', for: 'ALL patients, every time', ppe: 'Gloves, hand hygiene, gown if splash risk', examples: 'All patient care', room: 'Any', extras: '' },
  { type: 'Contact', icon: '🟢', for: 'Direct/indirect contact with organism', ppe: 'Gloves + Gown (don at doorway)', examples: 'MRSA, C. diff, VRE, RSV, wound infections', room: 'Private or cohort', extras: 'Dedicated equipment (stethoscope), C. diff → soap & water only (no gel)' },
  { type: 'Droplet', icon: '🟡', for: 'Large droplets (>5 µm), travels <3 feet', ppe: 'Surgical mask within 3 feet, gloves, gown', examples: 'Influenza, COVID-19, meningitis, pertussis, rubella, mumps', room: 'Private or 3ft curtain', extras: 'Patient wears mask during transport' },
  { type: 'Airborne', icon: '🔴', for: 'Small droplets (≤5 µm), stays airborne', ppe: 'N95 respirator (fit-tested), gloves, gown', examples: 'TB, Measles (rubeola), Chickenpox (varicella), disseminated zoster', room: 'Negative pressure room (AIIR)', extras: 'Door stays closed; patient wears surgical mask when transported' },
];

const VITAL_NORMS = [
  { param: 'Temperature', adult: '36.1–37.2 °C (97–99 °F)', critical: '<35°C or >40°C', notes: 'Rectal most accurate; axillary lowest' },
  { param: 'Heart Rate', adult: '60–100 bpm', critical: '<50 or >130 symptomatic', notes: 'Apical 1 full minute for irregular rhythms' },
  { param: 'Respiratory Rate', adult: '12–20 breaths/min', critical: '<8 or >30', notes: 'Count for 60 seconds without telling patient' },
  { param: 'Blood Pressure', adult: '90–120 / 60–80 mmHg', critical: 'SBP <90 (shock) or >180 (crisis)', notes: 'HTN: ≥130/80. Shock: MAP <65' },
  { param: 'SpO₂', adult: '≥95%', critical: '<90% requires intervention', notes: 'COPD patients may have baseline 88-92%' },
  { param: 'Pain', adult: '0/10 goal', critical: 'Uncontrolled pain >7 requires intervention', notes: 'Reassess 30 min after medication' },
];

export default function ResourcesView({ session }) {
  const [tab, setTab] = useState('care-plans');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(new Set());

  async function saveResource(itemId, title, summary, metadata = {}) {
    if (!session?.user?.id) return;
    const { error } = await saveItem(session.user.id, {
      item_type: 'resource',
      item_id: `${tab}:${itemId}`,
      title,
      summary,
      metadata: { tab, ...metadata },
    });
    if (!error) setSaved((prev) => new Set([...prev, `${tab}:${itemId}`]));
  }

  function SaveResourceButton({ itemId, title, summary, metadata }) {
    const key = `${tab}:${itemId}`;
    return (
      <button className="icon-btn" onClick={() => saveResource(itemId, title, summary, metadata)} disabled={!session?.user?.id} title={session?.user?.id ? 'Save resource' : 'Sign in to save'}>
        {saved.has(key) ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
      </button>
    );
  }

  return (
    <section className="content-band">
      <div className="section-title"><h2>Clinical Resources</h2><BookOpen size={22} /></div>

      {/* Tabs */}
      <div className="tab-bar" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`tab-btn ${tab === key ? 'tab-active' : ''}`} onClick={() => { setTab(key); setSearch(''); }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Search (care plans / drugs / labs) */}
      {['care-plans', 'drugs', 'labs'].includes(tab) && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#8a999c' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab === 'care-plans' ? 'nursing diagnoses' : tab === 'drugs' ? 'drug names or classes' : 'lab values'}…`} style={{ width: '100%', height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px 0 34px', boxSizing: 'border-box' }} />
        </div>
      )}

      {/* Care Plans */}
      {tab === 'care-plans' && (
        <div style={{ display: 'grid', gap: 14 }}>
          {CARE_PLANS.filter((c) => !search || c.diagnosis.toLowerCase().includes(search.toLowerCase()) || c.related.toLowerCase().includes(search.toLowerCase())).map((cp) => (
            <div key={cp.diagnosis} style={{ border: `1.5px solid ${cp.color}22`, borderLeft: `4px solid ${cp.color}`, borderRadius: 12, padding: '16px 18px', background: '#fff' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.97rem', color: cp.color }}>{cp.diagnosis}</div>
                  <div style={{ fontSize: '0.82rem', color: '#607478', marginTop: 2 }}>Related to: {cp.related}</div>
                </div>
                <div style={{ fontSize: '0.78rem', background: `${cp.color}15`, color: cp.color, padding: '4px 10px', borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap' }}>Nursing Diagnosis</div>
                <SaveResourceButton itemId={cp.diagnosis} title={cp.diagnosis} summary={cp.goals} metadata={{ related: cp.related }} />
              </div>
              <div style={{ marginBottom: 8, padding: '8px 12px', background: '#f0faf8', borderRadius: 8, fontSize: '0.84rem', color: '#2b8a7d' }}>
                <strong>Goal:</strong> {cp.goals}
              </div>
              <div style={{ fontSize: '0.84rem', color: '#42585e' }}>
                <strong>Interventions:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'grid', gap: 3 }}>
                  {cp.interventions.map((iv) => <li key={iv}>{iv}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drug Handbook */}
      {tab === 'drugs' && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ padding: '10px 14px', background: '#fff8e1', borderRadius: 10, border: '1.5px solid #e3a72f', fontSize: '0.83rem', color: '#875f08', marginBottom: 4 }}>
            ⚠️ High-alert medications below. Always double-check, use 2-nurse verification where required, and know the antidote.
          </div>
          {HIGH_ALERT_DRUGS.filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase()) || d.class.toLowerCase().includes(search.toLowerCase())).map((drug) => (
            <div key={drug.name} style={{ border: '1.5px solid #dbe6e4', borderLeft: `4px solid ${drug.color}`, borderRadius: 12, padding: '14px 16px', background: '#fff' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.96rem', color: '#17212f' }}>{drug.name}</strong>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, background: `${drug.color}18`, color: drug.color, padding: '2px 8px', borderRadius: 20 }}>{drug.class}</span>
                <SaveResourceButton itemId={drug.name} title={drug.name} summary={drug.nursing} metadata={{ class: drug.class }} />
              </div>
              <div style={{ fontSize: '0.84rem', color: '#42585e', marginBottom: 4 }}><strong>Uses:</strong> {drug.uses}</div>
              <div style={{ fontSize: '0.84rem', color: '#607478', lineHeight: 1.5 }}><strong>Nursing Considerations:</strong> {drug.nursing}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lab Values */}
      {tab === 'labs' && (
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr><th>Lab</th><th>Normal Range</th><th>Low (↓)</th><th>High (↑)</th><th>Save</th></tr>
            </thead>
            <tbody>
              {LAB_VALUES.filter((l) => !search || l.name.toLowerCase().includes(search.toLowerCase())).map((lab) => (
                <tr key={lab.name}>
                  <td><strong style={{ color: lab.color }}>{lab.name}</strong></td>
                  <td><code style={{ background: '#e9f1ef', padding: '2px 7px', borderRadius: 4, fontSize: '0.82rem' }}>{lab.normal}</code></td>
                  <td style={{ fontSize: '0.83rem', color: '#2b8a7d' }}>{lab.low}</td>
                  <td style={{ fontSize: '0.83rem', color: '#c17f44' }}>{lab.high}</td>
                  <td><SaveResourceButton itemId={lab.name} title={lab.name} summary={`Normal: ${lab.normal}`} metadata={{ low: lab.low, high: lab.high }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ECG / ABG */}
      {tab === 'ecg-abg' && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div>
            <h3 style={{ marginBottom: 12, color: '#17212f', fontSize: '1rem' }}>ABG Interpretation — ROME Method</h3>
            <div style={{ display: 'grid', gap: 2, background: '#f8fafb', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #dbe6e4' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 1, padding: '10px 14px', background: '#2b8a7d', color: '#fff', fontSize: '0.82rem', fontWeight: 700 }}>
                <span>Step</span><span>Normal</span><span>Interpretation</span>
              </div>
              {ABG_INTERPRETATION.map((row) => (
                <div key={row.step} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 1, padding: '10px 14px', background: '#fff', fontSize: '0.84rem', borderBottom: '1px solid #f0f4f4' }}>
                  <strong style={{ color: '#2b8a7d' }}>{row.step}</strong>
                  <code style={{ fontSize: '0.8rem' }}>{row.normal}</code>
                  <span style={{ color: '#42585e' }}>{row.interpretation}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: '10px 14px', background: '#e9f1ef', borderRadius: 10, fontSize: '0.83rem', color: '#135f55' }}>
              <strong>ROME:</strong> Respiratory Opposite (pH↑ CO₂↓ or pH↓ CO₂↑) · Metabolic Equal (pH↑ HCO₃↑ or pH↓ HCO₃↓)
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 12, color: '#17212f', fontSize: '1rem' }}>Common ECG Rhythms</h3>
            <div style={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr><th>Rhythm</th><th>Rate</th><th>P Wave</th><th>QRS</th><th>Nursing Action</th></tr>
                </thead>
                <tbody>
                  {ECG_RHYTHMS.map((r) => (
                    <tr key={r.rhythm}>
                      <td><strong style={{ fontSize: '0.88rem' }}>{r.rhythm}</strong></td>
                      <td style={{ fontSize: '0.83rem', color: '#2b8a7d' }}>{r.rate}</td>
                      <td style={{ fontSize: '0.82rem', color: '#607478' }}>{r.p_wave}</td>
                      <td style={{ fontSize: '0.82rem' }}>{r.qrs}</td>
                      <td style={{ fontSize: '0.82rem', color: r.action.includes('IMMEDIATE') || r.action.includes('CPR') ? '#e94868' : '#42585e', fontWeight: r.action.includes('IMMEDIATE') ? 700 : 400 }}>{r.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Isolation Precautions */}
      {tab === 'isolation' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ padding: '12px 16px', background: '#e9f1ef', borderRadius: 10, fontSize: '0.85rem', color: '#135f55' }}>
            <strong>Mnemonic:</strong> <strong>ABCD</strong> — Airborne (TB, Measles, VZV), Bloodborne (HIV, Hep B/C), Contact (MRSA, C. diff, VRE), Droplet (Flu, COVID, Meningitis)
          </div>
          {ISOLATION_TABLE.map((row) => (
            <div key={row.type} style={{ border: '1.5px solid #dbe6e4', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: row.type === 'Airborne' ? '#ffe4e4' : row.type === 'Droplet' ? '#fff9e1' : row.type === 'Contact' ? '#e4ffe4' : '#f8fafb', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ fontSize: '1.4rem' }}>{row.icon}</span>
                <div>
                  <strong style={{ fontSize: '0.97rem' }}>{row.type} Precautions</strong>
                  <div style={{ fontSize: '0.8rem', color: '#607478' }}>For: {row.for}</div>
                </div>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gap: 8, fontSize: '0.84rem' }}>
                <div><strong>PPE:</strong> <span style={{ color: '#42585e' }}>{row.ppe}</span></div>
                <div><strong>Examples:</strong> <span style={{ color: '#2b8a7d' }}>{row.examples}</span></div>
                <div><strong>Room:</strong> <span style={{ color: '#607478' }}>{row.room}</span></div>
                {row.extras && <div style={{ padding: '7px 12px', background: '#fff8e1', borderRadius: 8, color: '#875f08', fontSize: '0.82rem' }}>⚠️ {row.extras}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cardiac / Vitals */}
      {tab === 'cardiac' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: '0.97rem', color: '#17212f' }}>Adult Vital Sign Norms & Critical Values</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table">
              <thead>
                <tr><th>Parameter</th><th>Adult Normal</th><th>Critical Value</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {VITAL_NORMS.map((v) => (
                  <tr key={v.param}>
                    <td><strong>{v.param}</strong></td>
                    <td><code style={{ background: '#e9f1ef', padding: '2px 7px', borderRadius: 4, fontSize: '0.82rem' }}>{v.adult}</code></td>
                    <td style={{ color: '#e94868', fontSize: '0.83rem', fontWeight: 600 }}>{v.critical}</td>
                    <td style={{ fontSize: '0.82rem', color: '#607478' }}>{v.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginTop: 8 }}>
            {[
              { title: 'Shock Types & Signs', body: 'Hypovolemic: trauma, hemorrhage — ↓BP, ↑HR, cold clammy skin\nCardiogenic: MI, pump failure — ↓BP, ↑HR, crackles, S3\nSeptic: infection — SIRS criteria, ↑HR, fever or hypothermia\nAnaphylactic: allergen — hives, bronchospasm, ↓BP\nNeurogenic: spinal injury — ↓BP, bradycardia, warm skin', color: '#e94868' },
              { title: 'Fluid Resuscitation Mnemonics', body: 'Isotonic (0.9% NS, LR) — expands intravascular volume\nHypotonic (0.45% NS) — hydrates cells (cellular dehydration)\nHypertonic (3% NS) — pulls fluid from cells (cerebral edema, hyponatremia)\nD5W — technically hypotonic after glucose metabolized', color: '#2b8a7d' },
              { title: 'Pain Assessment: PQRST', body: 'P — Provokes/Palliates: what makes it worse/better?\nQ — Quality: sharp, dull, crushing, burning?\nR — Radiates: where does it go?\nS — Severity: scale 0-10\nT — Timing: constant, intermittent, onset?', color: '#c17f44' },
            ].map((card) => (
              <div key={card.title} style={{ border: `1.5px solid ${card.color}33`, borderLeft: `4px solid ${card.color}`, borderRadius: 12, padding: '14px 16px', background: '#fff' }}>
                <strong style={{ fontSize: '0.9rem', color: card.color, display: 'block', marginBottom: 8 }}>{card.title}</strong>
                <pre style={{ margin: 0, fontSize: '0.8rem', color: '#42585e', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{card.body}</pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
