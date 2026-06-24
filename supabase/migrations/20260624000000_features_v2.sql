-- Features V2: Bookmarks, Flashcards, Exam Sessions, Notebooks, Study Plans
-- Plus seeded NCLEX questions and pharmacology flashcard decks

-- Question bookmarks
create table if not exists public.question_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, question_id)
);

-- Flashcard decks
create table if not exists public.flashcard_decks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  topic text not null,
  description text,
  card_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Flashcards
create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.flashcard_decks(id) on delete cascade,
  front text not null,
  back text not null,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

-- Per-user SM-2 spaced repetition progress
create table if not exists public.user_flashcard_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  flashcard_id uuid not null references public.flashcards(id) on delete cascade,
  ease_factor numeric not null default 2.5,
  interval_days integer not null default 0,
  repetitions integer not null default 0,
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  unique(user_id, flashcard_id)
);

-- Exam sessions (practice, timed, CAT, assessment)
create table if not exists public.exam_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'practice',
  status text not null default 'active',
  question_ids jsonb not null default '[]'::jsonb,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  score_pct numeric,
  pass_probability numeric,
  time_limit_seconds integer,
  time_used_seconds integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

-- Individual answers within an exam session
create table if not exists public.exam_session_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.exam_sessions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  answer jsonb not null default '{}'::jsonb,
  is_correct boolean,
  time_taken_seconds integer,
  created_at timestamptz not null default now()
);

-- Digital notebook (notes per question or free-form)
create table if not exists public.notebooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  title text,
  content text not null default '',
  topic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Study plans
create table if not exists public.study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exam_date date not null,
  daily_question_target integer not null default 25,
  weak_topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- RLS
alter table public.question_bookmarks enable row level security;
alter table public.flashcard_decks enable row level security;
alter table public.flashcards enable row level security;
alter table public.user_flashcard_progress enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.exam_session_answers enable row level security;
alter table public.notebooks enable row level security;
alter table public.study_plans enable row level security;

create policy "bookmarks_own" on public.question_bookmarks for all using (auth.uid() = user_id);
create policy "decks_read" on public.flashcard_decks for select to authenticated using (true);
create policy "flashcards_read" on public.flashcards for select to authenticated using (true);
create policy "progress_own" on public.user_flashcard_progress for all using (auth.uid() = user_id);
create policy "sessions_own" on public.exam_sessions for all using (auth.uid() = user_id);
create policy "session_answers_own" on public.exam_session_answers for all using (
  exists (select 1 from public.exam_sessions where id = session_id and user_id = auth.uid())
);
create policy "notebooks_own" on public.notebooks for all using (auth.uid() = user_id);
create policy "study_plans_own" on public.study_plans for all using (auth.uid() = user_id);

-- Grants
grant select, insert, delete on public.question_bookmarks to authenticated;
grant select on public.flashcard_decks to authenticated;
grant select on public.flashcards to authenticated;
grant select, insert, update on public.user_flashcard_progress to authenticated;
grant select, insert, update on public.exam_sessions to authenticated;
grant select, insert on public.exam_session_answers to authenticated;
grant select, insert, update, delete on public.notebooks to authenticated;
grant select, insert, update on public.study_plans to authenticated;

