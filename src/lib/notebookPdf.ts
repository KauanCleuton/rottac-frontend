// Gera o PDF de um caderno de questões (capa com a logo, questões, folha de respostas e gabarito).
import { jsPDF } from 'jspdf';
import { parseRich, RICH_COLORS, stripRich, type RichStyle } from './richText';

export type PrintQuestion = {
  number: number;
  type: 'MULTIPLA_ESCOLHA' | 'CERTO_ERRADO';
  statement: string;
  options: { letter: string; text: string }[];
  answer: string | null;
  explanation: string | null;
  discipline?: string | null; topic?: string | null; banca?: string | null; orgao?: string | null; cargo?: string | null; year?: number | null;
  isAnnulled?: boolean;
  text?: { id: string; title?: string | null; body: string; source?: string | null } | null;
  myAnswer?: string | null;
  myResult?: boolean | null;
};
export type PrintData = {
  name: string; description?: string | null; folder?: string | null; student?: string; generatedAt: string;
  questions: PrintQuestion[];
};
export type PrintOptions = {
  answerKey: boolean;      // gabarito ao final
  explanations: boolean;   // gabarito comentado
  answerSheet: boolean;    // folha de respostas em branco
};

// Paleta do PDF (impressão: preto, cinzas e dourado escuro legível no papel)
const INK: [number, number, number] = [10, 10, 11];
const GOLD: [number, number, number] = [242, 183, 5];
const GOLD_DEEP: [number, number, number] = [138, 106, 0];
const GRAY: [number, number, number] = [95, 95, 102];
const LIGHT: [number, number, number] = [228, 228, 231];
const OK: [number, number, number] = [21, 128, 61];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 16; // margem
const CONTENT_W = PAGE_W - M * 2;
const TOP = 24; // início do conteúdo nas páginas internas
const BOTTOM = PAGE_H - 18;

// As fontes padrão do PDF usam Windows-1252: troca símbolos fora dele
const sanitize = (s: string) => String(s ?? '')
  .replace(/\r/g, '')
  .replace(/[→⇒]/g, '->').replace(/[←⇐]/g, '<-').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/≠/g, '!=')
  .replace(/[≡≅]/g, '=').replace(/[−]/g, '-').replace(/[   ]/g, ' ')
  .replace(/[^\x09\x0A\x20-\x7E -ÿ–—‘’“”•…›‹€]/g, '');

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
type Piece = RichStyle & { text: string; width: number };
type RichLine = { pieces: Piece[]; width: number };

const answerText = (q: PrintQuestion, key?: string | null) => {
  if (!key) return '-';
  return q.type === 'CERTO_ERRADO' ? (key === 'C' ? 'Certo' : 'Errado') : key;
};

