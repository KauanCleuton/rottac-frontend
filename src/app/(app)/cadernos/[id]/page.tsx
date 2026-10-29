'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Button, Grid, Chip, LinearProgress, Tabs, Tab, IconButton,
  Tooltip, Skeleton, Alert, ToggleButtonGroup, ToggleButton, Menu, MenuItem, alpha, useTheme,
} from '@mui/material';
import {
  ArrowBack, ArrowForward, Psychology, MoreVert, Folder, RestartAlt, DeleteOutline, RemoveCircleOutline,
  LibraryBooks, Print,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { notebookApi } from '@/lib/api';
import QuestionCard from '@/components/questions/QuestionCard';
import DiagnosisPanel, { type Diagnosis } from '@/components/notebooks/DiagnosisPanel';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import PrintNotebookDialog from '@/components/notebooks/PrintNotebookDialog';
import { NotebookIndex, NotebookStats, NotebookAnswerKey } from '@/components/notebooks/NotebookTabs';
import type { BankQuestion, AnswerResult } from '@/components/questions/types';

const OK = '#22C55E';
const BAD = '#EF4444';
type Filter = 'all' | 'pending' | 'right' | 'wrong';
type TabKey = 'resolver' | 'indice' | 'estatisticas' | 'gabarito' | 'diagnostico';

export default function CadernoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const qc = useQueryClient();
  const gold = theme.palette.primary.main;
  const [tab, setTab] = useState<TabKey>('resolver');
  const [printOpen, setPrintOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [current, setCurrent] = useState<string | null>(null);
  // Resultado das respostas desta sessão (sobrepõe o que veio do servidor)
  const [live, setLive] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [streak, setStreak] = useState(0); // acertos seguidos nesta sessão

  const { data: nb, isLoading, error } = useQuery({
    queryKey: ['notebooks', 'item', id],
    queryFn: () => notebookApi.get(id).then((r) => r.data.data),
  });
  const { data: diagnosis, refetch: refetchDiagnosis, isFetching: diagLoading } = useQuery({
    queryKey: ['notebooks', 'diagnosis', id],
    queryFn: () => notebookApi.diagnosis(id).then((r) => r.data.data as Diagnosis),
    enabled: tab === 'diagnostico' || tab === 'estatisticas',
  });

  const questions: (BankQuestion & { notebookAttempt?: { isCorrect: boolean } | null })[] = useMemo(() => nb?.questions || [], [nb]);
  const statusOf = (q: (typeof questions)[number]): 'right' | 'wrong' | 'pending' => {
    const v = q.id in live ? live[q.id] : q.notebookAttempt?.isCorrect;
    return v === undefined || v === null ? 'pending' : v ? 'right' : 'wrong';
  };
  const visible = questions.filter((q) => filter === 'all' || statusOf(q) === filter);
  const counts = {
    right: questions.filter((q) => statusOf(q) === 'right').length,
    wrong: questions.filter((q) => statusOf(q) === 'wrong').length,
  };
  const answered = counts.right + counts.wrong;
  const accuracy = answered ? Math.round((counts.right / answered) * 100) : null;

  const currentIdx = Math.max(0, visible.findIndex((q) => q.id === current));
  const q = visible[currentIdx];

  const go = (delta: number) => {
    const next = visible[currentIdx + delta];
    if (next) { setCurrent(next.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const openQuestion = (qid: string) => {
    setFilter('all');
    setCurrent(qid);
    setTab('resolver');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onAnswered = (qid: string) => (r: AnswerResult) => {
    const wasPending = statusOf(questions.find((x) => x.id === qid)!) === 'pending';
    setLive((s) => ({ ...s, [qid]: r.isCorrect }));
    setStreak((n) => (r.isCorrect ? n + 1 : 0));
    qc.invalidateQueries({ queryKey: ['notebooks', 'diagnosis', id] });
    // Última pendente respondida: abre o diagnóstico
    if (wasPending && answered + 1 === questions.length) {
      setTimeout(() => {
        toast('Caderno concluído! Veja seu diagnóstico.', { icon: '🧠' });
        setTab('diagnostico');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 1200);
    }
  };

  const doConfirm = async () => {
    setBusy(true);
    try {
      if (confirm === 'reset') {
        await notebookApi.reset(id);
        setLive({});
        await qc.invalidateQueries({ queryKey: ['notebooks'] });
        toast.success('Caderno zerado');
        setTab('resolver');
      } else if (confirm === 'delete') {
        await notebookApi.remove(id);
        qc.invalidateQueries({ queryKey: ['notebooks'] });
        toast.success('Caderno excluído');
        router.push('/cadernos');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const removeCurrent = async () => {
    if (!q) return;
    try {
      await notebookApi.removeQuestion(id, q.id);
      toast.success('Questão removida do caderno');
      go(1);
      qc.invalidateQueries({ queryKey: ['notebooks'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao remover');
    }
  };

  if (isLoading) return <Box sx={{ maxWidth: 1200, mx: 'auto' }}><Skeleton height={60} /><Skeleton variant="rounded" height={400} /></Box>;
  if (error || !nb) return <Alert severity="error">Caderno não encontrado.</Alert>;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Button startIcon={<ArrowBack />} size="small" component={Link} href="/cadernos">Cadernos</Button>

      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mt: 1, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 240 }}>
          <Typography variant="h4">{nb.name}</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.5 }}>
            {nb.folder && <Chip size="small" icon={<Folder sx={{ fontSize: 15, color: `${nb.folder.color} !important` }} />} label={nb.folder.name} variant="outlined" />}
            <Typography variant="body2" color="text.secondary">
              {answered}/{questions.length} resolvidas
              {accuracy !== null && <> · <strong style={{ color: accuracy >= 70 ? OK : accuracy >= 40 ? '#F59E0B' : BAD }}>{accuracy}% de acerto</strong></>}
            </Typography>
          </Box>
          {nb.description && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{nb.description}</Typography>}
        </Box>
        <Button variant={tab === 'diagnostico' ? 'contained' : 'outlined'} startIcon={<Psychology />} onClick={() => { setTab('diagnostico'); refetchDiagnosis(); }}>
          Diagnóstico
        </Button>
        <Button variant="outlined" startIcon={<Print />} onClick={() => setPrintOpen(true)} disabled={!questions.length}>Imprimir</Button>
        <IconButton onClick={(e) => setMenu(e.currentTarget)} aria-label="Mais opções"><MoreVert /></IconButton>
      </Box>
      <LinearProgress variant="determinate" value={questions.length ? (answered / questions.length) * 100 : 0} sx={{ height: 6, mb: 2 }} />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable" allowScrollButtonsMobile>
        <Tab value="resolver" label="Resolver" />
        <Tab value="indice" label="Índice" />
        <Tab value="estatisticas" label="Estatísticas" />
        <Tab value="gabarito" label="Gabarito" />
        <Tab value="diagnostico" label="Diagnóstico" />
      </Tabs>

      {tab === 'indice' ? (
        <NotebookIndex questions={questions} statusOf={statusOf} onOpen={openQuestion} />
      ) : tab === 'estatisticas' ? (
        <NotebookStats diagnosis={diagnosis as any} loading={diagLoading} />
      ) : tab === 'gabarito' ? (
        <NotebookAnswerKey notebookId={id} questions={questions} statusOf={statusOf} onOpen={openQuestion} />
      ) : tab === 'diagnostico' ? (
        diagLoading && !diagnosis ? <Skeleton variant="rounded" height={320} />
          : diagnosis ? <DiagnosisPanel key={answered} notebookId={id} diagnosis={diagnosis} /> : null
      ) : questions.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <LibraryBooks sx={{ fontSize: 56, color: 'text.disabled' }} />
            <Typography variant="h6" sx={{ mt: 1 }}>Este caderno está vazio</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>No Banco de Questões, use o botão “Caderno” em cada questão para adicioná-la aqui.</Typography>
            <Button variant="contained" component={Link} href="/questoes/banco">Ir ao banco de questões</Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8.5 }}>
            {/* Placar do caderno, sempre visível enquanto resolve */}
            <Card sx={{ mb: 2, position: 'sticky', top: { xs: 64, sm: 72 }, zIndex: 4 }}>
              <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 }, display: 'grid', gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(5, 1fr)' }, gap: 1, alignItems: 'center' }}>
                {[
                  { l: 'Acertos', v: counts.right, c: OK },
                  { l: 'Erros', v: counts.wrong, c: BAD },
                  { l: 'Faltam', v: questions.length - answered, c: undefined },
                  { l: 'Aproveitamento', v: accuracy === null ? '—' : `${accuracy}%`, c: accuracy === null ? undefined : accuracy >= 70 ? OK : accuracy >= 40 ? '#F59E0B' : BAD },
                ].map((s) => (
                  <Box key={s.l} sx={{ textAlign: 'center' }}>
                    <Typography sx={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1, color: s.c ?? 'text.primary' }}>{s.v}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>{s.l}</Typography>
                  </Box>
                ))}
                <Box sx={{ textAlign: 'center', display: { xs: 'none', sm: 'block' } }}>
                  <Typography sx={{ fontSize: 22, fontWeight: 900, lineHeight: 1.1, color: streak >= 3 ? gold : 'text.primary' }}>
                    {streak >= 3 ? '🔥 ' : ''}{streak}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Seguidas</Typography>
                </Box>
              </CardContent>
              <LinearProgress variant="determinate" value={questions.length ? (answered / questions.length) * 100 : 0} sx={{ height: 3, borderRadius: 0 }} />
            </Card>
            {q ? (
              <>
                <QuestionCard key={q.id} question={q} index={questions.indexOf(q) + 1} notebookId={id} onAnswered={onAnswered(q.id)} />
                <Box sx={{ display: 'flex', gap: 1.5, mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button startIcon={<ArrowBack />} disabled={currentIdx === 0} onClick={() => go(-1)}>Anterior</Button>
                  <Tooltip title="Remover esta questão do caderno">
                    <Button color="inherit" size="small" startIcon={<RemoveCircleOutline fontSize="small" />} onClick={removeCurrent} sx={{ color: 'text.secondary' }}>
                      Remover do caderno
                    </Button>
                  </Tooltip>
                  <Box sx={{ flex: 1 }} />
                  {currentIdx < visible.length - 1 ? (
                    <Button variant="contained" endIcon={<ArrowForward />} onClick={() => go(1)}>Próxima</Button>
                  ) : (
                    <Button variant="contained" startIcon={<Psychology />} onClick={() => setTab('diagnostico')}>Ver diagnóstico</Button>
                  )}
                </Box>
              </>
            ) : (
              <Alert severity="info">Nenhuma questão neste filtro.</Alert>
            )}
          </Grid>

          <Grid size={{ xs: 12, md: 3.5 }}>
            <Card sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
              <CardContent>
                <ToggleButtonGroup exclusive size="small" fullWidth value={filter} onChange={(_, v) => { if (v) { setFilter(v); setCurrent(null); } }} sx={{ mb: 2 }}>
                  <ToggleButton value="all">Todas</ToggleButton>
                  <ToggleButton value="pending">Abertas</ToggleButton>
                  <ToggleButton value="right" sx={{ '&.Mui-selected': { color: OK } }}>{counts.right}✓</ToggleButton>
                  <ToggleButton value="wrong" sx={{ '&.Mui-selected': { color: BAD } }}>{counts.wrong}✗</ToggleButton>
                </ToggleButtonGroup>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0.75 }}>
                  {questions.map((qq, i) => {
                    const st = statusOf(qq);
                    const isCurrent = q?.id === qq.id;
                    const c = st === 'right' ? OK : st === 'wrong' ? BAD : null;
                    const inFilter = visible.includes(qq);
                    return (
                      <Box key={qq.id} role="button" tabIndex={0}
                        aria-label={`Questão ${i + 1}: ${st === 'right' ? 'acertou' : st === 'wrong' ? 'errou' : 'não resolvida'}`}
                        onClick={() => { if (!inFilter) setFilter('all'); setCurrent(qq.id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { if (!inFilter) setFilter('all'); setCurrent(qq.id); } }}
                        sx={{
                          aspectRatio: '1', borderRadius: 1.5, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          bgcolor: c ? alpha(c, 0.18) : 'transparent', color: c ?? 'text.secondary',
                          border: `1.5px solid ${isCurrent ? gold : c ? alpha(c, 0.5) : theme.palette.divider}`,
                          outline: isCurrent ? `2px solid ${alpha(gold, 0.35)}` : 'none',
                          opacity: inFilter ? 1 : 0.35,
                        }}>
                        {i + 1}
                      </Box>
                    );
                  })}
                </Box>
                {answered >= 5 && (
                  <Button fullWidth variant="outlined" startIcon={<Psychology />} sx={{ mt: 2 }} onClick={() => setTab('diagnostico')}>
                    Ver diagnóstico parcial
                  </Button>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {printOpen && <PrintNotebookDialog notebookId={id} open onClose={() => setPrintOpen(false)} />}

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setConfirm('reset'); setMenu(null); }}><RestartAlt fontSize="small" sx={{ mr: 1 }} /> Zerar caderno</MenuItem>
        <MenuItem onClick={() => { setConfirm('delete'); setMenu(null); }} sx={{ color: 'error.main' }}>
          <DeleteOutline fontSize="small" sx={{ mr: 1 }} /> Excluir caderno
        </MenuItem>
      </Menu>
      <ConfirmDialog open={Boolean(confirm)} loading={busy} danger={confirm === 'delete'}
        title={confirm === 'reset' ? 'Zerar caderno?' : 'Excluir caderno?'}
        message={confirm === 'reset'
          ? 'O progresso deste caderno recomeça do zero para você resolver de novo. Suas respostas continuam no histórico geral.'
          : 'O caderno será excluído. Suas respostas continuam no histórico e nas estatísticas.'}
        confirmLabel={confirm === 'reset' ? 'Zerar' : 'Excluir'} onConfirm={doConfirm} onClose={() => setConfirm(null)} />
    </Box>
  );
}
