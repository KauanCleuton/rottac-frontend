'use client';

import { Box, Card, CardContent, Typography, Button, Chip, Divider, alpha, useTheme } from '@mui/material';
import { Check, Close, WorkspacePremium } from '@mui/icons-material';
import { formatBRL, PERIOD_LABEL, featureValue } from '@/lib/format';

export type PublicPlan = {
  id: string; slug: string; name: string; tagline?: string | null; description?: string | null;
  priceCents: number; finalCents: number; billingPeriod: string; color: string; highlight: boolean; isDefault: boolean;
  promotion: { name: string; badge?: string | null; endsAt?: string | null } | null;
  features: Record<string, boolean | number | null>;
};
export type FeatureDef = { key: string; type: 'bool' | 'limit'; label: string; group: string };

export default function PlanCards({ plans, features, freeAccessForAll, currentPlanId, onSelect, ctaLabel }: {
  plans: PublicPlan[];
  features: FeatureDef[];
  freeAccessForAll?: boolean;
  currentPlanId?: string | null;
  onSelect: (plan: PublicPlan) => void;
  ctaLabel?: (plan: PublicPlan) => string;
}) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;

  return (
    <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(plans.length, 3)}, 1fr)` }, alignItems: 'stretch' }}>
      {plans.map((p) => {
        const isCurrent = currentPlanId === p.id;
        const hasDiscount = p.finalCents < p.priceCents;
        const accent = p.highlight ? gold : p.color === '#0A0A0B' ? '#F5F5F4' : p.color;
        return (
          <Card key={p.id} sx={{
            position: 'relative', overflow: 'visible', display: 'flex', flexDirection: 'column',
            borderColor: p.highlight ? alpha(gold, 0.8) : undefined, borderWidth: p.highlight ? 2 : 1,
            transform: { md: p.highlight ? 'translateY(-8px)' : 'none' },
            boxShadow: p.highlight ? `0 24px 60px ${alpha(gold, 0.18)}` : undefined,
          }}>
            {p.highlight && (
              <Chip label="Mais escolhido" color="primary" size="small"
                sx={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', fontWeight: 800 }} />
            )}
            <CardContent sx={{ p: 3.5, display: 'flex', flexDirection: 'column', flex: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {p.slug === 'rottapapiro' && <WorkspacePremium sx={{ color: gold }} />}
                <Typography variant="h5" sx={{ fontWeight: 900, color: p.highlight ? gold : 'text.primary' }}>{p.name}</Typography>
                {isCurrent && <Chip label="Seu plano" size="small" variant="outlined" sx={{ ml: 'auto' }} />}
              </Box>
              {p.tagline && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{p.tagline}</Typography>}

              <Box sx={{ my: 3 }}>
                {p.promotion && hasDiscount && (
                  <Chip size="small" label={p.promotion.badge || p.promotion.name} sx={{ mb: 1, bgcolor: alpha('#22C55E', 0.15), color: '#22C55E', fontWeight: 700 }} />
                )}
                {hasDiscount && (
                  <Typography sx={{ textDecoration: 'line-through', color: 'text.secondary', fontSize: 15 }}>{formatBRL(p.priceCents)}</Typography>
                )}
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography sx={{ fontSize: 42, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    {p.finalCents === 0 ? 'Grátis' : formatBRL(p.finalCents)}
                  </Typography>
                  {p.finalCents > 0 && <Typography color="text.secondary">{PERIOD_LABEL[p.billingPeriod]}</Typography>}
                </Box>
                {freeAccessForAll && p.finalCents === 0 && !p.isDefault && (
                  <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 600 }}>Liberado no período de lançamento</Typography>
                )}
              </Box>

              {p.description && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{p.description}</Typography>}
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.1, mb: 3, flex: 1 }}>
                {features.map((f) => {
                  const v = featureValue(f.type, p.features[f.key]);
                  const on = f.type === 'bool' ? v === true : v !== '0';
                  return (
                    <Box key={f.key} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start', opacity: on ? 1 : 0.45 }}>
                      {on ? <Check sx={{ fontSize: 18, color: accent, mt: 0.2 }} /> : <Close sx={{ fontSize: 18, mt: 0.2 }} />}
                      <Typography variant="body2">
                        {f.label}
                        {f.type === 'limit' && <strong>: {v === 'Ilimitado' ? 'ilimitado' : v}</strong>}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              <Button fullWidth size="large" variant={p.highlight ? 'contained' : 'outlined'} disabled={isCurrent}
                onClick={() => onSelect(p)} sx={{ py: 1.4, fontWeight: 800 }}>
                {isCurrent ? 'Plano atual' : ctaLabel ? ctaLabel(p) : p.finalCents === 0 ? 'Começar grátis' : 'Assinar'}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
}
