// Formatação simples e segura para textos de questões e comentários.
// Marcação (nada de HTML, para não abrir brecha de XSS):
//   **negrito**   _itálico_   __sublinhado__   ==marca-texto==   [vermelho]texto[/vermelho]
// Cores: vermelho, azul, verde, dourado. Marcações podem ser combinadas.

export const RICH_COLORS = {
  vermelho: '#EF4444',
  azul: '#3B82F6',
  verde: '#22C55E',
  dourado: '#D49B00',
} as const;
export type RichColor = keyof typeof RICH_COLORS;

export type RichStyle = { b?: boolean; i?: boolean; u?: boolean; hl?: boolean; color?: RichColor };
export type RichSegment = RichStyle & { text: string };

const COLOR_NAMES = Object.keys(RICH_COLORS).join('|');
// Ordem importa: "__" antes de "_", "**" antes de qualquer coisa
const TOKEN = new RegExp(
  `\\*\\*([\\s\\S]+?)\\*\\*` +                       // 1 negrito
  `|__([\\s\\S]+?)__` +                              // 2 sublinhado
  `|==([\\s\\S]+?)==` +                              // 3 marca-texto
  `|\\[(${COLOR_NAMES})\\]([\\s\\S]+?)\\[\\/\\4\\]` + // 4-5 cor
  `|(?<![\\w\\u00C0-\\u017F])_([^_\\n]+?)_(?![\\w\\u00C0-\\u017F])`, // 6 itálico (não pega snake_case)
  'g',
);

// Converte a marcação em segmentos planos com estilo acumulado
export function parseRich(text: string, inherited: RichStyle = {}): RichSegment[] {
  const out: RichSegment[] = [];
  const src = String(text ?? '');
  let last = 0;
  for (const m of src.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ ...inherited, text: src.slice(last, start) });
    if (m[1] !== undefined) out.push(...parseRich(m[1], { ...inherited, b: true }));
    else if (m[2] !== undefined) out.push(...parseRich(m[2], { ...inherited, u: true }));
    else if (m[3] !== undefined) out.push(...parseRich(m[3], { ...inherited, hl: true }));
    else if (m[4] !== undefined) out.push(...parseRich(m[5], { ...inherited, color: m[4] as RichColor }));
    else if (m[6] !== undefined) out.push(...parseRich(m[6], { ...inherited, i: true }));
    last = start + m[0].length;
  }
  if (last < src.length) out.push({ ...inherited, text: src.slice(last) });
  return out.filter((s) => s.text);
}

// Texto sem marcação (busca, títulos, prévias)
export const stripRich = (text: string) => parseRich(text).map((s) => s.text).join('');

// Envolve a seleção de um campo com uma marcação; devolve o novo valor e a nova seleção
export function wrapSelection(value: string, start: number, end: number, open: string, close: string) {
  const selected = value.slice(start, end) || 'texto';
  const next = value.slice(0, start) + open + selected + close + value.slice(end);
  return { value: next, selStart: start + open.length, selEnd: start + open.length + selected.length };
}
