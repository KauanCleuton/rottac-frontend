'use client';

import {
  Box, Grid, Card, CardContent, Typography, Button, Chip,
  LinearProgress, CircularProgress, alpha, useTheme, Paper,
  List, ListItem, ListItemText, ListItemIcon, IconButton,
  Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Alert, Tooltip,
  Badge, Avatar,
} from '@mui/material';
import {
  Psychology, AutoAwesome, CheckCircle,
  PlayArrow, Bolt, LocalFireDepartment, EmojiEvents,
  AccessTime, Refresh, BatteryChargingFull,
  Shield, Whatshot, NotificationsActive, Timeline,
  Circle, FiberManualRecord,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { intelligenceApi, behaviorApi, missionApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useState } from 'react';
import { BRAND_GRADIENT } from '@/theme';

dayjs.locale('pt-br');

const MODE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  NORMAL:      { label: 'Normal',       color: '#F2B705', icon: <Psychology />,          desc: 'Estudo equilibrado e progressivo' },
  FORCA_BRUTA: { label: 'Força Bruta',  color: '#EF4444', icon: <Whatshot />,            desc: 'Foco total nas fraquezas críticas' },
  MODO_GUERRA: { label: 'Modo Guerra',  color: '#F59E0B', icon: <LocalFireDepartment />, desc: 'Reta final: revisão + simulados' },
  CANSADO:     { label: 'Modo Cansado', color: '#D4A017', icon: <BatteryChargingFull />, desc: 'Tarefas leves até recuperar energia' },
  RETORNO:     { label: 'Retorno',      color: '#10B981', icon: <Refresh />,             desc: 'Reconstruindo hábito gradualmente' },
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITICO: '#EF4444',
  AVISO:   '#F59E0B',
  INFO:    '#3B82F6',
  POSITIVO: '#10B981',
};

const TASK_TYPE_COLOR: Record<string, string> = {
  LEITURA: '#F2B705', REVISAO: '#FF6584', EXERCICIOS: '#00C896',
  VIDEO: '#FFB547', RESUMO: '#3B82F6', FLASHCARDS: '#D4A017', SIMULADO: '#EF4444',
  QUESTOES: '#10B981', REVISAO_ERROS: '#F59E0B',
};

