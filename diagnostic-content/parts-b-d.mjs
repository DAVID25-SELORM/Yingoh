// DRAFT content for SMART NCLEX Roadmap diagnostic Parts B, C and D (50 questions).
// STATUS: drafted for clinical review. Nothing here is published or live. Every item must be reviewed and
// approved by a licensed nurse educator before it is set to published/approved in the question bank.
//
// Blueprint fit (with the corrected Part A quota in migration 20260923000000):
//   Part B (30): MoC 3, Safety 4, HP 2, Psych 3, Basic 2, Pharm 4, Risk 5, Phys 7
//   Part C (10): Pharmacological and Parenteral Therapies 10 (medication calculations)
//   Part D (10): Management of Care 8, Physiological Adaptation 2 (prioritization / delegation)
// Clinical-judgment steps for Part B: Analyze Cues 10, Prioritize Hypotheses 10, Recognize Cues 3,
// Generate Solutions 3, Take Action 2, Evaluate Outcomes 2 (fills the two steps the existing bank lacks).

import { WHY } from './parts-b-d.explanations.mjs';

export const SOURCE_BATCH = 'diagnostic-parts-b-d-2026-09';

const MOC = 'Management of Care';
const SAFETY = 'Safety and Infection Prevention and Control';
const HP = 'Health Promotion and Maintenance';
const PSYCH = 'Psychosocial Integrity';
const BASIC = 'Basic Care and Comfort';
const PHARM = 'Pharmacological and Parenteral Therapies';
const RISK = 'Reduction of Risk Potential';
const PHYS = 'Physiological Adaptation';

// choices are listed in order and receive ids a, b, c, ...; `answer` is a string of the correct ids, e.g. 'b' or 'abc'.
const q = (o) => o;