// Logo (SVG do /public) rasterizada para PNG
async function loadLogoPng(): Promise<string | null> {
  try {
    const svg = await fetch('/logo.svg').then((r) => r.text());
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    canvas.getContext('2d')!.drawImage(img, 0, 0, 256, 256);
    URL.revokeObjectURL(url);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export async function buildNotebookPdf(data: PrintData, opts: PrintOptions): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const logo = await loadLogoPng();
  const title = sanitize(data.name);
  let y = 0;

  const setFont = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: [number, number, number] = INK) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const lineH = (size: number) => size * 0.42; // altura de linha em mm para o tamanho de fonte

  const innerHeader = () => {
    if (logo) doc.addImage(logo, 'PNG', M, 9, 7, 7);
    setFont(8.5, 'bold');
    doc.text('Rotta Concursos', M + 9, 13.6);
    setFont(8.5, 'normal', GRAY);
    doc.text(doc.splitTextToSize(title, 110)[0], PAGE_W - M, 13.6, { align: 'right' });
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(0.5);
    doc.line(M, 18, PAGE_W - M, 18);
  };

  const fontStyle = (st: RichStyle) => (st.b && st.i ? 'bolditalic' : st.b ? 'bold' : st.i ? 'italic' : 'normal');

  // Quebra o texto formatado em linhas que cabem na largura (mede cada palavra no seu estilo)
  const richLines = (text: string, size: number, width: number): RichLine[] => {
    const lines: RichLine[] = [];
    for (const rawLine of sanitize(text).split('\n')) {
      let cur: RichLine = { pieces: [], width: 0 };
      const words: (RichStyle & { text: string })[] = [];
      for (const seg of parseRich(rawLine)) {
        for (const w of seg.text.split(/(\s+)/)) if (w) words.push({ ...seg, text: w });
      }
      for (const w of words) {
        doc.setFont('helvetica', fontStyle(w));
        doc.setFontSize(size);
        const isSpace = /^\s+$/.test(w.text);
        const ww = doc.getTextWidth(isSpace ? ' ' : w.text);
        if (isSpace) {
          if (cur.pieces.length) { cur.pieces.push({ ...w, text: ' ', width: ww }); cur.width += ww; }
          continue;
        }
        if (cur.width + ww > width && cur.pieces.length) {
          while (cur.pieces.length && /^\s+$/.test(cur.pieces[cur.pieces.length - 1].text)) cur.width -= cur.pieces.pop()!.width;
          lines.push(cur);
          cur = { pieces: [], width: 0 };
        }
        cur.pieces.push({ ...w, width: ww });
        cur.width += ww;
      }
      lines.push(cur);
    }
    return lines;
  };

  const drawRichLine = (line: RichLine, x: number, baseline: number, size: number, color: [number, number, number]) => {
    let cx = x;
    for (const p of line.pieces) {
      if (p.hl) {
        doc.setFillColor(255, 236, 140);
        doc.rect(cx - 0.3, baseline - size * 0.3, p.width + 0.6, size * 0.4, 'F');
      }
      doc.setFont('helvetica', fontStyle(p));
      doc.setFontSize(size);
      const c = p.color ? hexToRgb(RICH_COLORS[p.color]) : color;
      doc.setTextColor(...c);
      doc.text(p.text, cx, baseline);
      if (p.u && p.text.trim()) {
        doc.setDrawColor(...c);
        doc.setLineWidth(0.2);
        doc.line(cx, baseline + 0.7, cx + p.width, baseline + 0.7);
      }
      cx += p.width;
    }
  };

  // Parágrafo formatado com quebra de página
  const richParagraph = (text: string, size: number, color: [number, number, number], x: number, width: number, gapAfter = 1.5) => {
    const lh = lineH(size) * 1.25;
    for (const ln of richLines(text, size, width)) {
      ensure(lh);
      drawRichLine(ln, x, y + lh * 0.8, size, color);
      y += lh;
    }
    y += gapAfter;
  };

  const newPage = () => {
    doc.addPage();
    innerHeader();
    y = TOP;
  };
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage(); };

  // Escreve um parágrafo quebrando linhas e páginas
  const paragraph = (text: string, size: number, style: 'normal' | 'bold' | 'italic', color: [number, number, number], x: number, width: number, gapAfter = 1.5) => {
    setFont(size, style, color);
    const lh = lineH(size) * 1.25;
    for (const raw of sanitize(text).split('\n')) {
      const lines: string[] = raw.trim() ? doc.splitTextToSize(raw, width) : [''];
      for (const ln of lines) {
        ensure(lh);
        doc.text(ln, x, y + lh * 0.8);
        y += lh;
      }
    }
    y += gapAfter;
  };

  // ── Capa ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...INK);
  doc.rect(0, 0, PAGE_W, 46, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 46, PAGE_W, 1.4, 'F');
  if (logo) doc.addImage(logo, 'PNG', M, 11, 22, 22);
  setFont(20, 'bold', [245, 245, 244]);
  doc.text('Rotta', M + 27, 22);
  setFont(20, 'normal', GOLD);
  doc.text('Concursos', M + 27 + doc.getTextWidth('Rotta ') + 0.5, 22);
  setFont(8.5, 'normal', [190, 190, 190]);
  doc.text('SUA ROTA ATÉ A APROVAÇÃO', M + 27, 29);
  setFont(9, 'bold', GOLD);
  doc.text('CADERNO DE QUESTÕES', PAGE_W - M, 22, { align: 'right' });

  y = 62;
  setFont(22, 'bold');
  for (const ln of doc.splitTextToSize(title, CONTENT_W)) { doc.text(ln, M, y); y += 9; }
  if (data.description) { y += 1; paragraph(data.description, 10.5, 'normal', GRAY, M, CONTENT_W, 2); }

  const disciplines = [...new Set(data.questions.map((q) => q.discipline).filter(Boolean))] as string[];
  const bancas = [...new Set(data.questions.map((q) => q.banca).filter(Boolean))] as string[];
  const meta: [string, string][] = [
    ['Aluno', data.student || '-'],
    ['Pasta', data.folder || '-'],
    ['Questões', String(data.questions.length)],
    ['Disciplinas', disciplines.slice(0, 6).join(', ') || '-'],
    ['Bancas', bancas.slice(0, 6).join(', ') || '-'],
    ['Gerado em', new Date(data.generatedAt).toLocaleString('pt-BR')],
  ];
  y += 4;
  doc.setDrawColor(...LIGHT);
  doc.setLineWidth(0.3);
  for (const [k, v] of meta) {
    setFont(9, 'bold', GRAY);
    doc.text(k.toUpperCase(), M, y);
    setFont(10.5, 'normal');
    const lines = doc.splitTextToSize(sanitize(v), CONTENT_W - 38);
    doc.text(lines, M + 38, y);
    y += Math.max(1, lines.length) * 5 + 2.5;
    doc.line(M, y - 3.5, PAGE_W - M, y - 3.5);
  }
  y += 4;
  setFont(9, 'italic', GRAY);
  doc.text(opts.answerKey ? 'O gabarito está ao final do caderno.' : 'Caderno impresso sem gabarito.', M, y);
  y += 10;

  // ── Questões ──────────────────────────────────────────────────────────────
  // Altura estimada da questão inteira (cabeçalho + enunciado + alternativas)
  const questionHeight = (q: PrintQuestion) => {
    setFont(10.5, 'normal');
    const lh = lineH(10.5) * 1.25;
    const statementLines = richLines(q.statement, 10.5, CONTENT_W).length;
    const optionLines = q.type === 'CERTO_ERRADO'
      ? 0
      : q.options.reduce((n, o) => n + richLines(o.text, 10.5, CONTENT_W - 10).length, 0);
    const optionGaps = q.type === 'CERTO_ERRADO' ? 8 : q.options.length * 1.6;
    return 10 + statementLines * lh + 4 + optionLines * lh + optionGaps + 6;
  };

  let lastTextId: string | null = null;
  const printSupportText = (q: PrintQuestion, idx: number) => {
    const t = q.text!;
    // Questões consecutivas que usam este texto
    let lastIdx = idx;
    while (lastIdx + 1 < data.questions.length && data.questions[lastIdx + 1].text?.id === t.id) lastIdx++;
    const first = data.questions[idx].number;
    const last = data.questions[lastIdx].number;
    ensure(30);
    doc.setFillColor(...GOLD);
    doc.rect(M, y, 1.4, 9, 'F');
    setFont(12, 'bold');
    doc.text(sanitize(stripRich(t.title || 'Texto')), M + 4, y + 4.2);
    setFont(8.5, 'normal', GRAY);
    doc.text(first === last ? `Texto para a questão ${String(first).padStart(2, '0')}` : `Texto para as questões ${String(first).padStart(2, '0')} a ${String(last).padStart(2, '0')}`, M + 4, y + 8.6);
    y += 14;
    // Corpo com linhas numeradas de 5 em 5 (as questões citam "linha X")
    const size = 10.5;
    const lh = lineH(size) * 1.35;
    let n = 0;
    for (const ln of richLines(t.body, size, CONTENT_W - 10)) {
      ensure(lh);
      n++;
      if (n % 5 === 0) {
        setFont(7.5, 'normal', GRAY);
        doc.text(String(n), M + 5, y + lh * 0.8, { align: 'right' });
      }
      drawRichLine(ln, M + 9, y + lh * 0.8, size, INK);
      y += lh;
    }
    if (t.source) {
      y += 1;
      setFont(8.5, 'italic', GRAY);
      const src: string[] = doc.splitTextToSize(sanitize(stripRich(t.source)), CONTENT_W - 10);
      ensure(src.length * 4);
      doc.text(src, PAGE_W - M, y + 3, { align: 'right' });
      y += src.length * 4;
    }
    y += 6;
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.3);
    doc.line(M, y - 3, PAGE_W - M, y - 3);
    y += 4;
  };

  data.questions.forEach((q, idx) => {
    if (q.text && q.text.id !== lastTextId) printSupportText(q, idx);
    lastTextId = q.text?.id ?? null;

    // Questão que cabe numa página não é partida; as maiores ao menos começam com cabeçalho + enunciado
    const h = questionHeight(q);
    if (h <= BOTTOM - TOP && y + h > BOTTOM) newPage();
    else ensure(26);
    if (idx > 0) {
      doc.setDrawColor(...LIGHT);
      doc.setLineWidth(0.3);
      doc.line(M, y - 3, PAGE_W - M, y - 3);
    }

    // Selo com o número
    const label = `QUESTÃO ${String(q.number).padStart(2, '0')}`;
    setFont(9, 'bold', INK);
    const lw = doc.getTextWidth(label) + 6;
    doc.setFillColor(...GOLD);
    doc.roundedRect(M, y, lw, 6, 1.2, 1.2, 'F');
    doc.text(label, M + 3, y + 4.2);

    const metaLine = [q.banca, q.year, q.orgao, q.cargo].filter(Boolean).join(' · ');
    const subject = [q.discipline, q.topic].filter(Boolean).join(' › ');
    setFont(8.5, 'normal', GRAY);
    const metaText = sanitize([metaLine, subject].filter(Boolean).join('  |  '));
    if (metaText) doc.text(doc.splitTextToSize(metaText, CONTENT_W - lw - 4)[0], M + lw + 3, y + 4.2);
    if (q.isAnnulled) {
      setFont(8, 'bold', [185, 28, 28]);
      doc.text('ANULADA', PAGE_W - M, y + 4.2, { align: 'right' });
    }
    y += 10;

    richParagraph(q.statement, 10.5, INK, M, CONTENT_W, 2.5);

    if (q.type === 'CERTO_ERRADO') {
      ensure(8);
      setFont(10.5, 'normal');
      doc.setDrawColor(...GRAY);
      doc.circle(M + 2.2, y + 2.3, 2);
      doc.text('Certo', M + 6, y + 3.6);
      doc.circle(M + 32.2, y + 2.3, 2);
      doc.text('Errado', M + 36, y + 3.6);
      y += 8;
    } else {
      for (const o of q.options) {
        const lines = richLines(o.text, 10.5, CONTENT_W - 10);
        const h = lines.length * lineH(10.5) * 1.25;
        ensure(Math.min(h, 12) + 1);
        // Letra dentro de um círculo
        doc.setDrawColor(...GRAY);
        doc.setLineWidth(0.3);
        doc.circle(M + 2.6, y + 2.3, 2.6);
        setFont(8.5, 'bold');
        doc.text(o.letter, M + 2.6, y + 3.4, { align: 'center' });
        const lh = lineH(10.5) * 1.25;
        lines.forEach((ln, i) => {
          if (i > 0) ensure(lh);
          drawRichLine(ln, M + 8, y + lh * 0.8, 10.5, INK);
          y += lh;
        });
        y += 1.6;
      }
    }
    y += 6;
  });

  // ── Folha de respostas ────────────────────────────────────────────────────
  if (opts.answerSheet) {
    newPage();
    setFont(15, 'bold');
    doc.text('Folha de respostas', M, y + 4);
    y += 12;
    const cols = 4;
    const colW = CONTENT_W / cols;
    const rowH = 7.5;
    // Preenche coluna por coluna; quando a página enche, continua na próxima
    let pageStart = 0;
    let top = y;
    let rows = Math.floor((BOTTOM - top) / rowH);
    data.questions.forEach((q, i) => {
      if (i - pageStart >= rows * cols) {
        newPage();
        pageStart = i;
        top = y;
        rows = Math.floor((BOTTOM - top) / rowH);
      }
      const k = i - pageStart;
      const perCol = Math.min(rows, Math.ceil((data.questions.length - pageStart) / cols));
      const x = M + Math.floor(k / perCol) * colW;
      const yy = top + (k % perCol) * rowH;
      setFont(9, 'bold');
      doc.text(String(q.number).padStart(2, '0'), x, yy + 4);
      const keys = q.type === 'CERTO_ERRADO' ? ['C', 'E'] : q.options.map((o) => o.letter);
      keys.forEach((k, j) => {
        const cx = x + 9 + j * 6.2;
        doc.setDrawColor(...GRAY);
        doc.circle(cx, yy + 2.8, 2.3);
        setFont(7, 'normal', GRAY);
        doc.text(k, cx, yy + 3.8, { align: 'center' });
      });
    });
  }

  // ── Gabarito ──────────────────────────────────────────────────────────────
  if (opts.answerKey) {
    newPage();
    setFont(15, 'bold');
    doc.text('Gabarito', M, y + 4);
    y += 12;
    const cellW = CONTENT_W / 6;
    const cellH = 9;
    data.questions.forEach((q, i) => {
      if (i % 6 === 0 && i > 0) y += cellH;
      ensure(cellH);
      const x = M + (i % 6) * cellW;
      doc.setDrawColor(...LIGHT);
      doc.setFillColor(i % 12 < 6 ? 250 : 255, i % 12 < 6 ? 250 : 255, i % 12 < 6 ? 249 : 255);
      doc.rect(x, y, cellW, cellH, 'FD');
      setFont(8.5, 'normal', GRAY);
      doc.text(String(q.number).padStart(2, '0'), x + 2.5, y + 5.8);
      setFont(11, 'bold', q.isAnnulled ? [185, 28, 28] : GOLD_DEEP);
      doc.text(q.isAnnulled ? 'Anul.' : answerText(q, q.answer), x + cellW - 3, y + 6, { align: 'right' });
    });
    y += cellH + 8;

    if (opts.explanations) {
      const commented = data.questions.filter((q) => q.explanation);
      if (commented.length) {
        ensure(16);
        setFont(13, 'bold');
        doc.text('Gabarito comentado', M, y + 4);
        y += 10;
        for (const q of commented) {
          ensure(14);
          setFont(10, 'bold', INK);
          doc.text(`Questão ${String(q.number).padStart(2, '0')}`, M, y + 3.6);
          setFont(10, 'bold', OK);
          doc.text(`Gabarito: ${answerText(q, q.answer)}`, M + 26, y + 3.6);
          y += 6;
          richParagraph(q.explanation || '', 9.5, GRAY, M, CONTENT_W, 4);
        }
      }
    }
  }

  // ── Rodapé com numeração em todas as páginas ──────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.3);
    doc.line(M, PAGE_H - 12, PAGE_W - M, PAGE_H - 12);
    setFont(8, 'normal', GRAY);
    doc.text('Rotta Concursos · Sua rota até a aprovação', M, PAGE_H - 7.5);
    doc.text(`Página ${p} de ${total}`, PAGE_W - M, PAGE_H - 7.5, { align: 'right' });
  }
  return doc;
}

export const pdfFileName = (name: string) =>
  `Caderno - ${name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'questoes'}.pdf`;
