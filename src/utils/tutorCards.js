export function parseTutorCards(text) {
  try {
    const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    if (!Array.isArray(parsed) || !parsed.length || parsed.length > 20) return [];
    if (!parsed.every(c => typeof c.front === 'string' && c.front.trim().length > 0 && c.front.length <= 2000 && typeof c.back === 'string' && c.back.trim().length > 0 && c.back.length <= 8000)) return [];
    return parsed.map(({ front, back }) => ({ front: front.trim(), back: back.trim() }));
  } catch { return []; }
}