const RAW = [
  // ===================== PART B - CLINICAL JUDGMENT =====================
  // ---- Analyze Cues (10) ----
  q({ id: 'B01', part: 'B', subcategory: PHYS, topic: 'Cardiovascular', subtopic: 'Heart failure', cj_step: 'Analyze Cues', difficulty: 'medium', type: 'mcq',
    prompt: 'A nurse reviews data for a client admitted with heart failure. Weight: 70.2 kg on day 1, 71.4 kg on day 2, and 72.9 kg on day 3. The client has new bibasilar crackles, 2+ pitting ankle edema, urine output of 600 mL over 24 hours, BP 148/92 mmHg, and SpO2 93% on room air. Which analysis of these cues is most accurate?',
    choices: ['The client is developing fluid volume overload from worsening heart failure.', 'The client is dehydrated from excessive diuretic therapy.', 'The client has developed a bacterial pneumonia.', 'The weight gain reflects expected improvement in nutrition.'], answer: 'a',
    rationale: 'Weight rose about 2.7 kg in 48 hours (1 kg is roughly 1 L of retained fluid) along with new crackles, edema, hypertension and low urine output. Together these cues show fluid retention from worsening heart failure. Dehydration would cause weight loss, and nothing in the data points to infection.' }),
  q({ id: 'B02', part: 'B', subcategory: PHYS, topic: 'Medical-Surgical', subtopic: 'Diabetic ketoacidosis', cj_step: 'Analyze Cues', difficulty: 'medium', type: 'mcq',
    prompt: 'A client with type 1 diabetes is admitted with a glucose of 486 mg/dL, deep rapid respirations, and a fruity breath odor. Arterial blood gases show pH 7.21, PaCO2 26 mmHg, and HCO3 12 mEq/L. Which interpretation is correct?',
    choices: ['Metabolic acidosis with respiratory compensation', 'Respiratory acidosis with renal compensation', 'Metabolic alkalosis with respiratory compensation', 'Respiratory alkalosis without compensation'], answer: 'a',
    rationale: 'A low pH with a low bicarbonate shows metabolic acidosis caused by ketone accumulation. The low PaCO2 and the deep, rapid (Kussmaul) respirations show the lungs are blowing off carbon dioxide to compensate.' }),
  q({ id: 'B03', part: 'B', subcategory: PHYS, topic: 'Emergency and Critical Care', subtopic: 'Sepsis', cj_step: 'Analyze Cues', difficulty: 'medium', type: 'mcq',
    prompt: 'A client on postoperative day 2 after bowel resection has a temperature of 38.9°C, HR 118/min, RR 26/min, BP 92/54 mmHg, WBC 18,000/mm3, lactate 3.8 mmol/L, and new confusion. Which analysis best fits these cues?',
    choices: ['Sepsis with early signs of poor tissue perfusion', 'An expected postoperative inflammatory response', 'Uncontrolled incisional pain', 'Anxiety related to hospitalization'], answer: 'a',
    rationale: 'Fever, tachycardia, tachypnea and leukocytosis suggest infection. Hypotension, a raised lactate and new confusion show that organs are not being perfused well. This pattern is sepsis and is not a normal postoperative response.' }),
  q({ id: 'B04', part: 'B', subcategory: RISK, topic: 'Laboratory and Diagnostics', subtopic: 'Anticoagulant therapy', cj_step: 'Analyze Cues', difficulty: 'easy', type: 'mcq',
    prompt: 'A client taking warfarin reports bleeding gums. The INR is 5.8 (therapeutic range 2 to 3). Which analysis is most accurate?',
    choices: ['The INR shows excessive anticoagulation and a high risk of serious bleeding.', 'The INR is expected for a client taking warfarin and needs no action.', 'The bleeding gums show that the warfarin dose is too low.', 'The INR shows the client has developed a clotting disorder.'], answer: 'a',
    rationale: 'An INR of 5.8 is well above the therapeutic range of 2 to 3 and means the blood is clotting too slowly. Bleeding gums are an early bleeding sign, so the client is at high risk of serious hemorrhage and the provider must be notified.' }),
  q({ id: 'B05', part: 'B', subcategory: RISK, topic: 'Laboratory and Diagnostics', subtopic: 'Hyperkalemia', cj_step: 'Analyze Cues', difficulty: 'medium', type: 'mcq',
    prompt: 'A client with end-stage kidney disease missed dialysis for one week and reports muscle weakness. Serum potassium is 6.8 mEq/L and the ECG shows tall, peaked T waves. Which conclusion is most accurate?',
    choices: ['Hyperkalemia from missed dialysis is putting the client at risk for a life-threatening dysrhythmia.', 'Peaked T waves are a normal variant for clients with kidney disease.', 'The muscle weakness is caused by low calcium and not by potassium.', 'The findings show hypokalemia related to fluid overload.'], answer: 'a',
    rationale: 'The kidneys excrete potassium, so it accumulates when dialysis is missed. Peaked T waves are an early ECG sign of hyperkalemia and can progress to ventricular dysrhythmias and cardiac arrest, so this is an emergency.' }),
  q({ id: 'B06', part: 'B', subcategory: PSYCH, topic: 'Mental Health', subtopic: 'Suicide risk', cj_step: 'Analyze Cues', difficulty: 'medium', type: 'sata',
    prompt: 'A nurse assesses a 68-year-old client who recently lost a spouse. Which findings indicate a high risk for suicide? Select all that apply.',
    choices: ['States, "Everyone would be better off without me."', 'Has been giving away treasured belongings to family members.', 'Has a written plan and access to a firearm at home.', 'Reports occasional mild headaches.', 'Attends a weekly grief-support group.'], answer: 'abc',
    rationale: 'Statements of being a burden, giving away possessions, and a specific plan with access to lethal means are strong warning signs of high risk. Mild headaches are unrelated, and attending a support group is a protective factor.' }),
  q({ id: 'B07', part: 'B', subcategory: SAFETY, topic: 'Safety and Infection Control', subtopic: 'Fall risk', cj_step: 'Analyze Cues', difficulty: 'medium', type: 'sata',
    prompt: 'An 82-year-old client on postoperative day 2 after hip surgery is receiving oxycodone and furosemide, uses a walker, and has nocturia. The client is confused at night. Which factors increase this client\'s risk for falls? Select all that apply.',
    choices: ['Opioid analgesic therapy', 'Diuretic-related nocturia', 'Nighttime confusion', 'Alert and oriented during the day', 'Uses the call light appropriately'], answer: 'abc',
    rationale: 'Opioids cause sedation and dizziness, diuretics cause urgent trips to the toilet at night, and nighttime confusion impairs judgment. Being oriented in the day and using the call light are protective, not risk factors.' }),
  q({ id: 'B08', part: 'B', subcategory: BASIC, topic: 'Fundamentals', subtopic: 'Pressure injury', cj_step: 'Analyze Cues', difficulty: 'medium', type: 'sata',
    prompt: 'A bedbound client has a stage 2 sacral pressure injury, a Braden score of 11, urinary incontinence, and a serum albumin of 2.6 g/dL. Which factors are contributing to the risk for skin breakdown? Select all that apply.',
    choices: ['Prolonged immobility', 'Moisture from incontinence', 'Poor nutritional status', 'Age-related vision changes', 'Well-fitting footwear'], answer: 'abc',
    rationale: 'Pressure, moisture and poor nutrition (shown by the low albumin) all reduce the skin\'s tolerance for pressure injury. A low Braden score confirms high risk. Vision changes and well-fitting footwear do not contribute to sacral skin breakdown.' }),
  q({ id: 'B09', part: 'B', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Digoxin toxicity', cj_step: 'Analyze Cues', difficulty: 'hard', type: 'mcq',
    prompt: 'A client taking digoxin and furosemide reports nausea and blurred yellow-green vision. The HR is 52/min, serum potassium is 3.1 mEq/L, and the digoxin level is 2.4 ng/mL (therapeutic 0.5 to 2.0). Which analysis is most accurate?',
    choices: ['Digoxin toxicity that is worsened by hypokalemia', 'A therapeutic digoxin effect that needs no action', 'Underdosing of digoxin with rebound tachycardia', 'An allergic reaction to furosemide'], answer: 'a',
    rationale: 'The level is above the therapeutic range and the client has classic toxicity signs (nausea, visual changes, bradycardia). Furosemide lowers potassium, and hypokalemia increases digoxin toxicity, so both problems must be addressed.' }),
  q({ id: 'B10', part: 'B', subcategory: HP, topic: 'Maternal and Newborn', subtopic: 'Preeclampsia', cj_step: 'Analyze Cues', difficulty: 'medium', type: 'mcq',
    prompt: 'A client at 34 weeks of gestation has BP 152/98 mmHg, 3+ proteinuria, a severe headache, and blurred vision. Which analysis is most accurate?',
    choices: ['Preeclampsia with severe features', 'Normal physiological changes of pregnancy', 'Gestational diabetes mellitus', 'A urinary tract infection'], answer: 'a',
    rationale: 'New hypertension with proteinuria after 20 weeks indicates preeclampsia, and the severe headache and visual disturbance are severe features that show central nervous system involvement and risk of seizure.' }),

  // ---- Prioritize Hypotheses (10) ----
  q({ id: 'B11', part: 'B', subcategory: PHYS, topic: 'Cardiovascular', subtopic: 'Acute coronary syndrome', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'A client reports substernal chest pressure that radiates to the left arm, with diaphoresis and nausea. The ECG shows ST-segment elevation in leads V2 to V4. Which hypothesis should the nurse prioritize?',
    choices: ['Acute myocardial infarction', 'Gastroesophageal reflux', 'Anxiety-related chest tightness', 'Musculoskeletal chest wall pain'], answer: 'a',
    rationale: 'Pressure radiating to the arm with diaphoresis and ST elevation is an acute ST-elevation myocardial infarction until proven otherwise. It is the most life-threatening explanation and needs immediate treatment.' }),
  q({ id: 'B12', part: 'B', subcategory: PHYS, topic: 'Medical-Surgical', subtopic: 'Postoperative hemorrhage', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'One day after abdominal surgery, a client has BP 86/50 mmHg, HR 124/min, cool and clammy skin, an increasingly distended abdomen, and rapidly increasing bloody drain output. Which hypothesis should the nurse prioritize?',
    choices: ['Hemorrhage with hypovolemic shock', 'Postoperative ileus', 'Surgical site pain', 'Opioid-related sedation'], answer: 'a',
    rationale: 'Hypotension, tachycardia, cool clammy skin, abdominal distention and bloody drainage indicate internal bleeding causing hypovolemic shock. This is the most urgent life-threatening cause and takes priority over ileus or pain.' }),
  q({ id: 'B13', part: 'B', subcategory: RISK, topic: 'Medical-Surgical', subtopic: 'Fat embolism', cj_step: 'Prioritize Hypotheses', difficulty: 'hard', type: 'mcq',
    prompt: 'A client with a fractured femur 24 hours ago suddenly develops dyspnea and confusion. The SpO2 is 86%, and petechiae appear over the chest. Which hypothesis should the nurse prioritize?',
    choices: ['Fat embolism syndrome', 'Anxiety related to pain', 'Fluid volume overload', 'Community-acquired pneumonia'], answer: 'a',
    rationale: 'Long-bone fractures release fat globules that lodge in the lungs and brain. The classic triad is respiratory distress, neurologic change and petechiae, usually within 24 to 72 hours of injury.' }),
  q({ id: 'B14', part: 'B', subcategory: PHYS, topic: 'Respiratory', subtopic: 'Hypercapnic respiratory failure', cj_step: 'Prioritize Hypotheses', difficulty: 'hard', type: 'mcq',
    prompt: 'A client with COPD receiving oxygen at 10 L/min by mask is drowsy and has a respiratory rate of 8/min. The SpO2 is 99%. Which hypothesis should the nurse prioritize?',
    choices: ['Acute hypercapnic respiratory failure from hypoventilation', 'Successful treatment with normal sleepiness', 'Pulmonary embolism', 'Hypoglycemia'], answer: 'a',
    rationale: 'Drowsiness with a slow respiratory rate in a client with COPD who is receiving high-flow oxygen suggests carbon dioxide retention. A normal SpO2 does not exclude hypercapnia, and the client is at risk of respiratory arrest.' }),
  q({ id: 'B15', part: 'B', subcategory: PSYCH, topic: 'Mental Health', subtopic: 'Alcohol withdrawal', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'On day 2 of admission, a client with alcohol use disorder has tremors, diaphoresis, HR 118/min, BP 168/98 mmHg, and agitation, and reports seeing insects on the walls. Which hypothesis should the nurse prioritize?',
    choices: ['Alcohol withdrawal delirium (delirium tremens)', 'Generalized anxiety disorder', 'Relapse of schizophrenia', 'Seasonal affective disorder'], answer: 'a',
    rationale: 'Autonomic hyperactivity with visual hallucinations 48 to 72 hours after the last drink is characteristic of delirium tremens. It has a significant mortality risk and needs urgent treatment and seizure precautions.' }),
  q({ id: 'B16', part: 'B', subcategory: SAFETY, topic: 'Safety and Infection Control', subtopic: 'Neutropenic fever', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'A client receiving chemotherapy has an absolute neutrophil count of 300/mm3 and a temperature of 38.6°C. The client reports feeling tired. Which hypothesis should the nurse prioritize?',
    choices: ['A serious infection in a neutropenic client', 'Expected fatigue from chemotherapy', 'Mild dehydration', 'An allergic reaction'], answer: 'a',
    rationale: 'Neutropenic clients cannot mount a normal inflammatory response, so fever may be the only sign of overwhelming infection. Fever with a low neutrophil count is a medical emergency needing cultures and immediate antibiotics.' }),
  q({ id: 'B17', part: 'B', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Vancomycin infusion reaction', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'Ten minutes into a rapid vancomycin infusion, a client develops flushing of the face, neck and upper torso with itching. BP is 104/62 mmHg, the lungs are clear, and there is no wheezing or lip swelling. Which hypothesis is best supported by these cues?',
    choices: ['An infusion-rate related reaction to vancomycin', 'Anaphylaxis with airway compromise', 'Sepsis', 'Contact dermatitis from the tape'], answer: 'a',
    rationale: 'Flushing and itching of the face, neck and upper trunk during a rapid vancomycin infusion is a rate-related histamine reaction (vancomycin flushing syndrome). Clear lungs and no wheezing or swelling make anaphylaxis less likely, though the nurse must keep monitoring.' }),
  q({ id: 'B18', part: 'B', subcategory: BASIC, topic: 'Neurologic and Sensory', subtopic: 'Dysphagia after stroke', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'A client 2 days after a stroke coughs and has a wet, gurgling voice after sips of water. The SpO2 is 94%. Which hypothesis should the nurse prioritize?',
    choices: ['Aspiration related to impaired swallowing', 'Seasonal allergies', 'Dry mouth from oxygen therapy', 'Anxiety about eating'], answer: 'a',
    rationale: 'Coughing and a wet voice after swallowing show that fluid is entering the airway. Aspiration can cause pneumonia and airway obstruction, so oral intake should be stopped until a swallow evaluation is done.' }),
  q({ id: 'B19', part: 'B', subcategory: RISK, topic: 'Medical-Surgical', subtopic: 'Hypocalcemia after thyroidectomy', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'Six hours after a total thyroidectomy, a client reports tingling around the mouth. Carpopedal spasm occurs when the blood pressure cuff is inflated, and Chvostek\'s sign is positive. Which hypothesis should the nurse prioritize?',
    choices: ['Hypocalcemia from parathyroid gland injury', 'Hypercalcemia', 'Postoperative anxiety', 'Thyroid storm'], answer: 'a',
    rationale: 'Perioral tingling, carpopedal spasm (Trousseau\'s sign) and Chvostek\'s sign are classic signs of low calcium, a complication when the parathyroid glands are damaged or removed. Laryngospasm and seizures can follow.' }),
  q({ id: 'B20', part: 'B', subcategory: PHYS, topic: 'Neurologic and Sensory', subtopic: 'Acute ischemic stroke', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'A client suddenly has slurred speech and right-sided arm weakness. The spouse reports the client was last seen normal 40 minutes ago. Which hypothesis should the nurse prioritize?',
    choices: ['Acute ischemic stroke with a time-sensitive treatment window', 'Migraine with aura', 'An anxiety attack', 'Vitamin B12 deficiency'], answer: 'a',
    rationale: 'Sudden speech and motor deficits with a known time last seen normal indicate a stroke. Treatment such as thrombolysis is time-dependent, so the nurse activates the stroke response and checks the glucose to rule out a mimic.' }),

  // ---- Recognize Cues (3) ----
  q({ id: 'B21', part: 'B', subcategory: RISK, topic: 'Medical-Surgical', subtopic: 'DVT and pulmonary embolism', cj_step: 'Recognize Cues', difficulty: 'easy', type: 'sata',
    prompt: 'On postoperative day 3 after total knee replacement, which findings should the nurse recognize as possible signs of deep vein thrombosis or pulmonary embolism? Select all that apply.',
    choices: ['Unilateral calf swelling and tenderness', 'Warmth and redness over the affected calf', 'New sudden chest pain with shortness of breath', 'Incisional pain of 3/10 that improves with medication', 'Bilateral ankle stiffness in the morning'], answer: 'abc',
    rationale: 'One-sided calf swelling, tenderness and warmth suggest a deep vein thrombosis, and sudden chest pain with dyspnea suggests the clot has traveled to the lungs. Expected incisional pain that responds to medication and bilateral stiffness are not typical clot signs.' }),
  q({ id: 'B22', part: 'B', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Serotonin syndrome', cj_step: 'Recognize Cues', difficulty: 'hard', type: 'sata',
    prompt: 'A client recently started tramadol while taking sertraline. Which findings should the nurse recognize as possible serotonin syndrome? Select all that apply.',
    choices: ['Agitation and tremor', 'Hyperreflexia and clonus', 'Fever with diaphoresis', 'Cool, dry skin', 'Slowed deep tendon reflexes'], answer: 'abc',
    rationale: 'Serotonin syndrome from combining serotonergic drugs causes agitation, tremor, hyperreflexia, clonus, fever and sweating. Cool dry skin and slowed reflexes point away from serotonin excess.' }),
  q({ id: 'B28', part: 'B', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Elder abuse', cj_step: 'Recognize Cues', difficulty: 'medium', type: 'sata',
    prompt: 'Which findings during an assessment of an older adult should raise the nurse\'s concern for possible elder abuse? Select all that apply.',
    choices: ['Bruises in various stages of healing on the upper arms', 'The caregiver answers all questions and will not leave the client alone', 'The client appears fearful and avoids eye contact when the caregiver is present', 'The client is well groomed and reports feeling safe at home', 'A single small shin bruise that matches the client\'s account of a fall'], answer: 'abc',
    rationale: 'Bruises at different healing stages, a controlling caregiver and fearful behavior are recognized warning signs of abuse. A well-groomed client who feels safe and an injury that fits the explanation are reassuring findings.' }),

  // ---- Generate Solutions (3) ----
  q({ id: 'B23', part: 'B', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Hypoglycemia treatment', cj_step: 'Generate Solutions', difficulty: 'easy', type: 'mcq',
    prompt: 'A client receiving insulin reports shakiness and sweating. The glucose is 52 mg/dL. The client is alert and able to swallow. Which action should the nurse plan first?',
    choices: ['Give 15 to 20 g of a fast-acting carbohydrate such as 4 oz of juice', 'Administer glucagon intramuscularly', 'Recheck the glucose in one hour', 'Offer peanut butter crackers'], answer: 'a',
    rationale: 'An alert client who can swallow should receive a fast-acting carbohydrate, with the glucose rechecked in about 15 minutes. Glucagon is for clients who cannot swallow safely, and fat-containing snacks absorb too slowly.' }),
  q({ id: 'B24', part: 'B', subcategory: HP, topic: 'Maternal and Newborn', subtopic: 'Breast engorgement', cj_step: 'Generate Solutions', difficulty: 'easy', type: 'sata',
    prompt: 'A breastfeeding client on postpartum day 4 has firm, tender, engorged breasts. Which interventions should the nurse include in the plan of care? Select all that apply.',
    choices: ['Breastfeed frequently, at least every 2 to 3 hours', 'Apply warm compresses or take a warm shower just before feeding', 'Apply cold packs between feedings for comfort', 'Limit feedings to every 6 hours to rest the breasts', 'Restrict fluid intake to reduce milk production'], answer: 'abc',
    rationale: 'Frequent milk removal relieves engorgement, warmth before feeding helps milk flow and cold packs afterward reduce swelling and pain. Spacing feedings out or restricting fluids worsens engorgement and risks mastitis.' }),
  q({ id: 'B25', part: 'B', subcategory: PSYCH, topic: 'Mental Health', subtopic: 'Panic attack', cj_step: 'Generate Solutions', difficulty: 'easy', type: 'mcq',
    prompt: 'A client who is hyperventilating states, "I can\'t breathe and I think I\'m dying." The client is diagnosed with a panic attack. Which action should the nurse plan first?',
    choices: ['Stay with the client in a calm, quiet area and coach slow breathing', 'Leave the client alone to reduce stimulation', 'Explain the physiology of anxiety in detail', 'Ask the client to describe what triggered the attack'], answer: 'a',
    rationale: 'During a panic attack the client cannot process complex information. Staying present, keeping the environment calm and using brief, simple instructions to slow breathing is the safest first step.' }),

  // ---- Take Action (2) ----
  q({ id: 'B26', part: 'B', subcategory: SAFETY, topic: 'Safety and Infection Control', subtopic: 'Airborne precautions', cj_step: 'Take Action', difficulty: 'easy', type: 'mcq',
    prompt: 'A client has a productive cough, night sweats, and weight loss and is suspected of having pulmonary tuberculosis. Which action should the nurse take?',
    choices: ['Place the client in a negative-pressure room and wear a fit-tested N95 respirator', 'Place the client in a private room and wear a surgical mask', 'Use contact precautions with a gown and gloves', 'Place the client in a room with another client who has a cough'], answer: 'a',
    rationale: 'Tuberculosis spreads by airborne droplet nuclei, so airborne precautions are needed: a negative-pressure room and a fit-tested N95 or higher respirator for staff. A surgical mask does not protect the nurse.' }),
  q({ id: 'B29', part: 'B', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Medication error', cj_step: 'Take Action', difficulty: 'medium', type: 'mcq',
    prompt: 'A nurse realizes that a client received a double dose of a prescribed antihypertensive medication. Which action should the nurse take first?',
    choices: ['Assess the client\'s blood pressure and clinical status, then notify the provider', 'Complete an incident report before contacting the provider', 'Say nothing to the client to avoid causing worry', 'Wait to see whether symptoms develop before reporting'], answer: 'a',
    rationale: 'Client safety comes first: assess for harm such as hypotension, then notify the provider so treatment can be ordered. The event is disclosed and documented in an incident report afterward, not instead of care.' }),

  // ---- Evaluate Outcomes (2) ----
  q({ id: 'B27', part: 'B', subcategory: SAFETY, topic: 'Safety and Infection Control', subtopic: 'Fall prevention evaluation', cj_step: 'Evaluate Outcomes', difficulty: 'easy', type: 'mcq',
    prompt: 'A nurse implemented a fall-prevention plan for a client at high risk for falls. Which finding best shows that the plan is effective?',
    choices: ['The client asks for help before getting up and has had no falls in 72 hours', 'The client refuses to use the call light', 'A visitor turned off the bed alarm', 'The client walks alone to the bathroom at night'], answer: 'a',
    rationale: 'An effective plan changes behavior and outcomes: the client asks for assistance and no falls occur. The other findings show that the safeguards are not being used.' }),
  q({ id: 'B30', part: 'B', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Advance directive teaching', cj_step: 'Evaluate Outcomes', difficulty: 'medium', type: 'mcq',
    prompt: 'A nurse teaches a client about an advance directive. Which client statement shows that the teaching was effective?',
    choices: ['"I can change or cancel my directive at any time."', '"I must have a lawyer complete it for it to be valid."', '"It only takes effect if I am hospitalized for surgery."', '"My family will not be able to see it once it is signed."'], answer: 'a',
    rationale: 'A competent client may revise or revoke an advance directive at any time. A lawyer is not required, the directive applies whenever the client cannot decide, and family and providers should have copies.' }),

  // ===================== PART C - MEDICATION CALCULATIONS (all Pharmacological and Parenteral Therapies) =====================
  q({ id: 'C01', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'IV infusion rate (mL/hr)', cj_step: 'Take Action', difficulty: 'easy', type: 'mcq',
    prompt: 'A prescriber orders 1,000 mL of 0.9% sodium chloride to infuse over 8 hours by infusion pump. At what rate in mL/hr should the nurse set the pump?',
    choices: ['100 mL/hr', '125 mL/hr', '150 mL/hr', '175 mL/hr'], answer: 'b', calc: { kind: 'rate', volumeMl: 1000, hours: 8, expected: 125 },
    rationale: 'Pumps are set in mL/hr, and the rate equals the total volume divided by the time in hours: 1,000 mL ÷ 8 hours = 125 mL/hr.' }),
  q({ id: 'C02', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Gravity drip rate (gtt/min)', cj_step: 'Take Action', difficulty: 'medium', type: 'mcq',
    prompt: 'The nurse will infuse 500 mL of lactated Ringer\'s solution over 4 hours by gravity. The tubing drop factor is 15 gtt/mL. How many drops per minute should the nurse set? (Round to the nearest whole number.)',
    choices: ['21 gtt/min', '31 gtt/min', '42 gtt/min', '125 gtt/min'], answer: 'b', calc: { kind: 'gtt', volumeMl: 500, hours: 4, dropFactor: 15, expected: 31 },
    rationale: 'Drops per minute = (volume × drop factor) ÷ minutes = (500 × 15) ÷ 240 = 31.25, which rounds to 31 gtt/min.' }),
  q({ id: 'C03', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Weight-based pediatric dose', cj_step: 'Take Action', difficulty: 'medium', type: 'mcq',
    prompt: 'A prescriber orders acetaminophen 15 mg/kg by mouth for a child who weighs 18 kg. The oral suspension is 160 mg per 5 mL. How many mL should the nurse give? (Round to the nearest tenth.)',
    choices: ['4.2 mL', '8.4 mL', '9.6 mL', '16.9 mL'], answer: 'b', calc: { kind: 'weightVolume', mgPerKg: 15, weightKg: 18, mgPerMl: 160 / 5, expected: 8.4, decimals: 1 },
    rationale: 'The dose is 15 mg/kg × 18 kg = 270 mg. At 160 mg per 5 mL (32 mg/mL) the volume is 270 ÷ 32 = 8.4 mL.' }),
  q({ id: 'C04', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Unit conversion (mg to mcg)', cj_step: 'Take Action', difficulty: 'easy', type: 'mcq',
    prompt: 'A prescriber orders levothyroxine 0.1 mg by mouth daily. The tablets available contain 50 mcg each. How many tablets should the nurse administer?',
    choices: ['0.5 tablet', '1 tablet', '2 tablets', '4 tablets'], answer: 'c', calc: { kind: 'tablets', orderedMg: 0.1, tabletMcg: 50, expected: 2 },
    rationale: 'Convert first: 0.1 mg × 1,000 = 100 mcg. Then 100 mcg ÷ 50 mcg per tablet = 2 tablets.' }),
  q({ id: 'C05', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Weight-based dose with lb to kg conversion', cj_step: 'Take Action', difficulty: 'hard', type: 'mcq',
    prompt: 'A prescriber orders gentamicin 5 mg/kg IV once daily. The client weighs 154 lb, and the vial contains 40 mg/mL. How many mL should the nurse prepare? (Round to the nearest tenth.)',
    choices: ['7.0 mL', '8.8 mL', '9.6 mL', '19.3 mL'], answer: 'b', calc: { kind: 'lbWeightVolume', mgPerKg: 5, weightLb: 154, mgPerMl: 40, expected: 8.8, decimals: 1 },
    rationale: 'Convert the weight: 154 lb ÷ 2.2 = 70 kg. The dose is 5 mg/kg × 70 kg = 350 mg. Volume = 350 mg ÷ 40 mg/mL = 8.75, which rounds to 8.8 mL.' }),
  q({ id: 'C06', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Heparin infusion rate', cj_step: 'Take Action', difficulty: 'medium', type: 'mcq',
    prompt: 'A heparin infusion contains 25,000 units in 250 mL of 5% dextrose in water. The prescriber orders 1,200 units/hr. At what rate in mL/hr should the nurse set the pump?',
    choices: ['8 mL/hr', '10 mL/hr', '12 mL/hr', '24 mL/hr'], answer: 'c', calc: { kind: 'unitsInfusion', totalUnits: 25000, bagMl: 250, unitsPerHour: 1200, expected: 12 },
    rationale: 'The concentration is 25,000 units ÷ 250 mL = 100 units/mL. The rate is 1,200 units/hr ÷ 100 units/mL = 12 mL/hr.' }),
  q({ id: 'C07', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Safe dose range check', cj_step: 'Take Action', difficulty: 'hard', type: 'mcq',
    prompt: 'A child who weighs 20 kg is prescribed amoxicillin 500 mg by mouth every 12 hours. The drug guide lists a safe range of 25 to 45 mg/kg/day in divided doses. What should the nurse do?',
    choices: ['Hold the dose and clarify with the prescriber because the daily dose exceeds the safe range', 'Give the dose because it is within the safe range', 'Give half of the dose and document it', 'Give the dose and monitor for a rash'], answer: 'a',
    calc: { kind: 'safeRange', doseMg: 500, dosesPerDay: 2, weightKg: 20, minMgKgDay: 25, maxMgKgDay: 45, expected: 'unsafe', mgKgDay: 50 },
    rationale: 'The daily dose is 500 mg × 2 = 1,000 mg, which is 1,000 ÷ 20 = 50 mg/kg/day. This is above the listed maximum of 45 mg/kg/day, so the nurse holds the dose and clarifies the order before giving it.' }),
  q({ id: 'C08', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'IV push administration time', cj_step: 'Take Action', difficulty: 'medium', type: 'mcq',
    prompt: 'A prescriber orders furosemide 40 mg IV push. Hospital policy states that the drug must not be given faster than 20 mg/min. Over what minimum time should the nurse administer the dose?',
    choices: ['0.5 minute', '1 minute', '2 minutes', '4 minutes'], answer: 'c', calc: { kind: 'pushTime', doseMg: 40, maxMgPerMin: 20, expected: 2 },
    rationale: 'Minimum time = dose ÷ maximum rate = 40 mg ÷ 20 mg/min = 2 minutes. Giving it faster raises the risk of hearing loss (ototoxicity) and hypotension.' }),
  q({ id: 'C09', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'IV piggyback rate', cj_step: 'Take Action', difficulty: 'easy', type: 'mcq',
    prompt: 'An antibiotic 100 mL IV piggyback is prescribed to infuse over 30 minutes by pump. At what rate in mL/hr should the nurse program the pump?',
    choices: ['50 mL/hr', '100 mL/hr', '150 mL/hr', '200 mL/hr'], answer: 'd', calc: { kind: 'rate', volumeMl: 100, hours: 0.5, expected: 200 },
    rationale: 'Pumps are programmed in mL/hr. 100 mL over 30 minutes is 100 mL ÷ 0.5 hour = 200 mL/hr.' }),
  q({ id: 'C10', part: 'C', subcategory: PHARM, topic: 'Pharmacology', subtopic: 'Titrated infusion (mcg/kg/min)', cj_step: 'Take Action', difficulty: 'hard', type: 'mcq',
    prompt: 'A prescriber orders dopamine 5 mcg/kg/min for a client who weighs 80 kg. The premixed bag contains 400 mg in 250 mL. At what rate in mL/hr should the nurse set the pump?',
    choices: ['7.5 mL/hr', '15 mL/hr', '24 mL/hr', '30 mL/hr'], answer: 'b', calc: { kind: 'mcgKgMin', mcgPerKgMin: 5, weightKg: 80, bagMg: 400, bagMl: 250, expected: 15 },
    rationale: 'The dose is 5 mcg/kg/min × 80 kg = 400 mcg/min, or 24,000 mcg/hr. The concentration is 400,000 mcg ÷ 250 mL = 1,600 mcg/mL. The rate is 24,000 ÷ 1,600 = 15 mL/hr.' }),

  // ===================== PART D - PRIORITIZATION AND DELEGATION =====================
  q({ id: 'D01', part: 'D', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Prioritizing client assessment', cj_step: 'Prioritize Hypotheses', difficulty: 'easy', type: 'mcq',
    prompt: 'During shift report, a nurse receives information about four clients. Which client should the nurse assess first?',
    choices: ['A client with COPD whose SpO2 is 91% on room air, which is the client\'s baseline', 'A client on postoperative day 1 who rates incisional pain 4/10', 'A client admitted 30 minutes ago who now reports new chest pressure and shortness of breath', 'A client with type 2 diabetes with a glucose of 188 mg/dL before lunch'], answer: 'c',
    rationale: 'New chest pressure with shortness of breath may indicate a life-threatening cardiac or pulmonary event and is an acute change. The other clients are stable or at their baseline.' }),
  q({ id: 'D02', part: 'D', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Delegation to UAP', cj_step: 'Take Action', difficulty: 'easy', type: 'mcq',
    prompt: 'Which task may the registered nurse delegate to an assistive personnel (UAP)?',
    choices: ['Obtain vital signs for a stable postoperative client', 'Assess a client\'s new onset of chest pain', 'Teach a client how to self-administer insulin', 'Evaluate a client\'s response to a PRN analgesic'], answer: 'a',
    rationale: 'Assessment, teaching and evaluation cannot be delegated. Taking vital signs on a stable client is a routine task within the UAP role, and the nurse then interprets the results.' }),
  q({ id: 'D03', part: 'D', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Assignment to LPN/LVN', cj_step: 'Take Action', difficulty: 'medium', type: 'mcq',
    prompt: 'The charge nurse is making assignments. Which client is most appropriate to assign to a licensed practical nurse (LPN/LVN)?',
    choices: ['A client with stable chronic heart failure who needs oral medications and routine monitoring', 'A client with an unstable gastrointestinal bleed', 'A newly admitted client who needs a comprehensive initial assessment', 'A client who needs a comprehensive discharge teaching plan'], answer: 'a',
    rationale: 'LPNs care for stable clients with predictable outcomes. Unstable clients, initial comprehensive assessment and development of teaching plans belong to the registered nurse.' }),
  q({ id: 'D04', part: 'D', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Task prioritization', cj_step: 'Prioritize Hypotheses', difficulty: 'easy', type: 'mcq',
    prompt: 'After receiving report, which task should the nurse complete first?',
    choices: ['Assess a client whom the assistive personnel reports has new facial droop and slurred speech', 'Administer a scheduled 0900 oral medication to a stable client', 'Reinforce discharge teaching for a client who is going home', 'Document the morning assessments'], answer: 'a',
    rationale: 'New facial droop and slurred speech are signs of a possible stroke and are time-critical. Scheduled medications, teaching and documentation can safely wait.' }),
  q({ id: 'D05', part: 'D', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Delegation to UAP', cj_step: 'Take Action', difficulty: 'medium', type: 'sata',
    prompt: 'Which tasks can the registered nurse delegate to an assistive personnel (UAP)? Select all that apply.',
    choices: ['Measure and record intake and output for a stable client', 'Assist a stable client to ambulate to the bathroom', 'Provide a bed bath', 'Assess skin integrity and stage a pressure injury', 'Reinforce teaching about a new insulin regimen'], answer: 'abc',
    rationale: 'Intake and output, routine ambulation assistance and bathing are routine tasks for stable clients. Skin assessment and staging and client teaching require the judgment of a registered nurse.' }),
  q({ id: 'D06', part: 'D', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Unstable versus stable', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'Which client should the nurse see first?',
    choices: ['A client with new atrial fibrillation, HR 148/min, BP 82/50 mmHg, who is dizzy and diaphoretic', 'A client with a COPD exacerbation who is stable on 2 L/min oxygen with an SpO2 of 92%', 'A postoperative client who rates pain 6/10 and requests analgesia', 'A client with a urinary tract infection who requests an antibiotic'], answer: 'a',
    rationale: 'A rapid rhythm with hypotension, dizziness and diaphoresis shows hemodynamic instability and needs immediate intervention. The other clients are stable and can be seen afterward.' }),
  q({ id: 'D07', part: 'D', subcategory: MOC, topic: 'Leadership and Delegation', subtopic: 'Safe assignments', cj_step: 'Evaluate Outcomes', difficulty: 'hard', type: 'mcq',
    prompt: 'The charge nurse is reviewing the assignments for the shift. Which assignment should the charge nurse question?',
    choices: ['An RN caring for a client with active pulmonary tuberculosis is also assigned to a client who is severely immunocompromised after a stem cell transplant', 'An RN is assigned two clients in adjacent rooms who have similar diagnoses', 'An LPN/LVN is assigned a stable client with a chronic condition', 'An assistive personnel is assigned to help two clients with bathing'], answer: 'a',
    rationale: 'Assigning one nurse to a client with an airborne infection and to a severely immunocompromised client creates a serious risk of transmission. The other assignments are appropriate for the roles.' }),
  q({ id: 'D08', part: 'D', subcategory: MOC, topic: 'Emergency and Critical Care', subtopic: 'Triage', cj_step: 'Prioritize Hypotheses', difficulty: 'medium', type: 'mcq',
    prompt: 'A nurse is triaging four clients in the emergency department. Which client has the highest priority?',
    choices: ['An adult with a forearm laceration that has controlled bleeding', 'An adult with sudden shortness of breath, stridor, and swelling of the lips after eating shrimp', 'An adult with abdominal pain of 5/10 for 2 days', 'A child with a temperature of 38.2°C and ear pain'], answer: 'b',
    rationale: 'Airway compromise from anaphylaxis is the most immediately life-threatening problem. Airway, breathing and circulation take priority over pain, fever and controlled bleeding.' }),
  q({ id: 'D09', part: 'D', subcategory: PHYS, topic: 'Emergency and Critical Care', subtopic: 'Anaphylaxis', cj_step: 'Take Action', difficulty: 'medium', type: 'mcq',
    prompt: 'A client develops facial swelling, wheezing, hypotension, and hives minutes after receiving an IV antibiotic. The nurse has stopped the infusion and called for help. Which prescribed intervention should the nurse implement first?',
    choices: ['Administer epinephrine intramuscularly', 'Start an IV bolus of 0.9% sodium chloride', 'Administer diphenhydramine intravenously', 'Obtain a full set of vital signs for comparison'], answer: 'a',
    rationale: 'Intramuscular epinephrine is the first-line treatment for anaphylaxis and reverses airway swelling and hypotension. Fluids, antihistamines and full monitoring follow.' }),
  q({ id: 'D10', part: 'D', subcategory: PHYS, topic: 'Emergency and Critical Care', subtopic: 'Tension pneumothorax', cj_step: 'Prioritize Hypotheses', difficulty: 'hard', type: 'mcq',
    prompt: 'A client receiving mechanical ventilation suddenly has hypotension, absent breath sounds on the right, tracheal deviation to the left, and distended neck veins. What should the nurse do first?',
    choices: ['Notify the provider immediately and prepare for emergency needle decompression while maintaining oxygenation', 'Obtain a portable chest x-ray and wait for the results before acting', 'Increase the ventilator rate', 'Administer a PRN sedative'], answer: 'a',
    rationale: 'These findings indicate a tension pneumothorax, which compresses the heart and lungs and can cause cardiac arrest within minutes. It is treated clinically with immediate decompression, not after imaging.' }),
];

