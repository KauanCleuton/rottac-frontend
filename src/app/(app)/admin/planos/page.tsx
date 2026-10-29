'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Tabs, Tab, Button, Grid, Chip, Switch, FormControlLabel, TextField,
  MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableCell, TableHead,
  TableRow, IconButton, Tooltip, Alert, Skeleton, Divider, InputAdornment, Autocomplete,
} from '@mui/material';
import { Sell, Add, Edit, DeleteOutline, LockOpen, Star } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { formatBRL, PERIOD_NAME, PERIOD_LABEL } from '@/lib/format';
import { useAuthStore } from '@/store/auth.store';
import ConfirmDialog from '@/components/common/ConfirmDialog';

type Feature = { key: string; type: 'bool' | 'limit'; label: string; group: string };
const PLAN_COLORS = ['#9CA3AF', '#F2B705', '#0A0A0B', '#3B82F6', '#22C55E', '#A855F7', '#EF4444'];

// "49,90" <-> 4990
const centsToInput = (c: number) => (c / 100).toFixed(2).replace('.', ',');
const inputToCents = (s: string) => Math.round(parseFloat(String(s).replace(/\./g, '').replace(',', '.') || '0') * 100) || 0;
const dateInput = (d?: string | null) => (d ? dayjs(d).format('YYYY-MM-DDTHH:mm') : '');
const discountLabel = (type: string, value: number) => (type === 'PERCENT' ? `${value}%` : formatBRL(value));

