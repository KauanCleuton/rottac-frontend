'use client';

import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, ToggleButton, ToggleButtonGroup,
  Grid, MenuItem, Switch, FormControlLabel, Autocomplete, Tooltip, Radio,
  Alert, Collapse, CircularProgress, alpha, useTheme, Divider, Link,
} from '@mui/material';
import { AddCircleOutline, RemoveCircleOutline, ContentPaste, Visibility, AutoFixHigh } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { questionBankApi } from '@/lib/api';
import QuestionCard from './QuestionCard';
import SupportTextPicker from './SupportTextPicker';
import AssuntoPicker from './AssuntoPicker';
import type { SupportTextData } from './SupportText';
import RichTextField from '@/components/common/RichTextField';
import { LETTERS, DIFFICULTY_LABEL, LEVEL_LABEL, type BankQuestion, type QuestionType, type Difficulty } from './types';

export type QuestionFormValues = {
  type: QuestionType;
  statement: string;
  options: Record<string, string>;
  optionCount: number;
  answer: string;
  explanation: string;
  assuntoId: number | null;
  discipline: string;
  topic: string;
  banca: string;
  orgao: string;
  cargo: string;
  year: string;
  level: string;
  difficulty: Difficulty;
  source: string;
  isPublic: boolean;
  isAnnulled: boolean;
  isOutdated: boolean;
  text: SupportTextData | null;
};

export const emptyForm = (isAdmin: boolean): QuestionFormValues => ({
  type: 'MULTIPLA_ESCOLHA',
  statement: '',
  options: { A: '', B: '', C: '', D: '', E: '' },
  optionCount: 5,
  answer: '',
  explanation: '',
  assuntoId: null, discipline: '', topic: '', banca: '', orgao: '', cargo: '', year: '', level: '', source: '',
  difficulty: 'MEDIO',
  isPublic: isAdmin,
  isAnnulled: false,
  isOutdated: false,
  text: null,
});

export function formFromQuestion(q: BankQuestion): QuestionFormValues {
  const options = Object.fromEntries(LETTERS.map((l) => [l, (q as any)[`option${l}`] || '']));
  const filled = LETTERS.filter((l) => options[l]).length;
  return {
    type: q.type,
    statement: q.statement,
    options,
    optionCount: Math.max(2, filled || 5),
    answer: q.answer || '',
    explanation: q.explanation || '',
    assuntoId: q.assuntoId ?? null,
    discipline: q.discipline || '', topic: q.topic || '', banca: q.banca || '', orgao: q.orgao || '',
    cargo: q.cargo || '', year: q.year ? String(q.year) : '', level: q.level || '', source: q.source || '',
    difficulty: q.difficulty,
    isPublic: q.isPublic, isAnnulled: q.isAnnulled, isOutdated: q.isOutdated,
    text: q.text ?? null,
  };
}

export function toPayload(v: QuestionFormValues) {
  const letters = LETTERS.slice(0, v.optionCount);
  return {
    type: v.type,
    statement: v.statement,
    options: v.type === 'CERTO_ERRADO'
      ? undefined
      : Object.fromEntries(LETTERS.map((l) => [l, letters.includes(l) ? v.options[l]?.trim() || null : null])),
    answer: v.answer || null,
    explanation: v.explanation || null,
    assuntoId: v.assuntoId ?? undefined,
    discipline: v.discipline || null,
    topic: v.topic || null,
    banca: v.banca || null,
    orgao: v.orgao || null,
    cargo: v.cargo || null,
    year: v.year || null,
    level: v.level || null,
    source: v.source || null,
    difficulty: v.difficulty,
    isPublic: v.isPublic,
    isAnnulled: v.isAnnulled,
    isOutdated: v.isOutdated,
    textId: v.text?.id ?? null,
  };
}

// Separa uma questão colada em enunciado + alternativas ("A) ...", "(B) ...", "c. ...")
export function parsePastedQuestion(text: string) {
  const clean = text.replace(/\r/g, '').trim();
  const re = /(?:^|\n)\s*\(?([A-Ea-e])\s*[).:\-–]\s+/g;
  const marks: { letter: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  let expected = 0;
  while ((m = re.exec(clean))) {
    const letter = m[1].toUpperCase();
    if (letter !== LETTERS[expected]) continue; // exige A, B, C... em ordem
    marks.push({ letter, start: m.index, end: m.index + m[0].length });
    expected++;
  }
  if (marks.length < 2) return null;
  const options: Record<string, string> = { A: '', B: '', C: '', D: '', E: '' };
  marks.forEach((mk, i) => {
    options[mk.letter] = clean.slice(mk.end, marks[i + 1]?.start ?? clean.length).replace(/\s*\n\s*/g, ' ').trim();
  });
  const statement = clean.slice(0, marks[0].start).replace(/^\s*(?:quest[aã]o\s*)?\d{1,3}\s*[.)\-–:]\s*/i, '').trim();
  return { statement, options, optionCount: marks.length };
}

