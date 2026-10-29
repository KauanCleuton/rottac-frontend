'use client';

import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Autocomplete, TextField, ToggleButtonGroup, ToggleButton,
  Skeleton, Alert, Breadcrumbs, Link as MuiLink, Tooltip, Chip, alpha, useTheme, CircularProgress,
} from '@mui/material';
import { Insights, PlayArrow, ChevronRight, LibraryAdd } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { questionBankApi, notebookApi } from '@/lib/api';
import AssuntoPicker from '@/components/questions/AssuntoPicker';

type Row = { id: number; name: string; path: string[]; count: number; share: number; answered: number; accuracy: number | null };
type Data = { root: { id: number; name: string; path: string[] } | null; total: number; general: number; ranking: Row[] };

// Acerto do aluno: cor + texto (nunca só cor)
function AccuracyTag({ row }: { row: Row }) {
  const theme = useTheme();
  if (row.accuracy === null) return <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>não treinou</Typography>;
  const c = row.accuracy >= 70 ? theme.palette.success.main : row.accuracy >= 50 ? theme.palette.warning.main : theme.palette.error.main;
  const label = row.accuracy >= 70 ? 'bom' : row.accuracy >= 50 ? 'atenção' : 'fraco';
  return (
    <Tooltip title={`Você acertou ${row.accuracy}% de ${row.answered} resposta(s) neste assunto`}>
      <Chip size="small" label={`${row.accuracy}% · ${label}`}
        sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: alpha(c, 0.12), color: c, border: `1px solid ${alpha(c, 0.35)}` }} />
    </Tooltip>
  );
}

