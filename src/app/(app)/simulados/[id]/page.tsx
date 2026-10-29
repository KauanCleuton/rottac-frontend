'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Alert, Skeleton, LinearProgress, Paper, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions, CircularProgress, ToggleButtonGroup, ToggleButton, Table, TableHead,
  TableRow, TableCell, TableBody, Tooltip, alpha, useTheme,
} from '@mui/material';
import {
  EmojiEvents, ArrowBack, Timer, PlayArrow, NavigateBefore, NavigateNext, Send, CheckCircle, Cancel, Groups,
  CloudDone, CloudSync, Lock, Rule,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { examApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import QuestionCard from '@/components/questions/QuestionCard';
import type { BankQuestion } from '@/components/questions/types';

type Detail = {
  id: string; title: string; description: string | null; banca: string | null; cargo: string | null;
  startsAt: string; endsAt: string; durationMinutes: number; cutoffScore: number | null; wrongPenalty: boolean; isPremium: boolean;
  phase: 'upcoming' | 'open' | 'closed'; questions: number; participants: number; locked: boolean;
  disciplines: { name: string; total: number }[]; myStatus: 'none' | 'in_progress' | 'finished'; serverNow: string;
};
type Attempt = { attemptId: string; startedAt: string; deadline: string; serverNow: string; answers: Record<string, string>; questions: BankQuestion[] };

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  return h ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};

// ─── Antes da prova ─────────────────────────────────────────────────────────
function Intro({ exam, onStart, starting }: { exam: Detail; onStart: () => void; starting: boolean }) {
  // Diferença entre o relógio do servidor e o do aparelho (o cronômetro segue o servidor)
  const [offset] = useState(() => new Date(exam.serverNow).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offset), 1000); return () => clearInterval(t); }, [offset]);
  const toStart = new Date(exam.startsAt).getTime() - now;
  const [confirm, setConfirm] = useState(false);

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 4 } }}>
        <Typography variant="h4" fontWeight={800}>{exam.title}</Typography>
        {(exam.banca || exam.cargo) && <Typography color="text.secondary">{[exam.banca, exam.cargo].filter(Boolean).join(' · ')}</Typography>}
        {exam.description && <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{exam.description}</Typography>}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, my: 3 }}>
          {[
            ['Questões', exam.questions],
            ['Tempo de prova', `${exam.durationMinutes} min`],
            ['Nota de corte', exam.cutoffScore ?? '—'],
            ['Participantes', exam.participants],
          ].map(([l, v]) => (
            <Paper key={l as string} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary">{l}</Typography>
              <Typography variant="h5" fontWeight={800}>{v}</Typography>
            </Paper>
          ))}
        </Box>

        {exam.disciplines.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="overline" color="text.secondary">Conteúdo</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {exam.disciplines.map((d) => <Chip key={d.name} label={`${d.name} · ${d.total}`} variant="outlined" />)}
            </Box>
          </Box>
        )}

        <Alert severity="info" icon={<Rule />} sx={{ mb: 3 }}>
          <strong>Regras:</strong> você pode começar de {dayjs(exam.startsAt).format('DD/MM HH:mm')} até {dayjs(exam.endsAt).format('DD/MM HH:mm')}.
          Ao começar, o cronômetro de {exam.durationMinutes} minutos não para (nem fechando a página) e a prova é entregue sozinha no fim do tempo.
          Uma tentativa por aluno. {exam.wrongPenalty ? 'Atenção: cada questão errada anula uma certa — deixar em branco não desconta.' : 'Questões erradas não descontam pontos.'}
        </Alert>

        {exam.phase === 'upcoming' ? (
          <Box sx={{ textAlign: 'center' }}>
            <Typography color="text.secondary">Começa em</Typography>
            <Typography variant="h3" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }}>
              {toStart > 86400000 ? `${Math.floor(toStart / 86400000)}d ${clock(toStart % 86400000)}` : clock(toStart)}
            </Typography>
          </Box>
        ) : exam.phase === 'closed' ? (
          <Alert severity="warning">O prazo para começar este simulado terminou.</Alert>
        ) : exam.locked ? (
          <Button variant="contained" size="large" startIcon={<Lock />} component={Link} href="/planos">Assine para participar</Button>
        ) : (
          <Button variant="contained" size="large" startIcon={starting ? <CircularProgress size={20} color="inherit" /> : <PlayArrow />}
            onClick={() => setConfirm(true)} disabled={starting} sx={{ px: 5 }}>
            Começar prova
          </Button>
        )}
      </CardContent>
      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Começar agora?</DialogTitle>
        <DialogContent>
          <DialogContentText>O cronômetro de {exam.durationMinutes} minutos começa assim que você confirmar e não pode ser pausado.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setConfirm(false)}>Agora não</Button>
          <Button variant="contained" onClick={() => { setConfirm(false); onStart(); }}>Começar</Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

