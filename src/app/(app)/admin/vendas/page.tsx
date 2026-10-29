'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Tabs, Tab, Table, TableBody, TableCell, TableHead, TableRow, Chip,
  Button, Pagination, Skeleton, Alert, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { PointOfSale } from '@mui/icons-material';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { formatBRL } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const ORDER_STATUS: Record<string, { label: string; color: 'success' | 'warning' | 'default' | 'error' }> = {
  PAID: { label: 'Pago', color: 'success' },
  PENDING: { label: 'Pendente', color: 'warning' },
  CANCELED: { label: 'Cancelado', color: 'default' },
  REFUNDED: { label: 'Estornado', color: 'error' },
};
const SUB_STATUS: Record<string, { label: string; color: 'success' | 'default' | 'error' }> = {
  ACTIVE: { label: 'Ativa', color: 'success' },
  CANCELED: { label: 'Cancelada', color: 'default' },
  EXPIRED: { label: 'Expirada', color: 'error' },
};

function VendasContent() {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const sp = useSearchParams();
  const [tab, setTab] = useState<'pedidos' | 'assinaturas'>('pedidos');
  const [status, setStatus] = useState(sp.get('status') || '');
  const [subStatus, setSubStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ kind: 'paid' | 'cancel'; order: any } | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin', 'orders', status, page],
    queryFn: () => adminApi.orders({ page, ...(status && { status }) }).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    enabled: isAdmin && tab === 'pedidos',
  });
  const { data: subs = [], isLoading: subsLoading } = useQuery({
    queryKey: ['admin', 'subscriptions', subStatus],
    queryFn: () => adminApi.subscriptions({ ...(subStatus && { status: subStatus }) }).then((r) => r.data.data as any[]),
    enabled: isAdmin && tab === 'assinaturas',
  });

  const run = async () => {
    if (!action) return;
    setBusy(true);
    try {
      const r = action.kind === 'paid' ? await adminApi.markPaid(action.order.id) : await adminApi.cancelOrder(action.order.id);
      toast.success(r.data.message);
      qc.invalidateQueries({ queryKey: ['admin'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro');
    } finally {
      setBusy(false);
      setAction(null);
    }
  };

  if (!isAdmin) return <Alert severity="warning">Área exclusiva para administradores.</Alert>;

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PointOfSale sx={{ color: 'primary.main', fontSize: 32 }} /> Vendas e Assinaturas
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Quem comprou, quanto pagou, com qual cupom, e o status de cada assinatura.</Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Ainda não há gateway de pagamento integrado: pedidos com valor ficam <strong>pendentes</strong> até você confirmar o pagamento aqui.
      </Alert>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="pedidos" label="Pedidos" />
        <Tab value="assinaturas" label="Assinaturas" />
      </Tabs>

      {tab === 'pedidos' ? (
        <Card>
          <CardContent sx={{ pb: 1 }}>
            <ToggleButtonGroup size="small" exclusive value={status} onChange={(_, v) => { setStatus(v ?? ''); setPage(1); }} sx={{ mb: 2, flexWrap: 'wrap' }}>
              <ToggleButton value="">Todos</ToggleButton>
              <ToggleButton value="PENDING">Pendentes</ToggleButton>
              <ToggleButton value="PAID">Pagos</ToggleButton>
              <ToggleButton value="CANCELED">Cancelados</ToggleButton>
              <ToggleButton value="REFUNDED">Estornados</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell><TableCell>Aluno</TableCell><TableCell>Plano</TableCell><TableCell>Cupom</TableCell>
                    <TableCell align="right">Preço</TableCell><TableCell align="right">Desconto</TableCell><TableCell align="right">Total</TableCell>
                    <TableCell>Situação</TableCell><TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading ? [0, 1, 2].map((i) => <TableRow key={i}><TableCell colSpan={9}><Skeleton height={32} /></TableCell></TableRow>)
                    : orders?.orders.length === 0 ? (
                      <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Nenhum pedido.</TableCell></TableRow>
                    ) : orders?.orders.map((o: any) => (
                      <TableRow key={o.id} hover>
                        <TableCell>{dayjs(o.createdAt).format('DD/MM/YYYY HH:mm')}</TableCell>
                        <TableCell>
                          <Typography component={Link} href={`/admin/alunos/${o.user.id}`} variant="body2" fontWeight={700} sx={{ color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{o.user.name}</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">{o.user.email}</Typography>
                        </TableCell>
                        <TableCell>{o.plan.name}</TableCell>
                        <TableCell>{o.coupon?.code || '—'}</TableCell>
                        <TableCell align="right">{formatBRL(o.originalCents)}</TableCell>
                        <TableCell align="right">{o.discountCents ? `− ${formatBRL(o.discountCents)}` : '—'}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800 }}>{formatBRL(o.finalCents)}</TableCell>
                        <TableCell><Chip size="small" label={ORDER_STATUS[o.status].label} color={ORDER_STATUS[o.status].color} variant="outlined" /></TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          {o.status === 'PENDING' && <Button size="small" variant="contained" onClick={() => setAction({ kind: 'paid', order: o })}>Confirmar pagamento</Button>}
                          {(o.status === 'PENDING' || o.status === 'PAID') && (
                            <Button size="small" color="inherit" onClick={() => setAction({ kind: 'cancel', order: o })} sx={{ ml: 0.5 }}>
                              {o.status === 'PAID' ? 'Estornar' : 'Cancelar'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">{orders?.total ?? 0} pedidos</Typography>
              {(orders?.pages ?? 1) > 1 && <Pagination count={orders.pages} page={page} shape="rounded" color="primary" onChange={(_, p) => setPage(p)} />}
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <ToggleButtonGroup size="small" exclusive value={subStatus} onChange={(_, v) => setSubStatus(v ?? '')} sx={{ mb: 2 }}>
              <ToggleButton value="ACTIVE">Ativas</ToggleButton>
              <ToggleButton value="CANCELED">Canceladas</ToggleButton>
              <ToggleButton value="EXPIRED">Expiradas</ToggleButton>
              <ToggleButton value="">Todas</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" sx={{ minWidth: 760 }}>
                <TableHead>
                  <TableRow><TableCell>Aluno</TableCell><TableCell>Plano</TableCell><TableCell>Origem</TableCell><TableCell>Início</TableCell><TableCell>Expira</TableCell><TableCell>Situação</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {subsLoading ? <TableRow><TableCell colSpan={6}><Skeleton height={32} /></TableCell></TableRow>
                    : subs.length === 0 ? (
                      <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Nenhuma assinatura.</TableCell></TableRow>
                    ) : subs.map((s) => (
                      <TableRow key={s.id} hover component={Link} href={`/admin/alunos/${s.user.id}`} sx={{ textDecoration: 'none' }}>
                        <TableCell><Typography variant="body2" fontWeight={700}>{s.user.name}</Typography><Typography variant="caption" color="text.secondary">{s.user.email}</Typography></TableCell>
                        <TableCell>{s.plan.name}</TableCell>
                        <TableCell>{s.source === 'ADMIN' ? 'Concedido' : 'Compra'}</TableCell>
                        <TableCell>{dayjs(s.startedAt).format('DD/MM/YYYY')}</TableCell>
                        <TableCell>{s.expiresAt ? dayjs(s.expiresAt).format('DD/MM/YYYY') : 'Sem expiração'}</TableCell>
                        <TableCell><Chip size="small" label={SUB_STATUS[s.status].label} color={SUB_STATUS[s.status].color} variant="outlined" /></TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog open={Boolean(action)} loading={busy} danger={action?.kind === 'cancel'}
        title={action?.kind === 'paid' ? 'Confirmar pagamento?' : action?.order.status === 'PAID' ? 'Estornar pedido?' : 'Cancelar pedido?'}
        message={action?.kind === 'paid'
          ? `O plano ${action.order.plan.name} será ativado para ${action.order.user.name}.`
          : action?.order.status === 'PAID'
            ? 'O pedido será marcado como estornado e a assinatura ligada a ele será cancelada.'
            : 'O pedido pendente será cancelado.'}
        confirmLabel={action?.kind === 'paid' ? 'Confirmar' : 'Sim, continuar'} onConfirm={run} onClose={() => setAction(null)} />
    </Box>
  );
}

export default function AdminVendasPage() {
  return <Suspense fallback={null}><VendasContent /></Suspense>;
}
