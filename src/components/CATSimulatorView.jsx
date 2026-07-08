import React, { useEffect, useRef, useState } from 'react';
import { Calculator, Flag, X } from 'lucide-react';
import {
  BowTieQuestion, MatrixQuestion, OrderedResponseQuestion, HighlightQuestion,
  bowTieIsCorrect, bowTieHasAnswer, matrixIsCorrect, matrixHasAnswer,
  orderedIsCorrect, highlightIsCorrect,
} from './NGNRenderer';
import {
  initialTheta, initialStep, nextTheta, pickNextQuestion, shouldStop, PASSING_THETA, topicKeyFor,
} from '../utils/adaptiveEngine';

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

function initialAnswerFor(question) {
  if (question?.question_type === 'bow_tie') return { left: [], right: [] };
  if (question?.question_type === 'matrix') return {};
  return [];
}

function hasAnswer(question, answer) {
  const type = question?.question_type;
  if (type === 'mcq' || type === 'sata' || type === 'highlight') return Array.isArray(answer) && answer.length > 0;
  if (type === 'bow_tie') return bowTieHasAnswer(answer);
  if (type === 'matrix') return matrixHasAnswer(answer);
  if (type === 'ordered_response') return true;
  return false;
}

function scoreAnswer(question, answer) {
  const type = question?.question_type;
  if (type === 'mcq') return Array.isArray(answer) && answer.length === 1 && answer[0] === question.correct_answer?.ids?.[0];
  if (type === 'sata') {
    const selected = [...(answer ?? [])].sort();
    const correct = [...(question.correct_answer?.ids ?? [])].sort();
    return selected.length === correct.length && selected.every((v, i) => v === correct[i]);
  }
  if (type === 'bow_tie') return bowTieIsCorrect(question, answer);
  if (type === 'matrix') return matrixIsCorrect(question, answer);
  if (type === 'ordered_response') return orderedIsCorrect(question, answer);
  if (type === 'highlight') return highlightIsCorrect(question, answer);
  return false;
}

