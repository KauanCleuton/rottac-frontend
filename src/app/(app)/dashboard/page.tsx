'use client';

import {
  Box, Grid, Card, CardContent, Typography, LinearProgress,
  Chip, IconButton, Avatar, List, ListItem, ListItemText,
  ListItemAvatar, Button, CircularProgress, Divider, alpha, useTheme,
  Paper, Tooltip,
} from '@mui/material';
import {
  CheckCircle, RadioButtonUnchecked, Timer, Bolt,
  LocalFireDepartment, TrendingUp, EmojiEvents, FlashOn,
  MenuBook, Add, PlayArrow, School, AutoAwesome, ArrowForward,
  Lightbulb, QuestionAnswer, SelfImprovement,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planApi, taskApi, analyticsApi, emotionApi, flashcardApi, errorNotebookApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useState } from 'react';
import Link from 'next/link';
import { BRAND_GRADIENT } from '@/theme';

dayjs.locale('pt-br');

const TASK_TYPE_COLORS: Record<string, string> = {
  LEITURA: '#F2B705', REVISAO: '#FF6584', EXERCICIOS: '#00C896',
  VIDEO: '#FFB547', RESUMO: '#3B82F6', FLASHCARDS: '#D4A017', SIMULADO: '#EF4444',
};
const TASK_TYPE_LABEL: Record<string, string> = {
  LEITURA: 'Leitura', REVISAO: 'Revisão', EXERCICIOS: 'Exercícios',
  VIDEO: 'Vídeo', RESUMO: 'Resumo', FLASHCARDS: 'Flashcards', SIMULADO: 'Simulado',
};
const EMOTIONS = [
  { value: 'MOTIVADO', emoji: '💪', label: 'Motivado' },
  { value: 'FOCADO', emoji: '🎯', label: 'Focado' },
  { value: 'TRANQUILO', emoji: '😌', label: 'Tranquilo' },
  { value: 'CANSADO', emoji: '😴', label: 'Cansado' },
  { value: 'ANSIOSO', emoji: '😰', label: 'Ansioso' },
  { value: 'ESTRESSADO', emoji: '😤', label: 'Estressado' },
];

const FRASES_CONCURSEIRO = [
  'A aprovação é resultado de disciplina diária, não de talento esporádico.',
  'Cada hora estudada hoje é um passo a menos para chegar à aprovação.',
  'Não compare seu capítulo 1 com o capítulo 20 de outra pessoa.',
  'O concurseiro aprovado não é o mais inteligente — é o mais persistente.',
  'Revisão é onde a aprovação acontece. Estudar uma vez não basta.',
  'Consistência supera intensidade. Todo dia, mesmo que pouco.',
  'Seu próximo concurso pode ser o último que você vai prestar.',
  'Dificuldade é o sinal de que você está crescendo. Continue.',
  'A questão que você errou hoje é a que você vai acertar na prova.',
  'Cuide do seu sono e da sua saúde — são parte do seu estudo.',
];

function getFraseDoDia(): string {
  const idx = dayjs().dayOfYear() % FRASES_CONCURSEIRO.length;
  return FRASES_CONCURSEIRO[idx];
}

// Adicionar plugin dayOfYear
import dayOfYear from 'dayjs/plugin/dayOfYear';
dayjs.extend(dayOfYear);

