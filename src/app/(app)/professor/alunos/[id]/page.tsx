'use client';

import {
  Box, Card, CardContent, Typography, Chip, alpha, useTheme, Grid,
  Avatar, CircularProgress, LinearProgress, Button, Paper, Divider,
} from '@mui/material';
import {
  ArrowBack, TrendingUp, TrendingDown, Psychology, Assignment,
  Lightbulb, Warning, CheckCircle,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import dayjs from 'dayjs';

const SCORE_COLOR = (s: number | null) =>
  !s ? '#9CA3AF' : s >= 700 ? '#22C55E' : s >= 500 ? '#F59E0B' : '#EF4444';

const C_LABELS = [
  { key: 'scoreC1', label: 'C1 — Norma culta' },
  { key: 'scoreC2', label: 'C2 — Proposta' },
  { key: 'scoreC3', label: 'C3 — Argumentação' },
  { key: 'scoreC4', label: 'C4 — Coesão' },
  { key: 'scoreC5', label: 'C5 — Intervenção' },
];

export default function StudentDetailPage() {
  const theme = useTheme();
  const router = useRouter();
  const { id: studentId } = useParams<{ id: string }>();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['student-stats', studentId],
    queryFn: () => teacherApi.getStudentStats(studentId).then(r => r.data.data),
  });

  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ['student-insights', studentId],
    queryFn: () => teacherApi.getStudentInsights(studentId).then(r => r.data.data),
  });

  const isLoading = loadingStats || loadingInsights;

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!stats) return null;

  const student = stats.student;
  const corrections: any[] = stats.corrections || [];
  const avg = corrections.length
    ? Math.round(corrections.reduce((s: number, c: any) => s + (c.totalScore || 0), 0) / corrections.length)
    : null;

  // Tendência: compara última vs penúltima nota
  const trend = corrections.length >= 2
    ? corrections[0].totalScore - corrections[1].totalScore
    : null;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/professor/alunos')} size="small">
          Voltar
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
          <Avatar src={student?.avatar} sx={{ width: 48, height: 48 }}>{student?.name?.[0]}</Avatar>
          <Box>
            <Typography variant="h5" fontWeight={700}>{student?.name}</Typography>
            <Typography color="text.secondary" variant="body2">{student?.email}</Typography>
          </Box>
        </Box>
        <Button variant="outlined" startIcon={<Assignment />}
          onClick={() => router.push(`/professor/redacoes?studentId=${studentId}`)}>
          Ver redações
        </Button>
      </Box>

      <Grid container spacing={2}>
        {/* Cards resumo */}
        <Grid size={12}>
          <Grid container spacing={2}>
            {[
              { label: 'Redações corrigidas', value: corrections.length, color: '#F2B705' },
              { label: 'Nota média', value: avg ? `${avg}/1000` : '—', color: SCORE_COLOR(avg) },
              { label: 'Última nota', value: corrections[0]?.totalScore ? `${corrections[0].totalScore}/1000` : '—', color: SCORE_COLOR(corrections[0]?.totalScore) },
              {
                label: 'Tendência',
                value: trend == null ? '—' : trend > 0 ? `+${trend}` : `${trend}`,
                color: trend == null ? '#9CA3AF' : trend > 0 ? '#22C55E' : '#EF4444',
              },
            ].map(s => (
              <Grid size={{ xs: 6, md: 3 }} key={s.label}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="h4" fontWeight={800} color={s.color}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    {s.label === 'Tendência' && trend != null && (
                      <Box sx={{ mt: 0.5 }}>
                        {trend > 0
                          ? <TrendingUp sx={{ color: '#22C55E', fontSize: 18 }} />
                          : <TrendingDown sx={{ color: '#EF4444', fontSize: 18 }} />}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Grid>

        {/* Médias por competência */}
        {stats.averages && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Psychology sx={{ color: '#F2B705' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Médias por Competência</Typography>
                </Box>
                {C_LABELS.map(({ key, label }) => {
                  const val: number | null = stats.averages?.[key];
                  const pct = val != null ? (val / 200) * 100 : 0;
                  const color = pct >= 70 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
                  return (
                    <Box key={key} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                        <Typography variant="body2">{label}</Typography>
                        <Typography variant="body2" fontWeight={700} color={color}>
                          {val != null ? `${Math.round(val)}/200` : '—'}
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct}
                        sx={{ height: 6, borderRadius: 3, bgcolor: alpha('#EF4444', 0.1),
                          '& .MuiLinearProgress-bar': { bgcolor: color } }} />
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Erros recorrentes */}
        {stats.recurringErrors?.length > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Warning sx={{ color: '#F59E0B' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Anotações recorrentes</Typography>
                </Box>
                {(stats.recurringErrors as any[]).map((e: any) => (
                  <Box key={e.type} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1,
                    p: 1, borderRadius: 1.5, bgcolor: alpha('#F59E0B', 0.04), border: `1px solid ${alpha('#F59E0B', 0.15)}` }}>
                    <Typography variant="body2">{e.type}</Typography>
                    <Chip label={`${e.count}x`} size="small"
                      sx={{ bgcolor: alpha('#F59E0B', 0.1), color: '#F59E0B', fontWeight: 700 }} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Insights da IA */}
        {insights?.insights?.length > 0 && (
          <Grid size={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Lightbulb sx={{ color: '#F59E0B' }} />
                  <Typography variant="subtitle1" fontWeight={700}>Insights do Aluno</Typography>
                </Box>
                <Grid container spacing={1.5}>
                  {(insights.insights as any[]).map((ins: any, i: number) => (
                    <Grid size={{ xs: 12, sm: 6 }} key={i}>
                      <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2,
                        border: `1px solid ${alpha(ins.type === 'positive' ? '#22C55E' : ins.type === 'warning' ? '#F59E0B' : '#3B82F6', 0.3)}`,
                        bgcolor: alpha(ins.type === 'positive' ? '#22C55E' : ins.type === 'warning' ? '#F59E0B' : '#3B82F6', 0.04) }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                          {ins.type === 'positive'
                            ? <CheckCircle sx={{ color: '#22C55E', fontSize: 18, mt: 0.25 }} />
                            : ins.type === 'warning'
                            ? <Warning sx={{ color: '#F59E0B', fontSize: 18, mt: 0.25 }} />
                            : <Lightbulb sx={{ color: '#3B82F6', fontSize: 18, mt: 0.25 }} />}
                          <Typography variant="body2">{ins.message}</Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Histórico de correções */}
        {corrections.length > 0 && (
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} mb={2}>Histórico de correções</Typography>
                <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
                  {corrections.map((c: any, i: number) => (
                    <Paper key={c.id} elevation={0} sx={{ p: 2, borderRadius: 2, minWidth: 150, flexShrink: 0,
                      border: `1px solid ${alpha(SCORE_COLOR(c.totalScore), 0.3)}`,
                      bgcolor: alpha(SCORE_COLOR(c.totalScore), 0.04),
                      cursor: 'pointer', '&:hover': { opacity: 0.75 } }}
                      onClick={() => router.push(`/professor/redacoes/${c.essayId}`)}>
                      <Typography variant="h4" fontWeight={900} color={SCORE_COLOR(c.totalScore)}>
                        {c.totalScore ?? '—'}
                      </Typography>
                      <Typography variant="caption" fontWeight={600} display="block" noWrap>{c.essay?.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(c.correctedAt).format('DD/MM/YY')}
                      </Typography>
                      {i > 0 && corrections[i - 1]?.totalScore && c.totalScore && (
                        <Box sx={{ mt: 0.5 }}>
                          {c.totalScore > corrections[i - 1].totalScore
                            ? <TrendingUp sx={{ fontSize: 14, color: '#22C55E' }} />
                            : <TrendingDown sx={{ fontSize: 14, color: '#EF4444' }} />}
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
