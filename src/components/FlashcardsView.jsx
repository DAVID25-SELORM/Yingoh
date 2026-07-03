import React, { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Brain, ChevronLeft, ChevronRight, RefreshCw, RotateCcw } from 'lucide-react';
import {
  getFlashcardDecks, getFlashcardsForDeck, getUserFlashcardProgress,
  saveItem, sm2, upsertFlashcardProgress,
} from '../services/supabase';
import { useSubscription } from '../hooks/useSubscription';

const DEMO_DECKS = [
  { id: 'demo-pharm', name: 'NCLEX Pharmacology Essentials', topic: 'Pharmacology', card_count: 15 },
  { id: 'demo-labs', name: 'Critical Lab Values', topic: 'Lab Values', card_count: 10 },
  { id: 'demo-disease', name: 'Disease Processes & Patho', topic: 'Cardiovascular', card_count: 5 },
];

const DEMO_CARDS = {
  'demo-pharm': [
    { id: 'p1', front: 'Digoxin', back: 'Class: Cardiac glycoside\nMOA: Inhibits Na/K-ATPase → ↑ contractility; slows HR\nTherapeutic level: 0.5–2.0 ng/mL\nSide effects: Bradycardia, yellow-green halos, N/V\nNursing: Hold if apical HR <60; monitor K+\nAntidote: Digibind' },
    { id: 'p2', front: 'Furosemide (Lasix)', back: 'Class: Loop diuretic\nMOA: Inhibits Na-K-2Cl in Loop of Henle\nSide effects: Hypokalemia, dehydration, ototoxicity\nNursing: Monitor K+, BMP; slow IV push' },
    { id: 'p3', front: 'Warfarin (Coumadin)', back: 'Class: Vitamin K antagonist\nMonitor: PT/INR (goal 2–3; valves 2.5–3.5)\nAntidote: Vitamin K (slow) or FFP (fast)\nTeach: Consistent vitamin K diet; many drug interactions' },
    { id: 'p4', front: 'Heparin', back: 'MOA: Binds antithrombin III → inactivates thrombin & Xa\nMonitor: aPTT (60–100 sec), platelets (HIT day 5–10)\nAntidote: Protamine sulfate\nNursing: NEVER massage injection site; rotate abdominal sites' },
    { id: 'p5', front: 'Metformin', back: 'Class: Biguanide antidiabetic\nContraindications: CrCl <30, IV contrast (hold 48h), hepatic disease\nSide effects: GI upset, lactic acidosis (rare)\nNo hypoglycemia risk as monotherapy' },
    { id: 'p6', front: 'Lisinopril (ACE Inhibitor)', back: 'MOA: Blocks angiotensin I→II → vasodilation\nUse: HTN, HF, diabetic nephropathy, post-MI\nSide effects: Dry cough (most common D/C), hyperkalemia, angioedema\nContraindications: Pregnancy, prior angioedema' },
    { id: 'p7', front: 'Morphine Sulfate', back: 'Class: Opioid (mu-receptor agonist)\nPriority side effect: RESPIRATORY DEPRESSION\nAntidote: Naloxone (Narcan)\nNursing: Assess RR BEFORE giving; have naloxone + resuscitation at bedside' },
    { id: 'p8', front: 'Amiodarone', back: 'Class: Class III antidysrhythmic\nUse: V-fib, V-tach, atrial fibrillation\nSide effects: Pulmonary toxicity, thyroid dysfunction, hepatotoxicity, corneal deposits, blue-gray skin\nMonitor: PFTs, LFTs, TFTs' },
    { id: 'p9', front: 'Albuterol (SABA)', back: 'Class: Short-acting beta-2 agonist\nOnset: 5–15 min (rescue)\nSide effects: Tachycardia, tremors, hypokalemia\nUse before corticosteroid inhaler (opens airways first)' },
    { id: 'p10', front: 'Vancomycin', back: 'Class: Glycopeptide antibiotic — MRSA coverage\nSide effects: Red man syndrome (rapid infusion), nephrotoxicity, ototoxicity\nMonitor: Trough levels (15–20 mcg/mL); BMP; hearing\nInfuse over ≥60 minutes' },
    { id: 'p11', front: 'Insulin: Types & Timing', back: 'Rapid (Lispro/Aspart): Onset 15 min — give BEFORE meals\nRegular: Onset 30–60 min — give 30 min before meals\nNPH: Peak 6–12 hr — watch overnight hypoglycemia\nGlargine/Detemir: No peak, 24 hr — do NOT mix\nHIGH-ALERT: 2-nurse verification always' },
    { id: 'p12', front: 'Potassium Chloride IV', back: 'NEVER give IV push → cardiac arrest!\nMax rate: 10 mEq/hr peripheral, 20 mEq/hr central\nAlways on cardiac monitor\nCheck urine output before giving\nHIGH-ALERT: 2-nurse verification' },
    { id: 'p13', front: 'Metoprolol (Beta-blocker)', back: 'Class: Cardioselective beta-1 blocker\nHold if HR <60, BP <90/60, heart block\nDo NOT abruptly discontinue (rebound tachycardia)\nMasks hypoglycemia symptoms in diabetics' },
    { id: 'p14', front: 'Levothyroxine (Synthroid)', back: 'Take on EMPTY STOMACH 30–60 min before breakfast\nDo NOT take with calcium, iron, antacids\nTakes 6–8 weeks for full effect\nMonitor TSH (goal 0.4–4.0 mIU/L)' },
    { id: 'p15', front: 'Aspirin', back: 'Antiplatelet dose: 81–325 mg/day\nMOA: Irreversibly inhibits COX-1 and COX-2\nSide effects: GI irritation/bleeding, tinnitus (toxicity)\nContraindication: Children with viral illness (Reye syndrome)' },
  ],
  'demo-labs': [
    { id: 'l1', front: 'Normal Sodium (Na+)', back: 'Normal: 135–145 mEq/L\nHyponatremia (<135): Confusion, seizures, cerebral edema\nHypernatremia (>145): Thirst, restlessness, ↓ LOC\nRaise Na SLOWLY to avoid central pontine myelinolysis' },
    { id: 'l2', front: 'Normal Potassium (K+)', back: 'Normal: 3.5–5.0 mEq/L\nCritical low: <2.5 | Critical high: >6.0\nHypoK: Muscle weakness, flattened T waves, U waves\nHyperK: Peaked T waves, widened QRS, bradycardia → cardiac arrest' },
    { id: 'l3', front: 'ABG Interpretation Steps', back: 'pH: <7.35 acidosis | >7.45 alkalosis\nPaCO2: >45 resp acidosis | <35 resp alkalosis\nHCO3: <22 met acidosis | >26 met alkalosis\nROME: Respiratory Opposite, Metabolic Equal' },
    { id: 'l4', front: 'Therapeutic INR Range', back: 'DVT/PE, Afib: 2.0–3.0\nMechanical heart valves: 2.5–3.5\nHigh INR >4: Give vitamin K (oral/IV)\nCritical INR >5: FFP or 4-factor PCC' },
    { id: 'l5', front: 'Blood Glucose Critical Values', back: 'Normal fasting: 70–100 mg/dL\nHypoglycemia: <70 → symptoms appear <50\nTreatment: 15g carbs, recheck in 15 min\nUnresponsive: D50 IV or glucagon IM\nHyperglycemic crisis: >500 (DKA or HHS)' },
    { id: 'l6', front: 'Troponin — MI Marker', back: 'Rises: 3–6 hours post-MI\nPeaks: 12–24 hours\nReturns to normal: 5–10 days\nhsTnI detectable in 1–3 hours\nElevated → 12-lead ECG, aspirin, IV access, cardiac monitor' },
    { id: 'l7', front: 'Normal Creatinine & GFR', back: 'Creatinine normal: 0.6–1.2 mg/dL\neGFR >90: Normal | 60–89: Mild ↓\n30–59: Moderate CKD | 15–29: Severe CKD\n<15: Kidney failure → dialysis\nBest indicator of renal function' },
    { id: 'l8', front: 'Critical Hemoglobin Values', back: 'Men: 13.5–17.5 g/dL | Women: 12–15.5 g/dL\nCritical low: <7 g/dL → transfusion considered\nHematocrit = Hgb × 3 (rule of 3)\nPlatelets <20,000: Spontaneous bleeding precautions' },
    { id: 'l9', front: 'Normal Calcium (Ca²⁺)', back: 'Normal: 8.5–10.5 mg/dL\nHypocalcemia: Chvostek sign (+), Trousseau sign (+), tetany, seizures\nCauses: Post-thyroidectomy, hypoparathyroidism\nTreatment: IV calcium gluconate\nHypercalcemia: "Bones, stones, groans, moans"' },
    { id: 'l10', front: 'Magnesium & Mag Sulfate Toxicity', back: 'Normal Mg: 1.5–2.5 mEq/L\nFirst sign of toxicity: Loss of deep tendon reflexes (>4 mEq/L)\nRespiratory depression: >6–7 mEq/L → HOLD Mag\nAntidote: Calcium gluconate 1g IV\nKeep at bedside for ALL patients on mag sulfate' },
  ],
  'demo-disease': [
    { id: 'd1', front: 'Acute MI Priority Interventions', back: 'MONA: Morphine, Oxygen (if SpO2 <90%), Nitrates, Aspirin\nGoal: Door-to-balloon <90 min (PCI) or <30 min (thrombolytics)\nECG changes: ST elevation (STEMI) or depression (NSTEMI)\nMonitor: Troponin, cardiac rhythm, vital signs q15-30 min' },
    { id: 'd2', front: 'Heart Failure: Left vs Right', back: 'Left HF → pulmonary: dyspnea, orthopnea, crackles, pink frothy sputum\nRight HF → systemic: JVD, peripheral edema, hepatomegaly, ascites\nAssess: Daily weights (>2-3 lb gain = notify provider)\nTreatment: ACE inhibitors, beta-blockers, diuretics' },
    { id: 'd3', front: 'DKA vs HHS', back: 'DKA: Type 1, BG >250, ketones YES, pH <7.35, anion gap high\nHHS: Type 2 elderly, BG >600, ketones MINIMAL, extreme dehydration\nBoth: IV fluids first → then insulin → then K+ replacement\nDKA: Kussmaul respirations, fruity breath' },
    { id: 'd4', front: 'Stroke Priority Actions', back: 'FAST: Face drooping, Arm weakness, Speech difficulty, Time to call 911\ntPA window: 3–4.5 hours (ischemic only)\nContraindications to tPA: Hemorrhagic stroke, BP >185/110, recent surgery\nNIH Stroke Scale: Assess deficits; neurological checks q1-2h' },
    { id: 'd5', front: 'Sepsis Hour-1 Bundle', back: '1. Blood cultures ×2 (before antibiotics)\n2. Broad-spectrum antibiotics ASAP\n3. 30 mL/kg IV crystalloid if hypotensive\n4. Vasopressors (norepinephrine 1st line) if MAP <65\n5. Lactate level\nSeptic shock = sepsis + vasopressors needed + lactate >2' },
  ],
};

