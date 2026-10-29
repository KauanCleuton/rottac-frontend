'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, Chip,
  TextField, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, alpha, useTheme,
  CircularProgress, Tabs, Tab, LinearProgress, Paper, Tooltip,
  IconButton, Divider, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow,
} from '@mui/material';
import {
  Add, CheckCircle, Cancel, TrendingUp, QuestionAnswer,
  Keyboard, Bolt, Speed, Close, BarChart, PlayArrow,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionApi, subjectApi } from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

// ─── Modo Rápido ──────────────────────────────────────────────────────────────

function ModoRapido({ subjects, onClose }: { subjects: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '');
  const [source, setSource] = useState('');
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [lastAction, setLastAction] = useState<'acerto' | 'erro' | null>(null);
  const timerRef = useRef<any>(null);

  const logMutation = useMutation({
    mutationFn: (isCorrect: boolean) =>
      questionApi.create({ subjectId, isCorrect, source: source || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['question-stats'] });
    },
  });

  const registrar = useCallback((isCorrect: boolean) => {
    if (!subjectId) { toast.error('Selecione a disciplina'); return; }
    logMutation.mutate(isCorrect);
    if (isCorrect) setAcertos(a => a + 1);
    else setErros(e => e + 1);
    setLastAction(isCorrect ? 'acerto' : 'erro');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLastAction(null), 800);
  }, [subjectId, logMutation]);

  // Atalhos de teclado: C = acerto, E = erro, Esc = fechar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'c' || e.key === 'C') registrar(true);
      if (e.key === 'e' || e.key === 'E') registrar(false);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [registrar, onClose]);

  const total = acertos + erros;
  const taxa = total > 0 ? Math.round((acertos / total) * 100) : 0;
  const taxaColor = taxa >= 70 ? '#22C55E' : taxa >= 50 ? '#F59E0B' : '#EF4444';

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>Modo Rápido</Typography>
          <Typography variant="caption" color="text.secondary">
            Teclas: <kbd style={{ background: '#22C55E20', padding: '1px 6px', borderRadius: 4 }}>C</kbd> Acertei &nbsp;
            <kbd style={{ background: '#EF444420', padding: '1px 6px', borderRadius: 4 }}>E</kbd> Errei &nbsp;
            <kbd style={{ background: '#88888820', padding: '1px 6px', borderRadius: 4 }}>Esc</kbd> Fechar
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <FormControl size="small" fullWidth>
            <InputLabel>Disciplina *</InputLabel>
            <Select value={subjectId} label="Disciplina *" onChange={e => setSubjectId(e.target.value)}>
              {subjects.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField size="small" fullWidth label="Banca/Fonte" value={source}
            onChange={e => setSource(e.target.value)} placeholder="CESPE 2024" />
        </Grid>
      </Grid>

      {/* Feedback visual */}
      <Box sx={{
        height: 80, borderRadius: 3, mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.3s',
        bgcolor: lastAction === 'acerto' ? alpha('#22C55E', 0.15) :
                 lastAction === 'erro' ? alpha('#EF4444', 0.15) :
                 alpha(useTheme().palette.divider, 0.1),
        border: lastAction === 'acerto' ? `2px solid #22C55E` :
                lastAction === 'erro' ? `2px solid #EF4444` : '2px solid transparent',
      }}>
        {lastAction === 'acerto' && <Typography fontSize={40}>✅</Typography>}
        {lastAction === 'erro' && <Typography fontSize={40}>❌</Typography>}
        {!lastAction && (
          <Typography variant="body2" color="text.secondary">
            Clique nos botões ou use as teclas C / E
          </Typography>
        )}
      </Box>

      {/* Botões grandes */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={6}>
          <Button fullWidth variant="contained" onClick={() => registrar(true)}
            sx={{ py: 2, fontSize: 16, fontWeight: 700, bgcolor: '#22C55E',
              '&:hover': { bgcolor: '#16A34A' }, gap: 1 }}>
            ✅ ACERTEI <Typography component="span" sx={{ opacity: 0.7, fontSize: 12 }}>(C)</Typography>
          </Button>
        </Grid>
        <Grid size={6}>
          <Button fullWidth variant="contained" onClick={() => registrar(false)}
            sx={{ py: 2, fontSize: 16, fontWeight: 700, bgcolor: '#EF4444',
              '&:hover': { bgcolor: '#DC2626' }, gap: 1 }}>
            ❌ ERREI <Typography component="span" sx={{ opacity: 0.7, fontSize: 12 }}>(E)</Typography>
          </Button>
        </Grid>
      </Grid>

      {/* Placar da sessão */}
      {total > 0 && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: alpha(taxaColor, 0.06),
          border: `1px solid ${alpha(taxaColor, 0.2)}` }}>
          <Typography variant="caption" color="text.secondary" display="block" mb={1} fontWeight={600}>
            PLACAR DA SESSÃO
          </Typography>
          <Grid container spacing={2} sx={{ mb: 1 }}>
            <Grid size={4}>
              <Typography variant="h5" fontWeight={900} color="#22C55E">{acertos}</Typography>
              <Typography variant="caption" color="text.secondary">Acertos</Typography>
            </Grid>
            <Grid size={4}>
              <Typography variant="h5" fontWeight={900} color="#EF4444">{erros}</Typography>
              <Typography variant="caption" color="text.secondary">Erros</Typography>
            </Grid>
            <Grid size={4}>
              <Typography variant="h5" fontWeight={900} color={taxaColor}>{taxa}%</Typography>
              <Typography variant="caption" color="text.secondary">Taxa</Typography>
            </Grid>
          </Grid>
          <LinearProgress variant="determinate" value={taxa}
            sx={{ height: 8, borderRadius: 4, bgcolor: alpha('#EF4444', 0.2),
              '& .MuiLinearProgress-bar': { bgcolor: taxaColor, borderRadius: 4 } }} />
        </Paper>
      )}
    </Box>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function QuestoesPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [rapidoOpen, setRapidoOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: '', topicId: '', source: '', isCorrect: 'true', timeSpent: '', notes: '' });
  const [bulk, setBulk] = useState({ subjectId: '', total: '10', correct: '7', source: '' });

  const { data: stats } = useQuery({
    queryKey: ['question-stats'],
    queryFn: () => questionApi.getStats().then(r => r.data.data),
  });

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['question-logs'],
    queryFn: () => questionApi.getLogs().then(r => r.data.data),
    enabled: tab === 2,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-simple'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => questionApi.create({
      ...form, isCorrect: form.isCorrect === 'true',
      timeSpent: form.timeSpent ? parseInt(form.timeSpent) : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['question-stats'] });
      qc.invalidateQueries({ queryKey: ['question-logs'] });
      setCreateOpen(false);
      setForm({ subjectId: '', topicId: '', source: '', isCorrect: 'true', timeSpent: '', notes: '' });
      toast.success('Questão registrada!');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: () => {
      const total = parseInt(bulk.total);
      const correct = parseInt(bulk.correct);
      const incorrect = total - correct;
      const bulkLogs = [
        ...Array(correct).fill({ subjectId: bulk.subjectId, isCorrect: true, source: bulk.source || null }),
        ...Array(incorrect).fill({ subjectId: bulk.subjectId, isCorrect: false, source: bulk.source || null }),
      ];
      return questionApi.bulkCreate(bulkLogs);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['question-stats'] });
      setBulkOpen(false);
      toast.success('Questões registradas!');
    },
  });

  const bySubjectStats = stats?.bySubject || [];
  const selectedSubject = (subjects as any[]).find((s: any) => s.id === form.subjectId);
  const topics = selectedSubject?.modules?.flatMap((m: any) => m.topics) || [];

  // Agrupar por banca/fonte
  const byBanca = (logs as any[]).reduce((acc: Record<string, { total: number; correct: number }>, log: any) => {
    const key = log.source || 'Sem fonte';
    if (!acc[key]) acc[key] = { total: 0, correct: 0 };
    acc[key].total++;
    if (log.isCorrect) acc[key].correct++;
    return acc;
  }, {});
  const bancaStats = Object.entries(byBanca)
    .map(([banca, data]) => ({ banca, ...data, accuracy: Math.round((data.correct / data.total) * 100) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Questões</Typography>
          <Typography color="text.secondary" variant="body2">Acompanhe seu desempenho por disciplina e banca</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<PlayArrow />}
            component={Link}
            href="/questoes/praticar"
            sx={{ background: 'linear-gradient(135deg,#10B981,#3B82F6)', fontWeight: 700 }}
          >
            Praticar
          </Button>
          <Tooltip title="Modo rápido com atalhos de teclado">
            <Button variant="outlined" startIcon={<Keyboard />} onClick={() => setRapidoOpen(true)}
              sx={{ borderColor: '#F2B705', color: '#F2B705', '&:hover': { bgcolor: alpha('#F2B705', 0.06) } }}>
              Modo Rápido
            </Button>
          </Tooltip>
          <Button variant="outlined" startIcon={<Add />} onClick={() => setBulkOpen(true)}>Lote</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>Registrar</Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Por Disciplina" />
        <Tab label="Por Banca" />
        <Tab label="Histórico" />
      </Tabs>

      {/* ── Por Disciplina ── */}
      {tab === 0 && (
        <Grid container spacing={2}>
          {[
            { label: 'Total', value: stats?.total || 0, color: '#F2B705', icon: <QuestionAnswer /> },
            { label: 'Acertos', value: stats?.correct || 0, color: '#22C55E', icon: <CheckCircle /> },
            { label: 'Erros', value: stats?.incorrect || 0, color: '#EF4444', icon: <Cancel /> },
            { label: 'Taxa Geral', value: `${stats?.accuracy || 0}%`, color: '#3B82F6', icon: <TrendingUp /> },
          ].map(s => (
            <Grid size={{ xs: 6, md: 3 }} key={s.label}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box sx={{ color: s.color, mb: 1 }}>{s.icon}</Box>
                  <Typography variant="h4" fontWeight={800}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}

          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Desempenho por Disciplina</Typography>
                {bySubjectStats.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <QuestionAnswer sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary">Nenhuma questão registrada ainda</Typography>
                    <Button variant="contained" sx={{ mt: 2 }} startIcon={<Keyboard />}
                      onClick={() => setRapidoOpen(true)}>
                      Começar com Modo Rápido
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {bySubjectStats.map((s: any) => {
                      const acc = Number(s.accuracy);
                      const accColor = acc >= 70 ? '#22C55E' : acc >= 50 ? '#F59E0B' : '#EF4444';
                      return (
                        <Box key={s.id}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75, alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color || '#F2B705', flexShrink: 0 }} />
                              <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                              <Chip label={`${Number(s.total)} questões`} size="small" sx={{ height: 18, fontSize: 9 }} />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                              <Typography variant="caption" color="text.secondary">
                                {Number(s.correct)}✅ / {Number(s.incorrect || s.total - s.correct)}❌
                              </Typography>
                              <Typography variant="body2" fontWeight={800} color={accColor}>
                                {acc.toFixed(1)}%
                              </Typography>
                            </Box>
                          </Box>
                          <LinearProgress variant="determinate" value={acc}
                            sx={{ height: 8, bgcolor: alpha('#EF4444', 0.15), borderRadius: 4,
                              '& .MuiLinearProgress-bar': { bgcolor: accColor, borderRadius: 4 } }} />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Por Banca ── */}
      {tab === 1 && (
        <Grid container spacing={2}>
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Desempenho por Banca / Fonte</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                  Acompanhe como você vai em cada banca. Registre a banca ao adicionar questões para ver este relatório.
                </Typography>
                {bancaStats.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <BarChart sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography color="text.secondary" mb={1}>Nenhuma questão com banca registrada</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Ao registrar questões, informe a banca (ex: CESPE 2024) para ver seu desempenho por banca.
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    {bancaStats.map(b => {
                      const accColor = b.accuracy >= 70 ? '#22C55E' : b.accuracy >= 50 ? '#F59E0B' : '#EF4444';
                      return (
                        <Box key={b.banca} sx={{ mb: 2.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Typography variant="body2" fontWeight={700}>{b.banca}</Typography>
                              <Chip label={`${b.total} questões`} size="small" sx={{ height: 18, fontSize: 9 }} />
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">
                                {b.correct}✅ / {b.total - b.correct}❌
                              </Typography>
                              <Typography variant="body2" fontWeight={800} color={accColor}>{b.accuracy}%</Typography>
                            </Box>
                          </Box>
                          <LinearProgress variant="determinate" value={b.accuracy}
                            sx={{ height: 10, borderRadius: 5, bgcolor: alpha('#EF4444', 0.15),
                              '& .MuiLinearProgress-bar': { bgcolor: accColor, borderRadius: 5 } }} />
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* ── Histórico ── */}
      {tab === 2 && (
        <Card>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Disciplina</TableCell>
                  <TableCell>Tópico</TableCell>
                  <TableCell>Banca/Fonte</TableCell>
                  <TableCell align="center">Resultado</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></TableCell></TableRow>
                ) : (logs as any[]).length === 0 ? (
                  <TableRow><TableCell colSpan={5} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>Nenhum histórico</TableCell></TableRow>
                ) : (logs as any[]).map((log: any) => (
                  <TableRow key={log.id} hover>
                    <TableCell sx={{ fontSize: 12 }}>{dayjs(log.loggedAt).format('DD/MM HH:mm')}</TableCell>
                    <TableCell>
                      <Chip label={log.subject?.name} size="small"
                        sx={{ bgcolor: alpha(log.subject?.color || '#888', 0.1), color: log.subject?.color }} />
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{log.topic?.name || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{log.source || '—'}</TableCell>
                    <TableCell align="center">
                      {log.isCorrect
                        ? <CheckCircle sx={{ color: '#22C55E', fontSize: 20 }} />
                        : <Cancel sx={{ color: '#EF4444', fontSize: 20 }} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Dialog: Modo Rápido */}
      <Dialog open={rapidoOpen} onClose={() => setRapidoOpen(false)} maxWidth="sm" fullWidth>
        <DialogContent sx={{ pt: 2 }}>
          <ModoRapido subjects={subjects as any[]} onClose={() => setRapidoOpen(false)} />
        </DialogContent>
      </Dialog>

      {/* Dialog: Registrar individual */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Registrar Questão</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <FormControl size="small">
            <InputLabel>Disciplina *</InputLabel>
            <Select value={form.subjectId} label="Disciplina *"
              onChange={e => setForm(f => ({ ...f, subjectId: e.target.value, topicId: '' }))}>
              {(subjects as any[]).map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" disabled={!form.subjectId}>
            <InputLabel>Tópico</InputLabel>
            <Select value={form.topicId} label="Tópico"
              onChange={e => setForm(f => ({ ...f, topicId: e.target.value }))}>
              <MenuItem value="">Nenhum</MenuItem>
              {topics.map((t: any) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Resultado *</InputLabel>
            <Select value={form.isCorrect} label="Resultado *"
              onChange={e => setForm(f => ({ ...f, isCorrect: e.target.value }))}>
              <MenuItem value="true">✅ Acertei</MenuItem>
              <MenuItem value="false">❌ Errei</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Banca/Fonte" value={form.source}
            onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
            placeholder="CESPE 2024, FCC 2023..." size="small" />
          <TextField label="Tempo (segundos)" type="number" value={form.timeSpent}
            onChange={e => setForm(f => ({ ...f, timeSpent: e.target.value }))} size="small" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => createMutation.mutate()} disabled={!form.subjectId}>
            Registrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Lote */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Registrar em Lote</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <FormControl size="small">
            <InputLabel>Disciplina *</InputLabel>
            <Select value={bulk.subjectId} label="Disciplina *"
              onChange={e => setBulk(b => ({ ...b, subjectId: e.target.value }))}>
              {(subjects as any[]).map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Grid container spacing={1}>
            <Grid size={6}>
              <TextField fullWidth size="small" label="Total de questões" type="number" value={bulk.total}
                onChange={e => setBulk(b => ({ ...b, total: e.target.value }))} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth size="small" label="Acertos" type="number" value={bulk.correct}
                onChange={e => setBulk(b => ({ ...b, correct: e.target.value }))} />
            </Grid>
          </Grid>
          <TextField size="small" label="Banca/Fonte" value={bulk.source}
            onChange={e => setBulk(b => ({ ...b, source: e.target.value }))} placeholder="CESPE 2024" />
          {bulk.total && bulk.correct && (
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#22C55E', 0.06), border: `1px solid ${alpha('#22C55E', 0.2)}` }}>
              <Typography variant="body2" fontWeight={700} color="#22C55E">
                Taxa de acerto: {Math.round((parseInt(bulk.correct) / parseInt(bulk.total)) * 100)}%
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {bulk.correct} acertos · {parseInt(bulk.total) - parseInt(bulk.correct)} erros
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBulkOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => bulkMutation.mutate()}
            disabled={!bulk.subjectId || bulkMutation.isPending}>
            Registrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
