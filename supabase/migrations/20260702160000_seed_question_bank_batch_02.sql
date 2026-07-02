-- Batch 02 and reusable engine: two independently worded seven-format sets
-- per clinical concept. All generated items remain review-gated drafts.
-- Every item remains unavailable to students until clinical review and sourcing.
create or replace function public.seed_structured_concept(
  batch_name text,
  concept_slug text,
  topic_name text,
  condition_name text,
  clinical_cue text,
  priority_action text,
  key_teaching text,
  danger_finding text,
  wrong_one text,
  wrong_two text,
  wrong_three text,
  client_need_name text
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  variant_number integer;
  base_variant integer;
  prompt_text text;
  correct_text text;
  rationale_text text;
  strategy_text text;
  judgment_name text;
  correct_position integer;
  answer_id text;
  choice_texts text[];
  item_type text;
  item_choices jsonb;
  item_answer jsonb;
  item_ngn_data jsonb;
  inserted_count integer := 0;
begin
  for variant_number in 1..14 loop
    base_variant := mod(variant_number - 1, 7) + 1;
    if base_variant = 1 then
      prompt_text := 'A nurse is caring for a client with ' || condition_name || ' who has ' || clinical_cue || '. Which action should the nurse take first?';
      correct_text := priority_action;
      rationale_text := priority_action || ' directly addresses the most urgent threat. The alternatives delay stabilization or create additional risk.';
      strategy_text := 'Prioritize the action that protects airway, breathing, circulation, neurologic function, or immediate safety.';
      judgment_name := 'Take Action';
    elsif base_variant = 2 then
      prompt_text := 'A nurse is teaching a client or caregiver about ' || condition_name || '. Which statement should the nurse include?';
      correct_text := key_teaching;
      rationale_text := key_teaching || ' is accurate, actionable teaching that reduces complications. The alternatives conflict with safe evidence-based care.';
      strategy_text := 'Select teaching that supports adherence, prevents harm, and gives a clear reason to seek follow-up.';
      judgment_name := 'Generate Solutions';
    elsif base_variant = 3 then
      prompt_text := 'A nurse is monitoring a client with ' || condition_name || '. Which finding requires immediate follow-up?';
      correct_text := danger_finding;
      rationale_text := danger_finding || ' indicates possible acute deterioration and requires immediate assessment and escalation. It should not be normalized or deferred.';
      strategy_text := 'Identify the cue showing instability or a threat to airway, breathing, circulation, or consciousness.';
      judgment_name := 'Recognize Cues';
    elsif base_variant = 4 then
      prompt_text := 'A nurse is planning care and teaching for a client with ' || condition_name || '. Which actions or instructions are appropriate? Select all that apply.';
      rationale_text := priority_action || ' and ' || key_teaching || ' are appropriate. The remaining options conflict with safe care for this condition.';
      strategy_text := 'For SATA items, evaluate every option independently against the client condition and established safety principles.';
      judgment_name := 'Generate Solutions';
    elsif base_variant = 5 then
      prompt_text := 'A nurse reviews proposed care for a client with ' || condition_name || '. Which statements require correction? Select all that apply.';
      rationale_text := wrong_one || '; ' || wrong_two || '; and ' || wrong_three || ' are unsafe or inaccurate. The other statements reflect appropriate care and teaching.';
      strategy_text := 'Select every independently unsafe statement; do not stop after identifying the first error.';
      judgment_name := 'Evaluate Outcomes';
    elsif base_variant = 6 then
      prompt_text := 'A nurse is reviewing interventions for a client with ' || condition_name || '. For each intervention, indicate whether it is appropriate or unsafe.';
      rationale_text := priority_action || ' and ' || key_teaching || ' are appropriate. The other three interventions are unsafe for this clinical situation.';
      strategy_text := 'Classify each row independently by asking whether it supports stabilization, prevention, and evidence-based care.';
      judgment_name := 'Generate Solutions';
    else
      prompt_text := 'A nurse reviews the following plan for a client with ' || condition_name || '. Highlight every statement that requires correction.';
      rationale_text := wrong_one || '; ' || wrong_two || '; and ' || wrong_three || ' require correction. The priority action and teaching statement are appropriate.';
      strategy_text := 'Compare each highlighted statement with the client condition and select only unsafe or inaccurate care.';
      judgment_name := 'Evaluate Outcomes';
    end if;

    if variant_number > 7 then
      if base_variant = 1 then
        prompt_text := 'During handoff, the nurse receives a client with ' || condition_name || ' and notes ' || clinical_cue || '. Which intervention has the highest priority?';
      elsif base_variant = 2 then
        prompt_text := 'Before discharge, a nurse evaluates teaching for ' || condition_name || '. Which instruction is essential for preventing harm?';
      elsif base_variant = 3 then
        prompt_text := 'During reassessment of a client with ' || condition_name || ', which finding should the nurse escalate without delay?';
      elsif base_variant = 4 then
        prompt_text := 'The nurse develops a safe plan for a client with ' || condition_name || '. Which elements belong in the plan? Select all that apply.';
      elsif base_variant = 5 then
        prompt_text := 'At change of shift, the nurse audits a care plan for ' || condition_name || '. Which entries are unsafe? Select all that apply.';
      elsif base_variant = 6 then
        prompt_text := 'The charge nurse reviews care decisions for ' || condition_name || '. For each decision, identify whether it is appropriate or unsafe.';
      else
        prompt_text := 'The nurse audits the documented care plan for ' || condition_name || '. Highlight every unsafe or inaccurate statement.';
      end if;
    end if;

    correct_position := mod(abs(hashtext(concept_slug || '-' || variant_number::text)), 4);
    answer_id := chr(97 + correct_position);
    choice_texts := array[wrong_one, wrong_two, wrong_three];
    item_ngn_data := null;

    if base_variant <= 3 then
      item_type := 'mcq';
      item_choices := jsonb_build_array(
        jsonb_build_object('id','a','text',case when correct_position=0 then correct_text else choice_texts[1] end),
        jsonb_build_object('id','b','text',case when correct_position=1 then correct_text when correct_position=0 then choice_texts[1] else choice_texts[2] end),
        jsonb_build_object('id','c','text',case when correct_position=2 then correct_text when correct_position<=1 then choice_texts[2] else choice_texts[3] end),
        jsonb_build_object('id','d','text',case when correct_position=3 then correct_text else choice_texts[3] end)
      );
      item_answer := jsonb_build_object('ids', jsonb_build_array(answer_id));
    elsif base_variant in (4, 5) then
      item_type := 'sata';
      item_choices := jsonb_build_array(
        jsonb_build_object('id','a','text',priority_action),
        jsonb_build_object('id','b','text',key_teaching),
        jsonb_build_object('id','c','text',wrong_one),
        jsonb_build_object('id','d','text',wrong_two),
        jsonb_build_object('id','e','text',wrong_three)
      );
      item_answer := jsonb_build_object(
        'ids',
        case when base_variant=4
          then jsonb_build_array('a','b')
          else jsonb_build_array('c','d','e')
        end
      );
    elsif base_variant = 6 then
      item_type := 'matrix';
      item_choices := '[]'::jsonb;
      item_answer := jsonb_build_object('ids', '[]'::jsonb);
      item_ngn_data := jsonb_build_object(
        'columns', jsonb_build_array(
          jsonb_build_object('id','appropriate','text','Appropriate'),
          jsonb_build_object('id','unsafe','text','Unsafe')
        ),
        'rows', jsonb_build_array(
          jsonb_build_object('id','r1','text',priority_action),
          jsonb_build_object('id','r2','text',key_teaching),
          jsonb_build_object('id','r3','text',wrong_one),
          jsonb_build_object('id','r4','text',wrong_two),
          jsonb_build_object('id','r5','text',wrong_three)
        ),
        'correct', jsonb_build_object(
          'r1','appropriate','r2','appropriate',
          'r3','unsafe','r4','unsafe','r5','unsafe'
        )
      );
    else
      item_type := 'highlight';
      item_choices := '[]'::jsonb;
      item_answer := jsonb_build_object('ids', '[]'::jsonb);
      item_ngn_data := jsonb_build_object(
        'passage',
        'Plan review: ' || priority_action || '. Teaching: ' || key_teaching ||
        '. Additional proposals: ' || wrong_one || '. ' || wrong_two || '. ' || wrong_three || '.',
        'highlights', jsonb_build_array(
          jsonb_build_object('id','h1','text',priority_action,'correct',false),
          jsonb_build_object('id','h2','text',key_teaching,'correct',false),
          jsonb_build_object('id','h3','text',wrong_one,'correct',true),
          jsonb_build_object('id','h4','text',wrong_two,'correct',true),
          jsonb_build_object('id','h5','text',wrong_three,'correct',true)
        )
      );
    end if;

    insert into public.questions (
      topic, question_type, prompt, choices, correct_answer, rationale, strategy, ngn_data,
      client_need, clinical_judgment, status, minimum_plan, source_batch,
      clinical_review_status, quality_notes
    )
    select
      topic_name,
      item_type,
      prompt_text,
      item_choices,
      item_answer,
      rationale_text,
      strategy_text,
      item_ngn_data,
      client_need_name,
      judgment_name,
      'draft',
      'starter',
      batch_name,
      'pending',
      'Requires independent clinical review and an authoritative reference before publication.'
    where not exists (
      select 1 from public.questions q
      where lower(trim(q.prompt)) = lower(trim(prompt_text))
    );

    if found then inserted_count := inserted_count + 1; end if;
  end loop;
  return inserted_count;
end;
$$;

-- Cardiovascular and respiratory
select public.seed_structured_concept('expansion-batch-02','aortic-dissection','Medical-Surgical','a suspected aortic dissection','abrupt tearing chest pain radiating to the back with unequal arm pressures','Activate emergency response, maintain bed rest, and prepare prescribed IV blood-pressure control','Control blood pressure, avoid heavy straining, and seek emergency care for sudden tearing chest or back pain','New loss of a peripheral pulse with altered consciousness','Encourage the client to walk to distinguish muscular pain','Apply vigorous massage over the painful back','Delay vascular imaging until pain resolves','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','cardiac-tamponade','Medical-Surgical','cardiac tamponade','hypotension, jugular venous distention, muffled heart sounds, and narrowing pulse pressure','Notify the rapid response team and prepare for emergency pericardiocentesis','Report increasing breathlessness, chest pressure, faintness, or neck-vein distention immediately','Pulsus paradoxus with rapidly falling blood pressure','Administer a diuretic and restrict fluids before notifying anyone','Place the client flat and encourage coughing','Wait for complete loss of heart sounds before escalating','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','tension-pneumothorax','Medical-Surgical','a tension pneumothorax','sudden respiratory distress, absent unilateral breath sounds, hypotension, and tracheal deviation','Activate emergency response and prepare immediate needle decompression followed by chest-tube placement','Seek emergency help for sudden one-sided chest pain and severe breathing difficulty after lung injury or a procedure','Increasing hypotension with distended neck veins and worsening hypoxemia','Clamp any existing chest tube routinely','Position the client on the unaffected side and delay oxygen','Wait for a chest radiograph before reporting instability','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','pulmonary-embolism','Medical-Surgical','an acute pulmonary embolism','sudden dyspnea, pleuritic chest pain, tachycardia, and oxygen desaturation','Apply oxygen, activate rapid response, and prepare prescribed anticoagulation or reperfusion therapy','Use anticoagulants exactly as directed and seek help for sudden breathlessness, chest pain, or coughing blood','Syncope with systolic blood pressure of 78 mm Hg','Massage a painful swollen calf vigorously','Encourage unassisted ambulation during severe hypoxemia','Delay assessment until the next anticoagulant dose','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','ards','Medical-Surgical','acute respiratory distress syndrome','refractory hypoxemia, diffuse crackles, and bilateral infiltrates after sepsis','Support oxygenation with lung-protective ventilation and treat the underlying cause','Follow pulmonary rehabilitation and report worsening breathlessness or oxygen needs promptly','Oxygen saturation of 84% despite escalating supplemental oxygen','Give a rapid large fluid bolus without reassessment','Use high tidal volumes to fully expand the lungs','Keep the client supine despite severe oxygenation failure','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','status-asthmaticus','Medical-Surgical','status asthmaticus','severe wheezing followed by a quiet chest, fatigue, and rising carbon dioxide','Activate emergency support and administer rapid bronchodilator and systemic corticosteroid therapy','Use a written action plan, correct inhaler technique, and seek help when rescue medicine is ineffective','Diminishing breath sounds with increasing drowsiness','Use a long-acting bronchodilator as the only rescue medicine','Lie flat during severe shortness of breath','Delay emergency care until wheezing becomes louder','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','copd-co2-retention','Medical-Surgical','an acute COPD exacerbation','increasing dyspnea, purulent sputum, and somnolence with elevated carbon dioxide','Titrate oxygen to the prescribed target, give bronchodilators, and assess ventilation promptly','Use inhalers correctly, avoid smoking, and report increased sputum or breathlessness early','Increasing drowsiness with shallow respirations and rising PaCO2','Withhold all oxygen because of chronic carbon-dioxide retention','Use sedatives to reduce respiratory effort','Encourage high-flow uncontrolled oxygen without monitoring','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','chest-tube-disconnection','Medical-Surgical','an accidental chest-tube system disconnection','chest tubing separated from the drainage system while the tube remains in the client','Place the distal tube end in sterile water temporarily and reconnect a new sterile system','Keep drainage below chest level and report disconnection, new dyspnea, or tube movement immediately','Sudden respiratory distress with absent breath sounds after disconnection','Clamp the tube for an extended period','Push a dislodged tube back into the chest','Raise the drainage system onto the bed','Safe and Effective Care Environment');

-- Renal, neurologic, and endocrine
select public.seed_structured_concept('expansion-batch-02','hyperkalemia','Medical-Surgical','severe hyperkalemia','potassium 6.8 mEq/L with peaked T waves and muscle weakness','Place the client on cardiac monitoring and administer prescribed membrane-stabilizing and potassium-shifting therapy','Avoid potassium salt substitutes and keep scheduled laboratory monitoring','Widening QRS complexes with bradycardia','Encourage potassium-rich fruit immediately','Administer potassium chloride IV push','Delay ECG monitoring until repeat laboratory results return','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','dialysis-disequilibrium','Medical-Surgical','dialysis disequilibrium syndrome','headache, nausea, confusion, and seizure activity during initial hemodialysis','Stop or slow dialysis as prescribed, protect the airway, and notify the dialysis provider immediately','Report headache, restlessness, nausea, or confusion during dialysis without delay','A new seizure with decreasing level of consciousness','Increase the dialysis rate to finish sooner','Encourage the client to stand and walk','Give large amounts of free water during treatment','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','av-fistula','Medical-Surgical','hemodialysis arteriovenous fistula care','a mature forearm fistula used for dialysis access','Assess for a thrill and bruit and protect the access arm from compression or puncture','Check the access daily and avoid blood pressure measurements, blood draws, and tight clothing on that arm','Absence of the previously palpable thrill','Sleep with body weight directly on the access arm','Allow routine venipuncture distal to the fistula','Apply a constrictive band for mild swelling','Safe and Effective Care Environment');
select public.seed_structured_concept('expansion-batch-02','diabetes-insipidus','Medical-Surgical','diabetes insipidus','large volumes of dilute urine, intense thirst, hypernatremia, and rising serum osmolality','Replace fluids, monitor sodium and urine output, and administer prescribed desmopressin','Maintain access to water and recognize excessive thirst and urination as signs needing follow-up','Hypotension with sodium 158 mEq/L and worsening confusion','Restrict fluids to reduce urine output','Administer a loop diuretic routinely','Provide highly salted foods without fluid','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','thyroid-storm','Medical-Surgical','thyroid storm','high fever, severe tachycardia, agitation, vomiting, and heart failure signs','Initiate cooling, cardiac monitoring, and prescribed beta blocker and antithyroid therapy','Take antithyroid medicine consistently and seek care for fever, palpitations, or severe agitation','Temperature 104.6°F with atrial fibrillation and hypotension','Apply warming blankets for the fever','Administer aspirin routinely for temperature control','Encourage exercise to reduce restlessness','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','myxedema-coma','Medical-Surgical','myxedema coma','hypothermia, bradycardia, hypotension, hypoventilation, and decreased consciousness','Support ventilation and administer prescribed IV thyroid hormone and corticosteroid','Take thyroid replacement consistently and report increasing lethargy, cold intolerance, or slowed thinking','Respiratory rate 6/min with worsening unresponsiveness','Rewarm rapidly with direct high heat','Give sedatives for agitation','Delay thyroid treatment until the client is fully awake','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','increased-icp','Medical-Surgical','increased intracranial pressure','declining consciousness, unequal pupils, vomiting, and widening pulse pressure','Elevate the head about 30 degrees, keep the neck neutral, and notify the provider immediately','Avoid straining and report worsening headache, vomiting, weakness, or confusion','A fixed dilated pupil with new extensor posturing','Place the client in Trendelenburg position','Cluster every procedure without rest periods','Flex the hips sharply during repositioning','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','guillain-barre','Medical-Surgical','Guillain-Barré syndrome','ascending weakness, reduced reflexes, and new difficulty taking a deep breath','Measure respiratory strength frequently and prepare early ventilatory support','Report swallowing difficulty, shortness of breath, or rapidly ascending weakness immediately','A declining vital capacity with a weak cough','Encourage unassisted walking despite progressing weakness','Give food before evaluating swallowing','Use sedatives for anxiety without respiratory assessment','Physiological Integrity');

-- Pharmacology
select public.seed_structured_concept('expansion-batch-02','heparin-hit','Pharmacology','heparin-induced thrombocytopenia','platelets falling by more than 50% with a new thrombosis after heparin exposure','Stop all heparin and begin a prescribed non-heparin anticoagulant','Tell future clinicians about HIT and avoid every heparin-containing product','New painful cyanotic toes with a rapidly falling platelet count','Administer a platelet transfusion routinely without bleeding','Continue low-dose heparin because the platelet count is above zero','Start warfarin alone during the acute platelet fall','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','vancomycin-infusion','Pharmacology','a vancomycin infusion reaction','flushing, itching, and hypotension during a rapid IV infusion','Stop or slow the infusion, assess the client, and follow prescribed management','Report flushing or breathing difficulty and expect vancomycin to be infused slowly','Wheezing with facial swelling and severe hypotension','Increase the infusion rate to finish the dose','Ignore flushing because it proves effectiveness','Give the next dose as a rapid IV push','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','insulin-hypoglycemia','Pharmacology','insulin-related hypoglycemia','diaphoresis, tremor, confusion, and glucose 48 mg/dL','Give 15 g rapid carbohydrate if able to swallow or emergency glucose therapy if not','Carry fast-acting glucose and recheck glucose 15 minutes after treatment','Seizure activity with inability to swallow','Administer additional rapid-acting insulin','Give a high-fat snack as the only immediate treatment','Allow the client to drive before glucose is rechecked','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','amiodarone','Pharmacology','long-term amiodarone therapy','treatment of recurrent ventricular dysrhythmia','Monitor ECG, thyroid, liver, pulmonary status, and medication interactions','Use sun protection and report cough, breathlessness, vision change, or marked fatigue','New dry cough with bilateral pulmonary infiltrates','Take grapefruit products freely with every dose','Stop the drug abruptly when the pulse feels regular','Ignore progressive shortness of breath as expected','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','clozapine','Mental Health','clozapine therapy','treatment-resistant schizophrenia beginning clozapine','Verify required absolute neutrophil count monitoring and assess infection symptoms','Keep every blood-test appointment and report fever or sore throat immediately','Fever with an absolute neutrophil count of 400/mm3','Skip blood monitoring once symptoms improve','Double the dose after a missed week','Treat severe constipation only with fluid restriction','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','maoi-interaction','Mental Health','monoamine oxidase inhibitor therapy','phenelzine prescribed for refractory depression','Review foods and medicines for tyramine and sympathomimetic interactions','Avoid aged or fermented high-tyramine foods and seek help for sudden severe headache','Severe occipital headache with blood pressure 220/118 mm Hg','Use over-the-counter decongestants freely','Eat aged cheese to prevent nausea','Combine the medicine with an SSRI the next day','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','methotrexate','Pharmacology','methotrexate therapy','weekly methotrexate prescribed for inflammatory disease','Verify weekly dosing and monitor blood counts, liver function, and pregnancy risk','Take the dose only on the assigned day and report mouth sores, fever, bruising, or pregnancy','Fever with oral ulcers and severe neutropenia','Take the weekly dose every morning','Use alcohol heavily to reduce stiffness','Receive live vaccines without prescriber approval','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','furosemide','Pharmacology','high-dose furosemide therapy','acute fluid overload receiving IV loop diuretic','Monitor blood pressure, urine output, potassium, magnesium, and hearing','Rise slowly, follow potassium instructions, and report weakness, palpitations, or hearing change','New ventricular ectopy with potassium 2.7 mEq/L','Take the dose at bedtime to improve sleep','Restrict all dietary potassium without instruction','Ignore tinnitus during rapid IV administration','Physiological Integrity');

-- Maternal, pediatric, and safety
select public.seed_structured_concept('expansion-batch-02','shoulder-dystocia','Maternal and Newborn','shoulder dystocia','the fetal head delivers and retracts against the perineum','Call for help and assist with McRoberts positioning and prescribed suprapubic pressure','Understand that extra staff and position changes may be needed quickly during birth','Persistent fetal bradycardia while the shoulders remain impacted','Apply fundal pressure forcefully','Pull firmly on the fetal head','Ask the client to walk before continuing birth','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','magnesium-toxicity','Maternal and Newborn','magnesium sulfate toxicity','preeclamptic client receiving magnesium with absent reflexes and slow respirations','Stop magnesium, support breathing, and administer prescribed calcium gluconate','Report extreme weakness, breathing difficulty, or markedly reduced urine output','Respiratory rate 8/min with absent patellar reflexes','Increase the magnesium rate for seizure prevention','Leave the client unattended in a bathtub','Administer additional sedating medication','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','rsv-infant','Pediatrics','RSV bronchiolitis in an infant','tachypnea, nasal flaring, copious secretions, and poor feeding','Suction the nose, support oxygenation and hydration, and monitor for apnea','Use nasal saline and suction before feeds and seek help for apnea, cyanosis, or poor intake','Recurrent apnea with a heart rate of 70/min','Give an over-the-counter cough suppressant','Force a large feeding during tachypnea','Use antibiotics routinely for viral bronchiolitis','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','kawasaki','Pediatrics','Kawasaki disease','prolonged fever, conjunctivitis, strawberry tongue, rash, and swollen hands','Administer prescribed IV immune globulin and aspirin and monitor the coronary arteries','Keep cardiology follow-up and report recurrent fever or chest symptoms','New chest pain with ECG changes during recovery','Avoid cardiac follow-up after the fever resolves','Give ibuprofen routinely while receiving aspirin','Delay immune globulin until skin peeling begins','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','sickle-cell-crisis-child','Pediatrics','a pediatric sickle cell vaso-occlusive crisis','severe limb pain after dehydration with oxygen saturation 91%','Provide prescribed analgesia, hydration, oxygen when hypoxemic, and assess for acute chest syndrome','Hydrate, avoid temperature extremes, and seek care for fever, chest pain, or breathing difficulty','New chest pain, fever, and increasing oxygen requirement','Apply ice directly to painful extremities','Delay opioid analgesia until pain becomes unbearable','Restrict fluids during the crisis','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','organophosphate','Emergency and Critical Care','organophosphate poisoning','salivation, lacrimation, diarrhea, bronchorrhea, miosis, and bradycardia','Decontaminate safely and administer prescribed atropine and pralidoxime while supporting ventilation','Use protective equipment around pesticides and seek emergency care immediately after exposure','Copious bronchial secretions with severe hypoxemia','Induce vomiting without guidance','Allow unprotected staff to handle contaminated clothing','Delay atropine until laboratory confirmation','Physiological Integrity');
select public.seed_structured_concept('expansion-batch-02','carbon-monoxide','Emergency and Critical Care','carbon monoxide poisoning','headache, dizziness, nausea, confusion, and exposure to a faulty heater','Remove from exposure and administer high-concentration oxygen immediately','Install working carbon-monoxide detectors and leave the building if an alarm sounds','New confusion and chest pain in a pregnant client after exposure','Rely on a normal pulse-oximeter reading','Return inside to locate the source alone','Treat the headache with sleep in the same room','Safe and Effective Care Environment');
select public.seed_structured_concept('expansion-batch-02','heat-stroke','Emergency and Critical Care','exertional heat stroke','core temperature 105°F, hot skin, confusion, and collapse','Begin rapid whole-body cooling and support airway, circulation, and electrolytes','Hydrate during heat exposure and stop activity for confusion, faintness, or hot dry skin','Persistent altered consciousness with rising temperature despite cooling','Give an antipyretic as the primary treatment','Delay cooling until transport arrives','Wrap the client in insulating blankets','Physiological Integrity');

-- Retained temporarily for subsequent held expansion batches.
