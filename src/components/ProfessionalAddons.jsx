import React, { useState } from 'react';
import { GraduationCap, CheckCircle2, Circle, Briefcase, Plane, Award, BookOpen } from 'lucide-react';

const TABS = [
  { key: 'usrn',    label: 'USRN Checklist',  icon: CheckCircle2 },
  { key: 'visa',    label: 'Visa Prep',        icon: Plane },
  { key: 'career',  label: 'Career Center',    icon: Briefcase },
  { key: 'cpd',     label: 'CPD Tracker',      icon: Award },
];

const USRN_STEPS = [
  {
    phase: 'Phase 1: Educational Requirements',
    color: '#2b8a7d',
    items: [
      { id: 'bsn', label: 'BSN or equivalent nursing degree (4-year program)' },
      { id: 'official-transcript', label: 'Official transcripts from nursing school (sealed)' },
      { id: 'coe', label: 'Certificate of Eligibility (CoE) or CGFNS Certificate obtained' },
      { id: 'cgfns-cvs', label: 'CGFNS Credentials Verification Service (CVS) completed' },
      { id: 'english-proficiency', label: 'English proficiency exam: IELTS Academic (7.0+) or TOEFL iBT (83+)' },
    ],
  },
  {
    phase: 'Phase 2: NCLEX Preparation',
    color: '#29b7a3',
    items: [
      { id: 'nclex-apply', label: 'Apply to a US State Board of Nursing (recommend: California, New York, or Texas)' },
      { id: 'authorization', label: 'Authorization to Test (ATT) received from State Board' },
      { id: 'nclex-exam', label: 'NCLEX-RN exam passed (max 145 items NGN format)' },
      { id: 'nclex-results', label: 'Official NCLEX results letter received' },
      { id: 'temp-license', label: 'Temporary nursing license issued by state board' },
    ],
  },
  {
    phase: 'Phase 3: Immigration Documents',
    color: '#e3a72f',
    items: [
      { id: 'passport', label: 'Valid passport (at least 6 months beyond intended stay)' },
      { id: 'visa-screen', label: 'VisaScreen Certificate from CGFNS (required for H-1B and EB-3)' },
      { id: 'retrogress-check', label: 'Check Visa Bulletin — EB-3 Philippines/India may have waiting periods' },
      { id: 'employer-petition', label: 'US employer files I-140 (Immigrant Petition for Alien Workers)' },
      { id: 'i-485-or-cp', label: 'I-485 (Adjustment of Status in US) OR Consular Processing (DS-260)' },
      { id: 'medical-exam', label: 'USCIS-approved physician medical exam (Form I-693)' },
    ],
  },
  {
    phase: 'Phase 4: Arrival & Licensing',
    color: '#c17f44',
    items: [
      { id: 'ead', label: 'Employment Authorization Document (EAD) or Green Card received' },
      { id: 'state-endorsement', label: 'Apply for nursing license by endorsement in destination state' },
      { id: 'ssn', label: 'Social Security Number (SSN) obtained' },
      { id: 'orientation', label: 'Complete hospital/employer orientation and skills validation' },
      { id: 'ceu-requirements', label: 'Understand state CEU renewal requirements (typically 30 hrs per 2 years)' },
    ],
  },
];

const VISA_TYPES = [
  { type: 'H-1B', name: 'Specialty Occupation', timeline: '6-12 months', notes: 'Cap-exempt for many healthcare employers. Requires employer sponsorship. VisaScreen required.', color: '#2b8a7d' },
  { type: 'EB-3', name: 'Skilled Worker (Immigrant)', timeline: '1-4 years', notes: 'Most common path for Philippine nurses. Subject to retrogression. Leads to green card.', color: '#29b7a3' },
  { type: 'TN Visa', name: 'Trade NAFTA (Mexico/Canada)', timeline: '1-3 months', notes: 'Only for Mexican and Canadian RNs. Quick processing, renewable, no cap.', color: '#e3a72f' },
  { type: 'J-1', name: 'Exchange Visitor', timeline: '3-6 months', notes: 'For training/exchange programs. 2-year home residency requirement unless waived.', color: '#8b5cf6' },
];

