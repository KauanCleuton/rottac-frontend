'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell, TableHead, TableRow, Chip, Button,
  LinearProgress, Grid, Skeleton, Tooltip, Collapse, IconButton, alpha,
} from '@mui/material';
import { CheckCircle, Cancel, RadioButtonUnchecked, Visibility, ExpandMore, ExpandLess } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { notebookApi } from '@/lib/api';
import { answerLabel, TYPE_LABEL, type BankQuestion } from '@/components/questions/types';
import type { Diagnosis } from './DiagnosisPanel';

const OK = '#22C55E';
const BAD = '#EF4444';
type Status = 'right' | 'wrong' | 'pending';
type NbQuestion = BankQuestion & { notebookAttempt?: { selected?: string; isCorrect: boolean } | null };

function StatusIcon({ s }: { s: Status }) {
  if (s === 'right') return <CheckCircle sx={{ color: OK, fontSize: 20 }} aria-label="Acertou" />;
  if (s === 'wrong') return <Cancel sx={{ color: BAD, fontSize: 20 }} aria-label="Errou" />;
  return <RadioButtonUnchecked sx={{ color: 'text.disabled', fontSize: 20 }} aria-label="Não resolvida" />;
}

// ─── Índice ──────────────────────────────────────────────────────────────────
export function NotebookIndex({ questions, statusOf, onOpen }: {
  questions: NbQuestion[]; statusOf: (q: NbQuestion) => Status; onOpen: (id: string) => void;
}) {
  // Agrupa por disciplina › assunto, preservando a ordem do caderno
  const groups = new Map<string, { q: NbQuestion; n: number }[]>();
  questions.forEach((q, i) => {
    const key = q.discipline || 'Sem disciplina';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ q, n: i + 1 });
  });
  return (
    <Card>
      <CardContent>
        <Typography variant="h6">Índice do caderno</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{questions.length} questões em {groups.size} disciplina(s). Clique para abrir.</Typography>
        {[...groups.entries()].map(([disc, items]) => (
          <Box key={disc} sx={{ mb: 2.5 }}>
            <Typography variant="overline" sx={{ color: 'primary.main' }}>{disc} · {items.length}</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 640 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 56 }}>Nº</TableCell><TableCell>Assunto / início do enunciado</TableCell>
                    <TableCell>Prova</TableCell><TableCell>Tipo</TableCell><TableCell align="center" sx={{ width: 60 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map(({ q, n }) => (
                    <TableRow key={q.id} hover onClick={() => onOpen(q.id)} sx={{ cursor: 'pointer' }}>
                      <TableCell sx={{ fontWeight: 800 }}>{String(n).padStart(2, '0')}</TableCell>
                      <TableCell>
                        {q.topic && <Typography variant="body2" fontWeight={700}>{q.topic}</Typography>}
                        <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {q.statement}
                        </Typography>
                      </TableCell>
                      <TableCell><Typography variant="caption">{[q.banca, q.year, q.orgao].filter(Boolean).join(' · ') || '—'}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{TYPE_LABEL[q.type]}</Typography></TableCell>
                      <TableCell align="center"><StatusIcon s={statusOf(q)} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </Box>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Estatísticas ────────────────────────────────────────────────────────────
function Breakdown({ title, rows }: { title: string; rows?: { name: string; total: number; correct: number; accuracy: number }[] }) {
  if (!rows?.length) return null;
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1.5 }}>{title}</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {rows.map((r) => {
            const c = r.accuracy >= 70 ? OK : r.accuracy >= 40 ? '#F59E0B' : BAD;
            return (
              <Box key={r.name}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>{r.name}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{r.correct}/{r.total} · <strong style={{ color: c }}>{r.accuracy}%</strong></Typography>
                </Box>
                <LinearProgress variant="determinate" value={r.accuracy} sx={{ height: 7, mt: 0.5, '& .MuiLinearProgress-bar': { bgcolor: c } }} />
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
}

export function NotebookStats({ diagnosis, loading }: { diagnosis?: Diagnosis & Record<string, any>; loading: boolean }) {
  if (loading && !diagnosis) return <Skeleton variant="rounded" height={320} />;
  if (!diagnosis) return null;
  const s = diagnosis.stats;
  const tiles = [
    { l: 'Resolvidas', v: `${s.answered}/${s.total}` },
    { l: 'Aproveitamento', v: s.answered ? `${s.accuracy}%` : '—' },
    { l: 'Acertos', v: s.correct, c: OK },
    { l: 'Erros', v: s.wrong, c: BAD },
    { l: 'Tempo médio', v: s.avgTime ? `${Math.floor(s.avgTime / 60)}:${String(s.avgTime % 60).padStart(2, '0')}` : '—' },
  ];
  return (
    <Box>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {tiles.map((t) => (
          <Grid key={t.l} size={{ xs: 6, sm: 2.4 }}>
            <Card><CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography sx={{ fontSize: 24, fontWeight: 900, color: t.c }}>{t.v}</Typography>
              <Typography variant="caption" color="text.secondary">{t.l}</Typography>
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
      {s.answered === 0 ? (
        <Typography color="text.secondary">Resolva questões para ver as estatísticas por disciplina, assunto e banca.</Typography>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}><Breakdown title="Por disciplina" rows={diagnosis.byDiscipline as any} /></Grid>
          <Grid size={{ xs: 12, md: 6 }}><Breakdown title="Por assunto" rows={diagnosis.byTopic} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Breakdown title="Por banca" rows={diagnosis.byBanca} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Breakdown title="Por dificuldade" rows={diagnosis.byDifficulty} /></Grid>
          <Grid size={{ xs: 12, md: 4 }}><Breakdown title="Por tipo de questão" rows={diagnosis.byType} /></Grid>
        </Grid>
      )}
    </Box>
  );
}

// ─── Gabarito ────────────────────────────────────────────────────────────────
export function NotebookAnswerKey({ notebookId, questions, statusOf, onOpen }: {
  notebookId: string; questions: NbQuestion[]; statusOf: (q: NbQuestion) => Status; onOpen: (id: string) => void;
}) {
  // Gabarito completo (inclusive das não resolvidas) só sob demanda
  const [full, setFull] = useState<Record<string, { answer: string | null; explanation: string | null }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const reveal = async () => {
    setLoading(true);
    try {
      const r = await notebookApi.printData(notebookId);
      setFull(Object.fromEntries(r.data.data.questions.map((q: any) => [q.id, { answer: q.answer, explanation: q.explanation }])));
    } catch (e: any) {
      if (e.response?.status !== 402) toast.error(e.response?.data?.message || 'Erro ao carregar o gabarito');
    } finally {
      setLoading(false);
    }
  };

  const pending = questions.filter((q) => statusOf(q) === 'pending').length;
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Gabarito</Typography>
            <Typography variant="body2" color="text.secondary">
              {full ? 'Gabarito completo do caderno.' : pending ? `O gabarito das ${pending} questões abertas fica oculto até você resolver.` : 'Todas as questões já foram resolvidas.'}
            </Typography>
          </Box>
          {!full && pending > 0 && (
            <Button variant="outlined" startIcon={<Visibility />} onClick={reveal} disabled={loading}>Revelar gabarito completo</Button>
          )}
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 56 }}>Nº</TableCell><TableCell>Disciplina</TableCell><TableCell align="center">Sua resposta</TableCell>
                <TableCell align="center">Gabarito</TableCell><TableCell align="center">Resultado</TableCell><TableCell sx={{ width: 48 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {questions.map((q, i) => {
                const st = statusOf(q);
                const answer = full?.[q.id]?.answer ?? q.answer;
                const explanation = full?.[q.id]?.explanation ?? q.explanation;
                const mine = q.notebookAttempt?.selected;
                return [
                  <TableRow key={q.id} hover>
                    <TableCell sx={{ fontWeight: 800, cursor: 'pointer' }} onClick={() => onOpen(q.id)}>{String(i + 1).padStart(2, '0')}</TableCell>
                    <TableCell><Typography variant="body2" noWrap sx={{ maxWidth: 260 }}>{q.discipline || '—'}</Typography></TableCell>
                    <TableCell align="center">{mine ? answerLabel(q.type, mine) : '—'}</TableCell>
                    <TableCell align="center">
                      {answer !== undefined && answer !== null
                        ? <Chip size="small" label={q.isAnnulled ? 'Anulada' : answerLabel(q.type, answer)} sx={{ fontWeight: 800, bgcolor: alpha(OK, 0.14), color: OK }} />
                        : <Typography variant="caption" color="text.disabled">oculto</Typography>}
                    </TableCell>
                    <TableCell align="center"><StatusIcon s={st} /></TableCell>
                    <TableCell>
                      {explanation && (
                        <Tooltip title={open === q.id ? 'Ocultar comentário' : 'Ver comentário'}>
                          <IconButton size="small" onClick={() => setOpen(open === q.id ? null : q.id)} aria-label="Comentário">
                            {open === q.id ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>,
                  explanation ? (
                    <TableRow key={`${q.id}-exp`}>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: open === q.id ? undefined : 'none' }}>
                        <Collapse in={open === q.id} unmountOnExit>
                          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', py: 1.5, color: 'text.secondary' }}>{explanation}</Typography>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  ) : null,
                ];
              })}
            </TableBody>
          </Table>
        </Box>
      </CardContent>
    </Card>
  );
}