// ---- Answer-position balancing (deterministic) ----
// Authored order puts most correct answers first, which test-wise students can exploit. Single-answer items get
// their correct option placed in the least-used position; select-all options are shuffled. Numeric (calculation)
// options keep ascending order, which is the NCLEX convention.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const IDS = ['a', 'b', 'c', 'd', 'e', 'f'];
function shuffled(list, random) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}
function finalize(items) {
  const random = mulberry32(20260921);
  const counts = { a: 0, b: 0, c: 0, d: 0 };
  const fixedOrder = item => Boolean(item.calc);
  // Count positions already fixed by ordered numeric options.
  for (const item of items) if (fixedOrder(item) && item.type === 'mcq') counts[item.answer] += 1;
  return items.map(item => {
    const correctIndexes = [...item.answer].map(letter => IDS.indexOf(letter));
    let order = item.choices.map((_, i) => i);
    if (!fixedOrder(item)) {
      if (item.type === 'mcq') {
        const target = Object.entries(counts).sort((x, y) => x[1] - y[1] || (random() - 0.5))[0][0];
        const targetIndex = IDS.indexOf(target);
        const others = shuffled(order.filter(i => i !== correctIndexes[0]), random);
        order = others.slice(0, targetIndex).concat([correctIndexes[0]], others.slice(targetIndex));
        counts[target] += 1;
      } else order = shuffled(order, random);
    }
    const choices = order.map((original, position) => ({ id: IDS[position], text: item.choices[original] }));
    const correct = order.map((original, position) => (correctIndexes.includes(original) ? IDS[position] : null)).filter(Boolean);
    const { answer, ...rest } = item; // eslint-disable-line no-unused-vars
    const why = WHY[item.id];
    const option_explanations = Object.fromEntries(order.map((original, position) => [IDS[position], { is_correct: correct.includes(IDS[position]), explanation: why?.[original] ?? '' }]));
    return { ...rest, choices, correct, correct_answer_explanation: item.rationale, option_explanations };
  });
}
export const ITEMS = finalize(RAW);

export const PLAN = {
  parts: { B: 30, C: 10, D: 10 },
  bySubcategory: { [MOC]: 11, [SAFETY]: 4, [HP]: 2, [PSYCH]: 3, [BASIC]: 2, [PHARM]: 14, [RISK]: 5, [PHYS]: 9 },
  partBSteps: { 'Analyze Cues': 10, 'Prioritize Hypotheses': 10, 'Recognize Cues': 3, 'Generate Solutions': 3, 'Take Action': 2, 'Evaluate Outcomes': 2 },
};