// ─── Durante a prova ────────────────────────────────────────────────────────
function ExamRunner({ exam, attempt, onFinished }: { exam: Detail; attempt: Attempt; onFinished: () => void }) {
  const theme = useTheme();
  const [answers, setAnswers] = useState<Record<string, string>>(attempt.answers || {});
  const [idx, setIdx] = useState(() => Math.max(0, attempt.questions.findIndex((q) => !attempt.answers?.[q.id])));
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [confirm, setConfirm] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [offset] = useState(() => new Date(attempt.serverNow).getTime() - Date.now());
  const deadline = new Date(attempt.deadline).getTime();
  const [left, setLeft] = useState(() => deadline - (Date.now() + offset));
  const answersRef = useRef(answers);
  const dirty = useRef(false);
  const finishedRef = useRef(false);

  const flush = useCallback(async () => {
    if (!dirty.current || finishedRef.current) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      await examApi.save(exam.id, answersRef.current);
      setSaveState('saved');
    } catch {
      dirty.current = true;
      setSaveState('error');
    }
  }, [exam.id]);

  const finish = useCallback(async (auto = false) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinishing(true);
    try {
      await examApi.finish(exam.id, answersRef.current);
      toast.success(auto ? 'Tempo esgotado — prova entregue' : 'Prova entregue!');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao entregar');
    }
    onFinished();
  }, [exam.id, onFinished]);

  // Cronômetro + salvamento a cada 5 s se algo mudou
  useEffect(() => {
    const t = setInterval(() => {
      const l = deadline - (Date.now() + offset);
      setLeft(l);
      if (l <= 0) finish(true);
    }, 1000);
    const s = setInterval(flush, 5000);
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    return () => { clearInterval(t); clearInterval(s); document.removeEventListener('visibilitychange', onHide); };
  }, [deadline, offset, finish, flush]);

  // Avisa antes de sair com respostas ainda não salvas
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const select = (qid: string, v: string | null) => {
    const n = { ...answersRef.current };
    if (v) n[qid] = v; else delete n[qid];
    answersRef.current = n; // o salvamento/entrega lê daqui sem esperar o próximo render
    setAnswers(n);
    dirty.current = true;
    setSaveState('saving');
  };

  const qs = attempt.questions;
  const q = qs[idx];
  const answered = Object.keys(answers).length;
  const blanks = qs.length - answered;
  const danger = left < 5 * 60000;
  const totalMs = exam.durationMinutes * 60000;

  return (
    <Box>
      {/* Barra fixa: tempo, progresso, salvamento, entregar */}
      <Paper elevation={3} sx={{ position: 'sticky', top: { xs: 56, sm: 64 }, zIndex: 10, p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: danger ? 'error.main' : 'text.primary' }}>
          <Timer />
          <Typography variant="h5" fontWeight={800} sx={{ fontVariantNumeric: 'tabular-nums' }} aria-live="off">{clock(left)}</Typography>
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 120 }}>
          <Typography variant="caption" color="text.secondary">{answered} de {qs.length} respondidas</Typography>
          <LinearProgress variant="determinate" value={(answered / qs.length) * 100} sx={{ height: 6, borderRadius: 3 }} />
          <LinearProgress variant="determinate" value={Math.max(0, (left / totalMs) * 100)} color={danger ? 'error' : 'inherit'} sx={{ height: 2, mt: 0.5, opacity: 0.5 }} />
        </Box>
        <Tooltip title={saveState === 'saved' ? 'Respostas salvas' : saveState === 'saving' ? 'Salvando…' : 'Falha ao salvar — tentando de novo'}>
          {saveState === 'saved' ? <CloudDone color="success" /> : <CloudSync color={saveState === 'error' ? 'error' : 'action'} />}
        </Tooltip>
        <Button variant="contained" startIcon={finishing ? <CircularProgress size={16} color="inherit" /> : <Send />} onClick={() => setConfirm(true)} disabled={finishing}>
          Entregar
        </Button>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) 250px' }, gap: 2, alignItems: 'start' }}>
        <Box>
          {q && (
            <QuestionCard key={q.id} question={q} index={idx + 1} mode="deferred" hideActions
              selected={answers[q.id] ?? null} onSelect={(v) => select(q.id, v)} />
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
            <Button startIcon={<NavigateBefore />} disabled={idx === 0} onClick={() => setIdx((i) => i - 1)}>Anterior</Button>
            {idx < qs.length - 1
              ? <Button variant="outlined" endIcon={<NavigateNext />} onClick={() => setIdx((i) => i + 1)}>Próxima</Button>
              : <Button variant="contained" endIcon={<Send />} onClick={() => setConfirm(true)}>Entregar</Button>}
          </Box>
        </Box>

        {/* Folha de respostas */}
        <Card sx={{ position: { md: 'sticky' }, top: { md: 150 } }}>
          <CardContent>
            <Typography variant="overline" color="text.secondary">Folha de respostas</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.75 }}>
              {qs.map((x, i) => {
                const a = answers[x.id];
                return (
                  <Button key={x.id} size="small" onClick={() => setIdx(i)} aria-label={`Questão ${i + 1}${a ? `, marcada ${a}` : ', em branco'}`}
                    sx={{
                      minWidth: 0, p: 0.5, flexDirection: 'column', lineHeight: 1.1, fontSize: 12, fontWeight: 800,
                      border: `1.5px solid ${i === idx ? theme.palette.primary.main : theme.palette.divider}`,
                      bgcolor: a ? alpha(theme.palette.primary.main, 0.15) : 'transparent', color: 'text.primary',
                    }}>
                    {i + 1}
                    <Box component="span" sx={{ fontSize: 10, color: 'text.secondary', minHeight: 12 }}>{a || ''}</Box>
                  </Button>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      </Box>

      <Dialog open={confirm} onClose={() => setConfirm(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Entregar a prova?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {blanks ? `Você deixou ${blanks} questão(ões) em branco. ` : 'Todas as questões foram respondidas. '}
            Depois de entregar não dá para alterar as respostas.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setConfirm(false)}>Voltar à prova</Button>
          <Button variant="contained" onClick={() => { setConfirm(false); finish(); }}>Entregar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Resultado ──────────────────────────────────────────────────────────────
function Result({ examId }: { examId: string }) {
  const theme = useTheme();
  const [filter, setFilter] = useState<'todas' | 'erradas' | 'branco'>('erradas');
  const [shown, setShown] = useState(10);
  const { data, isLoading, error } = useQuery({
    queryKey: ['exam-result', examId],
    queryFn: () => examApi.result(examId).then((r) => r.data.data),
  });
  if (isLoading) return <Skeleton variant="rounded" height={400} />;
  if (error || !data) return <Alert severity="error">Não foi possível carregar o resultado.</Alert>;

  const { exam, me, stats, ranking, byDiscipline, gabarito } = data;
  const OK = theme.palette.success.main;
  const BAD = theme.palette.error.main;
  const list = (gabarito as (BankQuestion & { mySelected: string | null })[]).filter((g) =>
    filter === 'todas' ? true : filter === 'branco' ? !g.mySelected : g.mySelected && !g.isAnnulled && g.mySelected !== g.answer);

  return (
    <Box>
      {me && (
        <Card sx={{ mb: 2, overflow: 'hidden' }}>
          <Box sx={{ p: { xs: 2.5, sm: 4 }, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.18)}, transparent 60%)` }}>
            <Typography variant="overline" color="text.secondary">{exam.title}</Typography>
            <Box sx={{ display: 'flex', gap: { xs: 3, sm: 6 }, flexWrap: 'wrap', alignItems: 'flex-end', mt: 1 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Nota {exam.wrongPenalty ? 'líquida' : ''}</Typography>
                <Typography variant="h2" fontWeight={900} sx={{ lineHeight: 1 }}>{me.score}<Typography component="span" variant="h5" color="text.secondary"> / {exam.questions}</Typography></Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Posição</Typography>
                <Typography variant="h3" fontWeight={900} sx={{ lineHeight: 1 }}>{me.position}º<Typography component="span" variant="h6" color="text.secondary"> de {stats.participants}</Typography></Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Percentil</Typography>
                <Typography variant="h3" fontWeight={900} sx={{ lineHeight: 1 }}>{me.percentile}%</Typography>
              </Box>
            </Box>
            <Typography sx={{ mt: 2 }}>
              {me.correct} certas · {me.wrong} erradas · {me.blank} em branco · {me.minutes} min.
              {stats.participants > 1 && ` Você ficou à frente de ${me.percentile}% dos participantes.`}
            </Typography>
            {me.approved !== null && (
              <Alert severity={me.approved ? 'success' : 'warning'} icon={me.approved ? <EmojiEvents /> : undefined} sx={{ mt: 2 }}>
                {me.approved
                  ? <>Você estaria <strong>aprovado</strong> com a nota de corte de {exam.cutoffScore} pontos.</>
                  : <>Faltaram <strong>{me.missing} ponto(s)</strong> para a nota de corte de {exam.cutoffScore}. Revise as erradas abaixo.</>}
              </Alert>
            )}
          </Box>
        </Card>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Groups color="primary" />
              <Typography fontWeight={800} sx={{ flexGrow: 1 }}>Ranking</Typography>
              {stats.provisional && <Chip size="small" label="parcial — ainda há quem possa fazer" variant="outlined" />}
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Média {stats.average} · melhor nota {stats.best ?? '—'}{stats.approved !== null && ` · ${stats.approved} acima da nota de corte`}
            </Typography>
            <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow><TableCell>#</TableCell><TableCell>Aluno</TableCell><TableCell align="right">Nota</TableCell><TableCell align="right">Tempo</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {ranking.map((r: any, i: number) => (
                    <TableRow key={i} sx={{ bgcolor: r.isMe ? alpha(theme.palette.primary.main, 0.12) : undefined }}>
                      <TableCell sx={{ fontWeight: 800 }}>{r.position}º</TableCell>
                      <TableCell sx={{ fontWeight: r.isMe ? 800 : 400 }}>{r.name}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{r.score}</TableCell>
                      <TableCell align="right">{r.minutes} min</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>

        {me && (
          <Card>
            <CardContent>
              <Typography fontWeight={800} sx={{ mb: 1.5 }}>Seu desempenho por matéria</Typography>
              {byDiscipline.map((d: any) => {
                const pct = d.total ? Math.round((d.correct / d.total) * 100) : 0;
                return (
                  <Box key={d.name} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{d.name}</Typography>
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{d.correct}/{d.total} · {pct}%</Typography>
                    </Box>
                    {/* Certas | erradas | brancas, com 2px de respiro entre os trechos */}
                    <Box sx={{ display: 'flex', gap: '2px', height: 8, mt: 0.5, borderRadius: 4, overflow: 'hidden', bgcolor: 'action.hover' }}>
                      {d.correct > 0 && <Box sx={{ flex: d.correct, bgcolor: OK }} />}
                      {d.wrong > 0 && <Box sx={{ flex: d.wrong, bgcolor: BAD }} />}
                      {d.blank > 0 && <Box sx={{ flex: d.blank, bgcolor: 'action.disabled' }} />}
                    </Box>
                  </Box>
                );
              })}
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                {[['Certas', OK], ['Erradas', BAD], ['Em branco', theme.palette.action.disabled]].map(([l, c]) => (
                  <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c }} />
                    <Typography variant="caption" color="text.secondary">{l}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <Typography fontWeight={800} sx={{ flexGrow: 1 }}>Gabarito comentado</Typography>
            <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => { if (v) { setFilter(v); setShown(10); } }}>
              <ToggleButton value="erradas"><Cancel sx={{ fontSize: 16, mr: 0.5 }} />Erradas</ToggleButton>
              <ToggleButton value="branco">Em branco</ToggleButton>
              <ToggleButton value="todas"><CheckCircle sx={{ fontSize: 16, mr: 0.5 }} />Todas</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {!list.length && <Alert severity="success">Nada aqui. 👏</Alert>}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {list.slice(0, shown).map((g) => (
              <QuestionCard key={g.id} question={g} index={(gabarito as any[]).indexOf(g) + 1} mode="deferred"
                selected={g.mySelected} onSelect={() => {}}
                reviewResult={{ selected: g.mySelected, correctAnswer: g.answer ?? null, explanation: g.explanation }} />
            ))}
          </Box>
          {list.length > shown && <Button fullWidth sx={{ mt: 2 }} onClick={() => setShown((n) => n + 10)}>Mostrar mais ({list.length - shown})</Button>}
        </CardContent>
      </Card>
    </Box>
  );
}

function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [starting, setStarting] = useState(false);

  const { data: exam, isLoading, error, refetch } = useQuery({
    queryKey: ['exam', id],
    queryFn: () => examApi.get(id).then((r) => r.data.data as Detail),
  });

  // Prova em andamento (recarregou a página / outra aba): retoma
  useEffect(() => {
    if (exam?.myStatus !== 'in_progress' || attempt) return;
    examApi.attempt(id).then((r) => {
      if (r.data.data.finished) refetch();
      else setAttempt(r.data.data);
    }).catch(() => refetch());
  }, [exam?.myStatus, attempt, id, refetch]);

  const start = async () => {
    setStarting(true);
    try {
      const r = await examApi.start(id);
      setAttempt(r.data.data);
      qc.invalidateQueries({ queryKey: ['exams'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Não foi possível começar');
      refetch();
    } finally {
      setStarting(false);
    }
  };

  const onFinished = useCallback(() => {
    setAttempt(null);
    qc.invalidateQueries({ queryKey: ['exams'] });
    refetch();
  }, [qc, refetch]);

  if (isLoading) return <Box sx={{ maxWidth: 1100, mx: 'auto' }}><Skeleton variant="rounded" height={400} /></Box>;
  if (error || !exam) return <Alert severity="error">Simulado não encontrado.</Alert>;

  const showResult = exam.myStatus === 'finished' || (isAdmin && sp.get('ver') === 'resultado');

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      {!attempt && <Button component={Link} href="/simulados" startIcon={<ArrowBack />} color="inherit" sx={{ mb: 1 }}>Simulados</Button>}
      {attempt ? (
        <ExamRunner exam={exam} attempt={attempt} onFinished={onFinished} />
      ) : showResult ? (
        <Result examId={id} />
      ) : exam.myStatus === 'in_progress' ? (
        <Skeleton variant="rounded" height={400} />
      ) : (
        <Intro exam={exam} onStart={start} starting={starting} />
      )}
    </Box>
  );
}

export default function ExamPageRoute() {
  return (
    <Suspense fallback={null}>
      <ExamPage />
    </Suspense>
  );
}