const CAREER_TIPS = [
  { section: 'Resume Tips for US Nursing Positions', icon: '📄', tips: ['Use reverse chronological format', 'List BLS, ACLS, PALS certifications prominently', 'Quantify experience: "Managed 6-bed ICU" not just "Worked in ICU"', 'Include NCLEX pass status and state license number', 'Keep to 1-2 pages maximum', 'Tailor resume keywords to match job posting (ATS systems scan for keywords)'] },
  { section: 'High-Demand Nursing Specialties', icon: '🏥', tips: ['ICU/Critical Care — highest pay, most in demand', 'Emergency Department (ED/ER)', 'Operating Room (OR/Perioperative)', 'Labor & Delivery (L&D)', 'Travel Nursing — 13-week contracts, premium pay', 'Home Health / Hospice'] },
  { section: 'Salary Expectations (USA 2025)', icon: '💰', tips: ['New RN (1-3 years): $55,000-$75,000/year', 'Experienced RN (5+ years): $75,000-$100,000+', 'ICU/ER/OR RN: $85,000-$115,000', 'Travel Nurse: $75-$120/hour ($130K+ annually)', 'Nurse Practitioner (NP): $110,000-$140,000+', 'Highest-paying states: California, New York, Hawaii, Texas'] },
  { section: 'Networking & Job Search', icon: '🔗', tips: ['LinkedIn: Connect with US RNs, join nursing groups', 'Indeed and NurseRecruiter.com', 'International nurse staffing agencies (AMN, Cross Country, Aya Healthcare)', 'Hospital websites → Careers → International Nurses', 'CGFNS has a job board for international nurses', 'Facebook groups: USRN Journey, Philippine Nurses in America'] },
];

const CPD_CATEGORIES = [
  { category: 'Clinical Education', color: '#2b8a7d', examples: 'ACLS renewal, wound care course, pharmacology seminar, hospital in-services' },
  { category: 'Academic/Formal Study', color: '#29b7a3', examples: 'BSN → MSN coursework, NP program, specialty certifications (CCRN, CEN)' },
  { category: 'Research & Publication', color: '#8b5cf6', examples: 'Contributing to nursing research, journal article publication, poster presentations' },
  { category: 'Leadership/Management', color: '#e3a72f', examples: 'Charge nurse training, quality improvement projects, committee participation' },
  { category: 'Self-Directed Learning', color: '#c17f44', examples: 'Online courses (Coursera, Medscape CME), nursing journals, webinars' },
];

const CLINICAL_SKILL_STATIONS = [
  { station: 'Patient Assessment', skills: ['Head-to-toe assessment in order', 'Vital sign measurement and documentation', 'Neuro assessment: GCS, pupils, orientation', 'Pain assessment using PQRST', 'Skin assessment: color, turgor, wounds'], color: '#2b8a7d' },
  { station: 'Medication Administration', skills: ['5 Rights verification (patient, drug, dose, route, time)', 'Double-check calculation: dimensional analysis', 'IV push rate calculation', 'Insulin administration technique', 'Document after administration — never before'], color: '#e3a72f' },
  { station: 'Wound Care / Sterile Technique', skills: ['Don sterile gloves without contamination', 'Wound irrigation technique', 'Dressing change: wet-to-moist, dry, transparent film', 'Culture specimen collection', 'Document wound characteristics'], color: '#c17f44' },
  { station: 'IV Access & Blood Draw', skills: ['IV insertion: vein selection, angle, securement', 'Blood draw using correct collection tubes (BCTR order)', 'IV line priming and connection', 'Central line care (sterile technique, clamping)', 'Troubleshoot infiltration vs phlebitis'], color: '#29b7a3' },
  { station: 'Communication & Ethics', skills: ['Therapeutic communication techniques', 'Informed consent process', 'SBAR handoff report', 'End-of-life care communication', 'Mandatory reporting (abuse, infection)'], color: '#8b5cf6' },
  { station: 'Emergency Response', skills: ['BLS: C-A-B sequence, rate, depth', 'Defibrillator: turning on, pad placement, shocking', 'Code roles: compressor, airway, timer, documenter', 'Rapid assessment: ABCDE approach', 'Epinephrine and other ACLS drugs'], color: '#e94868' },
];