export default function InteligenciaPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [modeDialog, setModeDialog] = useState(false);
  const [bruteDialog, setBruteDialog] = useState(false);
  const [selectedMode, setSelectedMode] = useState('NORMAL');
  const [selectedSubject, setSelectedSubject] = useState('');

  // ─── Queries ────────────────────────────────────────────────────────────
  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ['intel-profile'],
    queryFn: () => intelligenceApi.getProfile().then(r => r.data.data),
    staleTime: 1000 * 60 * 2,
  });

  const { data: plan, isLoading: loadingPlan } = useQuery({
    queryKey: ['intel-plan-today'],
    queryFn: () => intelligenceApi.getTodayPlan().then(r => r.data.data),
    staleTime: 1000 * 60,
  });

  const { data: nextAction } = useQuery({
    queryKey: ['intel-next-action'],
    queryFn: () => intelligenceApi.getNextAction().then(r => r.data.data),
    refetchInterval: 30_000,
  });

  const { data: insights = [] } = useQuery({
    queryKey: ['intel-insights'],
    queryFn: () => intelligenceApi.getInsights().then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const { data: metrics } = useQuery({
    queryKey: ['behavior-metrics'],
    queryFn: () => behaviorApi.getMetrics(30).then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const { data: missions = [] } = useQuery({
    queryKey: ['missions'],
    queryFn: () => missionApi.getAll().then(r => r.data.data),
    staleTime: 1000 * 60 * 2,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  // ─── Mutations ──────────────────────────────────────────────────────────
  const generatePlan = useMutation({
    mutationFn: () => intelligenceApi.generatePlan(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intel-plan-today'] });
      qc.invalidateQueries({ queryKey: ['intel-next-action'] });
      toast.success('Plano inteligente do dia gerado!');
    },
    onError: () => toast.error('Erro ao gerar plano. Verifique se o serviço de IA está ativo.'),
  });

  const analyzeProfile = useMutation({
    mutationFn: () => intelligenceApi.analyzeProfile(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intel-profile'] });
      qc.invalidateQueries({ queryKey: ['intel-insights'] });
      toast.success('Análise de perfil concluída!');
    },
  });

  const completeAction = useMutation({
    mutationFn: (itemId: string) => intelligenceApi.completeAction(itemId),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['intel-next-action'] });
      qc.invalidateQueries({ queryKey: ['intel-plan-today'] });
      if (data.data.data.allDone) {
        toast.success('Parabéns! Você concluiu todas as ações do dia! 🎉');
      } else {
        toast.success('Ação concluída! Próxima ação carregada.');
      }
    },
  });

  const setMode = useMutation({
    mutationFn: (mode: string) => intelligenceApi.setMode(mode),
    onSuccess: (_, mode) => {
      qc.invalidateQueries({ queryKey: ['intel-profile'] });
      toast.success(`Modo ${MODE_CONFIG[mode]?.label || mode} ativado!`);
      setModeDialog(false);
    },
  });

  const activateWarMode = useMutation({
    mutationFn: () => intelligenceApi.activateWarMode(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intel-profile'] });
      toast.success('MODO GUERRA ATIVADO!');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erro ao ativar modo guerra'),
  });

  const activateBruteForce = useMutation({
    mutationFn: () => intelligenceApi.activateBruteForce({ subjectId: selectedSubject }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['intel-profile'] });
      toast.success(`Força Bruta ativada em ${data.data.data.subject}!`);
      setBruteDialog(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erro'),
  });

  const generateMissions = useMutation({
    mutationFn: () => missionApi.generate(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['missions'] });
      toast.success('Missões geradas pela IA!');
    },
  });

  const completeMission = useMutation({
    mutationFn: (id: string) => missionApi.complete(id),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['missions'] });
      toast.success(`+${data.data.data.xpEarned} XP! Missão concluída!`);
    },
  });

  const replan = useMutation({
    mutationFn: () => intelligenceApi.replan({ reason: 'manual', completedItems: [] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intel-plan-today'] });
      toast.success('Plano reajustado para o restante do dia!');
    },
  });

  const markInsightRead = useMutation({
    mutationFn: (id: string) => intelligenceApi.markInsightRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intel-insights'] }),
  });

  // ─── Derived ────────────────────────────────────────────────────────────
  const activeMode = profile?.activeMode || 'NORMAL';
  const modeInfo = MODE_CONFIG[activeMode] || MODE_CONFIG.NORMAL;
  const planItems: any[] = Array.isArray(plan?.plan) ? plan.plan : [];
  const completedCount = planItems.filter((i: any) => i.done).length;
  const progress = planItems.length > 0 ? Math.round((completedCount / planItems.length) * 100) : 0;
  const activeMissions = missions.filter((m: any) => m.status === 'ATIVA');

  if (loadingProfile || loadingPlan) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Central de Inteligência</Typography>
          <Typography color="text.secondary" variant="body2">
            O sistema pensa, decide e age por você
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            startIcon={<Psychology />}
            onClick={() => analyzeProfile.mutate()}
            disabled={analyzeProfile.isPending}
            size="small"
          >
            Analisar Perfil
          </Button>
          <Button
            variant="contained"
            startIcon={<AutoAwesome />}
            onClick={() => generatePlan.mutate()}
            disabled={generatePlan.isPending}
            size="small"
            sx={{ background: BRAND_GRADIENT }}
          >
            Gerar Plano Inteligente
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* ── Modo Atual ── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              background: alpha(modeInfo.color, 0.1),
              border: `2px solid ${alpha(modeInfo.color, 0.3)}`,
              height: '100%',
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Box sx={{ color: modeInfo.color, display: 'flex' }}>{modeInfo.icon}</Box>
                <Typography variant="h6" fontWeight={700}>Modo Atual</Typography>
              </Box>
              <Chip
                label={modeInfo.label}
                sx={{ bgcolor: modeInfo.color, color: '#fff', fontWeight: 700, mb: 1, fontSize: 14 }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {modeInfo.desc}
              </Typography>
              {profile && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">Tipo Comportamental</Typography>
                  <Typography variant="body2" fontWeight={600}>{profile.behaviorType}</Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button size="small" variant="outlined" onClick={() => setModeDialog(true)}>
                  Mudar Modo
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<LocalFireDepartment />}
                  onClick={() => activateWarMode.mutate()}
                  disabled={activateWarMode.isPending}
                >
                  Modo Guerra
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Perfil de Performance ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Métricas de Inteligência
              </Typography>
              {profile ? (
                <Grid container spacing={2}>
                  {[
                    { label: 'Score de Performance', value: Math.round(profile.performanceScore), color: '#F2B705', unit: '%' },
                    { label: 'Taxa de Retenção',     value: Math.round(profile.retentionRate),    color: '#10B981', unit: '%' },
                    { label: 'Consistência',          value: Math.round(profile.consistencyScore), color: '#F59E0B', unit: '%' },
                    { label: 'Taxa de Abandono',      value: Math.round(profile.abandonmentRate),  color: '#EF4444', unit: '%' },
                  ].map((m) => (
                    <Grid size={{ xs: 6, sm: 3 }} key={m.label}>
                      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: alpha(m.color, 0.05), border: `1px solid ${alpha(m.color, 0.2)}` }}>
                        <Typography variant="h4" fontWeight={900} sx={{ color: m.color }}>
                          {m.value}{m.unit}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{m.label}</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={m.value}
                          sx={{ mt: 1, height: 4, borderRadius: 2, bgcolor: alpha(m.color, 0.15), '& .MuiLinearProgress-bar': { bgcolor: m.color } }}
                        />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Perfil ainda não analisado. Clique em "Analisar Perfil" para começar.
                  </Typography>
                  <Button variant="contained" onClick={() => analyzeProfile.mutate()} disabled={analyzeProfile.isPending}>
                    {analyzeProfile.isPending ? 'Analisando...' : 'Analisar Agora'}
                  </Button>
                </Box>
              )}
              {metrics && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Taxa de Conclusão</Typography>
                    <Typography fontWeight={700}>{metrics.completionRate}%</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Total Estudado</Typography>
                    <Typography fontWeight={700}>{metrics.totalHours}h (30d)</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Taxa de Acerto</Typography>
                    <Typography fontWeight={700}>{metrics.accuracy}%</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="text.secondary">Taxa de Fuga</Typography>
                    <Typography fontWeight={700} color="error">{metrics.abandonmentRate}%</Typography>
                  </Grid>
                </Grid>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Próxima Ação (botão único de execução) ── */}
        <Grid size={{ xs: 12 }}>
          <Card
            sx={{
              background: nextAction?.action
                ? `linear-gradient(135deg, ${alpha('#F2B705', 0.12)}, ${alpha('#FFD34D', 0.08)})`
                : undefined,
              border: nextAction?.action ? `1px solid ${alpha('#F2B705', 0.3)}` : undefined,
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Bolt sx={{ color: '#F2B705' }} />
                  <Typography variant="h6" fontWeight={700}>Próxima Ação</Typography>
                </Box>
                {planItems.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {completedCount}/{planItems.length} concluídas
                    </Typography>
                    <Tooltip title="Replanejar dia">
                      <IconButton size="small" onClick={() => replan.mutate()} disabled={replan.isPending}>
                        <Refresh fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )}
              </Box>

              {planItems.length > 0 && (
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ mb: 2, height: 6, borderRadius: 3, bgcolor: alpha('#F2B705', 0.1), '& .MuiLinearProgress-bar': { background: BRAND_GRADIENT } }}
                />
              )}

              {nextAction?.action ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box
                    sx={{
                      width: 48, height: 48, borderRadius: 2,
                      bgcolor: alpha(TASK_TYPE_COLOR[nextAction.action.type] || '#F2B705', 0.15),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PlayArrow sx={{ color: TASK_TYPE_COLOR[nextAction.action.type] || '#F2B705' }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6" fontWeight={700} noWrap>
                      {nextAction.action.title}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={nextAction.action.type}
                        size="small"
                        sx={{ bgcolor: alpha(TASK_TYPE_COLOR[nextAction.action.type] || '#F2B705', 0.15), fontSize: 11 }}
                      />
                      {nextAction.action.estimatedMinutes && (
                        <Chip
                          icon={<AccessTime sx={{ fontSize: 12 }} />}
                          label={`${nextAction.action.estimatedMinutes} min`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {nextAction.action.subject && (
                        <Chip label={nextAction.action.subject} size="small" variant="outlined" />
                      )}
                    </Box>
                  </Box>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<CheckCircle />}
                    onClick={() => completeAction.mutate(nextAction.action.id)}
                    disabled={completeAction.isPending}
                    sx={{ background: BRAND_GRADIENT, px: 4, py: 1.5, fontWeight: 700 }}
                  >
                    Executar
                  </Button>
                </Box>
              ) : plan ? (
                <Box sx={{ textAlign: 'center', py: 2 }}>
                  <CheckCircle sx={{ fontSize: 40, color: '#10B981', mb: 1 }} />
                  <Typography fontWeight={700} color="success.main">
                    {nextAction?.message || 'Todas as ações do dia concluídas!'}
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 3 }}>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Nenhum plano gerado para hoje. Gere seu plano inteligente para começar.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AutoAwesome />}
                    onClick={() => generatePlan.mutate()}
                    disabled={generatePlan.isPending}
                    sx={{ background: BRAND_GRADIENT }}
                  >
                    {generatePlan.isPending ? 'Gerando...' : 'Gerar Plano do Dia'}
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Plano do Dia (lista completa) ── */}
        {planItems.length > 0 && (
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Plano do Dia — {dayjs().format('DD [de] MMMM')}
                  <Chip
                    label={plan?.dayMode || 'NORMAL'}
                    size="small"
                    sx={{ ml: 1, bgcolor: alpha(modeInfo.color, 0.15), color: modeInfo.color, fontWeight: 700 }}
                  />
                </Typography>
                <List disablePadding>
                  {planItems.map((item: any, idx: number) => (
                    <ListItem
                      key={item.id || idx}
                      disablePadding
                      sx={{
                        mb: 1,
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: item.done ? alpha('#10B981', 0.05) : alpha(theme.palette.divider, 0.3),
                        border: `1px solid ${item.done ? alpha('#10B981', 0.2) : 'transparent'}`,
                        opacity: item.done ? 0.7 : 1,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {item.done
                          ? <CheckCircle sx={{ color: '#10B981', fontSize: 20 }} />
                          : <FiberManualRecord sx={{ color: TASK_TYPE_COLOR[item.type] || '#9CA3AF', fontSize: 14 }} />
                        }
                      </ListItemIcon>
                      <ListItemText
                        primary={item.title}
                        secondaryTypographyProps={{ component: 'div' }}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                            {item.type && (
                              <Chip
                                label={item.type}
                                size="small"
                                sx={{ height: 18, fontSize: 10, bgcolor: alpha(TASK_TYPE_COLOR[item.type] || '#F2B705', 0.1) }}
                              />
                            )}
                            {item.estimatedMinutes && (
                              <Chip
                                label={`${item.estimatedMinutes}min`}
                                size="small"
                                variant="outlined"
                                sx={{ height: 18, fontSize: 10 }}
                              />
                            )}
                            {item.priority === 'CRITICO' && (
                              <Chip
                                label="CRÍTICO"
                                size="small"
                                sx={{ height: 18, fontSize: 10, bgcolor: alpha('#EF4444', 0.15), color: '#EF4444' }}
                              />
                            )}
                          </Box>
                        }
                        primaryTypographyProps={{ fontWeight: item.done ? 400 : 600, fontSize: 14, sx: { textDecoration: item.done ? 'line-through' : 'none' } }}
                      />
                      {!item.done && (
                        <IconButton
                          size="small"
                          onClick={() => completeAction.mutate(item.id)}
                          disabled={completeAction.isPending}
                        >
                          <CheckCircle fontSize="small" sx={{ color: '#9CA3AF' }} />
                        </IconButton>
                      )}
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ── Insights da IA ── */}
        {insights.length > 0 && (
          <Grid size={{ xs: 12, md: planItems.length > 0 ? 5 : 12 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                  <Typography variant="h6" fontWeight={700}>Insights da IA</Typography>
                  <Badge badgeContent={insights.length} color="error">
                    <NotificationsActive sx={{ color: '#F59E0B' }} />
                  </Badge>
                </Box>
                <List disablePadding>
                  {insights.slice(0, 5).map((ins: any) => (
                    <ListItem
                      key={ins.id}
                      disablePadding
                      sx={{
                        mb: 1, p: 1.5, borderRadius: 2,
                        bgcolor: alpha(SEVERITY_COLOR[ins.severity] || '#3B82F6', 0.05),
                        border: `1px solid ${alpha(SEVERITY_COLOR[ins.severity] || '#3B82F6', 0.2)}`,
                      }}
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Circle sx={{ fontSize: 8, color: SEVERITY_COLOR[ins.severity] }} />
                            <Typography variant="body2" fontWeight={700}>{ins.title}</Typography>
                          </Box>
                        }
                        secondary={ins.body}
                        secondaryTypographyProps={{ fontSize: 12, sx: { mt: 0.5 } }}
                      />
                      <IconButton size="small" onClick={() => markInsightRead.mutate(ins.id)}>
                        <CheckCircle fontSize="small" sx={{ color: '#9CA3AF' }} />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ── Missões ── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <EmojiEvents sx={{ color: '#F59E0B' }} />
                  <Typography variant="h6" fontWeight={700}>Missões Ativas</Typography>
                </Box>
                <Button
                  size="small"
                  startIcon={<AutoAwesome />}
                  onClick={() => generateMissions.mutate()}
                  disabled={generateMissions.isPending}
                >
                  Gerar
                </Button>
              </Box>
              {activeMissions.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  Nenhuma missão ativa. Clique em "Gerar" para criar missões personalizadas.
                </Typography>
              ) : (
                <List disablePadding>
                  {activeMissions.slice(0, 4).map((m: any) => (
                    <ListItem
                      key={m.id}
                      disablePadding
                      sx={{
                        mb: 1, p: 1.5, borderRadius: 2,
                        bgcolor: alpha(theme.palette.divider, 0.3),
                      }}
                    >
                      <ListItemText
                        primary={m.title}
                        secondary={m.description}
                        secondaryTypographyProps={{ fontSize: 12 }}
                      />
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
                        <Chip
                          label={`+${m.xpReward} XP`}
                          size="small"
                          sx={{ bgcolor: alpha('#F59E0B', 0.15), color: '#F59E0B', fontWeight: 700, fontSize: 11 }}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          color="success"
                          onClick={() => completeMission.mutate(m.id)}
                          disabled={completeMission.isPending}
                          sx={{ fontSize: 11, py: 0.25, px: 1 }}
                        >
                          Concluir
                        </Button>
                      </Box>
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* ── Força Bruta / Modos especiais ── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Shield sx={{ color: '#EF4444' }} />
                <Typography variant="h6" fontWeight={700}>Modos de Ataque</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <Paper
                    sx={{
                      p: 2, borderRadius: 2, cursor: 'pointer',
                      bgcolor: alpha('#EF4444', 0.05),
                      border: `1px solid ${alpha('#EF4444', 0.2)}`,
                      '&:hover': { bgcolor: alpha('#EF4444', 0.1) },
                    }}
                    onClick={() => setBruteDialog(true)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Whatshot sx={{ color: '#EF4444', fontSize: 32 }} />
                      <Box>
                        <Typography fontWeight={700}>Força Bruta</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Atacar fraquezas críticas por 7 dias. Bloqueia outras disciplinas.
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Paper
                    sx={{
                      p: 2, borderRadius: 2, cursor: 'pointer',
                      bgcolor: alpha('#F59E0B', 0.05),
                      border: `1px solid ${alpha('#F59E0B', 0.2)}`,
                      '&:hover': { bgcolor: alpha('#F59E0B', 0.1) },
                    }}
                    onClick={() => activateWarMode.mutate()}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <LocalFireDepartment sx={{ color: '#F59E0B', fontSize: 32 }} />
                      <Box>
                        <Typography fontWeight={700}>Modo Guerra</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Reta final: revisão + simulados. Disponível nos últimos 60 dias.
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Fraquezas vs Forças ── */}
        {metrics && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Disciplinas: Fraquezas vs Forças</Typography>
                {metrics.weakSubjects?.length > 0 && (
                  <>
                    <Typography variant="body2" color="error" fontWeight={600} sx={{ mb: 1 }}>
                      Fraquezas Críticas
                    </Typography>
                    {metrics.weakSubjects.map((s: any) => (
                      <Box key={s.name} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{s.name}</Typography>
                          <Typography variant="body2" fontWeight={700} color="error">{s.accuracy}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={s.accuracy}
                          sx={{ height: 6, borderRadius: 3, bgcolor: alpha('#EF4444', 0.1), '& .MuiLinearProgress-bar': { bgcolor: '#EF4444' } }}
                        />
                      </Box>
                    ))}
                  </>
                )}
                {metrics.strongSubjects?.length > 0 && (
                  <>
                    <Typography variant="body2" color="success.main" fontWeight={600} sx={{ mt: 2, mb: 1 }}>
                      Pontos Fortes
                    </Typography>
                    {metrics.strongSubjects.map((s: any) => (
                      <Box key={s.name} sx={{ mb: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                          <Typography variant="body2">{s.name}</Typography>
                          <Typography variant="body2" fontWeight={700} color="success.main">{s.accuracy}%</Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={s.accuracy}
                          sx={{ height: 6, borderRadius: 3, bgcolor: alpha('#10B981', 0.1), '& .MuiLinearProgress-bar': { bgcolor: '#10B981' } }}
                        />
                      </Box>
                    ))}
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ── Eficiência por Hora ── */}
        {metrics?.efficiencyByHour?.length > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Timeline sx={{ color: '#F2B705' }} />
                  <Typography variant="h6" fontWeight={700}>Eficiência por Hora</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {Array.from({ length: 24 }, (_, h) => {
                    const data = metrics.efficiencyByHour.find((e: any) => e.hour === h);
                    return (
                      <Tooltip
                        key={h}
                        title={data ? `${h}h: ${data.accuracy}% acerto (${data.questions}q)` : `${h}h: sem dados`}
                      >
                        <Box
                          sx={{
                            width: 28, height: 48,
                            borderRadius: 1,
                            bgcolor: data
                              ? alpha(data.accuracy >= 70 ? '#10B981' : data.accuracy >= 50 ? '#F59E0B' : '#EF4444', 0.15 + data.accuracy / 250)
                              : alpha(theme.palette.divider, 0.3),
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            pb: 0.5,
                          }}
                        >
                          <Typography sx={{ fontSize: 8, color: 'text.secondary' }}>
                            {String(h).padStart(2, '0')}
                          </Typography>
                        </Box>
                      </Tooltip>
                    );
                  })}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 1.5 }}>
                  {[{ label: '≥70% acerto', color: '#10B981' }, { label: '50-70%', color: '#F59E0B' }, { label: '<50%', color: '#EF4444' }].map(l => (
                    <Box key={l.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: l.color }} />
                      <Typography variant="caption" color="text.secondary">{l.label}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* ── Dialog: Mudar Modo ── */}
      <Dialog open={modeDialog} onClose={() => setModeDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Selecionar Modo de Estudo</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            {Object.entries(MODE_CONFIG).map(([key, cfg]) => (
              <Grid size={{ xs: 12 }} key={key}>
                <Paper
                  sx={{
                    p: 2, cursor: 'pointer', borderRadius: 2,
                    border: `2px solid ${selectedMode === key ? cfg.color : 'transparent'}`,
                    bgcolor: alpha(cfg.color, 0.05),
                    '&:hover': { bgcolor: alpha(cfg.color, 0.1) },
                  }}
                  onClick={() => setSelectedMode(key)}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ color: cfg.color }}>{cfg.icon}</Box>
                    <Box>
                      <Typography fontWeight={700}>{cfg.label}</Typography>
                      <Typography variant="body2" color="text.secondary">{cfg.desc}</Typography>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModeDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => setMode.mutate(selectedMode)}
            disabled={setMode.isPending}
          >
            Ativar Modo
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Dialog: Força Bruta ── */}
      <Dialog open={bruteDialog} onClose={() => setBruteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Ativar Modo Força Bruta</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Força Bruta foca exclusivamente em uma disciplina por 7 dias. Outras disciplinas serão temporariamente bloqueadas.
          </Alert>
          <FormControl fullWidth>
            <InputLabel>Disciplina alvo</InputLabel>
            <Select
              value={selectedSubject}
              label="Disciplina alvo"
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              {subjects.map((s: any) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBruteDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => activateBruteForce.mutate()}
            disabled={!selectedSubject || activateBruteForce.isPending}
          >
            Ativar Força Bruta
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