-- ============================================================
-- SEED: 20 NCLEX questions
-- ============================================================
insert into public.questions (topic, question_type, prompt, choices, correct_answer, rationale, status) values
(
  'Pharmacology','mcq',
  'A nurse is administering metformin to a patient with type 2 diabetes. Which laboratory finding should the nurse report to the provider immediately before giving this medication?',
  '[{"id":"a","text":"Blood glucose of 180 mg/dL"},{"id":"b","text":"Serum creatinine of 2.8 mg/dL"},{"id":"c","text":"HbA1c of 7.2%"},{"id":"d","text":"Blood pressure of 130/82 mmHg"}]',
  '{"ids":["b"]}',
  'Metformin is contraindicated with significant renal impairment (creatinine >1.4 in women, >1.5 in men) due to the risk of lactic acidosis. A creatinine of 2.8 mg/dL requires holding the medication and notifying the provider.',
  'published'
),
(
  'Safety and Infection Control','sata',
  'A nurse is caring for a patient with Clostridioides difficile (C. diff) colitis. Which actions are appropriate? (Select all that apply)',
  '[{"id":"a","text":"Wear gloves when entering the room"},{"id":"b","text":"Use alcohol-based hand rub after removing gloves"},{"id":"c","text":"Wear a gown when entering the room"},{"id":"d","text":"Wash hands with soap and water"},{"id":"e","text":"Place patient in a negative pressure room"},{"id":"f","text":"Wear an N95 respirator"}]',
  '{"ids":["a","c","d"]}',
  'C. diff requires contact precautions: gown and gloves. Critically, alcohol-based hand rubs do NOT kill C. diff spores — soap and water is required. Negative pressure rooms and N95s are for airborne precautions, not C. diff.',
  'published'
),
(
  'Maternal and Newborn','mcq',
  'A nurse calculates an APGAR score at 5 minutes. The newborn has HR 110/min, slow irregular respirations, some extremity flexion, grimace to stimulation, and acrocyanosis. What is the APGAR score?',
  '[{"id":"a","text":"4"},{"id":"b","text":"5"},{"id":"c","text":"6"},{"id":"d","text":"7"}]',
  '{"ids":["b"]}',
  'HR >100 = 2, Respiratory slow/irregular = 1, Muscle tone some flexion = 1, Reflex grimace = 1, Color acrocyanosis = 0. Total = 5. Scores 4–6 indicate moderate depression requiring stimulation.',
  'published'
),
(
  'NGN Case Studies','sata',
  'A nurse assesses a patient 12 hours post-abdominal surgery: T 38.9°C, HR 102, BP 118/76, SpO2 95%, urine output 20 mL over 2 hours. Which findings require immediate intervention? (Select all that apply)',
  '[{"id":"a","text":"Temperature 38.9°C"},{"id":"b","text":"Heart rate 102"},{"id":"c","text":"Urine output 20 mL over 2 hours"},{"id":"d","text":"SpO2 95%"},{"id":"e","text":"Respiratory rate 22"},{"id":"f","text":"Blood pressure 118/76"}]',
  '{"ids":["a","c"]}',
  'Post-op day 0–1 fever (atelectasis) requires incentive spirometry and deep breathing. Urine output 20 mL/2 hr = 10 mL/hr — below the 30 mL/hr minimum, indicating oliguria. Other values are acceptable post-operatively.',
  'published'
),
(
  'Pharmacology','mcq',
  'A nurse is preparing to administer digoxin. Which finding should cause the nurse to withhold the medication and contact the provider?',
  '[{"id":"a","text":"Apical pulse of 56 beats per minute"},{"id":"b","text":"Blood pressure of 118/72 mmHg"},{"id":"c","text":"Serum potassium of 4.1 mEq/L"},{"id":"d","text":"Serum digoxin level of 0.8 ng/mL"}]',
  '{"ids":["a"]}',
  'Withhold digoxin if apical pulse <60 bpm and notify the provider. Digoxin is a negative chronotrope; giving it with a rate of 56 could cause dangerous bradycardia or heart block. Other values are within normal limits.',
  'published'
),
(
  'Medical-Surgical','sata',
  'A nurse is caring for a patient with diabetic ketoacidosis (DKA). Which clinical findings are consistent with this diagnosis? (Select all that apply)',
  '[{"id":"a","text":"Kussmaul respirations"},{"id":"b","text":"Blood glucose 520 mg/dL"},{"id":"c","text":"Fruity breath odor"},{"id":"d","text":"Bradycardia"},{"id":"e","text":"Polyuria and polydipsia"},{"id":"f","text":"Diaphoresis and pallor"}]',
  '{"ids":["a","b","c","e"]}',
  'DKA: Kussmaul respirations (compensation for metabolic acidosis), hyperglycemia >250 mg/dL, fruity/acetone breath (ketones), polyuria and polydipsia. Bradycardia and diaphoresis/pallor are not DKA findings — tachycardia is expected from dehydration; pallor/diaphoresis indicate hypoglycemia.',
  'published'
),
(
  'Mental Health','mcq',
  'A patient is prescribed lithium carbonate for bipolar disorder. Which serum level indicates toxicity requiring immediate intervention?',
  '[{"id":"a","text":"0.6 mEq/L"},{"id":"b","text":"0.9 mEq/L"},{"id":"c","text":"1.2 mEq/L"},{"id":"d","text":"2.1 mEq/L"}]',
  '{"ids":["d"]}',
  'Therapeutic lithium range is 0.6–1.2 mEq/L. Levels >1.5 indicate toxicity; >2.0 is severe toxicity requiring emergency treatment including IV fluids and possible hemodialysis.',
  'published'
),
(
  'Pediatrics','mcq',
  'A nurse is assessing an 18-month-old child. Which developmental milestone should the nurse expect?',
  '[{"id":"a","text":"Speaking in 4–5 word sentences"},{"id":"b","text":"Walking up stairs with alternating feet"},{"id":"c","text":"Using a spoon and cup with some spilling"},{"id":"d","text":"Drawing a circle"}]',
  '{"ids":["c"]}',
  'At 18 months, toddlers use a spoon and cup with some spilling. Four-to-five word sentences, stair-climbing with alternating feet, and drawing circles are ~3-year milestones. Vocabulary at 18 months is typically 10–20 words.',
  'published'
),
(
  'Medical-Surgical','sata',
  'A nurse teaches a patient prescribed warfarin. Which foods should be eaten in consistent amounts because they may decrease warfarin effectiveness? (Select all that apply)',
  '[{"id":"a","text":"Spinach"},{"id":"b","text":"Kale"},{"id":"c","text":"Grapefruit"},{"id":"d","text":"Broccoli"},{"id":"e","text":"Bananas"},{"id":"f","text":"Brussels sprouts"}]',
  '{"ids":["a","b","d","f"]}',
  'Vitamin K antagonizes warfarin. High vitamin K foods include spinach, kale, broccoli, and Brussels sprouts. Patients should eat these consistently, not avoid them, to maintain stable INR. Grapefruit affects CYP3A4 (not warfarin significantly); bananas are not a concern.',
  'published'
),
(
  'Pharmacology','mcq',
  'A nurse is administering morphine sulfate IV post-operatively. Which equipment must be at the bedside before administering?',
  '[{"id":"a","text":"Blood pressure cuff and stethoscope"},{"id":"b","text":"Naloxone and resuscitation equipment"},{"id":"c","text":"Blood glucose monitor"},{"id":"d","text":"IV calcium gluconate"}]',
  '{"ids":["b"]}',
  'Before administering opioids, naloxone (Narcan) and resuscitation equipment must be available. Opioids can cause respiratory depression; naloxone reverses opioid effects and is the required antidote at bedside.',
  'published'
),
(
  'Safety and Infection Control','mcq',
  'A nurse is preparing to administer blood. Which action is the priority to prevent a transfusion reaction?',
  '[{"id":"a","text":"Prime IV tubing with normal saline"},{"id":"b","text":"Verify the blood product with another nurse at the bedside"},{"id":"c","text":"Check vital signs 15 minutes after starting"},{"id":"d","text":"Obtain IV access with an 18-gauge catheter"}]',
  '{"ids":["b"]}',
  'Two licensed nurses must verify blood type, unit number, expiration date, and patient ID at the bedside before transfusion. This verification is the priority action to prevent hemolytic transfusion reactions, the most dangerous complication.',
  'published'
),
(
  'Medical-Surgical','mcq',
  'A patient has a serum potassium of 2.8 mEq/L. Which assessment finding is most consistent with this result?',
  '[{"id":"a","text":"Muscle weakness and leg cramps"},{"id":"b","text":"Peaked T waves on ECG"},{"id":"c","text":"Bradycardia"},{"id":"d","text":"Paresthesias of the face"}]',
  '{"ids":["a"]}',
  'Hypokalemia (<3.5 mEq/L) causes muscle weakness, cramps, and fatigue. Peaked T waves and bradycardia are hyperkalemia signs. Facial paresthesias are associated with hypocalcemia. Hypokalemia ECG shows flattened T waves and U waves.',
  'published'
),
(
  'NGN Case Studies','sata',
  'A nurse reviews orders for a patient with acute heart failure. Which orders should be clarified before implementing? (Select all that apply)',
  '[{"id":"a","text":"0.9% NaCl 500 mL IV bolus over 1 hour"},{"id":"b","text":"Furosemide 40 mg IV push"},{"id":"c","text":"Restrict fluids to 1500 mL/day"},{"id":"d","text":"Morphine sulfate 2 mg IV PRN for air hunger"},{"id":"e","text":"High sodium diet"},{"id":"f","text":"Daily weights"}]',
  '{"ids":["a","e"]}',
  'IV saline bolus worsens fluid overload and pulmonary edema in acute HF. A high sodium diet exacerbates fluid retention. Furosemide, fluid restriction, morphine for dyspnea, and daily weights are all appropriate HF interventions.',
  'published'
),
(
  'Maternal and Newborn','sata',
  'A nurse assesses a patient in active labor. Which findings require immediate intervention? (Select all that apply)',
  '[{"id":"a","text":"Fetal heart rate of 90 bpm for 3 minutes"},{"id":"b","text":"Contractions every 3–4 minutes lasting 50 seconds"},{"id":"c","text":"Late decelerations on the fetal monitor"},{"id":"d","text":"Maternal blood pressure of 158/106 mmHg"},{"id":"e","text":"Cervical dilation of 7 cm"},{"id":"f","text":"Clear amniotic fluid"}]',
  '{"ids":["a","c","d"]}',
  'Fetal bradycardia <110 bpm for >3 min requires repositioning, O2, IV bolus, and provider notification. Late decelerations indicate uteroplacental insufficiency. BP 158/106 meets severe hypertension criteria in pregnancy — magnesium sulfate and provider notification are required immediately. Other findings are normal.',
  'published'
),
(
  'Leadership and Management','mcq',
  'A charge nurse is making shift assignments. Which patient should be assigned to the most experienced RN?',
  '[{"id":"a","text":"Patient with COPD requiring chest physiotherapy"},{"id":"b","text":"Patient with new colostomy requiring discharge teaching"},{"id":"c","text":"Patient with septic shock receiving vasopressors"},{"id":"d","text":"Patient with type 2 diabetes preparing for discharge"}]',
  '{"ids":["c"]}',
  'Match patient acuity to nurse competency. Septic shock with vasopressors requires complex hemodynamic monitoring, medication titration, and critical thinking — the most demanding assignment. Other patients have more predictable needs suitable for less experienced nurses.',
  'published'
),
(
  'Medical-Surgical','mcq',
  'A nurse assesses a patient 24 hours post-thyroidectomy. Which finding requires the most immediate action?',
  '[{"id":"a","text":"Serum calcium 7.2 mg/dL with positive Trousseau sign"},{"id":"b","text":"Hoarseness when speaking"},{"id":"c","text":"Incision pain rated 5/10"},{"id":"d","text":"Temperature of 37.8°C"}]',
  '{"ids":["a"]}',
  'Post-thyroidectomy hypocalcemia from parathyroid damage can progress to tetany, laryngospasm, and seizures. Calcium 7.2 mg/dL with positive Trousseau sign requires immediate IV calcium gluconate. Hoarseness from laryngeal nerve injury is concerning but less immediately life-threatening.',
  'published'
),
(
  'Mental Health','sata',
  'A patient is admitted after a suicide attempt. Which nursing interventions are appropriate? (Select all that apply)',
  '[{"id":"a","text":"Remove all potentially harmful items from the environment"},{"id":"b","text":"Maintain 1:1 supervision at all times"},{"id":"c","text":"Ask the patient directly about suicidal ideation"},{"id":"d","text":"Avoid discussing the attempt to prevent distress"},{"id":"e","text":"Establish a therapeutic nurse–patient relationship"},{"id":"f","text":"Document the patient''s statements and behaviors"}]',
  '{"ids":["a","b","c","e","f"]}',
  'Suicide precautions include environmental safety, 1:1 supervision, and direct assessment — asking directly does NOT increase risk. Therapeutic relationship and thorough documentation are essential. Avoiding discussion (D) is incorrect; therapeutic communication about triggers is important for treatment.',
  'published'
),
(
  'Pharmacology','sata',
  'A nurse is preparing to administer heparin subcutaneously. Which actions should the nurse take? (Select all that apply)',
  '[{"id":"a","text":"Verify the aPTT before administration"},{"id":"b","text":"Administer in the abdomen, rotating sites"},{"id":"c","text":"Massage the injection site after administration"},{"id":"d","text":"Have protamine sulfate available as an antidote"},{"id":"e","text":"Use a 1-inch 21-gauge needle"},{"id":"f","text":"Monitor platelet count for HIT"}]',
  '{"ids":["a","b","d","f"]}',
  'Monitor aPTT (goal 60–100 sec); rotate abdominal sites; keep protamine sulfate (antidote) available; monitor platelets for HIT (day 5–10 drop). Do NOT massage (causes bruising). Use 5/8-inch, 25–27 gauge needle for subcutaneous injection, not 1-inch 21-gauge.',
  'published'
),
(
  'Medical-Surgical','mcq',
  'A patient with a bowel obstruction has an NG tube on low intermittent suction. Labs: Na 138, K 2.9, Cl 88, HCO3 32. Which acid-base imbalance is present?',
  '[{"id":"a","text":"Metabolic acidosis"},{"id":"b","text":"Metabolic alkalosis"},{"id":"c","text":"Respiratory acidosis"},{"id":"d","text":"Respiratory alkalosis"}]',
  '{"ids":["b"]}',
  'NG suction removes gastric HCl, causing loss of H+ and Cl−. Result: elevated HCO3 (32), low Cl (88), and hypokalemia (2.9) from renal compensation. This is metabolic alkalosis. Treatment includes KCl and chloride replacement.',
  'published'
),
(
  'Leadership and Management','sata',
  'A nurse is delegating tasks to unlicensed assistive personnel (UAP). Which tasks can be safely delegated? (Select all that apply)',
  '[{"id":"a","text":"Measuring and recording urinary output"},{"id":"b","text":"Assessing a patient who reports increased pain"},{"id":"c","text":"Obtaining vital signs on a stable patient"},{"id":"d","text":"Teaching a patient how to use an incentive spirometer"},{"id":"e","text":"Reporting urine output of 20 mL/hr to the nurse"},{"id":"f","text":"Ambulating a post-stroke patient independently"}]',
  '{"ids":["a","c","e"]}',
  'UAPs can measure and record I&O, obtain vital signs on stable patients, and report objective measurements. Assessment (pain evaluation), patient teaching, and ambulating post-stroke patients (requires nursing judgment) cannot be delegated to UAP.',
  'published'
);