export default function MaisCaiPage() {
  const theme = useTheme();
  const router = useRouter();
  const [banca, setBanca] = useState<string | null>(null);
  const [root, setRoot] = useState<number | null>(null);
  const [depth, setDepth] = useState(1);
  const [creating, setCreating] = useState<string | null>(null);

  const { data: filters } = useQuery({
    queryKey: ['question-bank-filters'],
    queryFn: () => questionBankApi.filters().then((r) => r.data.data),
  });
  const bancas: { value: string; count: number }[] = filters?.banca || [];

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['incidence', banca, root, depth],
    queryFn: () => questionBankApi.incidence({ banca: banca || undefined, root: root || undefined, depth }).then((r) => r.data.data as Data),
    placeholderData: (prev) => prev,
  });

  const max = useMemo(() => Math.max(1, ...(data?.ranking || []).map((r) => r.count)), [data]);
  const weak = (data?.ranking || []).filter((r) => r.accuracy !== null && r.accuracy < 60).slice(0, 3);

  const practice = async (ids: number[], name: string, key: string) => {
    setCreating(key);
    try {
      const r = await notebookApi.create({
        name: name.slice(0, 180),
        description: `Gerado em "O que mais cai"${banca ? ` · ${banca}` : ''}`,
        filters: { assuntos: ids.join(','), ...(banca ? { banca } : {}) },
        limit: 40,
        order: 'random',
      });
      toast.success(r.data.message);
      router.push(`/cadernos/${r.data.data.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao montar o caderno');
    } finally {
      setCreating(null);
    }
  };

  const scopeName = data?.root?.name || 'todas as matérias';
  const top10 = (data?.ranking || []).slice(0, 10);

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Insights sx={{ color: 'primary.main', fontSize: 32 }} /> O que mais cai
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Os assuntos mais cobrados pela banca, com o seu acerto em cada um. Estude primeiro o que cai muito e você ainda erra.
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1.4fr auto' }, alignItems: 'center' }}>
          <Autocomplete size="small" options={bancas} value={bancas.find((b) => b.value === banca) || null}
            getOptionLabel={(o) => `${o.value} (${o.count})`} isOptionEqualToValue={(a, b) => a.value === b.value}
            onChange={(_, o) => setBanca(o?.value || null)}
            renderInput={(p) => <TextField {...p} label="Banca" placeholder="Todas as bancas" />} />
          <AssuntoPicker value={root} onChange={(id) => setRoot(id)} label="Matéria ou assunto (opcional)" placeholder="Todas as matérias" />
          <ToggleButtonGroup size="small" exclusive value={depth} onChange={(_, v) => v && setDepth(v)}>
            <ToggleButton value={1}>Assuntos</ToggleButton>
            <ToggleButton value={2}>Subassuntos</ToggleButton>
          </ToggleButtonGroup>
        </CardContent>
      </Card>

      {data?.root && (
        <Breadcrumbs separator={<ChevronRight fontSize="small" />} sx={{ mb: 1.5 }}>
          <MuiLink component="button" underline="hover" color="inherit" onClick={() => setRoot(null)}>Todas as matérias</MuiLink>
          {data.root.path.slice(0, -1).map((name, i) => (
            <Typography key={i} color="text.secondary" variant="body2">{name}</Typography>
          ))}
          <Typography fontWeight={700} variant="body2">{data.root.name}</Typography>
        </Breadcrumbs>
      )}

      {isLoading ? (
        <Box>{[...Array(6)].map((_, i) => <Skeleton key={i} height={56} />)}</Box>
      ) : !data || data.total === 0 ? (
        <Alert severity="info">Ainda não há questões classificadas para esse filtro. Tente outra banca ou matéria.</Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              <strong>{data.total.toLocaleString('pt-BR')}</strong> questões de {banca || 'todas as bancas'} em <strong>{scopeName}</strong>
              {data.general > 0 && ` · ${data.general} classificadas só na matéria (sem assunto específico)`}
              {isFetching && <CircularProgress size={12} sx={{ ml: 1 }} />}
            </Typography>
            <Button variant="contained" startIcon={creating === 'top' ? <CircularProgress size={16} color="inherit" /> : <LibraryAdd />}
              disabled={!top10.length || Boolean(creating)}
              onClick={() => practice(top10.map((r) => r.id), `Mais cobrados — ${banca || 'todas as bancas'} — ${scopeName}`, 'top')}>
              Caderno com os {top10.length} mais cobrados
            </Button>
          </Box>

          {weak.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Prioridade: <strong>{weak.map((w) => w.name).join(', ')}</strong> — caem bastante e seu acerto está abaixo de 60%.
            </Alert>
          )}

          <Card>
            <CardContent sx={{ p: { xs: 1, sm: 2 }, '&:last-child': { pb: { xs: 1, sm: 2 } } }}>
              {data.ranking.map((r, i) => {
                const canDrill = depth === 1;
                return (
                  <Box key={r.id} sx={{
                    display: 'grid', gridTemplateColumns: { xs: '28px 1fr auto', sm: '32px minmax(0, 1fr) 110px auto' }, gap: { xs: 1, sm: 2 },
                    alignItems: 'center', py: 1.25, px: 1, borderRadius: 2,
                    borderBottom: i < data.ranking.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}>
                    <Typography fontWeight={800} color="text.secondary" sx={{ textAlign: 'right' }}>{i + 1}º</Typography>
                    <Box sx={{ minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                        {canDrill ? (
                          <MuiLink component="button" underline="hover" color="inherit" onClick={() => setRoot(r.id)}
                            sx={{ fontWeight: 700, textAlign: 'left', fontSize: 15 }} title="Ver os assuntos dentro deste">
                            {r.name}
                          </MuiLink>
                        ) : <Typography fontWeight={700}>{r.name}</Typography>}
                        <Typography variant="caption" color="text.secondary">{r.count} questões · {r.share.toLocaleString('pt-BR')}%</Typography>
                      </Box>
                      {depth > 1 && r.path.length > 2 && (
                        <Typography variant="caption" color="text.disabled" noWrap sx={{ display: 'block' }}>{r.path.slice(1, -1).join(' › ')}</Typography>
                      )}
                      <Box sx={{ mt: 0.75, height: 6, borderRadius: 3, bgcolor: alpha(theme.palette.text.primary, 0.06), overflow: 'hidden' }}>
                        <Box sx={{ width: `${(r.count / max) * 100}%`, height: '100%', borderRadius: 3, bgcolor: 'primary.main' }} />
                      </Box>
                    </Box>
                    <Box sx={{ display: { xs: 'none', sm: 'flex' }, justifyContent: 'flex-end' }}><AccuracyTag row={r} /></Box>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <Box sx={{ display: { xs: 'block', sm: 'none' } }}><AccuracyTag row={r} /></Box>
                      <Tooltip title="Montar um caderno com questões deste assunto">
                        <span>
                          <Button size="small" variant="outlined" disabled={Boolean(creating)} onClick={() => practice([r.id], `${r.name}${banca ? ` — ${banca}` : ''}`, String(r.id))}
                            startIcon={creating === String(r.id) ? <CircularProgress size={14} /> : <PlayArrow />}
                            sx={{ minWidth: 0, px: { xs: 1, sm: 1.5 } }}>
                            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Praticar</Box>
                          </Button>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
}
