-- Replace the generic generated rationale for the published malignant
-- hyperthermia deterioration item with clinically reviewed teaching content.
-- Sources reviewed 2026-08-09:
--   MHAUS: https://www.mhaus.org/healthcare-professionals/managing-a-crisis/
--   EMHG:  https://www.emhg.org/recommendations-1

do $$
declare
  affected_rows integer;
begin
  update public.questions
  set
    rationale = $rationale$
Malignant hyperthermia is a life-threatening hypermetabolic reaction, usually triggered by a potent volatile anaesthetic or succinylcholine in a susceptible patient.

Why the clinical cues matter

Generalized muscle rigidity together with a rapidly rising end-tidal carbon dioxide (ETCO2) level strongly suggests that the crisis is actively worsening. Uncontrolled skeletal-muscle metabolism produces excessive carbon dioxide, so ETCO2 may continue rising despite adequate ventilation. Tachycardia, respiratory and metabolic acidosis, hyperkalaemia, rapidly increasing core temperature, rhabdomyolysis, dysrhythmias, and cardiac arrest may follow. A very high temperature can be a later sign; treatment must not wait for it.

Immediate response

Declare an emergency and call for assistance. Stop all triggering anaesthetic agents and succinylcholine. Hyperventilate with 100% oxygen at high flow. Obtain the malignant-hyperthermia cart and administer IV dantrolene immediately according to the emergency protocol. Monitor ETCO2, ECG, oxygen saturation, core temperature, and urine output. Obtain blood gases, potassium, creatine kinase, glucose, renal-function, urine-myoglobin, and coagulation studies as clinically indicated. Actively manage hyperthermia, acidosis, hyperkalaemia, dysrhythmias, and myoglobinuria. Diagnostic and genetic confirmation occurs after stabilization and must never delay treatment.

Why each option is correct or incorrect

A. Continue the anaesthetic at a lower dose — Incorrect. If it is a triggering volatile agent, reducing the dose is not sufficient. Exposure must stop immediately because it can intensify the hypermetabolic crisis. If anaesthesia must continue, use a non-triggering intravenous technique according to the anaesthesia emergency plan.

B. Use antipyretics as the only treatment — Incorrect. Malignant hyperthermia is not an ordinary hypothalamic fever. It results from uncontrolled calcium release and skeletal-muscle metabolism, so antipyretics do not correct the underlying emergency. Dantrolene, removal of triggers, oxygenation, ventilation, cooling when indicated, and treatment of complications are required.

C. Generalized rigidity with rapidly rising end-tidal carbon dioxide — Correct. This combination reflects uncontrolled muscle contraction and sharply increased carbon-dioxide production. Rising ETCO2 is an important early warning sign and may precede marked hyperthermia.

D. Delay dantrolene until genetic confirmation — Incorrect. Malignant hyperthermia is treated on clinical suspicion. Waiting for genetic or contracture testing can permit rapid deterioration. Confirmatory testing is arranged only after the emergency is controlled.

Clinical references: Malignant Hyperthermia Association of the United States, Managing a Crisis (https://www.mhaus.org/healthcare-professionals/managing-a-crisis/); European Malignant Hyperthermia Group, Recognising and managing a malignant hyperthermia crisis (https://www.emhg.org/recommendations-1).
$rationale$,
    strategy = $strategy$
Look for two linked signs of rapid physiological deterioration: generalized rigidity indicates uncontrolled skeletal-muscle contraction, while rising ETCO2 indicates sharply increasing metabolism and carbon-dioxide production. Remember: stop the trigger, call for help, give 100% oxygen, and administer dantrolene without delay. Do not wait for severe hyperthermia or laboratory confirmation.
$strategy$,
    reference_url = 'https://www.mhaus.org/healthcare-professionals/managing-a-crisis/',
    quality_notes = concat_ws(
      E'\n',
      nullif(trim(coalesce(quality_notes, '')), ''),
      'Expanded option-by-option rationale clinically sourced from MHAUS and EMHG; reviewed 2026-08-09.'
    ),
    updated_at = now()
  where lower(trim(prompt)) = lower(trim(
    'During reassessment of a client with malignant hyperthermia, which finding should the nurse escalate without delay?'
  ));

  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Expected one malignant-hyperthermia reassessment question, updated %', affected_rows;
  end if;
end;
$$;
