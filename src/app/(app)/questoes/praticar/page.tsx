'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Button, Chip, alpha, useTheme, LinearProgress, Grid,
  TextField, MenuItem, FormControlLabel, Switch, Divider,
  Tooltip, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import {
  ArrowBack, ArrowForward, Timer, School, Flag, OutlinedFlag, EmojiEvents, Refresh,
  CheckCircle, Cancel, RadioButtonUnchecked, Keyboard,
} from '@mui/icons-material';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';
import QuestionCard from '@/components/questions/QuestionCard';
import QuestionFilters, { type Filters, filtersFromParams, filtersToParams } from '@/components/questions/QuestionFilters';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { type BankQuestion, type AnswerResult, choicesOf } from '@/components/questions/types';

type Mode = 'treino' | 'simulado';
type Phase = 'setup' | 'running' | 'submitting' | 'done';
type Outcome = { selected: string | null; isCorrect: boolean | null; correctAnswer: string | null; explanation: string | null };

const OK = '#22C55E';
const BAD = '#EF4444';
const WARN = '#F59E0B';

const fmtTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

function PraticarContent() {
  const theme = useTheme();
  const router = useRouter();
  const sp = useSearchParams();
  const gold = theme.palette.primary.main;

  // ── Configuração
  const [mode, setMode] = useState<Mode>(sp.get('modo') === 'simulado' ? 'simulado' : 'treino');
  const [filters, setFilters] = useState<Filters>(() => {
    const f = filtersFromParams(sp);
    if (!sp.get('status')) f.status = 'nao_resolvidas';
    return f;
  });
  const [qty, setQty] = useState(20);
  const [minutesPerQ, setMinutesPerQ] = useState(3);
  const [cebraspe, setCebraspe] = useState(filters.type === 'CERTO_ERRADO');

  // ── Sessão
  const [phase, setPhase] = useState<Phase>('setup');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [flags, setFlags] = useState<Set<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [elapsed, setElapsed] = useState(0);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const startedAt = useRef(0);

  const limitSeconds = mode === 'simulado' ? Math.round(questions.length * minutesPerQ * 60) : 0;
  const remaining = Math.max(0, limitSeconds - elapsed);

  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const start = async () => {
    setLoading(true);
    try {
      const res = await questionBankApi.list({ ...filtersToParams(filters), order: 'random', limit: qty });
      const qs: BankQuestion[] = res.data.data.questions;
      if (!qs.length) {
        toast.error('Nenhuma questão com esses filtros. Experimente remover alguns.');
        return;
      }
      setQuestions(qs);
      setIdx(0);
      setAnswers({});
      setFlags(new Set());
      setOutcomes({});
      setElapsed(0);
      if (qs.every((q) => q.type === 'CERTO_ERRADO')) setCebraspe(true);
      startedAt.current = Date.now();
      setPhase('running');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao montar a sessão');
    } finally {
      setLoading(false);
    }
  };

  // ── Simulado: envia as respostas só no fim
  const finishSimulado = useCallback(async () => {
    setConfirmFinish(false);
    setPhase('submitting');
    const answered = questions.filter((q) => answers[q.id]);
    const avg = answered.length ? Math.round(elapsed / answered.length) : 0;
    const results = await Promise.all(questions.map(async (q): Promise<[string, Outcome]> => {
      const sel = answers[q.id];
      if (!sel) return [q.id, { selected: null, isCorrect: null, correctAnswer: null, explanation: null }];
      try {
        const r = await questionBankApi.answer(q.id, { selected: sel, timeSpent: avg });
        const d: AnswerResult = r.data.data;
        return [q.id, { selected: sel, isCorrect: d.isCorrect, correctAnswer: d.correctAnswer, explanation: d.explanation }];
      } catch {
        return [q.id, { selected: sel, isCorrect: null, correctAnswer: null, explanation: null }];
      }
    }));
    setOutcomes(Object.fromEntries(results));
    setPhase('done');
  }, [questions, answers, elapsed]);

  // Tempo esgotado: corrige automaticamente
  useEffect(() => {
    if (phase === 'running' && mode === 'simulado' && limitSeconds > 0 && remaining === 0) {
      toast('Tempo esgotado! Corrigindo seu simulado...', { icon: '⏰' });
      finishSimulado();
    }
  }, [remaining, phase, mode, limitSeconds, finishSimulado]);

  // Atalhos do simulado: letras marcam, setas navegam
  useEffect(() => {
    if (phase !== 'running' || mode !== 'simulado') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, [role="dialog"]')) return;
      const q = questions[idx];
      if (!q) return;
      const key = e.key.toUpperCase();
      if (choicesOf(q).some((c) => c.key === key)) {
        setAnswers((a) => ({ ...a, [q.id]: a[q.id] === key ? null : key }));
      } else if (e.key === 'ArrowRight') setIdx((i) => Math.min(questions.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, mode, questions, idx]);

  const onTreinoAnswered = (q: BankQuestion) => (r: AnswerResult, sel: string) => {
    setOutcomes((o) => ({ ...o, [q.id]: { selected: sel, isCorrect: r.isCorrect, correctAnswer: r.correctAnswer, explanation: r.explanation } }));
  };

  // ── Resultado
  const summary = useMemo(() => {
    const list = Object.values(outcomes);
    const right = list.filter((o) => o.isCorrect === true).length;
    const wrong = list.filter((o) => o.isCorrect === false).length;
    const blank = questions.length - right - wrong;
    const byDisc: Record<string, { right: number; wrong: number; blank: number }> = {};
    for (const q of questions) {
      const k = q.discipline || 'Sem disciplina';
      byDisc[k] ??= { right: 0, wrong: 0, blank: 0 };
      const o = outcomes[q.id];
      if (o?.isCorrect === true) byDisc[k].right++;
      else if (o?.isCorrect === false) byDisc[k].wrong++;
      else byDisc[k].blank++;
    }
    return { right, wrong, blank, net: right - wrong, byDisc };
  }, [outcomes, questions]);

  // ═══════════════════════════ CONFIGURAÇÃO ═══════════════════════════
  if (phase === 'setup') {
    return (
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Button startIcon={<ArrowBack />} size="small" onClick={() => router.push('/questoes/banco')}>Banco de questões</Button>
        <Typography variant="h4" sx={{ mt: 1 }}>Treino e Simulado</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>Monte uma sessão com questões do banco.</Typography>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {([
            { v: 'treino', icon: <School />, title: 'Treino', desc: 'Correção imediata, comentário do professor e estatística de cada questão.' },
            { v: 'simulado', icon: <Timer />, title: 'Simulado', desc: 'Cronômetro, folha de respostas e correção só no final, como no dia da prova.' },
          ] as const).map((o) => {
            const active = mode === o.v;
            return (
              <Grid key={o.v} size={{ xs: 12, sm: 6 }}>
                <Card role="button" tabIndex={0} onClick={() => setMode(o.v)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setMode(o.v); }}
                  sx={{
                    cursor: 'pointer', height: '100%', borderColor: active ? gold : undefined, borderWidth: active ? 2 : 1,
                    bgcolor: active ? alpha(gold, 0.06) : undefined, transition: 'all .15s',
                  }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, color: active ? 'primary.main' : 'text.secondary' }}>
                      {o.icon}<Typography variant="h6" color="text.primary">{o.title}</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">{o.desc}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">Quais questões</Typography>
            <Box sx={{ mt: 1 }}>
              <QuestionFilters value={filters} compact
                onChange={(f) => { setFilters(f); if (f.type === 'CERTO_ERRADO') setCebraspe(true); }} />
            </Box>
            <Divider sx={{ my: 2.5 }} />
            <Typography variant="overline" color="text.secondary">Formato</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mt: 1 }}>
              <TextField select size="small" label="Quantidade" value={qty} onChange={(e) => setQty(+e.target.value)} sx={{ minWidth: 140 }}>
                {[5, 10, 20, 30, 50, 80, 100].map((n) => <MenuItem key={n} value={n}>{n} questões</MenuItem>)}
              </TextField>
              {mode === 'simulado' && (
                <>
                  <TextField select size="small" label="Tempo por questão" value={minutesPerQ} onChange={(e) => setMinutesPerQ(+e.target.value)} sx={{ minWidth: 170 }}>
                    {[1, 1.5, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{String(n).replace('.', ',')} min</MenuItem>)}
                  </TextField>
                  <FormControlLabel control={<Switch checked={cebraspe} onChange={(e) => setCebraspe(e.target.checked)} />}
                    label={<Typography variant="body2">Nota líquida Cebraspe (uma errada anula uma certa)</Typography>} />
                </>
              )}
            </Box>
          </CardContent>
        </Card>

        <Button fullWidth variant="contained" size="large" onClick={start} disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : mode === 'simulado' ? <Timer /> : <School />}
          sx={{ py: 1.5, fontSize: 16, fontWeight: 700 }}>
          {loading ? 'Montando...' : mode === 'simulado' ? `Começar simulado (até ${Math.round(qty * minutesPerQ)} min)` : 'Começar treino'}
        </Button>
      </Box>
    );
  }

  // ═══════════════════════════ CORRIGINDO ═══════════════════════════
  if (phase === 'submitting') {
    return (
      <Box sx={{ textAlign: 'center', py: 10 }}>
        <CircularProgress size={48} />
        <Typography variant="h6" sx={{ mt: 2 }}>Corrigindo seu simulado...</Typography>
      </Box>
    );
  }

  // ═══════════════════════════ RESULTADO ═══════════════════════════
  if (phase === 'done') {
    const answeredCount = summary.right + summary.wrong;
    const pct = answeredCount ? Math.round((summary.right / answeredCount) * 100) : 0;
    const scoreColor = pct >= 70 ? OK : pct >= 50 ? WARN : BAD;
    const tiles = [
      { l: 'Aproveitamento', v: `${pct}%`, c: scoreColor },
      { l: 'Acertos', v: summary.right, c: OK },
      { l: 'Erros', v: summary.wrong, c: BAD },
      { l: 'Em branco', v: summary.blank, c: theme.palette.text.secondary },
      ...(cebraspe ? [{ l: 'Nota líquida', v: summary.net, c: summary.net >= 0 ? gold : BAD }] : []),
    ];
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
        <Card sx={{ mb: 3, overflow: 'hidden' }}>
          <Box sx={{ height: 4, background: `linear-gradient(90deg, ${scoreColor}, ${alpha(scoreColor, 0.3)})` }} />
          <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <EmojiEvents sx={{ fontSize: 48, color: scoreColor }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h4">{mode === 'simulado' ? 'Simulado finalizado' : 'Treino finalizado'}</Typography>
                <Typography color="text.secondary">
                  {questions.length} questões · {fmtTime(elapsed)}
                  {answeredCount > 0 && ` · ${fmtTime(Math.round(elapsed / answeredCount))} por questão`}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: `repeat(${tiles.length}, 1fr)` }, gap: 2 }}>
              {tiles.map((s) => (
                <Box key={s.l} sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(String(s.c), 0.3)}`, bgcolor: alpha(String(s.c), 0.06) }}>
                  <Typography variant="h4" sx={{ fontWeight: 900, color: s.c }}>{s.v}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.l}</Typography>
                </Box>
              ))}
            </Box>
            {cebraspe && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                Nota líquida = acertos − erros. Itens em branco não pontuam nem descontam.
              </Typography>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Desempenho por disciplina</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Disciplina</TableCell>
                    <TableCell align="center">Acertos</TableCell>
                    <TableCell align="center">Erros</TableCell>
                    <TableCell align="center">Branco</TableCell>
                    <TableCell sx={{ minWidth: 140 }}>Aproveitamento</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(summary.byDisc)
                    .sort((a, b) => (b[1].right + b[1].wrong) - (a[1].right + a[1].wrong))
                    .map(([name, d]) => {
                      const p = d.right + d.wrong ? Math.round((d.right / (d.right + d.wrong)) * 100) : 0;
                      return (
                        <TableRow key={name}>
                          <TableCell sx={{ fontWeight: 600 }}>{name}</TableCell>
                          <TableCell align="center" sx={{ color: OK, fontWeight: 700 }}>{d.right}</TableCell>
                          <TableCell align="center" sx={{ color: BAD, fontWeight: 700 }}>{d.wrong}</TableCell>
                          <TableCell align="center">{d.blank}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <LinearProgress variant="determinate" value={p}
                                sx={{ flexGrow: 1, height: 8, '& .MuiLinearProgress-bar': { bgcolor: p >= 70 ? OK : p >= 50 ? WARN : BAD } }} />
                              <Typography variant="caption" sx={{ minWidth: 32 }}>{p}%</Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
          <Button variant="contained" startIcon={<Refresh />} onClick={() => setPhase('setup')}>Nova sessão</Button>
          <Button variant="outlined" onClick={() => router.push('/questoes/banco?status=errei')}>Revisar o que errei</Button>
        </Box>

        {mode === 'simulado' && (
          <>
            <Typography variant="h6" sx={{ mb: 2 }}>Gabarito comentado</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {questions.map((q, i) => {
                const o = outcomes[q.id];
                return (
                  <QuestionCard key={q.id} question={q} index={i + 1} mode="preview"
                    reviewResult={{ selected: o?.selected ?? null, correctAnswer: o?.correctAnswer ?? null, explanation: o?.explanation }} />
                );
              })}
            </Box>
          </>
        )}
      </Box>
    );
  }

  // ═══════════════════════════ EM ANDAMENTO ═══════════════════════════
  const q = questions[idx];
  const answeredCount = mode === 'simulado'
    ? Object.values(answers).filter(Boolean).length
    : Object.keys(outcomes).length;
  const lowTime = mode === 'simulado' && remaining <= 300;
  const finish = () => (mode === 'simulado' ? setConfirmFinish(true) : setPhase('done'));

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Barra fixa */}
      <Card sx={{ mb: 2, position: 'sticky', top: { xs: 64, sm: 72 }, zIndex: 5 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Chip icon={mode === 'simulado' ? <Timer /> : <School />} label={mode === 'simulado' ? 'Simulado' : 'Treino'} color="primary" />
          <Typography variant="body2" color="text.secondary">
            Questão <strong>{idx + 1}</strong> de {questions.length} · {answeredCount} respondida(s)
          </Typography>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={mode === 'simulado' ? 'Tempo restante' : 'Tempo de sessão'}>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, color: lowTime ? BAD : 'text.primary' }}>
              {mode === 'simulado' ? fmtTime(remaining) : fmtTime(elapsed)}
            </Typography>
          </Tooltip>
          <Button variant={mode === 'simulado' ? 'contained' : 'outlined'} onClick={finish}>Finalizar</Button>
        </CardContent>
        <LinearProgress variant="determinate" value={(answeredCount / questions.length) * 100} sx={{ borderRadius: 0, height: 3 }} />
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: mode === 'simulado' ? 8.5 : 12 }}>
          {mode === 'simulado' ? (
            <QuestionCard key={q.id} question={q} index={idx + 1} mode="deferred" hideActions
              selected={answers[q.id] ?? null} onSelect={(k) => setAnswers((a) => ({ ...a, [q.id]: k }))} />
          ) : (
            <QuestionCard key={q.id} question={q} index={idx + 1} onAnswered={onTreinoAnswered(q)} />
          )}

          <Box sx={{ display: 'flex', gap: 1.5, mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button startIcon={<ArrowBack />} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>Anterior</Button>
            {mode === 'simulado' && (
              <Button color="inherit" startIcon={flags.has(q.id) ? <Flag sx={{ color: WARN }} /> : <OutlinedFlag />}
                onClick={() => setFlags((f) => { const n = new Set(f); if (n.has(q.id)) n.delete(q.id); else n.add(q.id); return n; })}>
                {flags.has(q.id) ? 'Marcada para revisar' : 'Revisar depois'}
              </Button>
            )}
            <Box sx={{ flexGrow: 1 }} />
            {idx < questions.length - 1 ? (
              <Button variant="contained" endIcon={<ArrowForward />} onClick={() => setIdx(idx + 1)}>Próxima</Button>
            ) : (
              <Button variant="contained" onClick={finish}>Ver resultado</Button>
            )}
          </Box>

          {mode === 'treino' && Object.keys(outcomes).length > 0 && (
            <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
              <Chip icon={<CheckCircle sx={{ fontSize: 16 }} />} label={`${summary.right} acertos`} sx={{ bgcolor: alpha(OK, 0.12), color: OK }} />
              <Chip icon={<Cancel sx={{ fontSize: 16 }} />} label={`${summary.wrong} erros`} sx={{ bgcolor: alpha(BAD, 0.12), color: BAD }} />
            </Box>
          )}
        </Grid>

        {mode === 'simulado' && (
          <Grid size={{ xs: 12, md: 3.5 }}>
            <Card sx={{ position: { md: 'sticky' }, top: { md: 160 } }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">Folha de respostas</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.75, mt: 1 }}>
                  {questions.map((qq, i) => {
                    const a = answers[qq.id];
                    const current = i === idx;
                    return (
                      <Box key={qq.id} role="button" tabIndex={0} aria-label={`Questão ${i + 1}${a ? `, marcada ${a}` : ', em branco'}`}
                        onClick={() => setIdx(i)} onKeyDown={(e) => { if (e.key === 'Enter') setIdx(i); }}
                        sx={{
                          position: 'relative', aspectRatio: '1', borderRadius: 1.5, cursor: 'pointer',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 700, lineHeight: 1.1,
                          border: `1.5px solid ${current ? gold : a ? alpha(gold, 0.6) : theme.palette.divider}`,
                          bgcolor: a ? alpha(gold, 0.18) : 'transparent',
                          outline: current ? `2px solid ${alpha(gold, 0.35)}` : 'none',
                        }}>
                        {i + 1}
                        {a && <span style={{ fontSize: 10, opacity: 0.8 }}>{a}</span>}
                        {flags.has(qq.id) && <Flag sx={{ position: 'absolute', top: -6, right: -6, fontSize: 14, color: WARN }} />}
                      </Box>
                    );
                  })}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircle sx={{ fontSize: 14, color: gold }} /> {answeredCount} marcadas
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <RadioButtonUnchecked sx={{ fontSize: 14 }} /> {questions.length - answeredCount} em branco
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Flag sx={{ fontSize: 14, color: WARN }} /> {flags.size}
                  </Typography>
                </Box>
                <Divider sx={{ my: 1.5 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
                  <Keyboard sx={{ fontSize: 16 }} />
                  Atalhos: letras marcam a alternativa (C/E nos itens Certo/Errado) e as setas ← → navegam.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <ConfirmDialog open={confirmFinish} title="Finalizar simulado?"
        message={
          questions.length - answeredCount > 0
            ? `Você deixou ${questions.length - answeredCount} questão(ões) em branco${flags.size ? ` e marcou ${flags.size} para revisar` : ''}. Deseja corrigir mesmo assim?`
            : 'Todas as questões foram respondidas. Corrigir agora?'
        }
        confirmLabel="Corrigir simulado" onConfirm={finishSimulado} onClose={() => setConfirmFinish(false)} />
    </Box>
  );
}

export default function PraticarQuestoesPage() {
  return (
    <Suspense fallback={null}>
      <PraticarContent />
    </Suspense>
  );
}