function SuggestField({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <Autocomplete
      freeSolo size="small" options={options} value={value}
      onInputChange={(_, v) => onChange(v)}
      renderInput={(params) => <TextField {...params} label={label} placeholder={placeholder} />}
    />
  );
}

type Props = {
  initial: QuestionFormValues;
  isAdmin: boolean;
  submitting?: boolean;
  submitLabel?: string;
  onSubmit: (values: QuestionFormValues, opts: { another: boolean }) => void;
  allowAnother?: boolean;
};

export default function QuestionForm({ initial, isAdmin, submitting, submitLabel = 'Salvar questão', onSubmit, allowAnother }: Props) {
  const theme = useTheme();
  const [v, setV] = useState<QuestionFormValues>(initial);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [manualAssunto, setManualAssunto] = useState(!initial.assuntoId && Boolean(initial.discipline));
  const [error, setError] = useState('');

  const { data: filters } = useQuery({
    queryKey: ['question-bank-filters'],
    queryFn: () => questionBankApi.filters().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const opts = (k: string): string[] => (filters?.[k] || []).map((x: any) => String(x.value));

  const set = <K extends keyof QuestionFormValues>(k: K, val: QuestionFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const letters = LETTERS.slice(0, v.optionCount);

  const applyPaste = () => {
    const parsed = parsePastedQuestion(pasteText);
    if (!parsed) {
      // Sem alternativas reconhecidas: trata como item Certo/Errado
      setV((p) => ({ ...p, statement: pasteText.trim(), type: 'CERTO_ERRADO', answer: ['C', 'E'].includes(p.answer) ? p.answer : '' }));
    } else {
      setV((p) => ({ ...p, type: 'MULTIPLA_ESCOLHA', statement: parsed.statement, options: parsed.options, optionCount: parsed.optionCount, answer: '' }));
    }
    setPasteOpen(false);
    setPasteText('');
  };

  const validate = (): string => {
    if (v.statement.trim().length < 5) return 'Escreva o enunciado da questão.';
    if (v.type === 'MULTIPLA_ESCOLHA') {
      const empty = letters.find((l) => !v.options[l]?.trim());
      if (empty) return `Preencha a alternativa ${empty} (ou remova as alternativas sobrando).`;
      if (v.answer && !letters.includes(v.answer as any)) return 'O gabarito precisa ser uma das alternativas.';
    } else if (v.answer && !['C', 'E'].includes(v.answer)) {
      return 'O gabarito de um item Certo/Errado é C ou E.';
    }
    if (v.year && (+v.year < 1950 || +v.year > new Date().getFullYear() + 1)) return 'Ano inválido.';
    return '';
  };

  const submit = (another: boolean) => {
    const err = validate();
    setError(err);
    if (!err) onSubmit(v, { another });
  };

  // Pré-visualização: mesmo componente que o aluno vê
  const preview = useMemo<BankQuestion>(() => ({
    id: 'preview', type: v.type, statement: v.statement || 'O enunciado aparecerá aqui.',
    ...Object.fromEntries(LETTERS.map((l) => [`option${l}`, v.type === 'MULTIPLA_ESCOLHA' && letters.includes(l) ? v.options[l] || `Alternativa ${l}` : null])),
    hasAnswer: Boolean(v.answer), text: v.text, discipline: v.discipline, topic: v.topic, banca: v.banca, orgao: v.orgao, cargo: v.cargo,
    year: v.year ? +v.year : null, difficulty: v.difficulty, isPublic: v.isPublic, isAnnulled: v.isAnnulled, isOutdated: v.isOutdated,
    isOwner: true, isFavorite: false, commentsCount: 0, myAttempts: 0, lastAttempt: null, createdAt: '',
  } as BankQuestion), [v, letters]);

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Tipo + colar */}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
              <ToggleButtonGroup exclusive size="small" value={v.type}
                onChange={(_, t) => t && setV((p) => ({ ...p, type: t, answer: '' }))}>
                <ToggleButton value="MULTIPLA_ESCOLHA" sx={{ px: 2 }}>Múltipla escolha</ToggleButton>
                <ToggleButton value="CERTO_ERRADO" sx={{ px: 2 }}>Certo ou Errado</ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ flexGrow: 1 }} />
              <Button size="small" startIcon={<ContentPaste />} onClick={() => setPasteOpen((o) => !o)}>
                Colar questão inteira
              </Button>
            </Box>

            <Collapse in={pasteOpen}>
              <Box sx={{ mb: 3, p: 2, borderRadius: 2, border: `1px dashed ${alpha(theme.palette.primary.main, 0.5)}` }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Cole o enunciado com as alternativas (A) ... B) ...). O sistema separa tudo automaticamente.
                  Sem alternativas, vira item Certo/Errado.
                </Typography>
                <TextField fullWidth multiline minRows={5} maxRows={16} value={pasteText} onChange={(e) => setPasteText(e.target.value)}
                  placeholder={'Considerando a Constituição Federal, assinale a alternativa correta.\nA) ...\nB) ...\nC) ...'} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button variant="contained" size="small" startIcon={<AutoFixHigh />} onClick={applyPaste} disabled={!pasteText.trim()}>
                    Separar campos
                  </Button>
                </Box>
              </Box>
            </Collapse>

            {/* Classificação */}
            <Typography variant="overline" color="text.secondary">Classificação</Typography>
            <Grid container spacing={2} sx={{ mt: 0, mb: 3 }}>
              <Grid size={12}>
                <AssuntoPicker value={v.assuntoId}
                  onChange={(id, path) => setV((cur) => ({ ...cur, assuntoId: id, discipline: path[0] || '', topic: path.length > 1 ? path[path.length - 1] : '' }))}
                  helperText={
                    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                      <span>Escolha o nível mais específico possível; a questão aparece também nos níveis acima.</span>
                      <Link component="button" type="button" variant="caption" onClick={() => setManualAssunto((m) => !m)}>
                        {manualAssunto ? 'Esconder campos manuais' : 'Não achou? Digitar manualmente'}
                      </Link>
                    </Box>
                  } />
              </Grid>
              {manualAssunto && (
                <>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <SuggestField label="Disciplina (texto)" value={v.discipline} onChange={(x) => setV((cur) => ({ ...cur, discipline: x, assuntoId: null }))} options={opts('discipline')} placeholder="Direito Constitucional" />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <SuggestField label="Assunto (texto)" value={v.topic} onChange={(x) => setV((cur) => ({ ...cur, topic: x, assuntoId: null }))} options={opts('topic')} placeholder="Direitos fundamentais" />
                  </Grid>
                </>
              )}
              <Grid size={{ xs: 6, sm: 4 }}>
                <SuggestField label="Banca" value={v.banca} onChange={(x) => set('banca', x)} options={opts('banca')} placeholder="Cebraspe" />
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <SuggestField label="Órgão" value={v.orgao} onChange={(x) => set('orgao', x)} options={opts('orgao')} placeholder="TJ-CE" />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <SuggestField label="Cargo" value={v.cargo} onChange={(x) => set('cargo', x)} options={opts('cargo')} placeholder="Analista Judiciário" />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField fullWidth size="small" label="Ano" type="number" value={v.year} onChange={(e) => set('year', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField select fullWidth size="small" label="Escolaridade" value={v.level} onChange={(e) => set('level', e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  {Object.entries(LEVEL_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 4 }}>
                <TextField select fullWidth size="small" label="Dificuldade" value={v.difficulty} onChange={(e) => set('difficulty', e.target.value as Difficulty)}>
                  {Object.entries(DIFFICULTY_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>

            {/* Texto de apoio */}
            <Typography variant="overline" color="text.secondary">Texto de apoio (opcional)</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Para questões que dependem de um texto (ex.: Português). Um mesmo texto pode servir a várias questões.
            </Typography>
            <Box sx={{ mb: 3 }}>
              <SupportTextPicker value={v.text} onChange={(t) => set('text', t)} isAdmin={isAdmin} />
            </Box>

            {/* Enunciado */}
            <Typography variant="overline" color="text.secondary">Enunciado</Typography>
            <Box sx={{ mt: 0.5, mb: 3 }}>
              <RichTextField fullWidth multiline minRows={4} maxRows={20}
                placeholder={v.type === 'CERTO_ERRADO' ? 'Escreva o item a ser julgado...' : 'Escreva o enunciado da questão...'}
                value={v.statement} onChange={(x) => set('statement', x)} />
            </Box>

            {/* Alternativas / gabarito */}
            <Typography variant="overline" color="text.secondary">
              {v.type === 'CERTO_ERRADO' ? 'Gabarito' : 'Alternativas — marque a correta'}
            </Typography>
            {v.type === 'MULTIPLA_ESCOLHA' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 0.5, mb: 1 }}>
                {letters.map((l) => (
                  <Box key={l} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                    <Tooltip title={`Marcar ${l} como correta`}>
                      <Radio checked={v.answer === l} onChange={() => set('answer', l)} sx={{ mt: 0.25 }}
                        inputProps={{ 'aria-label': `Alternativa ${l} correta` }} />
                    </Tooltip>
                    <Box sx={{ flex: 1 }}>
                      <RichTextField compact fullWidth size="small" multiline maxRows={6} label={`Alternativa ${l}`}
                        value={v.options[l] || ''} onChange={(x) => setV((p) => ({ ...p, options: { ...p.options, [l]: x } }))}
                        sx={v.answer === l ? { '& .MuiOutlinedInput-notchedOutline': { borderColor: '#22C55E', borderWidth: 2 } } : undefined} />
                    </Box>
                  </Box>
                ))}
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" startIcon={<AddCircleOutline />} disabled={v.optionCount >= 5} onClick={() => set('optionCount', v.optionCount + 1)}>
                    Alternativa
                  </Button>
                  <Button size="small" color="inherit" startIcon={<RemoveCircleOutline />} disabled={v.optionCount <= 2}
                    onClick={() => setV((p) => ({ ...p, optionCount: p.optionCount - 1, answer: p.answer === LETTERS[p.optionCount - 1] ? '' : p.answer }))}>
                    Remover última
                  </Button>
                </Box>
              </Box>
            ) : (
              <ToggleButtonGroup exclusive value={v.answer} onChange={(_, a) => set('answer', a ?? '')} sx={{ mt: 0.5, mb: 1, display: 'flex' }}>
                <ToggleButton value="C" sx={{ flex: 1, fontWeight: 700, '&.Mui-selected': { color: '#22C55E', bgcolor: alpha('#22C55E', 0.12) } }}>Certo</ToggleButton>
                <ToggleButton value="E" sx={{ flex: 1, fontWeight: 700, '&.Mui-selected': { color: '#EF4444', bgcolor: alpha('#EF4444', 0.12) } }}>Errado</ToggleButton>
              </ToggleButtonGroup>
            )}
            {!v.answer && (
              <Typography variant="caption" color="warning.main" sx={{ display: 'block', mb: 2 }}>
                Sem gabarito, a questão não conta acerto para o aluno.
              </Typography>
            )}

            {/* Comentário */}
            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Comentário do professor</Typography>
            <Box sx={{ mt: 0.5, mb: 3 }}>
              <RichTextField fullWidth multiline minRows={3} maxRows={20}
                placeholder="Explique o porquê do gabarito e o erro de cada alternativa..."
                value={v.explanation} onChange={(x) => set('explanation', x)} />
            </Box>

            <TextField fullWidth size="small" label="Fonte (opcional)" placeholder="Prova TJ-CE 2024 — Analista Judiciário"
              value={v.source} onChange={(e) => set('source', e.target.value)} sx={{ mb: 2 }} />

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {isAdmin && (
                <FormControlLabel control={<Switch checked={v.isPublic} onChange={(e) => set('isPublic', e.target.checked)} />}
                  label={<Typography variant="body2"><strong>Publicar no banco</strong> (visível para todos os alunos)</Typography>} />
              )}
              <FormControlLabel control={<Switch checked={v.isAnnulled} onChange={(e) => set('isAnnulled', e.target.checked)} />}
                label={<Typography variant="body2">Anulada</Typography>} />
              <FormControlLabel control={<Switch checked={v.isOutdated} onChange={(e) => set('isOutdated', e.target.checked)} />}
                label={<Typography variant="body2">Desatualizada</Typography>} />
            </Box>
            {!isAdmin && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Suas questões ficam privadas: só você vê e pratica.
              </Typography>
            )}

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end', flexWrap: 'wrap', mt: 3 }}>
              {allowAnother && (
                <Button variant="outlined" onClick={() => submit(true)} disabled={submitting}>
                  Salvar e cadastrar outra
                </Button>
              )}
              <Button variant="contained" onClick={() => submit(false)} disabled={submitting} sx={{ px: 4 }}>
                {submitting ? <CircularProgress size={20} color="inherit" /> : submitLabel}
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <Box sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, color: 'text.secondary' }}>
            <Visibility fontSize="small" />
            <Typography variant="overline">Como o aluno verá</Typography>
          </Box>
          <QuestionCard key={`${v.type}-${v.optionCount}`} question={preview} mode="preview" hideActions
            reviewResult={v.answer ? { selected: null, correctAnswer: v.answer, explanation: v.explanation || null } : null} />
        </Box>
      </Grid>
    </Grid>
  );
}