const QUALITY_BUTTONS = [
  { label: 'Again', value: 0, color: '#e85d4f', desc: 'Forgot completely' },
  { label: 'Hard', value: 3, color: '#e3a72f', desc: 'Recalled with effort' },
  { label: 'Good', value: 4, color: '#29b7a3', desc: 'Recalled correctly' },
  { label: 'Easy', value: 5, color: '#135f55', desc: 'Perfect recall' },
];

export default function FlashcardsView({ session }) {
  const subscription = useSubscription(session);
  const [decks, setDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [progress, setProgress] = useState({});
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionResults, setSessionResults] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [done, setDone] = useState(false);
  const [savedCards, setSavedCards] = useState(new Set());

  const userId = session?.user?.id;

  useEffect(() => {
    getFlashcardDecks().then(({ data }) => {
      setDecks(data?.length ? data : DEMO_DECKS);
    });
  }, []);

  async function loadDeck(deck) {
    setSelectedDeck(deck);
    setIndex(0);
    setFlipped(false);
    setDone(false);
    setSessionResults({ again: 0, hard: 0, good: 0, easy: 0 });

    const { data: cardData } = await getFlashcardsForDeck(deck.id);
    const demoAccessibleIds = Object.values(DEMO_CARDS).flat().slice(0, subscription.entitlements.flashcardLimit).map((item) => item.id);
    const fallbackCards = (DEMO_CARDS[deck.id] ?? []).filter((item) => demoAccessibleIds.includes(item.id));
    const deckCards = cardData?.length ? cardData : fallbackCards;
    setCards(deckCards);

    if (userId) {
      const { data: progData } = await getUserFlashcardProgress(userId, deck.id);
      const map = {};
      (progData ?? []).forEach((p) => { map[p.flashcard_id] = p; });
      setProgress(map);
    }
  }

  async function handleQuality(quality) {
    const card = cards[index];
    const prog = progress[card.id] ?? { ease_factor: 2.5, interval_days: 0, repetitions: 0 };
    const result = sm2(quality, prog.repetitions, prog.ease_factor, prog.interval_days);
    const nextReview = new Date(Date.now() + result.intervalDays * 86400000).toISOString();

    const label = QUALITY_BUTTONS.find((b) => b.value === quality)?.label.toLowerCase();
    setSessionResults((prev) => ({ ...prev, [label]: prev[label] + 1 }));

    if (userId) {
      await upsertFlashcardProgress(userId, card.id, result.easeFactor, result.intervalDays, result.repetitions, nextReview);
    }

    setProgress((prev) => ({
      ...prev,
      [card.id]: { ...prog, ease_factor: result.easeFactor, interval_days: result.intervalDays, repetitions: result.repetitions },
    }));

    if (index + 1 >= cards.length) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
      setFlipped(false);
    }
  }

  async function saveCurrentCard() {
    if (!userId || !card) return;
    const { error } = await saveItem(userId, {
      item_type: 'flashcard',
      item_id: card.id,
      title: card.front,
      summary: card.back?.slice(0, 220),
      metadata: { deck_id: selectedDeck.id, deck_name: selectedDeck.name },
    });
    if (!error) setSavedCards((prev) => new Set([...prev, card.id]));
  }

  if (!selectedDeck) {
    return (
      <section className="content-band">
        <div className="section-title"><h2>Flashcard Decks</h2><Brain size={22} /></div>
        <p style={{ color: '#607478', marginTop: 0 }}>
          Spaced repetition powered by the SM-2 algorithm. Cards you struggle with appear more frequently.
        </p>
        <div className="deck-grid">
          {decks.map((deck) => (
            <button key={deck.id} className="deck-card" onClick={() => loadDeck(deck)}>
              <span className="deck-topic">{deck.topic}</span>
              <strong>{deck.name}</strong>
              <span className="deck-count">{deck.card_count} cards</span>
              <span className="deck-cta">Study now <ChevronRight size={14} /></span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (done) {
    const total = sessionResults.again + sessionResults.hard + sessionResults.good + sessionResults.easy;
    const mastered = sessionResults.good + sessionResults.easy;
    return (
      <section className="content-band">
        <div style={{ textAlign: 'center', padding: '32px 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🎉</div>
          <h2>Session Complete!</h2>
          <p style={{ color: '#607478' }}>{total} cards reviewed from <em>{selectedDeck.name}</em></p>
          <div className="flashcard-summary">
            {QUALITY_BUTTONS.map((b) => (
              <div key={b.label} className="fc-summary-item" style={{ borderColor: b.color }}>
                <strong style={{ color: b.color }}>{sessionResults[b.label.toLowerCase()]}</strong>
                <span>{b.label}</span>
              </div>
            ))}
          </div>
          <p style={{ color: '#135f55', fontWeight: 700 }}>
            {mastered}/{total} cards mastered this session ({total ? Math.round((mastered / total) * 100) : 0}%)
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
            <button className="ghost-btn" onClick={() => loadDeck(selectedDeck)}>
              <RefreshCw size={16} /> Study again
            </button>
            <button className="primary-btn" onClick={() => setSelectedDeck(null)}>
              <ChevronLeft size={16} /> All decks
            </button>
          </div>
        </div>
      </section>
    );
  }

  const card = cards[index];

  return (
    <section className="content-band">
      <div className="flashcard-header">
        <button className="ghost-btn" onClick={() => setSelectedDeck(null)}>
          <ChevronLeft size={16} /> Decks
        </button>
        <div style={{ textAlign: 'center' }}>
          <strong>{selectedDeck.name}</strong>
          <div style={{ color: '#607478', fontSize: '0.85rem' }}>{index + 1} / {cards.length}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="icon-btn" onClick={saveCurrentCard} disabled={!userId} title={userId ? 'Save flashcard' : 'Sign in to save'}>
            {savedCards.has(card?.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </button>
          <div className="progress-track" style={{ width: 120, height: 6 }}>
            <span style={{ width: `${((index) / cards.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Flashcard */}
      <div className={`flashcard-scene ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        <div className="flashcard-card">
          <div className="flashcard-front">
            <div className="flashcard-side-label">TERM</div>
            <div className="flashcard-front-text">{card?.front}</div>
            <div className="flashcard-hint">Click to reveal</div>
          </div>
          <div className="flashcard-back">
            <div className="flashcard-side-label">ANSWER</div>
            <pre className="flashcard-back-text">{card?.back}</pre>
          </div>
        </div>
      </div>

      {!flipped ? (
        <div style={{ textAlign: 'center', color: '#607478', fontSize: '0.9rem', marginTop: 10 }}>
          Click the card to flip it
        </div>
      ) : (
        <div className="flashcard-rating">
          <div style={{ textAlign: 'center', color: '#607478', fontSize: '0.88rem', marginBottom: 12 }}>
            How well did you recall this?
          </div>
          <div className="rating-buttons">
            {QUALITY_BUTTONS.map((btn) => (
              <button
                key={btn.value}
                className="rating-btn"
                style={{ '--rb-color': btn.color }}
                onClick={() => handleQuality(btn.value)}
              >
                <strong>{btn.label}</strong>
                <span>{btn.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 16 }}>
        <button className="ghost-btn" onClick={() => { setIndex((i) => Math.max(0, i - 1)); setFlipped(false); }} disabled={index === 0}>
          <ChevronLeft size={16} />
        </button>
        <button className="ghost-btn" onClick={() => setFlipped((f) => !f)}>
          <RotateCcw size={16} /> {flipped ? 'Back' : 'Flip'}
        </button>
      </div>
    </section>
  );
}