// ─── Planos ──────────────────────────────────────────────────────────────────
function PlanDialog({ plan, features, onClose, onSaved }: { plan: any | null; features: Feature[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !plan?.id;
  const [v, setV] = useState(() => ({
    name: plan?.name || '', slug: plan?.slug || '', tagline: plan?.tagline || '', description: plan?.description || '',
    price: centsToInput(plan?.priceCents || 0), billingPeriod: plan?.billingPeriod || 'MONTHLY', color: plan?.color || '#F2B705',
    highlight: Boolean(plan?.highlight), isActive: plan?.isActive ?? true, isDefault: Boolean(plan?.isDefault), sortOrder: plan?.sortOrder ?? 0,
    features: { ...(plan?.features || Object.fromEntries(features.map((f) => [f.key, f.type === 'bool' ? false : null]))) } as Record<string, any>,
  }));
  const [saving, setSaving] = useState(false);
  const set = (k: string, val: any) => setV((p) => ({ ...p, [k]: val }));
  const setFeature = (k: string, val: any) => setV((p) => ({ ...p, features: { ...p.features, [k]: val } }));

  const save = async () => {
    setSaving(true);
    const payload = {
      name: v.name, slug: v.slug || v.name, tagline: v.tagline, description: v.description, priceCents: inputToCents(v.price),
      billingPeriod: v.billingPeriod, color: v.color, highlight: v.highlight, isActive: v.isActive, isDefault: v.isDefault,
      sortOrder: Number(v.sortOrder) || 0, features: v.features,
    };
    try {
      if (isNew) await adminApi.createPlan(payload); else await adminApi.updatePlan(plan.id, payload);
      toast.success(isNew ? 'Plano criado' : 'Plano atualizado');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar plano');
    } finally {
      setSaving(false);
    }
  };

  const groups = [...new Set(features.map((f) => f.group))];

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isNew ? 'Novo plano' : `Editar ${plan.name}`}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Nome" value={v.name} onChange={(e) => set('name', e.target.value)} /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Identificador (slug)" value={v.slug} onChange={(e) => set('slug', e.target.value)} helperText="Usado internamente, ex.: premium" /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth label="Frase curta" value={v.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Para quem estuda sério" /></Grid>
          <Grid size={{ xs: 12 }}><TextField fullWidth multiline minRows={2} label="Descrição" value={v.description} onChange={(e) => set('description', e.target.value)} /></Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField fullWidth label="Preço" value={v.price} onChange={(e) => set('price', e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }} helperText="0,00 = gratuito" />
          </Grid>
          <Grid size={{ xs: 6, sm: 4 }}>
            <TextField select fullWidth label="Cobrança" value={v.billingPeriod} onChange={(e) => set('billingPeriod', e.target.value)}>
              {Object.entries(PERIOD_NAME).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}><TextField fullWidth type="number" label="Ordem de exibição" value={v.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></Grid>
        </Grid>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">Cor:</Typography>
          {PLAN_COLORS.map((c) => (
            <Box key={c} role="button" tabIndex={0} aria-label={`Cor ${c}`} onClick={() => set('color', c)}
              onKeyDown={(e) => { if (e.key === 'Enter') set('color', c); }}
              sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, cursor: 'pointer', border: '1px solid', borderColor: 'divider',
                outline: v.color === c ? '2px solid' : 'none', outlineColor: 'text.primary', outlineOffset: 2 }} />
          ))}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
          <FormControlLabel control={<Switch checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label="À venda" />
          <FormControlLabel control={<Switch checked={v.highlight} onChange={(e) => set('highlight', e.target.checked)} />} label="Destacar (mais escolhido)" />
          <FormControlLabel control={<Switch checked={v.isDefault} onChange={(e) => set('isDefault', e.target.checked)} />} label="Plano padrão de quem não assinou" />
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant="h6" sx={{ mb: 1 }}>Recursos e limites</Typography>
        {groups.map((g) => (
          <Box key={g} sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.secondary">{g}</Typography>
            {features.filter((f) => f.group === g).map((f) => (
              <Box key={f.key} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="body2" sx={{ flex: 1 }}>{f.label}</Typography>
                {f.type === 'bool' ? (
                  <Switch checked={Boolean(v.features[f.key])} onChange={(e) => setFeature(f.key, e.target.checked)} inputProps={{ 'aria-label': f.label }} />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FormControlLabel sx={{ mr: 0 }} label={<Typography variant="body2">Ilimitado</Typography>}
                      control={<Switch checked={v.features[f.key] === null} onChange={(e) => setFeature(f.key, e.target.checked ? null : 10)} />} />
                    {v.features[f.key] !== null && (
                      <TextField size="small" type="number" value={v.features[f.key] ?? 0} sx={{ width: 100 }}
                        onChange={(e) => setFeature(f.key, Math.max(0, parseInt(e.target.value, 10) || 0))} />
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        ))}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={save} disabled={saving || !v.name.trim()}>Salvar plano</Button>
      </DialogActions>
    </Dialog>
  );
}

function PlansTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => adminApi.plans().then((r) => r.data.data) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] }).then(() => qc.invalidateQueries({ queryKey: ['billing'] }));

  const remove = async () => {
    try {
      const r = await adminApi.deletePlan(toDelete.id);
      toast.success(r.data.message);
      refresh();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Erro'); }
    finally { setToDelete(null); }
  };

  if (isLoading || !data) return <Skeleton variant="rounded" height={300} />;
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(null)}>Novo plano</Button>
      </Box>
      <Grid container spacing={2}>
        {data.plans.map((p: any) => {
          const on = data.features.filter((f: Feature) => f.type === 'bool' && p.features[f.key]).length;
          const totalBool = data.features.filter((f: Feature) => f.type === 'bool').length;
          return (
            <Grid key={p.id} size={{ xs: 12, md: 4 }}>
              <Card sx={{ height: '100%', opacity: p.isActive ? 1 : 0.6 }}>
                <Box sx={{ height: 5, bgcolor: p.color === '#0A0A0B' ? 'text.primary' : p.color }} />
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, flex: 1 }}>{p.name}</Typography>
                    <Tooltip title="Editar"><IconButton size="small" onClick={() => setEditing(p)} aria-label="Editar plano"><Edit fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Remover"><IconButton size="small" onClick={() => setToDelete(p)} aria-label="Remover plano"><DeleteOutline fontSize="small" /></IconButton></Tooltip>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', my: 1 }}>
                    {p.isDefault && <Chip size="small" label="Padrão" />}
                    {p.highlight && <Chip size="small" icon={<Star sx={{ fontSize: 14 }} />} label="Destaque" color="primary" />}
                    {!p.isActive && <Chip size="small" label="Fora de venda" variant="outlined" />}
                  </Box>
                  <Typography sx={{ fontSize: 30, fontWeight: 900 }}>
                    {p.priceCents === 0 ? 'Grátis' : formatBRL(p.priceCents)}
                    {p.priceCents > 0 && <Typography component="span" color="text.secondary" sx={{ ml: 0.5 }}>{PERIOD_LABEL[p.billingPeriod]}</Typography>}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">{PERIOD_NAME[p.billingPeriod]} · {p.activeSubscribers} assinante(s) ativo(s)</Typography>
                  <Typography variant="body2" sx={{ mt: 1.5 }}>
                    {on} de {totalBool} recursos · {p.features.questionsPerDay === null ? 'questões ilimitadas' : `${p.features.questionsPerDay} questões/dia`} · {p.features.notebooksMax === null ? 'cadernos ilimitados' : `${p.features.notebooksMax} cadernos`}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
      {editing !== undefined && <PlanDialog plan={editing} features={data.features} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} />}
      <ConfirmDialog open={Boolean(toDelete)} danger title={`Remover o plano ${toDelete?.name}?`}
        message="Se o plano já teve vendas ou assinaturas, ele é apenas tirado de venda para preservar o histórico."
        confirmLabel="Remover" onConfirm={remove} onClose={() => setToDelete(null)} />
    </>
  );
}

// ─── Cupons ──────────────────────────────────────────────────────────────────
function CouponDialog({ coupon, plans, onClose, onSaved }: { coupon: any | null; plans: any[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !coupon?.id;
  const [v, setV] = useState(() => ({
    code: coupon?.code || '', description: coupon?.description || '', discountType: coupon?.discountType || 'PERCENT',
    value: coupon ? (coupon.discountType === 'FIXED' ? centsToInput(coupon.value) : String(coupon.value)) : '10',
    maxUses: coupon?.maxUses ?? '', perUserLimit: coupon?.perUserLimit ?? 1, planIds: (coupon?.planIds as string[]) || [],
    validFrom: dateInput(coupon?.validFrom), validUntil: dateInput(coupon?.validUntil), isActive: coupon?.isActive ?? true,
  }));
  const set = (k: string, val: any) => setV((p) => ({ ...p, [k]: val }));
  const save = async () => {
    const payload = {
      ...v,
      value: v.discountType === 'FIXED' ? inputToCents(v.value) : parseInt(v.value, 10),
      maxUses: v.maxUses === '' ? null : Number(v.maxUses),
      validFrom: v.validFrom || null, validUntil: v.validUntil || null,
    };
    try {
      if (isNew) await adminApi.createCoupon(payload); else await adminApi.updateCoupon(coupon.id, payload);
      toast.success(isNew ? 'Cupom criado' : 'Cupom atualizado');
      onSaved();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Erro ao salvar cupom'); }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isNew ? 'Novo cupom' : `Editar ${coupon.code}`}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Código" value={v.code} onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))} placeholder="APROVADO10" /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Descrição (interna)" value={v.description} onChange={(e) => set('description', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select fullWidth label="Tipo" value={v.discountType} onChange={(e) => set('discountType', e.target.value)}>
              <MenuItem value="PERCENT">Percentual (%)</MenuItem>
              <MenuItem value="FIXED">Valor fixo (R$)</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField fullWidth label="Desconto" value={v.value} onChange={(e) => set('value', e.target.value)}
              InputProps={v.discountType === 'FIXED' ? { startAdornment: <InputAdornment position="start">R$</InputAdornment> } : { endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
          </Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Limite de usos" value={v.maxUses} onChange={(e) => set('maxUses', e.target.value)} helperText="Vazio = ilimitado" /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth type="number" label="Usos por aluno" value={v.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth type="datetime-local" label="Válido a partir de" value={v.validFrom} onChange={(e) => set('validFrom', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth type="datetime-local" label="Válido até" value={v.validUntil} onChange={(e) => set('validUntil', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid size={{ xs: 12 }}>
            <Autocomplete multiple options={plans.map((p) => p.id)} value={v.planIds} onChange={(_, val) => set('planIds', val)}
              getOptionLabel={(id) => plans.find((p) => p.id === id)?.name || id}
              renderInput={(params) => <TextField {...params} label="Vale só para estes planos" helperText="Vazio = todos os planos" />} />
          </Grid>
        </Grid>
        <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label="Ativo" />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={save} disabled={!v.code}>Salvar cupom</Button>
      </DialogActions>
    </Dialog>
  );
}

function CouponsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const { data: coupons = [], isLoading } = useQuery({ queryKey: ['admin', 'coupons'], queryFn: () => adminApi.coupons().then((r) => r.data.data as any[]) });
  const { data: plans } = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => adminApi.plans().then((r) => r.data.data) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] });
  const remove = async () => {
    try { const r = await adminApi.deleteCoupon(toDelete.id); toast.success(r.data.message); refresh(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Erro'); }
    finally { setToDelete(null); }
  };
  const now = dayjs();
  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(null)}>Novo cupom</Button>
      </Box>
      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 780 }}>
            <TableHead><TableRow><TableCell>Código</TableCell><TableCell>Desconto</TableCell><TableCell>Usos</TableCell><TableCell>Validade</TableCell><TableCell>Planos</TableCell><TableCell>Situação</TableCell><TableCell align="right">Ações</TableCell></TableRow></TableHead>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={7}><Skeleton height={32} /></TableCell></TableRow>
                : coupons.length === 0 ? <TableRow><TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Nenhum cupom criado.</TableCell></TableRow>
                  : coupons.map((c) => {
                    const expired = c.validUntil && dayjs(c.validUntil).isBefore(now);
                    const soldOut = c.maxUses !== null && c.usedCount >= c.maxUses;
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell><Typography fontWeight={800} sx={{ fontFamily: 'monospace' }}>{c.code}</Typography>{c.description && <Typography variant="caption" color="text.secondary">{c.description}</Typography>}</TableCell>
                        <TableCell>{discountLabel(c.discountType, c.value)}</TableCell>
                        <TableCell>{c.usedCount}{c.maxUses !== null ? ` / ${c.maxUses}` : ''}</TableCell>
                        <TableCell>{c.validUntil ? `até ${dayjs(c.validUntil).format('DD/MM/YYYY')}` : 'Sem prazo'}</TableCell>
                        <TableCell>{Array.isArray(c.planIds) && c.planIds.length ? c.planIds.map((id: string) => plans?.plans.find((p: any) => p.id === id)?.name).filter(Boolean).join(', ') : 'Todos'}</TableCell>
                        <TableCell>
                          <Chip size="small" variant="outlined"
                            label={!c.isActive ? 'Inativo' : expired ? 'Expirado' : soldOut ? 'Esgotado' : 'Ativo'}
                            color={c.isActive && !expired && !soldOut ? 'success' : 'default'} />
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton size="small" onClick={() => setEditing(c)} aria-label="Editar cupom"><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => setToDelete(c)} aria-label="Remover cupom"><DeleteOutline fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </Box>
      </Card>
      {editing !== undefined && plans && <CouponDialog coupon={editing} plans={plans.plans} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} />}
      <ConfirmDialog open={Boolean(toDelete)} danger title={`Remover o cupom ${toDelete?.code}?`}
        message="Se o cupom já foi usado, ele é apenas desativado para manter o histórico das vendas."
        confirmLabel="Remover" onConfirm={remove} onClose={() => setToDelete(null)} />
    </>
  );
}

// ─── Promoções ───────────────────────────────────────────────────────────────
function PromotionDialog({ promo, plans, onClose, onSaved }: { promo: any | null; plans: any[]; onClose: () => void; onSaved: () => void }) {
  const isNew = !promo?.id;
  const [v, setV] = useState(() => ({
    name: promo?.name || '', badge: promo?.badge || '', description: promo?.description || '', planId: promo?.planId || '',
    discountType: promo?.discountType || 'PERCENT',
    value: promo ? (promo.discountType === 'FIXED' ? centsToInput(promo.value) : String(promo.value)) : '20',
    startsAt: dateInput(promo?.startsAt) || dayjs().format('YYYY-MM-DDTHH:mm'), endsAt: dateInput(promo?.endsAt), isActive: promo?.isActive ?? true,
  }));
  const set = (k: string, val: any) => setV((p) => ({ ...p, [k]: val }));
  const save = async () => {
    const payload = { ...v, value: v.discountType === 'FIXED' ? inputToCents(v.value) : parseInt(v.value, 10), planId: v.planId || null, endsAt: v.endsAt || null };
    try {
      if (isNew) await adminApi.createPromotion(payload); else await adminApi.updatePromotion(promo.id, payload);
      toast.success(isNew ? 'Promoção criada' : 'Promoção atualizada');
      onSaved();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Erro ao salvar promoção'); }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isNew ? 'Nova promoção' : `Editar ${promo.name}`}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Nome" value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Black Friday" /></Grid>
          <Grid size={{ xs: 12, sm: 6 }}><TextField fullWidth label="Selo exibido no plano" value={v.badge} onChange={(e) => set('badge', e.target.value)} placeholder="-30% Black Friday" /></Grid>
          <Grid size={{ xs: 12 }}>
            <TextField select fullWidth label="Plano" value={v.planId} onChange={(e) => set('planId', e.target.value)}>
              <MenuItem value="">Todos os planos pagos</MenuItem>
              {plans.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField select fullWidth label="Tipo" value={v.discountType} onChange={(e) => set('discountType', e.target.value)}>
              <MenuItem value="PERCENT">Percentual (%)</MenuItem>
              <MenuItem value="FIXED">Valor fixo (R$)</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6 }}>
            <TextField fullWidth label="Desconto" value={v.value} onChange={(e) => set('value', e.target.value)}
              InputProps={v.discountType === 'FIXED' ? { startAdornment: <InputAdornment position="start">R$</InputAdornment> } : { endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
          </Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth type="datetime-local" label="Início" value={v.startsAt} onChange={(e) => set('startsAt', e.target.value)} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid size={{ xs: 6 }}><TextField fullWidth type="datetime-local" label="Fim" value={v.endsAt} onChange={(e) => set('endsAt', e.target.value)} InputLabelProps={{ shrink: true }} helperText="Vazio = sem prazo" /></Grid>
        </Grid>
        <FormControlLabel sx={{ mt: 1 }} control={<Switch checked={v.isActive} onChange={(e) => set('isActive', e.target.checked)} />} label="Ativa" />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={save} disabled={!v.name.trim()}>Salvar promoção</Button>
      </DialogActions>
    </Dialog>
  );
}

function PromotionsTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const { data: promos = [], isLoading } = useQuery({ queryKey: ['admin', 'promotions'], queryFn: () => adminApi.promotions().then((r) => r.data.data as any[]) });
  const { data: plans } = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => adminApi.plans().then((r) => r.data.data) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin', 'promotions'] }); qc.invalidateQueries({ queryKey: ['billing'] }); };
  const remove = async () => {
    try { const r = await adminApi.deletePromotion(toDelete.id); toast.success(r.data.message); refresh(); }
    catch (e: any) { toast.error(e.response?.data?.message || 'Erro'); }
    finally { setToDelete(null); }
  };
  const now = dayjs();
  return (
    <>
      <Alert severity="info" sx={{ mb: 2 }}>Promoções são aplicadas automaticamente no preço exibido. Cupons, quando usados, somam desconto em cima da promoção.</Alert>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<Add />} onClick={() => setEditing(null)}>Nova promoção</Button>
      </Box>
      <Card>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead><TableRow><TableCell>Promoção</TableCell><TableCell>Plano</TableCell><TableCell>Desconto</TableCell><TableCell>Período</TableCell><TableCell>Situação</TableCell><TableCell align="right">Ações</TableCell></TableRow></TableHead>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={6}><Skeleton height={32} /></TableCell></TableRow>
                : promos.length === 0 ? <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Nenhuma promoção criada.</TableCell></TableRow>
                  : promos.map((p) => {
                    const running = p.isActive && dayjs(p.startsAt).isBefore(now) && (!p.endsAt || dayjs(p.endsAt).isAfter(now));
                    const scheduled = p.isActive && dayjs(p.startsAt).isAfter(now);
                    return (
                      <TableRow key={p.id} hover>
                        <TableCell><Typography fontWeight={700}>{p.name}</Typography>{p.badge && <Typography variant="caption" color="text.secondary">Selo: {p.badge}</Typography>}</TableCell>
                        <TableCell>{p.plan?.name || 'Todos os pagos'}</TableCell>
                        <TableCell>{discountLabel(p.discountType, p.value)}</TableCell>
                        <TableCell>{dayjs(p.startsAt).format('DD/MM/YYYY')} → {p.endsAt ? dayjs(p.endsAt).format('DD/MM/YYYY') : 'sem prazo'}</TableCell>
                        <TableCell><Chip size="small" variant="outlined" label={running ? 'No ar' : scheduled ? 'Agendada' : 'Encerrada'} color={running ? 'success' : 'default'} /></TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton size="small" onClick={() => setEditing(p)} aria-label="Editar promoção"><Edit fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => setToDelete(p)} aria-label="Remover promoção"><DeleteOutline fontSize="small" /></IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
        </Box>
      </Card>
      {editing !== undefined && plans && <PromotionDialog promo={editing} plans={plans.plans} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); refresh(); }} />}
      <ConfirmDialog open={Boolean(toDelete)} danger title={`Remover a promoção ${toDelete?.name}?`} message="A promoção deixa de valer imediatamente."
        confirmLabel="Remover" onConfirm={remove} onClose={() => setToDelete(null)} />
    </>
  );
}

// ─── Configurações ───────────────────────────────────────────────────────────
function SettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi.settings().then((r) => r.data.data) });
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOff, setConfirmOff] = useState(false);

  const save = async (patch: any) => {
    try {
      await adminApi.updateSettings(patch);
      toast.success('Configurações salvas');
      qc.invalidateQueries({ queryKey: ['admin'] });
      qc.invalidateQueries({ queryKey: ['billing'] });
    } catch (e: any) { toast.error(e.response?.data?.message || 'Erro'); }
  };

  if (isLoading || !data) return <Skeleton variant="rounded" height={200} />;
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
          <LockOpen sx={{ color: data.freeAccessForAll ? '#22C55E' : 'text.disabled', mt: 0.5 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Liberar tudo para todos</Typography>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Ligado: todos os alunos usam todos os recursos, sem limites, independentemente do plano (ideal para o lançamento).
              Desligado: cada aluno passa a ter apenas o que o plano dele inclui.
            </Typography>
            <FormControlLabel control={<Switch checked={Boolean(data.freeAccessForAll)}
              onChange={(e) => (e.target.checked ? save({ freeAccessForAll: true }) : setConfirmOff(true))} />}
              label={data.freeAccessForAll ? 'Tudo liberado' : 'Limites dos planos ativos'} />
            <TextField fullWidth multiline label="Mensagem exibida aos alunos" sx={{ mt: 2 }}
              value={message ?? data.freeAccessMessage ?? ''} onChange={(e) => setMessage(e.target.value)} />
            <Button sx={{ mt: 1 }} variant="outlined" disabled={message === null} onClick={() => { save({ freeAccessMessage: message }); setMessage(null); }}>
              Salvar mensagem
            </Button>
          </Box>
        </Box>
      </CardContent>
      <ConfirmDialog open={confirmOff} title="Ativar os limites dos planos?"
        message="A partir de agora, cada aluno terá apenas os recursos do seu plano. Quem está no Free passa a ter os limites do Free."
        confirmLabel="Ativar limites" onConfirm={() => { setConfirmOff(false); save({ freeAccessForAll: false }); }} onClose={() => setConfirmOff(false)} />
    </Card>
  );
}

function PlanosAdminContent() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const initial = useSearchParams().get('aba');
  const [tab, setTab] = useState(initial === 'config' ? 'config' : initial === 'cupons' ? 'cupons' : initial === 'promocoes' ? 'promocoes' : 'planos');
  if (!isAdmin) return <Alert severity="warning">Área exclusiva para administradores.</Alert>;
  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Sell sx={{ color: 'primary.main', fontSize: 32 }} /> Planos, Cupons e Promoções
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Defina o que cada plano libera, quanto custa e as condições de desconto.</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }} variant="scrollable" allowScrollButtonsMobile>
        <Tab value="planos" label="Planos" />
        <Tab value="cupons" label="Cupons" />
        <Tab value="promocoes" label="Promoções" />
        <Tab value="config" label="Configurações" />
      </Tabs>
      {tab === 'planos' && <PlansTab />}
      {tab === 'cupons' && <CouponsTab />}
      {tab === 'promocoes' && <PromotionsTab />}
      {tab === 'config' && <SettingsTab />}
    </Box>
  );
}

export default function AdminPlanosPage() {
  return <Suspense fallback={null}><PlanosAdminContent /></Suspense>;
}