export default function DashboardPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);

  const { data: todayData, isLoading } = useQuery({
    queryKey: ['today-tasks'],
    queryFn: () => planApi.getToday().then((r) => r.data.data),
  });

  const { data: dashData } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.getDashboard().then((r) => r.data.data),
  });

  const { data: flashDue = [] } = useQuery({
    queryKey: ['flashcards-due'],
    queryFn: () => flashcardApi.getDue().then(r => r.data.data || []),
  });

  const { data: errorsDue = [] } = useQuery({
    queryKey: ['errors-due'],
    queryFn: () => errorNotebookApi.getDue().then(r => r.data.data || []),
  });

  const { data: historyData = [] } = useQuery({
    queryKey: ['study-history-7'],
    queryFn: () => analyticsApi.getStudyHistory(7).then(r => r.data.data || []),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => taskApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['today-tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      toast.success('Tarefa concluída! +10 XP 🎉');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erro ao concluir tarefa'),
  });

  const uncompleteMutation = useMutation({
    mutationFn: (id: string) => taskApi.uncomplete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['today-tasks'] }),
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erro ao desfazer'),
  });

  const emotionMutation = useMutation({
    mutationFn: (emotion: string) => emotionApi.log({ emotion, energy: 3 }),
    onSuccess: (_, emotion) => { setSelectedEmotion(emotion); toast.success('Estado registrado!'); },
  });

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
  );

  const tasks = todayData?.tasks || [];
  const summary = todayData?.summary || {};
  const pending = tasks.filter((t: any) => !t.isCompleted);
  const completed = tasks.filter((t: any) => t.isCompleted);

  const flashDueCount = (flashDue as any[]).length;
  const errorsDueCount = (errorsDue as any[]).length;
  const revisaoTotal = flashDueCount + errorsDueCount;

  // Mini heatmap últimos 7 dias
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = dayjs().subtract(6 - i, 'day');
    const found = (historyData as any[]).find((d: any) => dayjs(d.date).isSame(date, 'day'));
    return { date, minutes: found?.minutes || 0 };
  });
  const maxMinutes = Math.max(...last7.map(d => d.minutes), 60);

  // Saudação personalizada
  const hora = dayjs().hour();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  // O que focar hoje
  const focoSugestao = revisaoTotal > 5
    ? { texto: `Você tem ${revisaoTotal} itens de revisão pendentes!`, link: '/flashcards', cor: '#EF4444', icon: '⚡' }
    : pending.length > 0
    ? { texto: `${pending.length} tarefa${pending.length > 1 ? 's' : ''} no plano de hoje`, link: '/plano', cor: theme.palette.primary.main, icon: '📋' }
    : errorsDueCount > 0
    ? { texto: `${errorsDueCount} erros aguardando revisão`, link: '/caderno-erros', cor: '#F59E0B', icon: '📖' }
    : { texto: 'Tudo em dia! Que tal resolver questões?', link: '/questoes', cor: '#22C55E', icon: '✅' };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          {saudacao}! {dayjs().format('dddd, D [de] MMMM')}
        </Typography>
        <Typography color="text.secondary" variant="body2">
          {pending.length > 0
            ? `Você tem ${pending.length} tarefa${pending.length > 1 ? 's' : ''} para hoje`
            : completed.length > 0 ? '🎉 Todas as tarefas de hoje concluídas!'
            : 'Pronto para estudar?'}
        </Typography>
      </Box>

      {/* Foco do dia */}
      <Paper sx={{
        p: 2, mb: 3, borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2,
        background: `linear-gradient(135deg, ${alpha(focoSugestao.cor, 0.1)}, ${alpha(focoSugestao.cor, 0.04)})`,
        border: `1px solid ${alpha(focoSugestao.cor, 0.2)}`,
      }}>
        <Typography fontSize={28}>{focoSugestao.icon}</Typography>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="body2" fontWeight={700} color={focoSugestao.cor}>
            Foco de agora
          </Typography>
          <Typography variant="body2" color="text.secondary">{focoSugestao.texto}</Typography>
        </Box>
        <Button component={Link} href={focoSugestao.link} variant="contained"
          size="small" endIcon={<ArrowForward />}
          sx={{ bgcolor: focoSugestao.cor, flexShrink: 0, '&:hover': { bgcolor: focoSugestao.cor } }}>
          Ir
        </Button>
      </Paper>

      <Grid container spacing={2.5}>
        {/* ── KPIs ── */}
        <Grid size={12}>
          <Grid container spacing={2}>
            {[
              { label: 'Progresso Hoje', value: `${summary.progressPercent || 0}%`, sub: `${summary.completed || 0}/${summary.total || 0} tarefas`, color: theme.palette.primary.main, icon: <TrendingUp /> },
              { label: 'Streak', value: `${dashData?.gamification?.streak || 0}d`, sub: `Melhor: ${dashData?.gamification?.bestStreak || 0}d`, color: '#FF6B35', icon: <LocalFireDepartment /> },
              { label: 'XP Total', value: dashData?.gamification?.xp || 0, sub: `Nível ${dashData?.gamification?.level || 1}`, color: '#D4A017', icon: <Bolt /> },
              { label: 'Flashcards', value: flashDueCount, sub: 'para revisar hoje', color: flashDueCount > 10 ? '#EF4444' : '#22C55E', icon: <FlashOn /> },
              { label: 'Erros p/ revisar', value: errorsDueCount, sub: 'caderno de erros', color: errorsDueCount > 5 ? '#F59E0B' : '#22C55E', icon: <MenuBook /> },
            ].map((stat) => (
              <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={stat.label}>
                <Card sx={{ height: '100%' }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 2, mb: 1.5,
                      bgcolor: alpha(stat.color, 0.12), display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: stat.color }}>
                      {stat.icon}
                    </Box>
                    <Typography variant="h5" fontWeight={700}>{stat.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                    <Typography variant="caption" display="block" color="text.secondary" sx={{ opacity: 0.7 }}>
                      {stat.sub}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* ── Revisão Express ── */}
        {revisaoTotal > 0 && (
          <Grid size={12}>
            <Card sx={{ border: `1px solid ${alpha('#F2B705', 0.2)}`,
              background: `linear-gradient(135deg, ${alpha('#F2B705', 0.04)}, transparent)` }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <AutoAwesome sx={{ color: '#F2B705' }} />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>Revisão Express</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {revisaoTotal} item{revisaoTotal > 1 ? 's' : ''} esperando revisão hoje — não deixe para amanhã
                      </Typography>
                    </Box>
                  </Box>
                </Box>
                <Grid container spacing={1.5}>
                  {flashDueCount > 0 && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2,
                        border: `1px solid ${alpha('#D4A017', 0.2)}`,
                        bgcolor: alpha('#D4A017', 0.04),
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <Typography fontSize={24}>⚡</Typography>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{flashDueCount} Flashcards</Typography>
                            <Typography variant="caption" color="text.secondary">Repetição espaçada</Typography>
                          </Box>
                        </Box>
                        <Button component={Link} href="/flashcards" variant="contained" size="small"
                          sx={{ bgcolor: '#D4A017', '&:hover': { bgcolor: '#7C3AED' } }}>
                          Revisar
                        </Button>
                      </Paper>
                    </Grid>
                  )}
                  {errorsDueCount > 0 && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2,
                        border: `1px solid ${alpha('#F59E0B', 0.2)}`,
                        bgcolor: alpha('#F59E0B', 0.04),
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                          <Typography fontSize={24}>📖</Typography>
                          <Box>
                            <Typography variant="body2" fontWeight={700}>{errorsDueCount} Erros</Typography>
                            <Typography variant="caption" color="text.secondary">Caderno de erros</Typography>
                          </Box>
                        </Box>
                        <Button component={Link} href="/caderno-erros" variant="contained" size="small"
                          sx={{ bgcolor: '#F59E0B', '&:hover': { bgcolor: '#D97706' } }}>
                          Revisar
                        </Button>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* ── Ações Rápidas ── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Ações Rápidas</Typography>
              <Grid container spacing={1}>
                {[
                  { label: 'Modo Foco', icon: <SelfImprovement />, href: '/foco', color: '#F2B705' },
                  { label: 'Flashcards', icon: <FlashOn />, href: '/flashcards', color: '#D4A017' },
                  { label: 'Simulado', icon: <QuestionAnswer />, href: '/simulado', color: '#EF4444' },
                  { label: 'Registrar Questões', icon: <Add />, href: '/questoes', color: '#22C55E' },
                  { label: 'Caderno de Erros', icon: <MenuBook />, href: '/caderno-erros', color: '#F59E0B' },
                  { label: 'Meu Concurso', icon: <School />, href: '/concurso', color: '#3B82F6' },
                ].map(a => (
                  <Grid size={6} key={a.label}>
                    <Button fullWidth component={Link} href={a.href} variant="outlined" size="small"
                      startIcon={<Box sx={{ color: a.color }}>{a.icon}</Box>}
                      sx={{ justifyContent: 'flex-start', borderColor: alpha(a.color, 0.2), fontSize: 11,
                        '&:hover': { borderColor: a.color, bgcolor: alpha(a.color, 0.06) } }}>
                      {a.label}
                    </Button>
                  </Grid>
                ))}
              </Grid>

              <Divider sx={{ my: 2 }} />

              {/* Heatmap 7 dias */}
              <Typography variant="caption" color="text.secondary" display="block" mb={1} fontWeight={600}>
                ÚLTIMOS 7 DIAS
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-end' }}>
                {last7.map((d, i) => {
                  const pct = d.minutes / maxMinutes;
                  const isToday = dayjs(d.date).isSame(dayjs(), 'day');
                  return (
                    <Tooltip key={i} title={`${d.date.format('ddd DD/MM')}: ${Math.round(d.minutes / 60 * 10) / 10}h`}>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                        <Box sx={{
                          width: '100%', height: Math.max(4, pct * 40), borderRadius: 1,
                          bgcolor: d.minutes === 0 ? alpha(theme.palette.divider, 0.3) :
                            pct >= 0.7 ? '#22C55E' : pct >= 0.4 ? '#F59E0B' : '#3B82F6',
                          transition: 'height 0.3s',
                          border: isToday ? `2px solid ${theme.palette.primary.main}` : 'none',
                        }} />
                        <Typography variant="caption" sx={{ fontSize: 9, color: 'text.secondary' }}>
                          {d.date.format('D')}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Como você está */}
              <Typography variant="caption" color="text.secondary" display="block" mb={1} fontWeight={600}>
                COMO VOCÊ ESTÁ HOJE?
              </Typography>
              <Grid container spacing={0.75}>
                {EMOTIONS.map((e) => (
                  <Grid size={4} key={e.value}>
                    <Button fullWidth variant={selectedEmotion === e.value ? 'contained' : 'outlined'}
                      size="small" onClick={() => emotionMutation.mutate(e.value)}
                      sx={{ flexDirection: 'column', py: 0.75, borderRadius: 2, fontSize: 16,
                        borderColor: alpha(theme.palette.divider, 0.5),
                        minHeight: 52,
                      }}>
                      {e.emoji}
                      <Typography variant="caption" sx={{ mt: 0.25, fontSize: 9 }}>{e.label}</Typography>
                    </Button>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Tarefas de Hoje ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ pb: '16px !important' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Tarefas de Hoje</Typography>
                {tasks.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinearProgress variant="determinate" value={summary.progressPercent || 0}
                      sx={{ width: 100, height: 8, borderRadius: 4,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        '& .MuiLinearProgress-bar': { borderRadius: 4 } }} />
                    <Typography variant="caption" color="text.secondary">
                      {summary.progressPercent || 0}%
                    </Typography>
                  </Box>
                )}
              </Box>

              {tasks.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <School sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary" gutterBottom>Nenhuma tarefa para hoje.</Typography>
                  <Button variant="contained" component={Link} href="/plano" startIcon={<Add />} size="small">
                    Criar Plano de Estudos
                  </Button>
                </Box>
              ) : (
                <List disablePadding>
                  {[...pending, ...completed].map((task: any, idx: number) => {
                    const subjectColor = task.topic?.module?.subject?.color || '#F2B705';
                    const subjectName = task.topic?.module?.subject?.name;
                    const typeColor = TASK_TYPE_COLORS[task.type] || '#F2B705';

                    return (
                      <Box key={task.id}>
                        {idx > 0 && idx === pending.length && completed.length > 0 && (
                          <Divider sx={{ my: 1 }}>
                            <Typography variant="caption" color="text.secondary">Concluídas</Typography>
                          </Divider>
                        )}
                        <ListItem disablePadding sx={{ py: 0.75, opacity: task.isCompleted ? 0.6 : 1,
                          '&:hover .task-actions': { opacity: 1 } }}>
                          <IconButton size="small"
                            onClick={() => task.isCompleted
                              ? uncompleteMutation.mutate(task.id)
                              : completeMutation.mutate(task.id)}
                            sx={{ mr: 1, color: task.isCompleted ? 'success.main' : 'text.disabled' }}>
                            {task.isCompleted ? <CheckCircle /> : <RadioButtonUnchecked />}
                          </IconButton>

                          <ListItemAvatar sx={{ minWidth: 8 }}>
                            <Box sx={{ width: 4, height: 40, borderRadius: 2, bgcolor: subjectColor, mr: 1.5 }} />
                          </ListItemAvatar>

                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight={500}
                                sx={{ textDecoration: task.isCompleted ? 'line-through' : 'none' }}>
                                {task.title}
                              </Typography>
                            }
                            secondaryTypographyProps={{ component: 'div' }}
                            secondary={
                              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                                {subjectName && (
                                  <Chip label={subjectName} size="small"
                                    sx={{ height: 18, fontSize: 11, bgcolor: alpha(subjectColor, 0.1), color: subjectColor }} />
                                )}
                                <Chip label={TASK_TYPE_LABEL[task.type]} size="small"
                                  sx={{ height: 18, fontSize: 11, bgcolor: alpha(typeColor, 0.1), color: typeColor }} />
                                <Chip icon={<Timer sx={{ fontSize: '12px !important' }} />}
                                  label={`${task.estimatedMinutes}min`} size="small" sx={{ height: 18, fontSize: 11 }} />
                              </Box>
                            }
                          />

                          <IconButton size="small" className="task-actions"
                            component={Link} href="/foco"
                            sx={{ opacity: 0, transition: 'opacity 0.2s' }}>
                            <PlayArrow fontSize="small" />
                          </IconButton>
                        </ListItem>
                      </Box>
                    );
                  })}
                </List>
              )}

              {/* Frase motivacional */}
              <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.04),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Lightbulb sx={{ fontSize: 16, color: '#F59E0B', mt: 0.2, flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary" fontStyle="italic">
                    "{getFraseDoDia()}"
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
