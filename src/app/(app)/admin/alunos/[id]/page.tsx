'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Grid, Chip, Button, Skeleton, Alert, Avatar, Table, TableBody, TableCell,
  TableHead, TableRow, LinearProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
  Switch, FormControlLabel, useTheme,
} from '@mui/material';
import { ArrowBack, CardGiftcard, Block } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { adminApi } from '@/lib/api';
import { formatBRL } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const SUB_STATUS: Record<string, string> = { ACTIVE: 'Ativa', CANCELED: 'Cancelada', EXPIRED: 'Expirada' };
const ORDER_STATUS: Record<string, string> = { PAID: 'Pago', PENDING: 'Pendente', CANCELED: 'Cancelado', REFUNDED: 'Estornado' };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider' }}>
      <Typography sx={{ fontSize: 22, fontWeight: 900 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}

export default function AdminAlunoPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const qc = useQueryClient();
  const me = useAuthStore((s) => s.user);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grant, setGrant] = useState({ planId: '', days: '30' });
  const [revokeOpen, setRevokeOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => adminApi.user(id).then((r) => r.data.data),
    enabled: me?.role === 'ADMIN',
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => adminApi.plans().then((r) => r.data.data.plans as any[]),
    enabled: me?.role === 'ADMIN',
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const doGrant = async () => {
    try {
      const r = await adminApi.grant(id, grant.planId, grant.days ? Number(grant.days) : null);
      toast.success(r.data.message);
      setGrantOpen(false);
      refresh();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Erro'); }
  };
  const doRevoke = async () => {
    try {
      const r = await adminApi.revoke(id);
      toast.success(r.data.message);
      refresh();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Erro'); }
    finally { setRevokeOpen(false); }
  };
  const updateUser = async (patch: any) => {
    try {
      await adminApi.updateUser(id, patch);
      toast.success('Usuário atualizado');
      refresh();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Erro'); }
  };

  if (me?.role !== 'ADMIN') return <Alert severity="warning">Área exclusiva para administradores.</Alert>;
  if (isLoading) return <Skeleton variant="rounded" height={400} />;
  if (error || !data) return <Alert severity="error">Usuário não encontrado.</Alert>;

  const { user, stats } = data;
  const activeSub = data.subscriptions.find((s: any) => s.status === 'ACTIVE');

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Button startIcon={<ArrowBack />} size="small" component={Link} href="/admin/alunos">Alunos</Button>

      <Card sx={{ mt: 1, mb: 2 }}>
        <CardContent sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar src={user.avatar} sx={{ width: 64, height: 64, fontSize: 26, bgcolor: 'primary.main', color: '#0A0A0B', fontWeight: 900 }}>{user.name?.[0]?.toUpperCase()}</Avatar>
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>{user.name}</Typography>
            <Typography color="text.secondary">{user.email}</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Chip size="small" color="primary" label={`Plano ${data.plan?.name || '—'}`} />
              {activeSub?.expiresAt && <Chip size="small" variant="outlined" label={`até ${dayjs(activeSub.expiresAt).format('DD/MM/YYYY')}`} />}
              {user.examName && <Chip size="small" variant="outlined" label={`Concurso: ${user.examName}`} />}
              <Chip size="small" variant="outlined" label={`Desde ${dayjs(user.createdAt).format('DD/MM/YYYY')}`} />
              {user.gamification && <Chip size="small" variant="outlined" label={`Nível ${user.gamification.level} · ${user.gamification.xp} XP · 🔥 ${user.gamification.streak}`} />}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button variant="contained" startIcon={<CardGiftcard />} onClick={() => { setGrant({ planId: plans.find((p) => !p.isDefault)?.id || '', days: '30' }); setGrantOpen(true); }}>
              Conceder plano
            </Button>
            {activeSub && <Button color="inherit" startIcon={<Block />} onClick={() => setRevokeOpen(true)}>Cancelar assinatura</Button>}
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Desempenho</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
                <Stat label="Questões resolvidas" value={stats.questions} />
                <Stat label="Aproveitamento" value={stats.accuracy === null ? '—' : `${stats.accuracy}%`} />
                <Stat label="Tempo médio" value={stats.avgTime ? `${Math.floor(stats.avgTime / 60)}:${String(stats.avgTime % 60).padStart(2, '0')}` : '—'} />
                <Stat label="Em revisão / dominadas" value={`${stats.inReview} / ${stats.mastered}`} />
                <Stat label="Cadernos" value={user._count.questionNotebooks} />
                <Stat label="Flashcards" value={user._count.flashcards} />
                <Stat label="Caderno de erros" value={user._count.errorNotebook} />
                <Stat label="Redações" value={user._count.essays} />
              </Box>
              <Typography variant="subtitle2" color="text.secondary">Questões por dia (últimos 30 dias)</Typography>
              <Box sx={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.daily} margin={{ top: 8, right: 4, left: -24, bottom: 0 }} barCategoryGap={2}>
                    <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="day" tickFormatter={(d) => dayjs(d).format('DD/MM')} interval={6} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: theme.palette.action.hover }}
                      contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8, color: theme.palette.text.primary }}
                      labelFormatter={(d) => dayjs(String(d)).format('DD/MM/YYYY')} formatter={(v) => [`${v} questões`, '']} separator="" />
                    <Bar dataKey="total" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Por disciplina</Typography>
              {stats.byDiscipline.length === 0 ? (
                <Typography color="text.secondary">Ainda não resolveu questões.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {stats.byDiscipline.map((d: any) => {
                    const c = d.accuracy >= 70 ? '#22C55E' : d.accuracy >= 40 ? '#F59E0B' : '#EF4444';
                    return (
                      <Box key={d.name}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2" fontWeight={600}>{d.name}</Typography>
                          <Typography variant="body2" color="text.secondary">{d.total} questões · <strong style={{ color: c }}>{d.accuracy}%</strong></Typography>
                        </Box>
                        <LinearProgress variant="determinate" value={d.accuracy} sx={{ height: 7, mt: 0.5, '& .MuiLinearProgress-bar': { bgcolor: c } }} />
                      </Box>
                    );
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Conta</Typography>
              <TextField select fullWidth size="small" label="Perfil" value={user.role} sx={{ my: 1 }}
                onChange={(e) => updateUser({ role: e.target.value })} disabled={user.id === me?.id}>
                <MenuItem value="STUDENT">Aluno</MenuItem>
                <MenuItem value="TEACHER">Professor</MenuItem>
                <MenuItem value="ADMIN">Admin</MenuItem>
              </TextField>
              <FormControlLabel control={<Switch checked={user.isActive} disabled={user.id === me?.id} onChange={(e) => updateUser({ isActive: e.target.checked })} />}
                label={user.isActive ? 'Conta ativa' : 'Conta desativada'} />
            </CardContent>
          </Card>

          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Assinaturas</Typography>
              {data.subscriptions.length === 0 ? (
                <Typography variant="body2" color="text.secondary">Nunca assinou: está no plano gratuito.</Typography>
              ) : data.subscriptions.map((s: any) => (
                <Box key={s.id} sx={{ py: 1, borderBottom: 1, borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight={700}>{s.plan.name}</Typography>
                    <Chip size="small" label={SUB_STATUS[s.status]} color={s.status === 'ACTIVE' ? 'success' : 'default'} variant="outlined" sx={{ height: 20 }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(s.startedAt).format('DD/MM/YYYY')} → {s.expiresAt ? dayjs(s.expiresAt).format('DD/MM/YYYY') : 'sem expiração'} · {s.source === 'ADMIN' ? 'concedido' : 'compra'}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Pedidos</Typography>
              {data.orders.length === 0 ? <Typography variant="body2" color="text.secondary">Nenhum pedido.</Typography> : (
                <Table size="small">
                  <TableHead><TableRow><TableCell>Data</TableCell><TableCell>Plano</TableCell><TableCell align="right">Valor</TableCell><TableCell>Situação</TableCell></TableRow></TableHead>
                  <TableBody>
                    {data.orders.map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell>{dayjs(o.createdAt).format('DD/MM')}</TableCell>
                        <TableCell>{o.plan.name}{o.coupon && <Typography variant="caption" display="block" color="text.secondary">{o.coupon.code}</Typography>}</TableCell>
                        <TableCell align="right">{formatBRL(o.finalCents)}</TableCell>
                        <TableCell>{ORDER_STATUS[o.status]}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={grantOpen} onClose={() => setGrantOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Conceder plano</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Cortesia, parceria ou pagamento recebido fora da plataforma. Substitui a assinatura atual.</Typography>
          <TextField select fullWidth label="Plano" value={grant.planId} onChange={(e) => setGrant((g) => ({ ...g, planId: e.target.value }))} sx={{ mb: 2 }}>
            {plans.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
          </TextField>
          <TextField fullWidth type="number" label="Duração em dias" value={grant.days} onChange={(e) => setGrant((g) => ({ ...g, days: e.target.value }))}
            helperText="Deixe em branco para usar o período do plano (vitalício = sem expiração)" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setGrantOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={doGrant} disabled={!grant.planId}>Conceder</Button>
        </DialogActions>
      </Dialog>
      <ConfirmDialog open={revokeOpen} danger title="Cancelar assinatura?" message="O aluno volta imediatamente para o plano gratuito."
        confirmLabel="Cancelar assinatura" onConfirm={doRevoke} onClose={() => setRevokeOpen(false)} />
    </Box>
  );
}