function CalculatorPopover({ onClose }) {
  const [display, setDisplay] = useState('0');
  const [accumulator, setAccumulator] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  function compute(a, b, op) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? 0 : a / b;
    return b;
  }

  function inputDigit(d) {
    if (waitingForOperand) { setDisplay(d); setWaitingForOperand(false); }
    else setDisplay(display === '0' ? d : display + d);
  }
  function inputDecimal() {
    if (waitingForOperand) { setDisplay('0.'); setWaitingForOperand(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  }
  function clearAll() { setDisplay('0'); setAccumulator(null); setOperator(null); setWaitingForOperand(false); }
  function chooseOperator(nextOp) {
    const inputValue = parseFloat(display);
    if (accumulator == null) setAccumulator(inputValue);
    else if (operator && !waitingForOperand) setAccumulator(compute(accumulator, inputValue, operator));
    setWaitingForOperand(true);
    setOperator(nextOp);
  }
  function equals() {
    const inputValue = parseFloat(display);
    if (operator && accumulator != null) {
      setDisplay(String(compute(accumulator, inputValue, operator)));
      setAccumulator(null);
      setOperator(null);
      setWaitingForOperand(true);
    }
  }

  return (
    <div className="cat-sim-calculator-popover">
      <div className="cat-sim-calc-head">
        <span>Calculator</span>
        <button type="button" className="icon-btn" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="cat-sim-calc-display">{display}</div>
      <div className="cat-sim-calc-keys">
        <button type="button" className="cat-sim-calc-key" onClick={clearAll}>C</button>
        <button type="button" className="cat-sim-calc-key" onClick={() => setDisplay(String(parseFloat(display) * -1))}>±</button>
        <button type="button" className="cat-sim-calc-key" onClick={() => chooseOperator('÷')}>÷</button>
        <button type="button" className="cat-sim-calc-key" onClick={() => chooseOperator('×')}>×</button>
        {[7, 8, 9].map((n) => <button type="button" key={n} className="cat-sim-calc-key" onClick={() => inputDigit(String(n))}>{n}</button>)}
        <button type="button" className="cat-sim-calc-key" onClick={() => chooseOperator('-')}>−</button>
        {[4, 5, 6].map((n) => <button type="button" key={n} className="cat-sim-calc-key" onClick={() => inputDigit(String(n))}>{n}</button>)}
        <button type="button" className="cat-sim-calc-key" onClick={() => chooseOperator('+')}>+</button>
        {[1, 2, 3].map((n) => <button type="button" key={n} className="cat-sim-calc-key" onClick={() => inputDigit(String(n))}>{n}</button>)}
        <button type="button" className="cat-sim-calc-key cat-sim-calc-key-tall" onClick={equals} style={{ gridRow: 'span 2' }}>=</button>
        <button type="button" className="cat-sim-calc-key" style={{ gridColumn: 'span 2' }} onClick={() => inputDigit('0')}>0</button>
        <button type="button" className="cat-sim-calc-key" onClick={inputDecimal}>.</button>
      </div>
    </div>
  );
}

function McqSataChoices({ question, answer, setAnswer, struck, toggleStruck }) {
  const isMulti = question.question_type === 'sata';
  function toggle(id) {
    if (isMulti) setAnswer((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    else setAnswer([id]);
  }
  return (
    <div className="cat-sim-choice-list">
      {isMulti && <div className="cat-sim-sata-hint">Select all that apply.</div>}
      {(question.choices ?? []).map((choice) => {
        const isSel = answer.includes(choice.id);
        const isStruck = struck.has(choice.id);
        return (
          <div key={choice.id} className={`cat-sim-choice ${isSel ? 'cat-sim-choice-selected' : ''} ${isStruck ? 'cat-sim-choice-struck' : ''}`}>
            <button type="button" className="cat-sim-choice-main" onClick={() => toggle(choice.id)}>
              <span className={`cat-sim-choice-mark ${isMulti ? 'cat-sim-choice-mark-box' : 'cat-sim-choice-mark-circle'}`}>{isSel ? '✓' : ''}</span>
              <span className="cat-sim-choice-text">{choice.text}</span>
            </button>
            <button
              type="button"
              className="cat-sim-strike-toggle"
              title="Strike out this option"
              onClick={() => toggleStruck(choice.id)}
            >
              S
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default function CATSimulatorView({ pool, maxItems, minItems, statsMap, onSubmitAnswer, onComplete, onExit }) {
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [engine, setEngine] = useState(() => ({
    theta: initialTheta(),
    step: initialStep(),
    history: [],
    askedIds: new Set(),
    topicCounts: new Map(),
  }));
  const [servedQuestions, setServedQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [currentAnswer, setCurrentAnswer] = useState([]);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [struck, setStruck] = useState(new Set());
  const [flagged, setFlagged] = useState(new Set());
  const questionStartRef = useRef(Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    const first = pickNextQuestion(pool, new Set(), initialTheta(), statsMap, new Map());
    setCurrentQuestion(first);
    if (first) setServedQuestions([first]);
    const id = setInterval(() => setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleStruck(choiceId) {
    setStruck((prev) => {
      const next = new Set(prev);
      next.has(choiceId) ? next.delete(choiceId) : next.add(choiceId);
      return next;
    });
  }

  function finish(reason) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const finalTheta = engine.history.length ? engine.history[engine.history.length - 1].theta : engine.theta;
    const result = {
      answers: engine.history.map((h) => ({ questionId: h.questionId, correct: h.correct, timeTaken: h.timeTaken })),
      questions: servedQuestions.slice(0, Math.max(engine.history.length, 1)),
      passed: finalTheta >= PASSING_THETA,
      finalTheta,
      timeUsed: Math.round((Date.now() - startTimeRef.current) / 1000),
      reason,
    };
    if (reason === 'exit') onExit(result);
    else onComplete(result);
  }

  function requestAdvance() {
    if (!currentQuestion || !hasAnswer(currentQuestion, currentAnswer)) return;
    setAwaitingConfirm(true);
  }

  function cancelAdvance() {
    setAwaitingConfirm(false);
  }

  function confirmAdvance() {
    const timeTaken = Math.round((Date.now() - questionStartRef.current) / 1000);
    const correct = scoreAnswer(currentQuestion, currentAnswer);
    const { theta: newTheta, step: newStep } = nextTheta(engine.theta, correct, engine.step);

    onSubmitAnswer?.(currentQuestion.id, currentAnswer, correct, timeTaken);

    const newHistory = [...engine.history, {
      questionId: currentQuestion.id, correct, timeTaken, theta: newTheta,
    }];
    const newAskedIds = new Set(engine.askedIds);
    newAskedIds.add(currentQuestion.id);
    const newTopicCounts = new Map(engine.topicCounts);
    const key = topicKeyFor(currentQuestion);
    newTopicCounts.set(key, (newTopicCounts.get(key) ?? 0) + 1);

    const verdict = shouldStop(newHistory, minItems, maxItems);
    const nextQuestion = verdict.stop ? null : pickNextQuestion(pool, newAskedIds, newTheta, statsMap, newTopicCounts);

    setEngine({ theta: newTheta, step: newStep, history: newHistory, askedIds: newAskedIds, topicCounts: newTopicCounts });
    setAwaitingConfirm(false);
    setStruck(new Set());

    if (verdict.stop || !nextQuestion) {
      finishedRef.current = true;
      const result = {
        answers: newHistory.map((h) => ({ questionId: h.questionId, correct: h.correct, timeTaken: h.timeTaken })),
        questions: [...servedQuestions],
        passed: verdict.passed ?? (newTheta >= PASSING_THETA),
        finalTheta: newTheta,
        timeUsed: Math.round((Date.now() - startTimeRef.current) / 1000),
        reason: verdict.reason ?? 'pool_exhausted',
      };
      onComplete(result);
      return;
    }

    setServedQuestions((prev) => [...prev, nextQuestion]);
    setCurrentQuestion(nextQuestion);
    setCurrentAnswer(initialAnswerFor(nextQuestion));
    questionStartRef.current = Date.now();
  }

  if (!currentQuestion) return null;

  const itemNumber = engine.history.length + 1;
  const isFlagged = flagged.has(currentQuestion.id);
  const type = currentQuestion.question_type;

  return (
    <div className="cat-sim-overlay">
      <div className="cat-sim-topbar">
        <span className="cat-sim-topbar-brand">NCLEX-RN &middot; CAT Simulation</span>
        <span className="cat-sim-topbar-item">Item {itemNumber}</span>
        <span className="cat-sim-topbar-timer">{formatElapsed(elapsed)}</span>
      </div>

      <div className="cat-sim-body">
        <div className="cat-sim-question">
          <p className="cat-sim-prompt">{currentQuestion.prompt}</p>

          {(type === 'mcq' || type === 'sata') && (
            <McqSataChoices
              key={currentQuestion.id}
              question={currentQuestion}
              answer={currentAnswer}
              setAnswer={setCurrentAnswer}
              struck={struck}
              toggleStruck={toggleStruck}
            />
          )}
          {type === 'bow_tie' && (
            <BowTieQuestion key={currentQuestion.id} question={currentQuestion} submitted={false} onAnswer={setCurrentAnswer} />
          )}
          {type === 'matrix' && (
            <MatrixQuestion key={currentQuestion.id} question={currentQuestion} submitted={false} onAnswer={setCurrentAnswer} />
          )}
          {type === 'ordered_response' && (
            <OrderedResponseQuestion key={currentQuestion.id} question={currentQuestion} submitted={false} onAnswer={setCurrentAnswer} />
          )}
          {type === 'highlight' && (
            <HighlightQuestion key={currentQuestion.id} question={currentQuestion} submitted={false} onAnswer={setCurrentAnswer} />
          )}
        </div>
        {awaitingConfirm && <div className="cat-sim-lock-overlay" />}
      </div>

      <div className="cat-sim-toolbar">
        <div className="cat-sim-toolbar-left">
          <button type="button" className="cat-sim-tool-btn" onClick={() => setCalculatorOpen((v) => !v)}>
            <Calculator size={16} /> Calculator
          </button>
          <button
            type="button"
            className={`cat-sim-tool-btn ${isFlagged ? 'cat-sim-flag-active' : ''}`}
            title="Flagging does not allow you to return to this item — matches the real exam."
            onClick={() => setFlagged((prev) => {
              const next = new Set(prev);
              next.has(currentQuestion.id) ? next.delete(currentQuestion.id) : next.add(currentQuestion.id);
              return next;
            })}
          >
            <Flag size={16} /> Flag for Review
          </button>
          <button type="button" className="cat-sim-tool-btn cat-sim-end-btn" onClick={() => finish('exit')}>
            End Simulation
          </button>
        </div>
        <button type="button" className="primary-btn cat-sim-next-btn" onClick={requestAdvance} disabled={!hasAnswer(currentQuestion, currentAnswer)}>
          Next
        </button>
      </div>

      {calculatorOpen && <CalculatorPopover onClose={() => setCalculatorOpen(false)} />}

      {awaitingConfirm && (
        <div className="cat-sim-confirm-backdrop">
          <div className="cat-sim-confirm-modal">
            <h3>Confirm Your Answer</h3>
            <p>Once you continue, you cannot return to this item. This matches how the real NCLEX-CAT works.</p>
            <div className="cat-sim-confirm-actions">
              <button type="button" className="ghost-btn" onClick={cancelAdvance}>Review My Answer</button>
              <button type="button" className="primary-btn" onClick={confirmAdvance}>Confirm &amp; Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
