'use client';
import {
  Box, Card, CardContent, Grid, Typography, CircularProgress,
  alpha, useTheme, Chip, Select, MenuItem, FormControl,
} from '@mui/material';
import {
  TrendingUp, School, Timer, CheckCircle, EmojiEvents,
  MenuBook, FlashOn, BarChart,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, gamificationApi } from '@/lib/api';
import {
  LineChart, Line, BarChart as ReBarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, RadarChart,
  PolarGrid, PolarAngleAxis, Radar, Tooltip,
} from 'recharts';
import { useState } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');
export default function AnalyticsPage() {
  const theme = useTheme();
  const [historyDays, setHistoryDays] = useState(30);

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsApi.getDashboard().then(r => r.data.data),
  });

  const { data: history = [], isLoading: histLoading } = useQuery({
    queryKey: ['study-history', historyDays],
    queryFn: () => analyticsApi.getStudyHistory(historyDays).then(r => r.data.data || []),
  });

  const { data: performance = [], isLoading: perfLoading } = useQuery({
    queryKey: ['subject-performance'],
    queryFn: () => analyticsApi.getSubjectPerformance().then(r => r.data.data || []),
  });

  const { data: consistency = [], isLoading: consLoading } = useQuery({
    queryKey: ['consistency'],
    queryFn: () => analyticsApi.getConsistency(12).then(r => r.data.data || []),
  });

  const { data: gami } = useQuery({
    queryKey: ['gamification'],
    queryFn: () => gamificationApi.getProfile().then(r => r.data.data),
    staleTime: 60000,
  });

  const isLoading = dashLoading || histLoading || perfLoading || consLoading;

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  // Formatar histórico
  const chartHistory = history.map((d: any) => ({
    date: dayjs(d.date).format('DD/MM'),
    minutos: d.minutes,
    horas: parseFloat((d.minutes / 60).toFixed(1)),
  }));

  // Radar de desempenho por disciplina
  const radarData = performance.slice(0, 8).map((s: any) => ({
    subject: s.name.length > 12 ? s.name.substring(0, 10) + '…' : s.name,
    progresso: s.progressPercent || 0,
    precisao: s.questionAccuracy || 0,
  }));

  // Barras de erros por disciplina
  const errorData = performance
    .filter((s: any) => s.totalErrors > 0)
    .sort((a: any, b: any) => b.totalErrors - a.totalErrors)
    .slice(0, 8)
    .map((s: any) => ({
      name: s.name.length > 12 ? s.name.substring(0, 10) + '…' : s.name,
      erros: s.totalErrors,
      resolvidos: s.totalErrors - s.unresolvedErrors,
      color: s.color,
    }));

  // KPIs
  const totalStudyHours = history.reduce((acc: number, d: any) => acc + d.minutes, 0) / 60;
  const daysStudied = history.filter((d: any) => d.minutes > 0).length;
  const avgPerDay = daysStudied > 0 ? (totalStudyHours / daysStudied).toFixed(1) : '0';
  const bestDay = history.reduce((best: any, d: any) => d.minutes > (best?.minutes || 0) ? d : best, null);
  const consistencyPct = history.length > 0 ? Math.round((daysStudied / history.length) * 100) : 0;

  const StatCard = ({ icon, label, value, sub, color }: any) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h4" fontWeight={800} color={color || 'primary'}>{value}</Typography>
            <Typography variant="body2" fontWeight={600}>{label}</Typography>
            {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
          </Box>
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(color || theme.palette.primary.main, 0.1) }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Analytics</Typography>
          <Typography color="text.secondary" variant="body2">Acompanhe seu desempenho e evolução</Typography>
        </Box>
      </Box>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<Timer color="primary" />} label="Horas Estudadas" value={`${totalStudyHours.toFixed(1)}h`}
            sub={`Nos últimos ${historyDays} dias`} color={theme.palette.primary.main} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<CheckCircle sx={{ color: '#22C55E' }} />} label="Dias Ativos" value={daysStudied}
            sub={`${consistencyPct}% de consistência`} color="#22C55E" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<TrendingUp sx={{ color: '#F59E0B' }} />} label="Média Diária" value={`${avgPerDay}h`}
            sub={`Dias que estudou`} color="#F59E0B" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<EmojiEvents sx={{ color: '#FF6B35' }} />} label="Melhor Streak" value={`${gami?.bestStreak || 0}d`}
            sub={`Atual: ${gami?.streak || 0} dias`} color="#FF6B35" />
        </Grid>
      </Grid>

      {/* Questões + Erros */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<BarChart sx={{ color: '#3B82F6' }} />} label="Questões (mês)" value={dashboard?.questions?.total || 0}
            sub={`${dashboard?.questions?.accuracy || 0}% de acerto`} color="#3B82F6" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<MenuBook sx={{ color: '#EF4444' }} />} label="Erros Pendentes" value={dashboard?.pendingErrors || 0}
            sub="Para revisar" color="#EF4444" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<FlashOn sx={{ color: '#D4A017' }} />} label="Flashcards Atrasados" value={dashboard?.flashcardsDue || 0}
            sub="Para revisar hoje" color="#D4A017" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard icon={<EmojiEvents color="primary" />} label="Nível" value={`Nível ${gami?.level || 1}`}
            sub={`${gami?.xp || 0} XP acumulados`} />
        </Grid>
      </Grid>

      {/* Gráfico de horas estudadas */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Horas Estudadas por Dia</Typography>
            <FormControl size="small">
              <Select value={historyDays} onChange={e => setHistoryDays(Number(e.target.value))}>
                <MenuItem value={7}>7 dias</MenuItem>
                <MenuItem value={14}>14 dias</MenuItem>
                <MenuItem value={30}>30 dias</MenuItem>
                <MenuItem value={60}>60 dias</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }}
                tickFormatter={(v, i) => i % Math.ceil(chartHistory.length / 8) === 0 ? v : ''}
                stroke={theme.palette.text.disabled} />
              <YAxis tick={{ fontSize: 11 }} stroke={theme.palette.text.disabled}
                tickFormatter={v => `${v}h`} />
              <Tooltip formatter={(v: any) => [`${v}h`, 'Horas']}
                contentStyle={{ borderRadius: 8, background: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}` }} />
              <Line type="monotone" dataKey="horas" stroke="#F2B705" strokeWidth={2.5}
                dot={false} activeDot={{ r: 6, fill: '#F2B705' }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Radar de desempenho */}
        {radarData.length > 2 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Radar de Disciplinas</Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke={alpha(theme.palette.divider, 0.5)} />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                    <Radar name="Progresso" dataKey="progresso" stroke="#F2B705" fill="#F2B705" fillOpacity={0.25} />
                    <Radar name="Precisão" dataKey="precisao" stroke="#FFD34D" fill="#FFD34D" fillOpacity={0.15} />
                    <Tooltip contentStyle={{ borderRadius: 8, background: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}` }} />
                  </RadarChart>
                </ResponsiveContainer>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 1 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <Box sx={{ width: 12, height: 3, borderRadius: 2, bgcolor: '#F2B705' }} />
                    <Typography variant="caption">Progresso (%)</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <Box sx={{ width: 12, height: 3, borderRadius: 2, bgcolor: '#FFD34D' }} />
                    <Typography variant="caption">Precisão questões (%)</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Erros por disciplina */}
        {errorData.length > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Erros por Disciplina</Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <ReBarChart data={errorData} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                    <XAxis type="number" tick={{ fontSize: 11 }} stroke={theme.palette.text.disabled} />
                    <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} stroke={theme.palette.text.disabled} />
                    <Tooltip contentStyle={{ borderRadius: 8, background: theme.palette.background.paper,
                      border: `1px solid ${theme.palette.divider}` }} />
                    <Bar dataKey="resolvidos" stackId="a" fill="#22C55E" name="Resolvidos" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="erros" stackId="a" fill="#EF4444" name="Pendentes" radius={[0, 4, 4, 0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Consistência semanal */}
      {consistency.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>Consistência Semanal (dias estudados)</Typography>
            <ResponsiveContainer width="100%" height={180}>
              <ReBarChart data={consistency.map((c: any) => ({
                semana: dayjs(c.week).format('DD/MM'),
                dias: c.daysStudied,
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
                <XAxis dataKey="semana" tick={{ fontSize: 11 }} stroke={theme.palette.text.disabled} />
                <YAxis domain={[0, 7]} tick={{ fontSize: 11 }} stroke={theme.palette.text.disabled} />
                <Tooltip contentStyle={{ borderRadius: 8, background: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}` }} />
                <Bar dataKey="dias" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={36} name="Dias estudados" />
              </ReBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
