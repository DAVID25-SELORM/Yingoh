import React, { useId } from 'react';
import { CheckCircle2, ExternalLink, XCircle } from 'lucide-react';
import { feedbackModel } from '../utils/structuredExplanations';

function choiceText(choices) {
  return choices.length
    ? choices.map((choice) => `${String(choice.id).toUpperCase()}. ${choice.text}`).join('; ')
    : 'See the reviewed answer details below.';
}

export default function AnswerExplanation({ question, selectedIds = [], isCorrect, showReviewInfo = true }) {
  const model = feedbackModel(question, selectedIds);
  const headingPrefix = useId();
  const headingId = (name) => `${headingPrefix}-${name}`;
  return (
    <div className="answer-explanation">
      <div className={`qb-result ${isCorrect ? 'result-correct' : 'result-wrong'}`} role="status" aria-live="polite">
        <div className="result-verdict">
          {isCorrect ? <><CheckCircle2 size={22} /> Correct!</> : <><XCircle size={22} /> Incorrect</>}
        </div>
      </div>

      <section className="explanation-section" aria-labelledby={headingId('your-answer')}>
        <h3 id={headingId('your-answer')}>Your selected answer{model.selectedChoices.length === 1 ? '' : 's'}</h3>
        <p>{choiceText(model.selectedChoices)}</p>
      </section>

      <section className="explanation-section explanation-correct" aria-labelledby={headingId('correct-answer')}>
        <h3 id={headingId('correct-answer')}>Correct answer{model.correctChoices.length === 1 ? '' : 's'}</h3>
        <p>{choiceText(model.correctChoices)}</p>
      </section>

      {model.correctAnswerExplanation && (
        <section className="explanation-section" aria-labelledby={headingId('why-correct')}>
          <h3 id={headingId('why-correct')}>Why this is correct</h3>
          <p className="preserve-format">{model.correctAnswerExplanation}</p>
        </section>
      )}

      {model.optionRows.length > 0 && (
        <section className="explanation-section" aria-labelledby={headingId('option-explanations')}>
          <h3 id={headingId('option-explanations')}>Why each option is correct or incorrect</h3>
          <div className="option-explanation-list">
            {model.optionRows.map((option) => (
              <article key={option.id} className={option.is_correct ? 'option-explanation-correct' : 'option-explanation-wrong'}>
                <strong>{String(option.id).toUpperCase()}. {option.text} — {option.is_correct ? 'Correct' : 'Incorrect'}</strong>
                <p>{option.explanation}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {model.immediateResponse && (
        <section className="explanation-section explanation-response" aria-labelledby={headingId('immediate-response')}>
          <h3 id={headingId('immediate-response')}>What the nurse should do</h3>
          <p className="preserve-format">{model.immediateResponse}</p>
        </section>
      )}

      {model.strategy && (
        <section className="explanation-section explanation-strategy" aria-labelledby={headingId('strategy')}>
          <h3 id={headingId('strategy')}>Test-taking strategy</h3>
          <p className="preserve-format">{model.strategy}</p>
        </section>
      )}

      {model.references.length > 0 && (
        <section className="explanation-section" aria-labelledby={headingId('references')}>
          <h3 id={headingId('references')}>Clinical references</h3>
          <ul className="explanation-references">
            {model.references.map((reference, index) => (
              <li key={`${reference.url}-${index}`}>
                <a href={reference.url} target="_blank" rel="noreferrer">
                  {reference.title || reference.url}{reference.organization ? ` — ${reference.organization}` : ''} <ExternalLink size={13} />
                </a>
                {reference.accessed_at && <span>Accessed {reference.accessed_at}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showReviewInfo && model.reviewedAt && (
        <p className="clinical-review-note">Clinically reviewed {new Date(model.reviewedAt).toLocaleDateString()}.</p>
      )}
      {model.usesLegacyFallback && <p className="legacy-explanation-note">Legacy explanation shown while structured option review is pending.</p>}
    </div>
  );
}