-- ============================================================
-- SEED: Flashcard decks
-- ============================================================
insert into public.flashcard_decks (name, topic, description, card_count) values
  ('NCLEX Pharmacology Essentials', 'Pharmacology', 'High-yield drugs: mechanisms, side effects, nursing considerations', 15),
  ('Critical Lab Values', 'Lab Values', 'Normal ranges and critical values for essential labs', 10),
  ('Disease Processes & Patho', 'Medical-Surgical', 'Key diseases, pathophysiology, and priority interventions', 5);

-- Pharmacology flashcards
with deck as (select id from public.flashcard_decks where name = 'NCLEX Pharmacology Essentials' limit 1)
insert into public.flashcards (deck_id, front, back, tags)
select deck.id, front, back, tags from deck, (values
  ('Digoxin','Class: Cardiac glycoside\nMOA: Inhibits Na/K-ATPase → ↑ intracellular Ca → ↑ contractility; slows HR (vagal effect)\nUse: Heart failure, atrial fibrillation\nTherapeutic level: 0.5–2.0 ng/mL\nSide effects: Bradycardia, yellow-green visual halos, N/V, anorexia\nNursing: Hold if apical HR <60; monitor K+ (hypokalemia ↑ toxicity)\nAntidote: Digibind',ARRAY['cardiac']),
  ('Metformin (Glucophage)','Class: Biguanide antidiabetic\nMOA: ↓ hepatic glucose production; ↑ insulin sensitivity\nUse: Type 2 diabetes\nSide effects: GI upset, lactic acidosis (rare — serious)\nContraindications: CrCl <30, IV contrast (hold 48 h), hepatic disease, alcoholism\nNursing: Hold before IV contrast; monitor BMP; no hypoglycemia as monotherapy',ARRAY['diabetes']),
  ('Furosemide (Lasix)','Class: Loop diuretic\nMOA: Inhibits Na-K-2Cl in Loop of Henle → ↑ water, Na, K, Cl excretion\nUse: Edema, HF, hypertension, pulmonary edema\nSide effects: Hypokalemia, dehydration, ototoxicity (high IV doses)\nNursing: Monitor K+ and BMP; slow IV push to prevent ototoxicity; assess for muscle weakness',ARRAY['diuretic','cardiac']),
  ('Warfarin (Coumadin)','Class: Oral anticoagulant (vitamin K antagonist)\nMOA: Inhibits factors II, VII, IX, X\nMonitor: PT/INR (goal 2–3; mechanical valves 2.5–3.5)\nSide effects: Bleeding\nAntidote: Vitamin K (slow), FFP (fast), 4-factor PCC (fastest)\nTeach: Consistent vitamin K intake; many drug interactions; weekly INR until stable',ARRAY['anticoagulant']),
  ('Heparin','Class: Anticoagulant\nMOA: Binds antithrombin III → inactivates thrombin and factor Xa\nMonitor: aPTT (goal 60–100 sec), platelets (HIT day 5–10)\nSide effects: Bleeding, HIT (↓ platelets → paradoxical clots)\nAntidote: Protamine sulfate\nNursing: NEVER massage injection site; rotate abdominal sites; monitor for HIT',ARRAY['anticoagulant']),
  ('Lisinopril (ACE Inhibitor)','Class: ACE inhibitor — antihypertensive\nMOA: Blocks angiotensin I→II → vasodilation, ↓ aldosterone\nUse: HTN, HF, diabetic nephropathy, post-MI\nSide effects: Dry cough (most common D/C reason), hyperkalemia, angioedema (rare/life-threatening)\nContraindications: Pregnancy, bilateral renal artery stenosis, prior angioedema\nNursing: Monitor K+, BMP, BP; avoid NSAIDs',ARRAY['antihypertensive','cardiac']),
  ('Metoprolol (Beta-blocker)','Class: Cardioselective beta-1 blocker\nMOA: Blocks beta-1 receptors → ↓ HR, contractility, BP\nUse: HTN, angina, HF, atrial fibrillation, post-MI\nSide effects: Bradycardia, hypotension, fatigue, masks hypoglycemia signs\nContraindications: HR <60, heart block, cardiogenic shock\nNursing: Check apical pulse before giving; NEVER abruptly discontinue',ARRAY['beta-blocker','cardiac']),
  ('Amiodarone','Class: Class III antidysrhythmic\nMOA: Prolongs action potential and refractory period; class I/II/IV effects too\nUse: Life-threatening V-fib, V-tach, atrial fibrillation\nSide effects: Pulmonary toxicity (most serious), thyroid dysfunction, hepatotoxicity, corneal deposits, photosensitivity, blue-gray skin\nNursing: Monitor PFTs, LFTs, TFTs; sun protection; use in-line filter IV; half-life 40–55 days',ARRAY['antidysrhythmic','cardiac']),
  ('Morphine Sulfate','Class: Opioid analgesic (mu-receptor agonist)\nMOA: Binds opioid receptors → analgesia, sedation, ↓ preload\nUse: Severe pain, pulmonary edema, dyspnea in HF\nSide effects: RESPIRATORY DEPRESSION (priority), constipation, urinary retention, sedation\nAntidote: Naloxone (Narcan)\nNursing: Assess RR BEFORE giving; have naloxone + resuscitation at bedside',ARRAY['opioid','analgesic']),
  ('Vancomycin','Class: Glycopeptide antibiotic\nMOA: Inhibits cell wall synthesis (gram-positive)\nUse: MRSA, serious gram-positive infections, C. diff (oral only)\nSide effects: Red man syndrome (rapid infusion — not allergy), nephrotoxicity, ototoxicity\nMonitor: Trough levels (goal 15–20 mcg/mL); BMP; urine output; hearing\nNursing: Infuse over ≥60 minutes; monitor troughs',ARRAY['antibiotic']),
  ('Insulin — Types and Timing','Rapid-acting (Lispro/Aspart/Glulisine): Onset 15 min, Peak 1–2 hr → Give BEFORE meals\n\nShort-acting (Regular): Onset 30–60 min, Peak 2–4 hr → Give 30 min BEFORE meals\n\nIntermediate (NPH): Onset 1–2 hr, Peak 6–12 hr → Watch for overnight hypoglycemia\n\nLong-acting (Glargine/Detemir): Onset 1–2 hr, NO PEAK, 24 hr → Do NOT mix\n\nHIGH-ALERT: Always check with 2 nurses',ARRAY['insulin','diabetes','high-alert']),
  ('Potassium Chloride IV','Class: Electrolyte replacement\nNormal K+: 3.5–5.0 mEq/L\nCritical low: <2.5 mEq/L\n\nNURSING PRIORITIES:\n• NEVER give IV push → cardiac arrest risk\n• Dilute: max 10 mEq/hr peripheral, 20 mEq/hr central with monitoring\n• Always on cardiac monitor\n• Assess IV site (very irritating)\n• Check urine output first\n• HIGH-ALERT: verify with 2 nurses',ARRAY['electrolyte','high-alert']),
  ('Albuterol (SABA)','Class: Short-acting beta-2 agonist bronchodilator\nMOA: Beta-2 receptor activation → bronchial smooth muscle relaxation → bronchodilation\nOnset: 5–15 minutes (rescue)\nUse: Acute asthma/COPD, anaphylaxis; also used in hyperkalemia (shifts K+ into cells)\nSide effects: Tachycardia, tremors, hypokalemia, anxiety\nNursing: Shake inhaler; auscultate before/after; use before corticosteroid inhaler',ARRAY['respiratory','bronchodilator']),
  ('Levothyroxine (Synthroid)','Class: Thyroid hormone replacement (synthetic T4)\nUse: Hypothyroidism, myxedema coma\nSide effects of overtreatment: Tachycardia, angina, tremors, insomnia, weight loss\nMonitor: TSH (goal 0.4–4.0 mIU/L)\nNursing: Take on EMPTY STOMACH 30–60 min before breakfast; avoid calcium/iron/antacids (impair absorption); takes 6–8 weeks full effect',ARRAY['endocrine','thyroid']),
  ('Aspirin','Class: Salicylate — analgesic, antipyretic, anti-inflammatory, antiplatelet\nMOA: Irreversibly inhibits COX-1 and COX-2\nAntiplatelet dose: 81–325 mg/day\nUse: ACS, post-MI, stroke prevention, pain, fever\nSide effects: GI irritation/bleeding, tinnitus (toxicity), Reye syndrome in children\nContraindications: Children with viral illness, active GI bleed\nNursing: Give with food; hold 7–10 days before surgery',ARRAY['analgesic','antiplatelet','cardiac'])
) as t(front, back, tags);

