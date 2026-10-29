'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box, Card, CardContent, Typography, Button, IconButton,
  Grid, Chip, LinearProgress, Slider, Select, MenuItem,
  FormControl, InputLabel, alpha, useTheme, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Paper, Collapse,
} from '@mui/material';
import {
  PlayArrow, Pause, Stop, SkipNext, Settings,
  SelfImprovement, Timer, MusicNote, Coffee,
  Visibility, ArrowForward, MenuBook, CheckCircle,
  RadioButtonUnchecked, CalendarMonth,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { focusApi, errorNotebookApi, planApi, taskApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { BRAND_GRADIENT } from '@/theme';

dayjs.locale('pt-br');

type Phase = 'WORK' | 'BREAK' | 'LONG_BREAK';
type Status = 'idle' | 'running' | 'paused';

const TECHNIQUES = [
  { value: 'POMODORO', label: 'Pomodoro', work: 25, shortBreak: 5, longBreak: 15, description: 'Clássico 25/5 min' },
  { value: 'CINQUENTA_DEZ', label: '50/10', work: 50, shortBreak: 10, longBreak: 20, description: 'Sessões mais longas' },
  { value: 'NOVENTA_VINTE', label: '90/20', work: 90, shortBreak: 20, longBreak: 30, description: 'Máxima concentração' },
  { value: 'FLOWTIME', label: 'Flowtime', work: 0, shortBreak: 5, longBreak: 15, description: 'Sem tempo fixo' },
];

const AMBIENT_SOUNDS = [
  { label: 'Nenhum', value: 'none' },
  { label: '🌧️ Chuva', value: 'rain' },
  { label: '🌊 Ondas', value: 'waves' },
  { label: '☕ Café', value: 'cafe' },
  { label: '🌿 Floresta', value: 'forest' },
];

export default function FocoPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const [technique, setTechnique] = useState(TECHNIQUES[0]);
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [phase, setPhase] = useState<Phase>('WORK');
  const [status, setStatus] = useState<Status>('idle');
  const [secondsLeft, setSecondsLeft] = useState(workMinutes * 60);
  const [cycles, setCycles] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [ambientSound, setAmbientSound] = useState('none');
  const [showSettings, setShowSettings] = useState(false);
  const [flashReviewOpen, setFlashReviewOpen] = useState(false);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  // Tarefas de hoje
  const { data: todayData } = useQuery({
    queryKey: ['today-tasks'],
    queryFn: () => planApi.getToday().then(r => r.data.data),
    refetchInterval: 30000,
  });

  // Próximas tarefas (plano ativo)
  const { data: plans = [] } = useQuery({
    queryKey: ['study-plans'],
    queryFn: () => planApi.getAll().then(r => r.data.data),
  });

  const completeFocusTask = useMutation({
    mutationFn: (id: string) => taskApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-tasks'] });
      qc.invalidateQueries({ queryKey: ['study-plans'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      toast.success('+10 XP 🎉');
      if (focusedTaskId) setFocusedTaskId(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erro ao concluir'),
  });

  // Revisão Relâmpago — busca erros recentes
  const { data: recentErrors = [] } = useQuery({
    queryKey: ['error-notebook-flash'],
    queryFn: () => errorNotebookApi.getDue().then(r => r.data.data?.entries?.slice(0, 5) || []),
    staleTime: 60000,
  });

  const totalSeconds_phase = phase === 'WORK' ? workMinutes * 60 : breakMinutes * 60;
  const progress = ((totalSeconds_phase - secondsLeft) / totalSeconds_phase) * 100;

  const startMutation = useMutation({
    mutationFn: () => focusApi.start({ technique: technique.value, workMinutes, breakMinutes }),
    onSuccess: (res) => { sessionIdRef.current = res.data.data.id; },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!sessionIdRef.current) throw new Error('Sem sessão ativa');
      return focusApi.update(sessionIdRef.current, data);
    },
  });

  const tick = useCallback(() => {
    setSecondsLeft((s) => {
      if (s <= 1) {
        handlePhaseEnd();
        return 0;
      }
      return s - 1;
    });
    setTotalSeconds((t) => t + 1);
  }, []);

  const handlePhaseEnd = () => {
    clearInterval(intervalRef.current!);

    if (phase === 'WORK') {
      const newCycles = cycles + 1;
      setCycles(newCycles);

      if (newCycles % 4 === 0) {
        toast('☕ Intervalo longo! Você merece.', { icon: '🎉' });
        setPhase('LONG_BREAK');
        setSecondsLeft(technique.longBreak * 60);
      } else {
        toast('⏸️ Pausa! Respire...', { icon: '✅' });
        setPhase('BREAK');
        setSecondsLeft(breakMinutes * 60);
      }
    } else {
      toast('💪 Hora de estudar!', { icon: '📚' });
      setPhase('WORK');
      setSecondsLeft(workMinutes * 60);
    }

    setStatus('idle');
  };

  const startFocus = () => {
    if (status === 'idle') startMutation.mutate();
    setStatus('running');
    intervalRef.current = setInterval(tick, 1000);
  };

  const start = () => {
    // Se houver erros para revisar, mostrar Revisão Relâmpago primeiro
    if (recentErrors.length > 0 && status === 'idle') {
      setFlashIndex(0);
      setFlashFlipped(false);
      setFlashReviewOpen(true);
    } else {
      startFocus();
    }
  };

  const pause = () => {
    clearInterval(intervalRef.current!);
    setStatus('paused');
    updateMutation.mutate({ status: 'PAUSADO' });
  };

  const resume = () => {
    setStatus('running');
    intervalRef.current = setInterval(tick, 1000);
  };

  const stop = () => {
    clearInterval(intervalRef.current!);
    setStatus('idle');
    setPhase('WORK');
    setSecondsLeft(workMinutes * 60);

    if (sessionIdRef.current && totalSeconds > 60) {
      updateMutation.mutate({ status: 'CANCELADO', totalMinutes: Math.round(totalSeconds / 60) });
    }
    sessionIdRef.current = null;
    setTotalSeconds(0);
  };

  const finish = () => {
    clearInterval(intervalRef.current!);
    const minutes = Math.round(totalSeconds / 60);

    if (sessionIdRef.current) {
      updateMutation.mutate({ status: 'CONCLUIDO', cycles, totalMinutes: minutes });
      qc.invalidateQueries({ queryKey: ['gamification'] });
    }

    toast.success(`Sessão concluída! ${minutes} minutos de foco. +${Math.floor(minutes / 5)} XP`);
    setStatus('idle');
    setPhase('WORK');
    setSecondsLeft(workMinutes * 60);
    setCycles(0);
    setTotalSeconds(0);
    sessionIdRef.current = null;
  };

  useEffect(() => {
    return () => clearInterval(intervalRef.current!);
  }, []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const phaseColor = phase === 'WORK' ? theme.palette.primary.main : theme.palette.success.main;
  const phaseLabel = phase === 'WORK' ? 'Foco' : phase === 'BREAK' ? 'Pausa' : 'Pausa Longa';

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Modo Foco</Typography>
        <Typography color="text.secondary">Mantenha o foco e seja mais produtivo</Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Timer */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              {/* Técnica */}
              <Box sx={{ mb: 3, display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                {TECHNIQUES.map((t) => (
                  <Chip
                    key={t.value}
                    label={t.label}
                    onClick={() => {
                      if (status !== 'idle') return;
                      setTechnique(t);
                      setWorkMinutes(t.work || 25);
                      setBreakMinutes(t.shortBreak);
                      setSecondsLeft((t.work || 25) * 60);
                    }}
                    variant={technique.value === t.value ? 'filled' : 'outlined'}
                    color={technique.value === t.value ? 'primary' : 'default'}
                    disabled={status !== 'idle'}
                  />
                ))}
              </Box>

              {/* Fase */}
              <Chip
                label={phaseLabel}
                size="small"
                sx={{
                  mb: 2,
                  bgcolor: alpha(phaseColor, 0.12),
                  color: phaseColor,
                  fontWeight: 700,
                }}
              />

              {/* Clock */}
              <Box
                sx={{
                  width: 240, height: 240, borderRadius: '50%',
                  background: `conic-gradient(${phaseColor} ${progress}%, ${alpha(phaseColor, 0.1)} 0%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mx: 'auto', mb: 3, position: 'relative',
                  boxShadow: `0 0 40px ${alpha(phaseColor, 0.2)}`,
                }}
              >
                <Box
                  sx={{
                    width: 210, height: 210, borderRadius: '50%',
                    bgcolor: 'background.paper',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Typography sx={{ fontFamily: 'monospace', fontSize: 52, fontWeight: 800, lineHeight: 1 }}>
                    {mm}:{ss}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ciclo {cycles + 1}
                  </Typography>
                </Box>
              </Box>

              {/* Progress */}
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  mb: 3, height: 6,
                  bgcolor: alpha(phaseColor, 0.1),
                  '& .MuiLinearProgress-bar': { bgcolor: phaseColor },
                }}
              />

              {/* Controls */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', alignItems: 'center' }}>
                {status === 'idle' && (
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayArrow />}
                    onClick={start}
                    sx={{ px: 4, background: BRAND_GRADIENT }}
                  >
                    Iniciar
                  </Button>
                )}
                {status === 'running' && (
                  <>
                    <IconButton onClick={pause} size="large" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }}>
                      <Pause />
                    </IconButton>
                    <IconButton onClick={finish} size="large"
                      sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' }}>
                      <Stop />
                    </IconButton>
                  </>
                )}
                {status === 'paused' && (
                  <>
                    <Button variant="contained" startIcon={<PlayArrow />} onClick={resume}
                      sx={{ background: BRAND_GRADIENT }}>
                      Continuar
                    </Button>
                    <Button variant="outlined" color="error" onClick={stop}>Cancelar</Button>
                  </>
                )}
              </Box>

              {/* Stats da sessão */}
              {status !== 'idle' && (
                <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Chip label={`${Math.round(totalSeconds / 60)} min focado`} size="small" icon={<Timer />} />
                  <Chip label={`${cycles} ciclos`} size="small" icon={<SelfImprovement />} />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Coluna direita */}
        <Grid size={{ xs: 12, md: 5 }}>

          {/* ── Tarefas de Hoje ── */}
          {(() => {
            const todayTasks: any[] = todayData?.tasks || [];
            const pending = todayTasks.filter((t: any) => !t.isCompleted);
            const done = todayTasks.filter((t: any) => t.isCompleted);
            return (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Tarefas de Hoje</Typography>
                    {todayTasks.length > 0 && (
                      <Chip
                        label={`${done.length}/${todayTasks.length}`}
                        size="small"
                        color={done.length === todayTasks.length ? 'success' : 'default'}
                      />
                    )}
                  </Box>

                  {todayTasks.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      Nenhuma tarefa para hoje. Crie um plano de estudos em{' '}
                      <Box component="span" sx={{ color: 'primary.main', cursor: 'pointer' }}
                        onClick={() => window.location.href = '/plano'}>
                        /plano
                      </Box>.
                    </Typography>
                  ) : (
                    <>
                      {todayTasks.length > 0 && (
                        <LinearProgress
                          variant="determinate"
                          value={todayTasks.length > 0 ? (done.length / todayTasks.length) * 100 : 0}
                          sx={{ mb: 1.5, height: 5, borderRadius: 3 }}
                        />
                      )}
                      {[...pending, ...done].map((t: any) => (
                        <Box key={t.id} sx={{
                          display: 'flex', alignItems: 'center', gap: 1, py: 0.75,
                          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
                          opacity: t.isCompleted ? 0.6 : 1,
                          bgcolor: focusedTaskId === t.id ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
                          borderRadius: 1, px: 0.5,
                        }}>
                          <IconButton
                            size="small"
                            onClick={() => !t.isCompleted && completeFocusTask.mutate(t.id)}
                            sx={{ color: t.isCompleted ? 'success.main' : 'text.disabled', p: 0.5 }}
                          >
                            {t.isCompleted ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                          </IconButton>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="caption" fontWeight={500}
                              sx={{ textDecoration: t.isCompleted ? 'line-through' : 'none', display: 'block' }}
                              noWrap>
                              {t.title}
                            </Typography>
                            <Typography variant="caption" color="text.disabled">{t.estimatedMinutes}min</Typography>
                          </Box>
                          {!t.isCompleted && (
                            <Tooltip title="Focar nessa tarefa">
                              <IconButton
                                size="small"
                                onClick={() => {
                                  setFocusedTaskId(t.id);
                                  if (status === 'idle') start();
                                  toast(`Focando em: ${t.title}`, { icon: '🎯' });
                                }}
                                sx={{ p: 0.5, color: focusedTaskId === t.id ? 'primary.main' : 'text.disabled' }}
                              >
                                <PlayArrow fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      ))}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {/* ── Próximas Tarefas ── */}
          {(() => {
            const activePlan = (plans as any[]).find((p: any) => p.isActive);
            const today = dayjs().format('YYYY-MM-DD');
            const upcoming = (activePlan?.tasks || [])
              .filter((t: any) => !t.isCompleted && dayjs(t.scheduledDate).format('YYYY-MM-DD') > today)
              .slice(0, 5);
            if (!upcoming.length) return null;
            return (
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <CalendarMonth fontSize="small" color="action" />
                    <Typography variant="subtitle1" fontWeight={700}>Próximas Tarefas</Typography>
                  </Box>
                  {upcoming.map((t: any) => (
                    <Box key={t.id} sx={{
                      display: 'flex', alignItems: 'center', gap: 1, py: 0.75,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                    }}>
                      <Box sx={{ width: 4, height: 32, borderRadius: 2, bgcolor: 'primary.main', flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="caption" fontWeight={500} noWrap display="block">{t.title}</Typography>
                        <Typography variant="caption" color="text.disabled">
                          {dayjs(t.scheduledDate).format('ddd DD/MM')} · {t.estimatedMinutes}min
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Configurações
              </Typography>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Tempo de foco: {workMinutes} min
                </Typography>
                <Slider
                  value={workMinutes}
                  onChange={(_, v) => {
                    if (status !== 'idle') return;
                    setWorkMinutes(v as number);
                    if (phase === 'WORK') setSecondsLeft((v as number) * 60);
                  }}
                  min={10} max={120} step={5}
                  disabled={status !== 'idle'}
                  marks={[{ value: 25, label: '25' }, { value: 50, label: '50' }, { value: 90, label: '90' }]}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Pausa: {breakMinutes} min
                </Typography>
                <Slider
                  value={breakMinutes}
                  onChange={(_, v) => {
                    if (status !== 'idle') return;
                    setBreakMinutes(v as number);
                    if (phase !== 'WORK') setSecondsLeft((v as number) * 60);
                  }}
                  min={5} max={30} step={5}
                  disabled={status !== 'idle'}
                />
              </Box>

              <FormControl fullWidth size="small">
                <InputLabel>Som Ambiente</InputLabel>
                <Select
                  value={ambientSound}
                  onChange={(e) => setAmbientSound(e.target.value)}
                  label="Som Ambiente"
                >
                  {AMBIENT_SOUNDS.map((s) => (
                    <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Técnicas de Estudo
              </Typography>
              {TECHNIQUES.map((t) => (
                <Box
                  key={t.value}
                  sx={{
                    p: 1.5, mb: 1, borderRadius: 2,
                    bgcolor: technique.value === t.value ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    border: `1px solid ${technique.value === t.value ? alpha(theme.palette.primary.main, 0.3) : 'transparent'}`,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.05) },
                  }}
                  onClick={() => {
                    if (status !== 'idle') return;
                    setTechnique(t);
                    setWorkMinutes(t.work || 25);
                    setBreakMinutes(t.shortBreak);
                    setSecondsLeft((t.work || 25) * 60);
                  }}
                >
                  <Typography variant="body2" fontWeight={600}>{t.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.description}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ─── REVISÃO RELÂMPAGO ─── */}
      <Dialog open={flashReviewOpen} onClose={() => { setFlashReviewOpen(false); startFocus(); }}
        maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography fontWeight={700}>⚡ Revisão Relâmpago</Typography>
            <Typography variant="caption" color="text.secondary">
              {flashIndex + 1} de {recentErrors.length} erros recentes
            </Typography>
          </Box>
          <Chip label="Antes de focar" size="small" color="warning" />
        </DialogTitle>

        <LinearProgress variant="determinate" value={((flashIndex + 1) / recentErrors.length) * 100}
          sx={{ height: 3, '& .MuiLinearProgress-bar': { bgcolor: '#F2B705' } }} />

        <DialogContent sx={{ pt: 3 }}>
          {recentErrors[flashIndex] && (() => {
            const err = recentErrors[flashIndex];
            return (
              <Box>
                {err.subject && (
                  <Chip label={err.subject.name} size="small" sx={{
                    mb: 1.5,
                    bgcolor: alpha(err.subject.color || '#888', 0.15), color: err.subject.color
                  }} />
                )}
                <Paper elevation={0} sx={{
                  p: 2, borderRadius: 3, bgcolor: alpha('#EF4444', 0.06),
                  border: `1px solid ${alpha('#EF4444', 0.2)}`, mb: 2
                }}>
                  <Typography variant="caption" fontWeight={700} color="error" display="block" mb={0.75}>
                    ❓ O que você errou:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>{err.description}</Typography>
                </Paper>
                <Collapse in={flashFlipped}>
                  <Paper elevation={0} sx={{
                    p: 2, borderRadius: 3, bgcolor: alpha('#22C55E', 0.06),
                    border: `1px solid ${alpha('#22C55E', 0.2)}`
                  }}>
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#22C55E' }} display="block" mb={0.75}>
                      ✅ Resposta correta:
                    </Typography>
                    <Typography variant="body1">{err.correctAnswer}</Typography>
                    {err.personalNotes && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', fontStyle: 'italic' }}>
                        📝 {err.personalNotes}
                      </Typography>
                    )}
                  </Paper>
                </Collapse>
                {!flashFlipped && (
                  <Button fullWidth variant="outlined" startIcon={<Visibility />}
                    onClick={() => setFlashFlipped(true)} sx={{ mt: 1 }}>
                    Revelar resposta
                  </Button>
                )}
              </Box>
            );
          })()}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => { setFlashReviewOpen(false); startFocus(); }} color="secondary">
            Pular tudo e focar
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {flashIndex < recentErrors.length - 1 ? (
            <Button variant="contained" endIcon={<ArrowForward />}
              onClick={() => { setFlashIndex(i => i + 1); setFlashFlipped(false); }}>
              Próximo erro
            </Button>
          ) : (
            <Button variant="contained" startIcon={<PlayArrow />}
              onClick={() => { setFlashReviewOpen(false); startFocus(); }}
              sx={{ background: 'linear-gradient(135deg, #F2B705, #FFD34D)' }}>
              Iniciar Foco!
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
