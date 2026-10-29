'use client';

import {
  Box, Card, CardContent, Typography, Grid, Skeleton, Alert, Chip, Button, Table, TableBody, TableCell,
  TableHead, TableRow, LinearProgress, useTheme,
} from '@mui/material';
import { Insights, Group, PointOfSale, Sell, LockOpen, ArrowForward } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { adminApi } from '@/lib/api';
import { formatBRL } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
        <Typography sx={{ fontSize: 30, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.02em' }}>{value}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </CardContent>
    </Card>
  );
}

// Série diária única: barras de uma cor só, com dica no hover (título nomeia a série)
function DailyBars({ title, data, unit }: { title: string; data: { day: string; total: number }[]; unit: string }) {
  const theme = useTheme();
  const total = data.reduce((s, d) => s + d.total, 0);
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">{total} nos últimos 30 dias</Typography>
        </Box>
        <Box sx={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="day" tickFormatter={(d) => dayjs(d).format('DD/MM')} interval={6}
                tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: theme.palette.action.hover }}
                contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8, color: theme.palette.text.primary }}
                labelFormatter={(d) => dayjs(String(d)).format('DD/MM/YYYY')}
                formatter={(v) => [`${v} ${unit}`, '']}
                separator=""
              />
              <Bar dataKey="total" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => adminApi.overview().then((r) => r.data.data),
    enabled: isAdmin,
  });

  if (!isAdmin) return <Alert severity="warning">Área exclusiva para administradores.</Alert>;
  if (isLoading || !data) {
    return (
      <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
        <Skeleton height={60} />
        <Grid container spacing={2}>{[0, 1, 2, 3].map((i) => <Grid key={i} size={{ xs: 6, md: 3 }}><Skeleton variant="rounded" height={110} /></Grid>)}</Grid>
      </Box>
    );
  }

  const planTotal = data.plans.reduce((s: number, p: any) => s + p.users, 0) || 1;

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Insights sx={{ color: 'primary.main', fontSize: 32 }} /> Painel Geral
          </Typography>
          <Typography color="text.secondary">Alunos, vendas e uso da plataforma em tempo real.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<Group />} component={Link} href="/admin/alunos">Alunos</Button>
        <Button variant="outlined" startIcon={<PointOfSale />} component={Link} href="/admin/vendas">Vendas</Button>
        <Button variant="contained" startIcon={<Sell />} component={Link} href="/admin/planos">Planos e cupons</Button>
      </Box>

      {data.freeAccessForAll && (
        <Alert severity="success" icon={<LockOpen />} sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" component={Link} href="/admin/planos?aba=config">Alterar</Button>}>
          <strong>Tudo liberado:</strong> todos os alunos têm acesso a todos os recursos, independentemente do plano.
        </Alert>
      )}
      {data.pendingOrders > 0 && (
        <Alert severity="warning" sx={{ mb: 3 }}
          action={<Button color="inherit" size="small" component={Link} href="/admin/vendas?status=PENDING">Ver pedidos</Button>}>
          {data.pendingOrders} pedido(s) aguardando confirmação de pagamento.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, md: 3 }}><Kpi label="Usuários" value={data.users} hint={`${data.new7} novos em 7 dias · ${data.new30} em 30`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Kpi label="Alunos ativos (7 dias)" value={data.activeStudents7} hint={`de ${data.students} alunos`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Kpi label="Receita (30 dias)" value={formatBRL(data.revenue.last30Cents)} hint={`${data.revenue.last30Orders} vendas · total ${formatBRL(data.revenue.allCents)}`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><Kpi label="Questões resolvidas hoje" value={data.answers.today} hint={`${data.answers.last7} em 7 dias · ${data.answers.last30} em 30`} /></Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, md: 6 }}><DailyBars title="Novos cadastros por dia" data={data.signupsDaily} unit="cadastros" /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><DailyBars title="Questões resolvidas por dia" data={data.answersDaily} unit="questões" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Alunos por plano</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {data.plans.map((p: any) => (
                  <Box key={p.id}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Typography fontWeight={700}>
                        {p.name} {p.isDefault && <Chip label="padrão" size="small" variant="outlined" sx={{ height: 18, fontSize: 10, ml: 0.5 }} />}
                      </Typography>
                      <Typography sx={{ fontWeight: 900, fontSize: 20 }}>{p.users}</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={(p.users / planTotal) * 100} sx={{ height: 8, mt: 0.5 }} />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="h6" sx={{ flex: 1 }}>Alunos que mais resolveram (30 dias)</Typography>
                <Button size="small" endIcon={<ArrowForward />} component={Link} href="/admin/alunos">Todos</Button>
              </Box>
              {data.topStudents.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 3 }}>Ainda não há questões resolvidas no período.</Typography>
              ) : (
                <Table size="small">
                  <TableHead><TableRow><TableCell>Aluno</TableCell><TableCell align="right">Questões</TableCell><TableCell align="right">Acerto</TableCell></TableRow></TableHead>
                  <TableBody>
                    {data.topStudents.map((s: any) => (
                      <TableRow key={s.id} hover component={Link} href={`/admin/alunos/${s.id}`} sx={{ textDecoration: 'none', cursor: 'pointer' }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{s.email}</Typography>
                        </TableCell>
                        <TableCell align="right">{s.total}</TableCell>
                        <TableCell align="right">{s.accuracy}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