export default function ProfessionalAddons({ session }) {
  const [tab, setTab] = useState('usrn');
  const [checked, setChecked] = useState({});
  const [cpdEntries, setCpdEntries] = useState([
    { id: 1, date: '2026-01-15', category: 'Clinical Education', title: 'ACLS Renewal', hours: 8, provider: 'AHA' },
    { id: 2, date: '2026-03-02', category: 'Self-Directed Learning', title: 'NGN Review Webinar', hours: 2, provider: 'NCSBN' },
  ]);
  const [showCpdForm, setShowCpdForm] = useState(false);
  const [newCpd, setNewCpd] = useState({ date: '', category: 'Clinical Education', title: '', hours: '', provider: '' });

  const totalItems = USRN_STEPS.reduce((s, p) => s + p.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;
  const progress = Math.round((checkedCount / totalItems) * 100);
  const totalCpdHours = cpdEntries.reduce((s, e) => s + Number(e.hours), 0);

  function toggle(id) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function addCpd() {
    if (!newCpd.title || !newCpd.hours || !newCpd.date) return;
    setCpdEntries((prev) => [...prev, { ...newCpd, id: Date.now(), hours: Number(newCpd.hours) }]);
    setNewCpd({ date: '', category: 'Clinical Education', title: '', hours: '', provider: '' });
    setShowCpdForm(false);
  }

  return (
    <section className="content-band">
      <div className="section-title"><h2>Professional Add-ons</h2><GraduationCap size={22} /></div>

      <div className="tab-bar" style={{ marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} className={`tab-btn ${tab === key ? 'tab-active' : ''}`} onClick={() => setTab(key)}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* USRN Checklist */}
      {tab === 'usrn' && (
        <div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
            <div className="stat-card" style={{ borderTop: '3px solid #29b7a3', textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#29b7a3' }}>{progress}%</div>
              <div style={{ fontSize: '0.82rem', color: '#607478' }}>Complete</div>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #2b8a7d', textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2b8a7d' }}>{checkedCount}/{totalItems}</div>
              <div style={{ fontSize: '0.82rem', color: '#607478' }}>Steps Done</div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', background: '#dbe6e4', borderRadius: 8, height: 10 }}>
                <div style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #29b7a3, #2b8a7d)', height: '100%', borderRadius: 8, transition: 'width 0.3s' }} />
              </div>
            </div>
          </div>

          {USRN_STEPS.map((phase) => (
            <div key={phase.phase} style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: phase.color, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{phase.phase}</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {phase.items.map((item) => (
                  <div key={item.id} onClick={() => toggle(item.id)} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${checked[item.id] ? phase.color + '55' : '#dbe6e4'}`, background: checked[item.id] ? phase.color + '08' : '#fff', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {checked[item.id] ? <CheckCircle2 size={18} color={phase.color} style={{ flexShrink: 0, marginTop: 1 }} /> : <Circle size={18} color="#dbe6e4" style={{ flexShrink: 0, marginTop: 1 }} />}
                    <span style={{ fontSize: '0.88rem', color: checked[item.id] ? '#8a999c' : '#17212f', textDecoration: checked[item.id] ? 'line-through' : 'none' }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visa Prep */}
      {tab === 'visa' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ padding: '12px 16px', background: '#e9f1ef', borderRadius: 10, fontSize: '0.85rem', color: '#135f55', lineHeight: 1.6 }}>
            Most internationally educated nurses use the <strong>EB-3 immigrant visa</strong> or <strong>H-1B non-immigrant visa</strong>. The path depends on your country, employer type, and timeline. Always consult a licensed immigration attorney before making decisions.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {VISA_TYPES.map((v) => (
              <div key={v.type} style={{ border: '1.5px solid #dbe6e4', borderLeft: `4px solid ${v.color}`, borderRadius: 12, padding: '14px 16px', background: '#fff' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                  <strong style={{ fontSize: '1.05rem', color: v.color }}>{v.type}</strong>
                  <span style={{ fontSize: '0.78rem', color: '#607478' }}>{v.name}</span>
                </div>
                <div style={{ fontSize: '0.83rem', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: '#42585e' }}>Timeline: </span>
                  <span style={{ color: v.color }}>{v.timeline}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#607478', lineHeight: 1.5 }}>{v.notes}</p>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px 18px', background: '#fff', border: '1.5px solid #dbe6e4', borderRadius: 14 }}>
            <strong style={{ display: 'block', marginBottom: 10, color: '#17212f' }}>Key Organizations for International Nurses</strong>
            <div style={{ display: 'grid', gap: 6, fontSize: '0.84rem' }}>
              {[
                { name: 'CGFNS International', role: 'Credentials evaluation, VisaScreen Certificate, CES for NCLEX eligibility', url: 'cgfns.org' },
                { name: 'NCSBN', role: 'NCLEX exam administration, US state board directory', url: 'ncsbn.org' },
                { name: 'AMN Healthcare', role: 'International nurse staffing, EB-3 sponsorship', url: 'amnhealthcare.com' },
                { name: 'Aya Healthcare', role: 'Travel nursing and permanent placement, international program', url: 'ayahealthcare.com' },
                { name: 'USCIS', role: 'US immigration petitions (I-140, I-485, EAD)', url: 'uscis.gov' },
              ].map((org) => (
                <div key={org.name} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', background: '#f8fafb', borderRadius: 8 }}>
                  <BookOpen size={14} color="#29b7a3" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div><strong style={{ color: '#17212f' }}>{org.name}</strong> <span style={{ color: '#8a999c', fontSize: '0.79rem' }}>({org.url})</span> — <span style={{ color: '#607478' }}>{org.role}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Career Center */}
      {tab === 'career' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {CAREER_TIPS.map((section) => (
            <div key={section.section} style={{ border: '1.5px solid #dbe6e4', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ background: '#f8fafb', padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid #dbe6e4' }}>
                <span style={{ fontSize: '1.3rem' }}>{section.icon}</span>
                <strong style={{ fontSize: '0.95rem', color: '#17212f' }}>{section.section}</strong>
              </div>
              <div style={{ padding: '12px 16px', display: 'grid', gap: 6 }}>
                {section.tips.map((tip, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.86rem', color: '#42585e' }}>
                    <CheckCircle2 size={14} color="#29b7a3" style={{ flexShrink: 0, marginTop: 2 }} />
                    {tip}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CPD Tracker */}
      {tab === 'cpd' && (
        <div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="stat-card" style={{ borderTop: '3px solid #29b7a3', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#29b7a3' }}>{totalCpdHours}</div>
              <div style={{ fontSize: '0.82rem', color: '#607478' }}>CPD Hours (30 needed)</div>
            </div>
            <div className="stat-card" style={{ borderTop: '3px solid #2b8a7d', textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#2b8a7d' }}>{Math.max(0, 30 - totalCpdHours)}</div>
              <div style={{ fontSize: '0.82rem', color: '#607478' }}>Hours Remaining</div>
            </div>
            <button className="primary-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowCpdForm(true)}>+ Add CPD Activity</button>
          </div>

          {showCpdForm && (
            <div className="qm-editor" style={{ marginBottom: 16 }}>
              <div className="qm-editor-header">
                <strong>Log CPD Activity</strong>
                <button className="icon-btn" onClick={() => setShowCpdForm(false)}>×</button>
              </div>
              <div className="qm-form-grid">
                {[
                  { label: 'Date', key: 'date', type: 'date' },
                  { label: 'Hours', key: 'hours', type: 'number' },
                  { label: 'Title / Activity', key: 'title', type: 'text' },
                  { label: 'Provider / Institution', key: 'provider', type: 'text' },
                ].map(({ label, key, type }) => (
                  <div key={key} className="qm-form-row">
                    <label>{label}</label>
                    <input type={type} value={newCpd[key]} onChange={(e) => setNewCpd((p) => ({ ...p, [key]: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 12px' }} />
                  </div>
                ))}
                <div className="qm-form-row">
                  <label>Category</label>
                  <select value={newCpd.category} onChange={(e) => setNewCpd((p) => ({ ...p, category: e.target.value }))} style={{ height: 38, borderRadius: 8, border: '1px solid #dbe6e4', padding: '0 10px' }}>
                    {CPD_CATEGORIES.map((c) => <option key={c.category}>{c.category}</option>)}
                  </select>
                </div>
              </div>
              <div className="editor-footer">
                <button className="ghost-btn" onClick={() => setShowCpdForm(false)}>Cancel</button>
                <button className="primary-btn" onClick={addCpd} disabled={!newCpd.title || !newCpd.hours || !newCpd.date}>Save Activity</button>
              </div>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <div style={{ width: '100%', background: '#dbe6e4', borderRadius: 8, height: 12, marginBottom: 8 }}>
              <div style={{ width: `${Math.min(100, (totalCpdHours / 30) * 100)}%`, background: 'linear-gradient(90deg, #29b7a3, #2b8a7d)', height: '100%', borderRadius: 8, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#607478' }}>{totalCpdHours} / 30 hours completed for this renewal cycle</div>
          </div>

          <table className="admin-table">
            <thead>
              <tr><th>Date</th><th>Activity</th><th>Category</th><th>Provider</th><th>Hours</th></tr>
            </thead>
            <tbody>
              {cpdEntries.map((entry) => {
                const cat = CPD_CATEGORIES.find((c) => c.category === entry.category);
                return (
                  <tr key={entry.id}>
                    <td style={{ color: '#607478', fontSize: '0.84rem' }}>{entry.date}</td>
                    <td><strong style={{ fontSize: '0.88rem' }}>{entry.title}</strong></td>
                    <td><span style={{ fontSize: '0.76rem', fontWeight: 700, background: `${cat?.color ?? '#8a999c'}18`, color: cat?.color ?? '#8a999c', padding: '2px 8px', borderRadius: 12 }}>{entry.category}</span></td>
                    <td style={{ fontSize: '0.84rem', color: '#607478' }}>{entry.provider || '—'}</td>
                    <td><strong style={{ color: '#29b7a3' }}>{entry.hours}h</strong></td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
            <strong style={{ fontSize: '0.9rem', color: '#17212f' }}>CPD Categories</strong>
            {CPD_CATEGORIES.map((cat) => (
              <div key={cat.category} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 12px', borderLeft: `3px solid ${cat.color}`, background: '#f8fafb', borderRadius: '0 8px 8px 0', fontSize: '0.84rem' }}>
                <strong style={{ color: cat.color, whiteSpace: 'nowrap' }}>{cat.category}</strong>
                <span style={{ color: '#607478' }}>{cat.examples}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clinical Skills Guide */}
      {tab === 'clinical-skills' && (
        <div>
          <div style={{ padding: '12px 16px', background: '#e9f1ef', borderRadius: 10, fontSize: '0.85rem', color: '#135f55', marginBottom: 16, lineHeight: 1.6 }}>
            <strong>Clinical skills review</strong> helps students organize hands-on nursing skills, safe sequencing, patient communication, and documentation.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {CLINICAL_SKILL_STATIONS.map((station) => (
              <div key={station.station} style={{ border: '1.5px solid #dbe6e4', borderLeft: `4px solid ${station.color}`, borderRadius: 12, padding: '14px 16px', background: '#fff' }}>
                <strong style={{ display: 'block', marginBottom: 10, color: station.color, fontSize: '0.96rem' }}>{station.station}</strong>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 5 }}>
                  {station.skills.map((skill) => (
                    <li key={skill} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.84rem', color: '#42585e' }}>
                      <CheckCircle2 size={13} color={station.color} style={{ flexShrink: 0, marginTop: 2 }} />
                      {skill}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, padding: '14px 16px', background: '#fff', border: '1.5px solid #dbe6e4', borderRadius: 12 }}>
            <strong style={{ display: 'block', marginBottom: 8, color: '#17212f' }}>General Clinical Skills Tips</strong>
            <div style={{ display: 'grid', gap: 5 }}>
              {[
                'Introduce yourself and verify patient identity (name + DOB) at every station',
                'State what you are doing: "I am now going to check your blood pressure"',
                'Wash hands / use gel at START and END of every station',
                'If you forget a step, calmly continue — do not panic',
                'Time management: glance at the clock halfway through',
                'Document clearly and completely — examiners check your notes',
              ].map((tip) => (
                <div key={tip} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.85rem', color: '#42585e' }}>
                  <CheckCircle2 size={13} color="#29b7a3" style={{ flexShrink: 0, marginTop: 3 }} />
                  {tip}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
