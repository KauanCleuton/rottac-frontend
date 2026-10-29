'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button, Chip,
  IconButton, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, alpha, useTheme, CircularProgress, LinearProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip, Paper,
  Divider, ToggleButton, ToggleButtonGroup, Badge, Collapse,
} from '@mui/material';
import {
  Add, PlayArrow, Stop, Timer, CheckCircle, Cancel,
  QuestionAnswer, EmojiEvents, TrendingUp, Delete, Refresh,
  MenuBook, Warning, ArrowBack, Download,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { subjectApi, errorNotebookApi, questionApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');

// ─── Types ────────────────────────────────────────────────────────────────────
type AnswerKey = 'A' | 'B' | 'C' | 'D' | 'E' | '';

interface SimuladoAnswer {
  q: number;
  marked: AnswerKey;
  correct: AnswerKey;
  subjectId?: string;
  notes?: string;
}

interface Simulado {
  id: string;
  title: string;
  source?: string;
  subjectId?: string;
  subjectName?: string;
  subjectColor?: string;
  questoes: number;
  timeLimit: number; // minutes, 0 = unlimited
  status: 'pending' | 'active' | 'gabarito' | 'completed';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  elapsedSeconds?: number;
  answers: SimuladoAnswer[];
  score?: number;
  pct?: number;
}

// ─── Storage ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'aprova-ai-simulados';

function loadSimulados(): Simulado[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveSimulados(list: Simulado[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function newId() { return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ALTS: AnswerKey[] = ['A', 'B', 'C', 'D', 'E'];
const ALT_COLORS: Record<AnswerKey, string> = { A: '#F2B705', B: '#3B82F6', C: '#22C55E', D: '#F59E0B', E: '#EF4444', '': '#888' };

function fmtTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
type Screen = 'list' | 'config' | 'active' | 'gabarito' | 'results';

export default function SimuladoPage() {
  const theme = useTheme();
  const qc = useQueryClient();

  const [screen, setScreen] = useState<Screen>('list');
  const [simulados, setSimulados] = useState<Simulado[]>([]);
  const [current, setCurrent] = useState<Simulado | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [selectedQ, setSelectedQ] = useState<number | null>(null);
  const [gabaritoInput, setGabaritoInput] = useState(''); // bulk paste mode
  const [registerErrorsOpen, setRegisterErrorsOpen] = useState(false);
  const [selectedErrors, setSelectedErrors] = useState<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Config form
  const [config, setConfig] = useState({
    title: '', source: '', subjectId: '',
    questoes: '60', timeLimit: '180',
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-simple'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  const addErrorsMutation = useMutation({
    mutationFn: async (indexes: number[]) => {
      if (!current) return;
      const sub = subjects.find((s: any) => s.id === current.subjectId);
      for (const i of indexes) {
        const ans = current.answers[i];
        const fd = new FormData();
        fd.append('subjectId', current.subjectId || '');
        fd.append('description', `Q${ans.q} do simulado "${current.title}" — Marquei ${ans.marked}, correto: ${ans.correct}`);
        fd.append('correctAnswer', `Alternativa ${ans.correct}`);
        fd.append('errorType', 'ESQUECIMENTO');
        fd.append('difficulty', 'MEDIO');
        await errorNotebookApi.create(fd);
      }
    },
    onSuccess: () => {
      toast.success(`${selectedErrors.length} erros adicionados ao Caderno!`);
      setRegisterErrorsOpen(false);
      setSelectedErrors([]);
    },
  });

  // Load from localStorage
  useEffect(() => {
    setSimulados(loadSimulados());
  }, []);

  // Timer
  const startTimer = useCallback(() => {
    clearInterval(intervalRef.current!);
    intervalRef.current = setInterval(() => {
      setElapsedSec(s => {
        // Auto-submit when time limit reached
        if (current?.timeLimit && s + 1 >= current.timeLimit * 60) {
          clearInterval(intervalRef.current!);
          toast('⏰ Tempo esgotado! Entregando prova...', { icon: '⏱️' });
          goToGabarito();
          return s + 1;
        }
        return s + 1;
      });
    }, 1000);
  }, [current]);

  const stopTimer = () => clearInterval(intervalRef.current!);

  useEffect(() => {
    return () => clearInterval(intervalRef.current!);
  }, []);

  // ─── Actions ───────────────────────────────────────────────────────────────

  const createSimulado = () => {
    const sub = subjects.find((s: any) => s.id === config.subjectId);
    const n = parseInt(config.questoes);
    const sim: Simulado = {
      id: newId(),
      title: config.title || `Simulado ${dayjs().format('DD/MM/YYYY')}`,
      source: config.source || undefined,
      subjectId: config.subjectId || undefined,
      subjectName: sub?.name,
      subjectColor: sub?.color,
      questoes: n,
      timeLimit: parseInt(config.timeLimit),
      status: 'active',
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      answers: Array.from({ length: n }, (_, i) => ({ q: i + 1, marked: '', correct: '' })),
    };
    const updated = [sim, ...simulados];
    saveSimulados(updated);
    setSimulados(updated);
    setCurrent(sim);
    setElapsedSec(0);
    setSelectedQ(null);
    setScreen('active');
    startTimer();
    toast.success('Simulado iniciado! Boa prova! 🎯');
  };

  const markAnswer = (q: number, alt: AnswerKey) => {
    if (!current) return;
    const updated = { ...current, answers: current.answers.map(a => a.q === q ? { ...a, marked: alt } : a) };
    setCurrent(updated);
    const list = simulados.map(s => s.id === updated.id ? updated : s);
    saveSimulados(list);
    setSimulados(list);
  };

  const goToGabarito = () => {
    stopTimer();
    if (!current) return;
    const updated = { ...current, status: 'gabarito' as const, elapsedSeconds: elapsedSec };
    setCurrent(updated);
    const list = simulados.map(s => s.id === updated.id ? updated : s);
    saveSimulados(list);
    setSimulados(list);
    setGabaritoInput('');
    setScreen('gabarito');
  };

  const applyBulkGabarito = () => {
    if (!current) return;
    const clean = gabaritoInput.toUpperCase().replace(/[^ABCDE]/g, '');
    const answers = current.answers.map((a, i) => ({
      ...a, correct: (clean[i] as AnswerKey) ?? '',
    }));
    setCurrent(prev => prev ? { ...prev, answers } : null);
    toast.success('Gabarito aplicado!');
  };

  const finishSimulado = () => {
    if (!current) return;
    const answered = current.answers.filter(a => a.marked !== '').length;
    const correct = current.answers.filter(a => a.marked !== '' && a.correct !== '' && a.marked === a.correct).length;
    const withGabarito = current.answers.filter(a => a.correct !== '').length;
    const pct = withGabarito > 0 ? Math.round((correct / withGabarito) * 100) : 0;

    const completed: Simulado = {
      ...current,
      status: 'completed',
      completedAt: new Date().toISOString(),
      score: correct,
      pct,
    };
    setCurrent(completed);
    const list = simulados.map(s => s.id === completed.id ? completed : s);
    saveSimulados(list);
    setSimulados(list);

    // Save to question log
    const answeredWithGabarito = completed.answers.filter(a => a.marked !== '' && a.correct !== '');
    if (answeredWithGabarito.length > 0) {
      questionApi.bulkCreate(answeredWithGabarito.map(a => ({
        subjectId: completed.subjectId || null,
        isCorrect: a.marked === a.correct,
        source: completed.source || completed.title,
        notes: `Simulado: ${completed.title} - Q${a.q}`,
      }))).catch(() => {});
    }

    setScreen('results');
  };

  const deleteSimulado = (id: string) => {
    const list = simulados.filter(s => s.id !== id);
    saveSimulados(list);
    setSimulados(list);
    toast.success('Simulado removido');
  };

  const openResults = (sim: Simulado) => {
    setCurrent(sim);
    setScreen('results');
  };

  const wrongAnswers = current?.answers.filter(a => a.marked !== '' && a.correct !== '' && a.marked !== a.correct) || [];
  const notAnswered = current?.answers.filter(a => a.marked === '' && current.status === 'completed').length || 0;
  const timeLeft = current?.timeLimit ? current.timeLimit * 60 - elapsedSec : null;

  // ─── TELA: LISTA ──────────────────────────────────────────────────────────
  if (screen === 'list') {
    const completed = simulados.filter(s => s.status === 'completed');
    const avgPct = completed.length > 0 ? Math.round(completed.reduce((a, s) => a + (s.pct || 0), 0) / completed.length) : 0;

    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Simulados</Typography>
            <Typography color="text.secondary" variant="body2">
              {completed.length} realizados · Média: {avgPct}%
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => { setConfig({ title:'',source:'',subjectId:'',questoes:'60',timeLimit:'180' }); setScreen('config'); }}>
            Novo Simulado
          </Button>
        </Box>

        {/* Trend */}
        {completed.length >= 2 && (
          <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main,0.08)}, ${alpha('#22C55E',0.06)})` }}>
            <CardContent sx={{ py: '12px !important' }}>
              <Typography variant="body2" fontWeight={700} mb={1}>Evolução de desempenho</Typography>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end', height: 48 }}>
                {completed.slice(-10).map((s, i) => (
                  <Tooltip key={s.id} title={`${s.title}: ${s.pct}%`}>
                    <Box sx={{ flex: 1, bgcolor: s.pct! >= 70 ? '#22C55E' : s.pct! >= 50 ? '#F59E0B' : '#EF4444',
                      height: `${Math.max(10, (s.pct || 0))}%`, borderRadius: '3px 3px 0 0',
                      opacity: 0.7 + i * 0.03, transition: 'height 0.3s' }} />
                  </Tooltip>
                ))}
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Mais antigo</Typography>
                <Typography variant="caption" color="text.secondary">Mais recente</Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {simulados.length === 0 ? (
          <Card><CardContent sx={{ textAlign: 'center', py: 8 }}>
            <QuestionAnswer sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6">Nenhum simulado ainda</Typography>
            <Typography color="text.secondary" mb={2}>Pratique com simulados cronometrados e registre seus erros automaticamente</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setScreen('config')}>Criar primeiro simulado</Button>
          </CardContent></Card>
        ) : (
          <Grid container spacing={2}>
            {simulados.map(sim => {
              const scoreColor = (sim.pct || 0) >= 70 ? '#22C55E' : (sim.pct || 0) >= 50 ? '#F59E0B' : '#EF4444';
              return (
                <Grid size={{ xs: 12, md: 6 }} key={sim.id}>
                  <Card sx={{
                    borderLeft: `4px solid ${sim.status === 'completed' ? scoreColor : theme.palette.primary.main}`,
                    cursor: sim.status === 'completed' ? 'pointer' : 'default',
                    transition: 'transform 0.15s, box-shadow 0.15s',
                    '&:hover': sim.status === 'completed' ? { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${alpha(scoreColor, 0.2)}` } : {},
                  }} onClick={() => sim.status === 'completed' && openResults(sim)}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Box>
                          <Typography fontWeight={700}>{sim.title}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                            {sim.source && <Chip label={sim.source} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                            {sim.subjectName && (
                              <Chip label={sim.subjectName} size="small"
                                sx={{ height: 18, fontSize: 10, bgcolor: alpha(sim.subjectColor || '#888', 0.1), color: sim.subjectColor }} />
                            )}
                            <Chip label={`${sim.questoes}Q`} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                            <Chip label={sim.timeLimit > 0 ? `${sim.timeLimit}min` : 'Sem limite'} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                          </Box>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          {sim.status === 'completed' ? (
                            <Box>
                              <Typography variant="h4" fontWeight={900} color={scoreColor}>{sim.pct}%</Typography>
                              <Typography variant="caption" color="text.secondary">{sim.score}/{sim.answers.filter(a => a.correct !== '').length}</Typography>
                            </Box>
                          ) : (
                            <Chip label={sim.status === 'active' ? '▶ Em andamento' : 'Gabarito pendente'} color="warning" size="small" />
                          )}
                        </Box>
                      </Box>

                      {sim.status === 'completed' && (
                        <LinearProgress variant="determinate" value={sim.pct || 0}
                          sx={{ height: 6, borderRadius: 3, mt: 1, bgcolor: alpha(scoreColor, 0.12),
                            '& .MuiLinearProgress-bar': { bgcolor: scoreColor, borderRadius: 3 } }} />
                      )}

                      <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          {dayjs(sim.createdAt).format('DD/MM/YYYY')}
                          {sim.elapsedSeconds && ` · ${fmtTime(sim.elapsedSeconds)}`}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {(sim.status === 'active' || sim.status === 'gabarito') && (
                            <Button size="small" variant="outlined" onClick={(e) => {
                              e.stopPropagation();
                              setCurrent(sim);
                              setElapsedSec(sim.elapsedSeconds || 0);
                              setScreen(sim.status === 'active' ? 'active' : 'gabarito');
                              if (sim.status === 'active') startTimer();
                            }}>Continuar</Button>
                          )}
                          <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); deleteSimulado(sim.id); }}>
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Box>
    );
  }

  // ─── TELA: CONFIG ─────────────────────────────────────────────────────────
  if (screen === 'config') {
    return (
      <Box sx={{ maxWidth: 560, mx: 'auto' }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => setScreen('list')}><ArrowBack /></IconButton>
          <Typography variant="h5" fontWeight={700}>Novo Simulado</Typography>
        </Box>
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField label="Título do simulado" value={config.title}
              onChange={e => setConfig(c => ({ ...c, title: e.target.value }))}
              placeholder="Ex: TRF 4ª 2023 - Analista Judiciário" autoFocus />

            <TextField label="Fonte / Banca (opcional)" value={config.source}
              onChange={e => setConfig(c => ({ ...c, source: e.target.value }))}
              placeholder="Ex: Cespe, FCC, Quadrix, FGV..." />

            <FormControl size="small">
              <InputLabel>Disciplina principal (opcional)</InputLabel>
              <Select value={config.subjectId} label="Disciplina principal (opcional)"
                onChange={e => setConfig(c => ({ ...c, subjectId: e.target.value }))}>
                <MenuItem value="">Geral (múltiplas)</MenuItem>
                {subjects.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>

            <Grid container spacing={2}>
              <Grid size={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Número de questões</InputLabel>
                  <Select value={config.questoes} label="Número de questões"
                    onChange={e => setConfig(c => ({ ...c, questoes: e.target.value }))}>
                    {['10','20','30','40','50','60','80','100','120'].map(n => (
                      <MenuItem key={n} value={n}>{n} questões</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tempo limite</InputLabel>
                  <Select value={config.timeLimit} label="Tempo limite"
                    onChange={e => setConfig(c => ({ ...c, timeLimit: e.target.value }))}>
                    <MenuItem value="0">Sem limite</MenuItem>
                    <MenuItem value="30">30 min</MenuItem>
                    <MenuItem value="60">1 hora</MenuItem>
                    <MenuItem value="90">1h30</MenuItem>
                    <MenuItem value="120">2 horas</MenuItem>
                    <MenuItem value="180">3 horas</MenuItem>
                    <MenuItem value="240">4 horas</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.06), border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
              <Typography variant="body2" fontWeight={600} mb={0.5}>ℹ️ Como funciona</Typography>
              <Typography variant="caption" color="text.secondary">
                1. Inicie o simulado — o timer começa automaticamente<br />
                2. Marque sua resposta (A-E) para cada questão<br />
                3. Ao finalizar, insira o gabarito oficial<br />
                4. Veja seu desempenho e adicione erros ao Caderno
              </Typography>
            </Paper>

            <Button variant="contained" size="large" startIcon={<PlayArrow />}
              onClick={createSimulado} disabled={!config.questoes}>
              Iniciar Simulado
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // ─── TELA: SIMULADO ATIVO ─────────────────────────────────────────────────
  if (screen === 'active' && current) {
    const answered = current.answers.filter(a => a.marked !== '').length;
    const pctAnswered = Math.round((answered / current.questoes) * 100);
    const isTimeRunningOut = timeLeft !== null && timeLeft < 300;

    return (
      <Box>
        {/* Toolbar */}
        <Paper elevation={0} sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, borderRadius: 3 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography fontWeight={700} variant="body1">{current.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              {answered}/{current.questoes} respondidas
            </Typography>
          </Box>

          {/* Timer */}
          <Box sx={{ textAlign: 'center', px: 2 }}>
            <Typography variant={isTimeRunningOut ? 'h5' : 'h6'} fontWeight={900}
              color={isTimeRunningOut ? 'error' : 'text.primary'} sx={{ fontFamily: 'monospace' }}>
              {timeLeft !== null ? fmtTime(timeLeft) : fmtTime(elapsedSec)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {timeLeft !== null ? 'restante' : 'decorrido'}
            </Typography>
          </Box>

          <Button variant="contained" color="warning" startIcon={<Stop />} onClick={goToGabarito}>
            Entregar Prova
          </Button>
        </Paper>

        <LinearProgress variant="determinate" value={pctAnswered}
          sx={{ mb: 2, height: 6, borderRadius: 3, '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #F2B705, #FFD34D)', borderRadius: 3 } }} />

        {/* Question Grid */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {current.answers.map((ans) => (
            <Box key={ans.q}>
              <Tooltip title={ans.marked ? `Q${ans.q}: ${ans.marked}` : `Q${ans.q}: não respondida`}>
                <Paper
                  onClick={() => setSelectedQ(selectedQ === ans.q ? null : ans.q)}
                  elevation={0}
                  sx={{
                    width: 52, minHeight: 52, borderRadius: 2, cursor: 'pointer',
                    border: `2px solid ${selectedQ === ans.q ? theme.palette.primary.main : ans.marked ? alpha(ALT_COLORS[ans.marked], 0.4) : alpha(theme.palette.divider, 0.5)}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    bgcolor: ans.marked ? alpha(ALT_COLORS[ans.marked], 0.08) : 'transparent',
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: theme.palette.primary.main, transform: 'scale(1.05)' },
                  }}
                >
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 700 }}>Q{ans.q}</Typography>
                  <Typography fontWeight={900} fontSize={18} color={ans.marked ? ALT_COLORS[ans.marked] : 'text.disabled'}>
                    {ans.marked || '·'}
                  </Typography>
                </Paper>
              </Tooltip>

              {/* Inline answer selector */}
              <Collapse in={selectedQ === ans.q}>
                <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {ALTS.map(alt => (
                    <Box key={alt} onClick={() => { markAnswer(ans.q, alt); setSelectedQ(null); }}
                      sx={{
                        width: 52, height: 26, borderRadius: 1, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', fontWeight: 800, fontSize: 14,
                        bgcolor: ans.marked === alt ? ALT_COLORS[alt] : alpha(ALT_COLORS[alt], 0.1),
                        color: ans.marked === alt ? '#fff' : ALT_COLORS[alt],
                        border: `1px solid ${alpha(ALT_COLORS[alt], 0.3)}`,
                        transition: 'all 0.1s',
                        '&:hover': { bgcolor: ALT_COLORS[alt], color: '#fff', transform: 'scale(1.05)' },
                      }}>
                      {alt}
                    </Box>
                  ))}
                  <Box onClick={() => { markAnswer(ans.q, ''); setSelectedQ(null); }}
                    sx={{ width: 52, height: 22, borderRadius: 1, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', fontSize: 10, color: 'text.disabled',
                      border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                      '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08), color: 'error.main' } }}>
                    limpar
                  </Box>
                </Box>
              </Collapse>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Button variant="outlined" color="error" startIcon={<ArrowBack />}
            onClick={() => { stopTimer(); setScreen('list'); }}>
            Abandonar
          </Button>
          <Button variant="contained" size="large" startIcon={<Stop />} onClick={goToGabarito}>
            Finalizar e Inserir Gabarito ({answered}/{current.questoes})
          </Button>
        </Box>
      </Box>
    );
  }

  // ─── TELA: GABARITO ───────────────────────────────────────────────────────
  if (screen === 'gabarito' && current) {
    const answeredCount = current.answers.filter(a => a.marked !== '').length;

    return (
      <Box sx={{ maxWidth: 700, mx: 'auto' }}>
        <Typography variant="h5" fontWeight={700} mb={1}>Inserir Gabarito Oficial</Typography>
        <Typography color="text.secondary" mb={3}>
          Você respondeu {answeredCount}/{current.questoes} questões em {fmtTime(current.elapsedSeconds || elapsedSec)}.
          Agora insira o gabarito oficial para ver seu resultado.
        </Typography>

        {/* Bulk paste */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} mb={1}>
              ⚡ Colar gabarito em bloco
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mb={1.5}>
              Cole as respostas corretas em sequência (ex: "ABCDECBADE..."). Apenas letras A-E são aceitas.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField size="small" fullWidth placeholder="ABCDEABCDE..."
                value={gabaritoInput} onChange={e => setGabaritoInput(e.target.value)}
                inputProps={{ style: { fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' } }} />
              <Button variant="outlined" onClick={applyBulkGabarito} disabled={!gabaritoInput}>
                Aplicar
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Individual */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} mb={2}>Gabarito por questão</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {current.answers.map((ans) => (
                <Box key={ans.q} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 700, color: 'text.secondary' }}>Q{ans.q}</Typography>
                  <Box sx={{
                    width: 36, height: 28, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 13,
                    bgcolor: ans.marked ? alpha(ALT_COLORS[ans.marked], 0.1) : 'transparent',
                    color: ans.marked ? ALT_COLORS[ans.marked] : 'text.disabled',
                    border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                  }}>
                    {ans.marked || '–'}
                  </Box>
                  <Select size="small" value={ans.correct} displayEmpty
                    onChange={e => {
                      if (!current) return;
                      const updated = { ...current, answers: current.answers.map(a => a.q === ans.q ? { ...a, correct: e.target.value as AnswerKey } : a) };
                      setCurrent(updated);
                    }}
                    sx={{ width: 56, height: 28, fontSize: 12, '& .MuiSelect-select': { py: 0.25, fontWeight: 700, fontFamily: 'monospace' } }}>
                    <MenuItem value=""><em>?</em></MenuItem>
                    {ALTS.map(a => <MenuItem key={a} value={a} sx={{ fontWeight: 700 }}>{a}</MenuItem>)}
                  </Select>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="outlined" onClick={() => {
            setCurrent(prev => prev ? { ...prev, status: 'active' } : null);
            setScreen('active'); startTimer();
          }}>
            Voltar à prova
          </Button>
          <Button variant="contained" size="large" startIcon={<EmojiEvents />}
            onClick={finishSimulado}
            disabled={current.answers.filter(a => a.correct !== '').length === 0}>
            Ver Resultado
          </Button>
        </Box>
      </Box>
    );
  }

  // ─── TELA: RESULTADOS ─────────────────────────────────────────────────────
  if (screen === 'results' && current) {
    const withGabarito = current.answers.filter(a => a.correct !== '');
    const correct = withGabarito.filter(a => a.marked === a.correct);
    const wrong = withGabarito.filter(a => a.marked !== a.correct);
    const skipped = current.answers.filter(a => a.marked === '');
    const pct = current.pct ?? (withGabarito.length > 0 ? Math.round((correct.length / withGabarito.length) * 100) : 0);
    const scoreColor = pct >= 70 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
    const scoreLabel = pct >= 80 ? 'Excelente! 🏆' : pct >= 70 ? 'Bom resultado! 🎯' : pct >= 50 ? 'Pode melhorar 💪' : 'Precisa estudar mais 📚';

    return (
      <Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => setScreen('list')}><ArrowBack /></IconButton>
          <Typography variant="h5" fontWeight={700}>Resultado do Simulado</Typography>
        </Box>

        {/* Score hero */}
        <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${alpha(scoreColor, 0.12)}, ${alpha(scoreColor, 0.04)})`, borderTop: `4px solid ${scoreColor}` }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, sm: 4 }} sx={{ textAlign: 'center' }}>
                <Typography variant="h1" fontWeight={900} color={scoreColor} sx={{ fontSize: '5rem', lineHeight: 1 }}>
                  {pct}%
                </Typography>
                <Typography variant="h6" fontWeight={700} color={scoreColor}>{scoreLabel}</Typography>
                <Typography variant="body2" color="text.secondary">{current.title}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <Grid container spacing={2}>
                  {[
                    { label: 'Acertos', value: correct.length, color: '#22C55E', icon: '✅' },
                    { label: 'Erros', value: wrong.length, color: '#EF4444', icon: '❌' },
                    { label: 'Em branco', value: skipped.length, color: '#888', icon: '○' },
                    { label: 'Tempo', value: fmtTime(current.elapsedSeconds || 0), color: '#3B82F6', icon: '⏱️' },
                  ].map(s => (
                    <Grid size={6} key={s.label}>
                      <Paper elevation={0} sx={{ p: 1.5, textAlign: 'center', borderRadius: 2,
                        border: `1px solid ${alpha(s.color, 0.2)}`, bgcolor: alpha(s.color, 0.06) }}>
                        <Typography fontSize={20}>{s.icon}</Typography>
                        <Typography variant="h5" fontWeight={800} color={s.color}>{s.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Question grid visual */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} mb={2}>Gabarito Visual</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {current.answers.map(ans => {
                const isCorrect = ans.correct !== '' && ans.marked === ans.correct;
                const isWrong = ans.correct !== '' && ans.marked !== '' && ans.marked !== ans.correct;
                const isSkipped = ans.marked === '';
                const bg = isCorrect ? alpha('#22C55E', 0.15) : isWrong ? alpha('#EF4444', 0.15) : alpha('#888', 0.08);
                const textColor = isCorrect ? '#22C55E' : isWrong ? '#EF4444' : '#888';
                return (
                  <Tooltip key={ans.q} title={
                    isCorrect ? `Q${ans.q}: Acerto (${ans.marked})` :
                    isWrong ? `Q${ans.q}: Marquei ${ans.marked}, correto ${ans.correct}` :
                    `Q${ans.q}: Em branco`
                  }>
                    <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: bg, display: 'flex',
                      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${alpha(textColor, 0.2)}` }}>
                      <Typography variant="caption" sx={{ fontSize: 8, color: 'text.disabled', fontWeight: 700 }}>{ans.q}</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: textColor, lineHeight: 1 }}>{ans.marked || '–'}</Typography>
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>
          </CardContent>
        </Card>

        {/* Wrong answers + add to caderno */}
        {wrong.length > 0 && (
          <Card sx={{ mb: 3, borderLeft: '4px solid #EF4444' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>❌ Questões Erradas ({wrong.length})</Typography>
                <Button variant="outlined" color="error" startIcon={<MenuBook />}
                  onClick={() => {
                    setSelectedErrors(wrong.map(a => current.answers.indexOf(a)));
                    setRegisterErrorsOpen(true);
                  }}>
                  Adicionar ao Caderno de Erros
                </Button>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {wrong.map(ans => (
                  <Paper key={ans.q} elevation={0} sx={{ px: 1.5, py: 1, borderRadius: 2,
                    bgcolor: alpha('#EF4444', 0.06), border: `1px solid ${alpha('#EF4444', 0.2)}` }}>
                    <Typography variant="caption" color="text.secondary">Q{ans.q}</Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.25 }}>
                      <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: alpha('#EF4444', 0.15), fontSize: 12, fontWeight: 800, color: '#EF4444' }}>
                        Meu: {ans.marked}
                      </Box>
                      <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: alpha('#22C55E', 0.15), fontSize: 12, fontWeight: 800, color: '#22C55E' }}>
                        ✓ {ans.correct}
                      </Box>
                    </Box>
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="outlined" onClick={() => setScreen('list')}>Ver todos os simulados</Button>
          <Button variant="contained" startIcon={<Add />}
            onClick={() => { setConfig({ title:'',source:'',subjectId:'',questoes:'60',timeLimit:'180' }); setScreen('config'); }}>
            Novo Simulado
          </Button>
        </Box>

        {/* Dialog Caderno de Erros */}
        <Dialog open={registerErrorsOpen} onClose={() => setRegisterErrorsOpen(false)} maxWidth="xs" fullWidth>
          <DialogTitle fontWeight={700}>Adicionar ao Caderno de Erros</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" mb={2}>
              {selectedErrors.length} questões erradas serão registradas no Caderno de Erros para revisão futura.
            </Typography>
            <Typography variant="body2">
              Disciplina: <strong>{current.subjectName || 'Geral'}</strong>
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setRegisterErrorsOpen(false)}>Cancelar</Button>
            <Button variant="contained" color="error" onClick={() => addErrorsMutation.mutate(selectedErrors)}
              disabled={addErrorsMutation.isPending}>
              {addErrorsMutation.isPending ? 'Registrando...' : `Registrar ${selectedErrors.length} erros`}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  return null;
}