-- Lab values flashcards
with deck as (select id from public.flashcard_decks where name = 'Critical Lab Values' limit 1)
insert into public.flashcards (deck_id, front, back, tags)
select deck.id, front, back, tags from deck, (values
  ('Sodium (Na+)','Normal: 135–145 mEq/L\n\nHyponatremia (<135):\n• S/S: Confusion, headache, seizures, cerebral edema\n• Treatment: Fluid restriction; raise Na SLOWLY to avoid central pontine myelinolysis\n\nHypernatremia (>145):\n• S/S: Thirst, dry mucous membranes, restlessness, ↓ LOC\n• Treatment: Free water replacement slowly',ARRAY['electrolyte','sodium']),
  ('Potassium (K+)','Normal: 3.5–5.0 mEq/L\n\nHypokalemia (<3.5; critical <2.5):\n• S/S: Muscle weakness, cramps, flattened T waves, U waves\n• Treatment: KCl replacement (NEVER IV push)\n\nHyperkalemia (>5.0; critical >6.0):\n• S/S: Peaked T waves, widened QRS, bradycardia, cardiac arrest\n• Treatment: Ca gluconate → insulin+glucose → Kayexalate → dialysis',ARRAY['electrolyte','potassium']),
  ('ABG Interpretation','pH: <7.35 Acidosis | 7.35–7.45 Normal | >7.45 Alkalosis\nPaCO2: >45 Resp Acidosis | 35–45 Normal | <35 Resp Alkalosis\nHCO3: <22 Met Acidosis | 22–26 Normal | >26 Met Alkalosis\n\nStep: Is CO2 or HCO3 moving with pH?\n• CO2 moves with pH change = Respiratory cause\n• HCO3 moves with pH change = Metabolic cause\n\nRemember ROME: Respiratory Opposite, Metabolic Equal',ARRAY['abg','acid-base']),
  ('INR / PT','PT normal: 11–13 seconds | INR normal: 0.8–1.1\n\nTherapeutic INR targets:\n• DVT/PE, Afib: 2.0–3.0\n• Mechanical valves: 2.5–3.5\n\nHigh INR management:\n• >3.0: Hold warfarin, assess for bleeding\n• >4.0: Vitamin K (slow) or FFP (fast)\n• >5.0: Emergency → FFP or 4-factor PCC',ARRAY['coagulation']),
  ('Blood Glucose — Diabetes','Fasting normal: 70–100 mg/dL\nPre-diabetes: 100–125 mg/dL\nDiabetes diagnosis: ≥126 mg/dL (×2)\n\nHbA1c: Normal <5.7% | Diabetic goal <7%\n\nHypoglycemia: <70 mg/dL\n• Treatment: 15g fast carbs, recheck in 15 min (15-15 rule)\n• Unresponsive: D50 IV or glucagon IM\n\nHyperglycemic crisis: >500 mg/dL → DKA or HHS',ARRAY['glucose','diabetes']),
  ('Troponin — Cardiac Markers','Troponin I: Rises 3–6 h post-MI, peaks 12–24 h, returns to normal 5–10 days\nhsTnI: Detectable in 1–3 hours\n\nCPK-MB: Rises 4–8 h, peaks 18–24 h, normal by 72 h\n(Early return to normal = reinfarction indicator)\n\nWith elevated troponin:\n1. 12-lead ECG immediately\n2. Aspirin (if no contraindication)\n3. IV access, O2 if SpO2 <90%\n4. Continuous cardiac monitoring',ARRAY['cardiac','MI']),
  ('BUN & Creatinine','BUN normal: 7–20 mg/dL\nCreatinine normal: 0.6–1.2 mg/dL\n\nBUN:Cr ratio >20:1 = pre-renal cause\n\neGFR stages:\n• >90: Normal\n• 60–89: Mild ↓\n• 30–59: Moderate CKD\n• 15–29: Severe CKD\n• <15: Kidney failure → dialysis\n\nCreatinine best indicator of renal function; rises LATE',ARRAY['renal']),
  ('CBC — Critical Values','Hemoglobin: Men 13.5–17.5 | Women 12–15.5 g/dL\n• Critical low <7 g/dL → transfusion considered\n\nHematocrit: Men 41–53% | Women 36–46%\nRule of 3: Hgb × 3 ≈ Hct\n\nPlatelets: 150,000–400,000/mm³\n• <100,000: Bleeding risk\n• <20,000: Spontaneous bleeding precautions\n\nWBC: 4,500–11,000/mm³\n• <1,000 neutrophils → Neutropenic precautions',ARRAY['hematology','CBC']),
  ('Calcium (Ca²⁺)','Normal: 8.5–10.5 mg/dL\n\nHypocalcemia (<8.5; critical <7.0):\n• S/S: Tetany, Chvostek sign (+), Trousseau sign (+), seizures, laryngospasm\n• Causes: Post-thyroidectomy, hypoparathyroidism, pancreatitis\n• Treatment: IV calcium gluconate (symptomatic)\n\nHypercalcemia (>10.5; critical >13.0):\n• S/S: "Bones, stones, groans, moans"\n• Treatment: IV normal saline, furosemide, bisphosphonates',ARRAY['electrolyte','calcium']),
  ('Magnesium (Mg²⁺)','Normal: 1.5–2.5 mEq/L\n\nHypomagnesemia: Tremors, seizures, hyperreflexia, arrhythmias\n• Causes: Alcoholism, loop diuretics, GI losses\n\nHypermagnesemia (especially with mag sulfate in OB):\n• >4 mEq/L: Loss of DTRs (FIRST SIGN — assess reflexes)\n• >6–7: Respiratory depression → HOLD Mag Sulfate\n• >15: Cardiac arrest\n• Antidote: Calcium gluconate 1 g IV\n• Keep at bedside for ALL patients on mag sulfate',ARRAY['electrolyte','magnesium','OB'])
) as t(front, back, tags);

