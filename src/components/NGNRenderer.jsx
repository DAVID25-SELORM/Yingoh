import React, { useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   BOW TIE
   ngn_data: { left_label, right_label, left_choices[], right_choices[],
               correct_left[], correct_right[] }
   prompt = clinical scenario + central condition
   ───────────────────────────────────────────────────────── */
export function BowTieQuestion({ question, submitted, onAnswer }) {
  const [leftSel, setLeftSel] = useState([]);
  const [rightSel, setRightSel] = useState([]);
  const d = question.ngn_data ?? {};

  function toggleLeft(id) {
    if (submitted) return;
    setLeftSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }
  function toggleRight(id) {
    if (submitted) return;
    setRightSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }

  const totalCorrect = (d.correct_left?.length ?? 0) + (d.correct_right?.length ?? 0);
  const totalSelected = leftSel.length + rightSel.length;

  React.useEffect(() => {
    if (onAnswer) onAnswer({ left: leftSel, right: rightSel });
  }, [leftSel, rightSel]);

  function isLeftCorrect(id) { return d.correct_left?.includes(id); }
  function isRightCorrect(id) { return d.correct_right?.includes(id); }

  function choiceStyle(isSelected, isCorrectFn, id) {
    if (!submitted) return {
      background: isSelected ? '#e9f6f4' : '#fff',
      border: `1.5px solid ${isSelected ? '#29b7a3' : '#dbe6e4'}`,
    };
    const correct = isCorrectFn(id);
    if (correct) return { background: '#e2f5f2', border: '1.5px solid #b9e3dc' };
    if (isSelected && !correct) return { background: '#fce8e6', border: '1.5px solid #f5bcb6' };
    return { background: '#fafcfb', border: '1.5px solid #dbe6e4' };
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 16, alignItems: 'start', marginTop: 8 }}>
        {/* Left column */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', color: '#2b8a7d', marginBottom: 10 }}>
            {d.left_label ?? 'Actions to Take'}
            <span style={{ color: '#607478', fontWeight: 400 }}> (select {d.correct_left?.length ?? 2})</span>
          </div>
          <div style={{ display: 'grid', gap: 7 }}>
            {(d.left_choices ?? []).map((c) => {
              const isSel = leftSel.includes(c.id);
              const style = choiceStyle(isSel, isLeftCorrect, c.id);
              return (
                <button key={c.id} onClick={() => toggleLeft(c.id)} disabled={submitted} style={{ ...style, padding: '9px 12px', borderRadius: 8, textAlign: 'left', cursor: submitted ? 'default' : 'pointer', display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.87rem', lineHeight: 1.4, width: '100%' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSel ? '#29b7a3' : submitted && isLeftCorrect(c.id) ? '#29b7a3' : '#c0cece'}`, background: isSel ? '#29b7a3' : submitted && isLeftCorrect(c.id) ? '#29b7a3' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {(isSel || (submitted && isLeftCorrect(c.id))) && <CheckCircle2 size={12} color="#fff" />}
                  </span>
                  {c.text}
                  {submitted && !isSel && isLeftCorrect(c.id) && <CheckCircle2 size={14} color="#29b7a3" style={{ marginLeft: 'auto' }} />}
                  {submitted && isSel && !isLeftCorrect(c.id) && <XCircle size={14} color="#e85d4f" style={{ marginLeft: 'auto' }} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Center — condition */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingTop: 28 }}>
          <div style={{ width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderLeft: '16px solid #29b7a3' }} />
          <div style={{ width: 100, padding: '10px 12px', background: 'linear-gradient(135deg,#17313a,#2b8a7d)', borderRadius: 10, textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#fff', lineHeight: 1.4, margin: '4px 0' }}>
            {d.condition ?? 'Central Condition'}
          </div>
          <div style={{ width: 0, height: 0, borderTop: '12px solid transparent', borderBottom: '12px solid transparent', borderRight: '16px solid #29b7a3' }} />
        </div>

        {/* Right column */}
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.82rem', textTransform: 'uppercase', color: '#2b8a7d', marginBottom: 10 }}>
            {d.right_label ?? 'Parameters to Monitor'}
            <span style={{ color: '#607478', fontWeight: 400 }}> (select {d.correct_right?.length ?? 2})</span>
          </div>
          <div style={{ display: 'grid', gap: 7 }}>
            {(d.right_choices ?? []).map((c) => {
              const isSel = rightSel.includes(c.id);
              const style = choiceStyle(isSel, isRightCorrect, c.id);
              return (
                <button key={c.id} onClick={() => toggleRight(c.id)} disabled={submitted} style={{ ...style, padding: '9px 12px', borderRadius: 8, textAlign: 'left', cursor: submitted ? 'default' : 'pointer', display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.87rem', lineHeight: 1.4, width: '100%' }}>
                  <span style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${isSel ? '#29b7a3' : submitted && isRightCorrect(c.id) ? '#29b7a3' : '#c0cece'}`, background: isSel ? '#29b7a3' : submitted && isRightCorrect(c.id) ? '#29b7a3' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {(isSel || (submitted && isRightCorrect(c.id))) && <CheckCircle2 size={12} color="#fff" />}
                  </span>
                  {c.text}
                  {submitted && !isSel && isRightCorrect(c.id) && <CheckCircle2 size={14} color="#29b7a3" style={{ marginLeft: 'auto' }} />}
                  {submitted && isSel && !isRightCorrect(c.id) && <XCircle size={14} color="#e85d4f" style={{ marginLeft: 'auto' }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      {!submitted && (
        <div style={{ marginTop: 12, fontSize: '0.82rem', color: '#607478', textAlign: 'center' }}>
          Select from both sides: {leftSel.length} / {d.correct_left?.length ?? 2} left · {rightSel.length} / {d.correct_right?.length ?? 2} right
        </div>
      )}
    </div>
  );
}

export function bowTieIsCorrect(question, answer) {
  const d = question.ngn_data ?? {};
  const leftOk = [...(answer?.left ?? [])].sort().join() === [...(d.correct_left ?? [])].sort().join();
  const rightOk = [...(answer?.right ?? [])].sort().join() === [...(d.correct_right ?? [])].sort().join();
  return leftOk && rightOk;
}

export function bowTieHasAnswer(answer) {
  return (answer?.left?.length ?? 0) > 0 || (answer?.right?.length ?? 0) > 0;
}

/* ─────────────────────────────────────────────────────────
   MATRIX
   ngn_data: { columns[], rows[], correct: {row_id: col_id} }
   ───────────────────────────────────────────────────────── */
export function MatrixQuestion({ question, submitted, onAnswer }) {
  const d = question.ngn_data ?? {};
  const [selections, setSelections] = useState({});

  function select(rowId, colId) {
    if (submitted) return;
    setSelections((p) => ({ ...p, [rowId]: colId }));
  }

  React.useEffect(() => {
    if (onAnswer) onAnswer(selections);
  }, [selections]);

  const correct = d.correct ?? {};
  const cols = d.columns ?? [];
  const rows = d.rows ?? [];

  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr>
            <th style={{ padding: '10px 12px', textAlign: 'left', background: '#f0f5f4', borderRadius: '8px 0 0 0', fontWeight: 700, color: '#42585e', fontSize: '0.8rem', width: '40%' }}>
              Nursing Action / Finding
            </th>
            {cols.map((c) => (
              <th key={c.id} style={{ padding: '10px 12px', textAlign: 'center', background: '#f0f5f4', fontWeight: 700, color: '#42585e', fontSize: '0.8rem' }}>{c.text}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            const sel = selections[row.id];
            const correctCol = correct[row.id];
            const rowCorrect = submitted && sel === correctCol;
            const rowWrong = submitted && sel && sel !== correctCol;
            return (
              <tr key={row.id} style={{ background: submitted ? (rowCorrect ? '#f0faf8' : rowWrong ? '#fef5f4' : '#fff') : ri % 2 === 0 ? '#fafcfb' : '#fff' }}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #e9f1ef', fontWeight: 500, color: '#17212f', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {submitted && (
                    sel === correctCol
                      ? <CheckCircle2 size={15} color="#29b7a3" style={{ flexShrink: 0 }} />
                      : <XCircle size={15} color="#e85d4f" style={{ flexShrink: 0 }} />
                  )}
                  {row.text}
                </td>
                {cols.map((col) => {
                  const isSel = sel === col.id;
                  const isCorr = submitted && correct[row.id] === col.id;
                  return (
                    <td key={col.id} style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid #e9f1ef' }}>
                      <button
                        onClick={() => select(row.id, col.id)}
                        disabled={submitted}
                        style={{
                          width: 22, height: 22, borderRadius: '50%', border: `2px solid ${isCorr ? '#29b7a3' : isSel ? '#29b7a3' : '#c0cece'}`,
                          background: isCorr ? '#29b7a3' : isSel ? '#29b7a3' : 'transparent',
                          cursor: submitted ? 'default' : 'pointer', display: 'inline-block',
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {submitted && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0f5f4', borderRadius: 8, fontSize: '0.82rem', color: '#607478' }}>
          <strong>Correct answers:</strong> {rows.map((r) => `${r.text} → ${cols.find((c) => c.id === correct[r.id])?.text ?? '?'}`).join(' · ')}
        </div>
      )}
    </div>
  );
}

export function matrixIsCorrect(question, selections) {
  const correct = question.ngn_data?.correct ?? {};
  return Object.entries(correct).every(([rowId, colId]) => selections?.[rowId] === colId);
}

export function matrixHasAnswer(selections) {
  return Object.keys(selections ?? {}).length > 0;
}

/* ─────────────────────────────────────────────────────────
   ORDERED RESPONSE
   choices[]: items to order
   correct_answer.order[]: correct sequence of ids
   ───────────────────────────────────────────────────────── */
export function OrderedResponseQuestion({ question, submitted, onAnswer }) {
  const correctOrder = question.correct_answer?.order ?? [];
  const items = question.choices ?? [];
  const [order, setOrder] = useState(() => [...items]);

  function moveUp(idx) {
    if (idx === 0 || submitted) return;
    setOrder((p) => { const a = [...p]; [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]; return a; });
  }
  function moveDown(idx) {
    if (idx === order.length - 1 || submitted) return;
    setOrder((p) => { const a = [...p]; [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]]; return a; });
  }

  React.useEffect(() => {
    if (onAnswer) onAnswer(order.map((i) => i.id));
  }, [order]);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: '0.83rem', color: '#607478', marginBottom: 10 }}>
        Drag or use arrows to arrange in the correct order (first → last).
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {order.map((item, idx) => {
          const isCorrectPos = submitted && correctOrder[idx] === item.id;
          const isWrongPos = submitted && correctOrder[idx] !== item.id;
          return (
            <div key={item.id} style={{
              display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px', borderRadius: 10,
              border: `1.5px solid ${submitted ? (isCorrectPos ? '#b9e3dc' : '#f5bcb6') : '#dbe6e4'}`,
              background: submitted ? (isCorrectPos ? '#e2f5f2' : '#fce8e6') : '#fff',
            }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: submitted ? (isCorrectPos ? '#29b7a3' : '#e85d4f') : '#edf2f1', color: submitted ? '#fff' : '#42585e', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: '0.82rem', flexShrink: 0 }}>
                {idx + 1}
              </div>
              <span style={{ flex: 1, fontSize: '0.88rem' }}>{item.text}</span>
              {!submitted && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, border: '1px solid #dbe6e4', background: '#fff', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1 }}>▲</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === order.length - 1} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: 4, border: '1px solid #dbe6e4', background: '#fff', cursor: idx === order.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === order.length - 1 ? 0.4 : 1 }}>▼</button>
                </div>
              )}
              {submitted && isCorrectPos && <CheckCircle2 size={16} color="#29b7a3" />}
              {submitted && isWrongPos && (
                <span style={{ fontSize: '0.78rem', color: '#8a2c21' }}>→ {idx + 1}. {items.find((i) => i.id === correctOrder[idx])?.text?.slice(0, 30)}…</span>
              )}
            </div>
          );
        })}
      </div>
      {submitted && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0f5f4', borderRadius: 8, fontSize: '0.82rem', color: '#607478' }}>
          <strong>Correct order:</strong> {correctOrder.map((id, i) => `${i + 1}. ${items.find((x) => x.id === id)?.text}`).join(' → ')}
        </div>
      )}
    </div>
  );
}

export function orderedIsCorrect(question, answer) {
  const correct = question.correct_answer?.order ?? [];
  return JSON.stringify(answer) === JSON.stringify(correct);
}

/* ─────────────────────────────────────────────────────────
   HIGHLIGHT
   ngn_data: { passage: string, highlights: [{id, text, correct}] }
   ───────────────────────────────────────────────────────── */
export function HighlightQuestion({ question, submitted, onAnswer }) {
  const d = question.ngn_data ?? {};
  const highlights = d.highlights ?? [];
  const [selected, setSelected] = useState(new Set());

  function toggle(id) {
    if (submitted) return;
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  React.useEffect(() => {
    if (onAnswer) onAnswer([...selected]);
  }, [selected]);

  if (!d.passage) return null;

  // Build rendered passage with highlights clickable
  // Replace highlight text spans in passage
  let passage = d.passage;
  const parts = [];
  let remaining = passage;

  // Sort highlights by their position in the passage
  const positioned = highlights.map((h) => ({ ...h, start: passage.indexOf(h.text) })).filter((h) => h.start >= 0).sort((a, b) => a.start - b.start);

  if (!positioned.length) {
    // fallback: show passage as plain text with highlights as separate chips
    return (
      <div style={{ marginTop: 8 }}>
        <div style={{ padding: '14px 16px', background: '#f7faf9', borderRadius: 10, lineHeight: 1.8, fontSize: '0.92rem', marginBottom: 12, color: '#17212f' }}>{passage}</div>
        <div style={{ fontSize: '0.83rem', color: '#607478', marginBottom: 8 }}>Click all findings that are clinically significant:</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {highlights.map((h) => {
            const isSel = selected.has(h.id);
            const isCorr = submitted && h.correct;
            const isWrong = submitted && isSel && !h.correct;
            return (
              <button key={h.id} onClick={() => toggle(h.id)} disabled={submitted} style={{ padding: '6px 14px', borderRadius: 8, border: `1.5px solid ${isCorr ? '#b9e3dc' : isWrong ? '#f5bcb6' : isSel ? '#29b7a3' : '#dbe6e4'}`, background: isCorr ? '#e2f5f2' : isWrong ? '#fce8e6' : isSel ? '#e9f6f4' : '#fff', fontSize: '0.88rem', cursor: submitted ? 'default' : 'pointer', fontWeight: isSel ? 700 : 400 }}>
                {h.text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Render passage with inline clickable spans
  let cursor = 0;
  const passageNodes = [];
  positioned.forEach((h, i) => {
    if (h.start > cursor) passageNodes.push(<span key={`t${i}`}>{passage.slice(cursor, h.start)}</span>);
    const isSel = selected.has(h.id);
    const isCorr = submitted && h.correct;
    const isWrong = submitted && isSel && !h.correct;
    passageNodes.push(
      <button key={h.id} onClick={() => toggle(h.id)} disabled={submitted} style={{
        padding: '1px 4px', margin: '0 1px', borderRadius: 4, border: 'none', cursor: submitted ? 'default' : 'pointer', display: 'inline',
        background: isCorr ? '#b9e3dc' : isWrong ? '#f5bcb6' : isSel ? '#c6ede6' : '#e0ede9',
        fontWeight: isSel || isCorr ? 700 : 400, color: isCorr ? '#135f55' : isWrong ? '#8a2c21' : '#17212f',
        textDecoration: isSel ? 'underline' : 'none', fontSize: 'inherit', fontFamily: 'inherit', lineHeight: 'inherit',
      }}>
        {h.text}
      </button>
    );
    cursor = h.start + h.text.length;
  });
  if (cursor < passage.length) passageNodes.push(<span key="tail">{passage.slice(cursor)}</span>);

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: '0.83rem', color: '#607478', marginBottom: 10 }}>
        Click to highlight the clinically significant findings in the passage below.
      </div>
      <div style={{ padding: '16px 18px', background: '#f7faf9', borderRadius: 10, border: '1px solid #e1ebe9', lineHeight: 2, fontSize: '0.92rem', color: '#17212f' }}>
        {passageNodes}
      </div>
      {submitted && (
        <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0f5f4', borderRadius: 8, fontSize: '0.82rem', color: '#607478' }}>
          <strong>Correct highlights:</strong> {highlights.filter((h) => h.correct).map((h) => h.text).join(', ')}
        </div>
      )}
    </div>
  );
}

export function highlightIsCorrect(question, selected) {
  const h = question.ngn_data?.highlights ?? [];
  const correctIds = h.filter((x) => x.correct).map((x) => x.id);
  const sel = [...(selected ?? [])].sort();
  return sel.join() === [...correctIds].sort().join();
}
