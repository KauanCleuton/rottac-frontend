'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Alert, CircularProgress, Divider, Chip, Skeleton, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { WorkspacePremium, LocalOffer, CheckCircle } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { billingApi } from '@/lib/api';
import { formatBRL, PERIOD_LABEL } from '@/lib/format';
import { useEntitlements } from '@/hooks/useEntitlements';
import PlanCards, { type PublicPlan, type FeatureDef } from '@/components/billing/PlanCards';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const ORDER_STATUS: Record<string, { label: string; color: 'success' | 'warning' | 'default' | 'error' }> = {
  PAID: { label: 'Pago', color: 'success' },
  PENDING: { label: 'Aguardando pagamento', color: 'warning' },
  CANCELED: { label: 'Cancelado', color: 'default' },
  REFUNDED: { label: 'Estornado', color: 'error' },
};

type Quote = {
  originalCents: number; discountCents: number; finalCents: number;
  promotion: { name: string; badge?: string; discountCents: number } | null;
  coupon: { code: string; discountCents: number } | null;
};

function Checkout({ plan, onClose }: { plan: PublicPlan; onClose: () => void }) {
  const qc = useQueryClient();
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponError, setCouponError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ status: string; message: string } | null>(null);

  const applyCoupon = async () => {
    setCouponError('');
    try {
      const r = await billingApi.quote(plan.id, coupon || undefined);
      setQuote(r.data.data);
    } catch (e: any) {
      setQuote(null);
      setCouponError(e.response?.data?.message || 'Cupom inválido');
    }
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const r = await billingApi.checkout(plan.id, quote?.coupon ? coupon : undefined);
      setResult({ status: r.data.data.status, message: r.data.message });
      qc.invalidateQueries({ queryKey: ['billing'] });
      if (r.data.data.status === 'PAID') toast.success(r.data.message);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Não foi possível concluir');
    } finally {
      setBusy(false);
    }
  };

  const original = quote?.originalCents ?? plan.priceCents;
  const final = quote?.finalCents ?? plan.finalCents;
  const promoDiscount = quote?.promotion?.discountCents ?? plan.priceCents - plan.finalCents;

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Assinar {plan.name}</DialogTitle>
      <DialogContent>
        {result ? (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircle sx={{ fontSize: 56, color: result.status === 'PAID' ? '#22C55E' : 'warning.main' }} />
            <Typography variant="h6" sx={{ mt: 1 }}>{result.status === 'PAID' ? 'Plano ativado!' : 'Pedido registrado'}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>{result.message}</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography color="text.secondary">Plano {plan.name}</Typography>
              <Typography>{formatBRL(original)}</Typography>
            </Box>
            {promoDiscount > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: '#22C55E' }}>
                <Typography>{plan.promotion?.badge || plan.promotion?.name || 'Promoção'}</Typography>
                <Typography>− {formatBRL(promoDiscount)}</Typography>
              </Box>
            )}
            {quote?.coupon && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, color: '#22C55E' }}>
                <Typography>Cupom {quote.coupon.code}</Typography>
                <Typography>− {formatBRL(quote.coupon.discountCents)}</Typography>
              </Box>
            )}
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Typography fontWeight={800}>Total</Typography>
              <Typography sx={{ fontSize: 26, fontWeight: 900 }}>
                {final === 0 ? 'Grátis' : formatBRL(final)}
                {final > 0 && <Typography component="span" color="text.secondary" sx={{ fontSize: 14, ml: 0.5 }}>{PERIOD_LABEL[plan.billingPeriod]}</Typography>}
              </Typography>
            </Box>

            {plan.priceCents > 0 && (
              <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
                <TextField size="small" fullWidth label="Cupom de desconto" value={coupon}
                  onChange={(e) => { setCoupon(e.target.value.toUpperCase()); setCouponError(''); }}
                  error={Boolean(couponError)} helperText={couponError || ' '}
                  onKeyDown={(e) => { if (e.key === 'Enter' && coupon) applyCoupon(); }} />
                <Button variant="outlined" startIcon={<LocalOffer />} onClick={applyCoupon} disabled={!coupon} sx={{ height: 40 }}>Aplicar</Button>
              </Box>
            )}
            {final > 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                O pagamento online ainda não está disponível. Seu pedido fica registrado e o plano é ativado assim que o pagamento for confirmado pela equipe.
              </Alert>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {result ? (
          <Button variant="contained" onClick={onClose}>Fechar</Button>
        ) : (
          <>
            <Button color="inherit" onClick={onClose} disabled={busy}>Cancelar</Button>
            <Button variant="contained" onClick={confirm} disabled={busy}>
              {busy ? <CircularProgress size={18} color="inherit" /> : final === 0 ? 'Ativar plano' : 'Confirmar pedido'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function PlanosContent() {
  const qc = useQueryClient();
  const preselected = useSearchParams().get('plano');
  const { ent, isLoading: entLoading } = useEntitlements();
  const [selected, setSelected] = useState<PublicPlan | null>(null);
  const [autoOpened, setAutoOpened] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['billing', 'public-plans'],
    queryFn: () => billingApi.plans().then((r) => r.data.data as { plans: PublicPlan[]; features: FeatureDef[]; freeAccessForAll: boolean; freeAccessMessage?: string }),
  });

  // Veio da página de apresentação com um plano escolhido: abre o checkout direto
  if (!autoOpened && preselected && data && ent) {
    const p = data.plans.find((x) => x.id === preselected);
    setAutoOpened(true);
    if (p && p.id !== ent.plan?.id) setSelected(p);
  }

  const cancelSub = async () => {
    try {
      const r = await billingApi.cancel();
      toast.success(r.data.message);
      qc.invalidateQueries({ queryKey: ['billing'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao cancelar');
    } finally {
      setConfirmCancel(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WorkspacePremium sx={{ color: 'primary.main', fontSize: 32 }} /> Planos
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Escolha o plano que acompanha o seu ritmo de estudo.</Typography>

      {ent?.freeAccessForAll && <Alert severity="success" sx={{ mb: 3 }}>{ent.freeAccessMessage || 'Todos os recursos estão liberados no momento.'}</Alert>}

      {entLoading ? <Skeleton variant="rounded" height={90} sx={{ mb: 3 }} /> : ent?.plan && (
        <Card sx={{ mb: 4 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="overline" color="text.secondary">Seu plano</Typography>
              <Typography variant="h5" sx={{ fontWeight: 900 }}>{ent.plan.name}</Typography>
              {ent.subscription?.expiresAt && (
                <Typography variant="body2" color="text.secondary">Válido até {dayjs(ent.subscription.expiresAt).format('DD/MM/YYYY')}</Typography>
              )}
            </Box>
            {ent.subscription && (
              <Button color="inherit" onClick={() => setConfirmCancel(true)} sx={{ color: 'text.secondary' }}>Cancelar assinatura</Button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading || !data ? (
        <Skeleton variant="rounded" height={560} />
      ) : (
        <PlanCards plans={data.plans} features={data.features} freeAccessForAll={data.freeAccessForAll}
          currentPlanId={ent?.plan?.id} onSelect={setSelected}
          ctaLabel={(p) => (p.finalCents === 0 ? `Mudar para ${p.name}` : `Assinar ${p.name}`)} />
      )}

      {ent?.orders?.length ? (
        <Card sx={{ mt: 5 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>Meus pedidos</Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Data</TableCell><TableCell>Plano</TableCell><TableCell>Cupom</TableCell><TableCell align="right">Valor</TableCell><TableCell>Situação</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {ent.orders.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell>{dayjs(o.createdAt).format('DD/MM/YYYY')}</TableCell>
                      <TableCell>{o.plan?.name}</TableCell>
                      <TableCell>{o.coupon?.code || '—'}</TableCell>
                      <TableCell align="right">{o.finalCents === 0 ? 'Grátis' : formatBRL(o.finalCents)}</TableCell>
                      <TableCell><Chip size="small" label={ORDER_STATUS[o.status]?.label} color={ORDER_STATUS[o.status]?.color} variant="outlined" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      {selected && <Checkout plan={selected} onClose={() => setSelected(null)} />}
      <ConfirmDialog open={confirmCancel} title="Cancelar assinatura?" danger
        message="Você volta para o plano gratuito agora. Pode assinar de novo quando quiser."
        confirmLabel="Cancelar assinatura" onConfirm={cancelSub} onClose={() => setConfirmCancel(false)} />
    </Box>
  );
}

export default function PlanosPage() {
  return (
    <Suspense fallback={null}>
      <PlanosContent />
    </Suspense>
  );
}