-- Disease processes flashcards
with deck as (select id from public.flashcard_decks where name = 'Disease Processes & Patho' limit 1)
insert into public.flashcards (deck_id, front, back, tags)
select deck.id, front, back, tags from deck, (values
  ('Acute Myocardial Infarction (MI)','Pathophysiology: Coronary artery occlusion → myocardial ischemia → infarction\n\nS/S: Crushing chest pain, diaphoresis, nausea, dyspnea, jaw/arm radiation; women may have atypical S/S\n\nPriority interventions (MONA):\n• Morphine (pain + ↓ preload)\n• Oxygen (if SpO2 <90%)\n• Nitrates (vasodilation)\n• Aspirin (antiplatelet)\n\nGoal: Door-to-balloon time <90 min (PCI) or <30 min (thrombolytics)',ARRAY['cardiac','MI']),
  ('Heart Failure (HF)','Types: Systolic (reduced EF <40%) vs Diastolic (preserved EF)\nLeft HF → pulmonary congestion (dyspnea, orthopnea, crackles, pink frothy sputum)\nRight HF → systemic congestion (JVD, edema, hepatomegaly, ascites)\n\nPriority assessment: Daily weights (>2–3 lb gain = notify provider), lung sounds, edema, JVD\n\nTreatment: ACE inhibitors, beta-blockers, diuretics, digoxin\nPosition: High Fowler''s to ease breathing',ARRAY['cardiac','HF']),
  ('Stroke (CVA)','Ischemic (87%): Clot occludes artery → brain ischemia\nHemorrhagic (13%): Vessel rupture → bleeding\n\nF.A.S.T.: Face drooping, Arm weakness, Speech difficulty, Time to call 911\n\nThrombolytics (tPA): Must give within 3–4.5 hours; contraindicated if hemorrhagic\nPriority: Airway, neuro checks (every 1–2 h), position HOB 30°\n\nNIH Stroke Scale for severity assessment',ARRAY['neuro','stroke']),
  ('Diabetic Ketoacidosis (DKA)','Cause: Insulin deficiency → hyperglycemia → ketone production → metabolic acidosis\n\nS/S: BG >250, Kussmaul respirations, fruity breath, polyuria/polydipsia, dehydration, N/V\n\nABG: pH <7.35, HCO3 <15, metabolic acidosis with respiratory compensation\n\nTreatment:\n1. IV fluids (0.9% NS first)\n2. Insulin drip (not SQ)\n3. Potassium replacement (monitor closely)\n4. Treat underlying cause',ARRAY['endocrine','diabetes','DKA']),
  ('Sepsis / Septic Shock','Sepsis: Life-threatening organ dysfunction from dysregulated infection response\nSeptic shock: Sepsis + vasodilation + hypotension unresponsive to fluids\n\nS/S: Fever OR hypothermia, tachycardia, tachypnea, altered LOC, hypotension\n\nSepsis Bundle (Hour-1 Bundle):\n1. Blood cultures (×2 before antibiotics)\n2. Broad-spectrum antibiotics\n3. 30 mL/kg IV crystalloid bolus for hypotension\n4. Vasopressors (norepinephrine first-line) if MAP <65\n5. Lactate level',ARRAY['critical care','sepsis'])
) as t(front, back, tags);

-- Update card counts
update public.flashcard_decks set card_count = (
  select count(*) from public.flashcards where deck_id = flashcard_decks.id
);
