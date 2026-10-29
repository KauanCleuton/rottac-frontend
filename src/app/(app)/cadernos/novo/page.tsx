'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Button, Chip, TextField, MenuItem, Slider, ToggleButtonGroup, ToggleButton,
  FormControlLabel, Switch, InputAdornment, Skeleton, Alert, CircularProgress, Divider, alpha, useTheme, Badge,
} from '@mui/material';
import {
  ArrowBack, AccountTree, Gavel, AccountBalance, CalendarMonth, Tune, Search, Close, PlayArrow, FilterAltOff,
  AutoAwesome,
} from '@mui/icons-material';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { questionBankApi, notebookApi } from '@/lib/api';
import AssuntoTree, { SEM_ASSUNTO } from '@/components/notebooks/AssuntoTree';
import { type TreeNode } from '@/components/notebooks/SubjectTree';
import { useAssuntos } from '@/hooks/useAssuntos';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { DIFFICULTY_LABEL, LEVEL_LABEL, TYPE_LABEL } from '@/components/questions/types';

type Facet = { value: string | number; count: number };
type Facets = { total: number; assuntoCounts: Record<number, number>; semAssunto: number; tree: TreeNode[]; banca: Facet[]; orgao: Facet[]; cargo: Facet[]; year: Facet[]; type: Facet[]; difficulty: Facet[]; level: Facet[] };
type Section = 'assuntos' | 'bancas' | 'orgaos' | 'anos' | 'preferencias';

const MAX_QUESTIONS = 300;
const STATUS_OPTIONS = [
  { v: '', l: 'Todas' },
  { v: 'nao_resolvidas', l: 'Nunca resolvi' },
  { v: 'errei', l: 'Que errei' },
  { v: 'resolvidas', l: 'Já resolvi' },
];

// Lista de opções em "chips" com busca e contagem ao vivo
function ChipFacet({ base, live, selected, onToggle, placeholder, format }: {
  base: Facet[]; live: Facet[]; selected: string[]; onToggle: (v: string) => void; placeholder: string;
  format?: (v: string | number) => string;
}) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const [q, setQ] = useState('');
  const liveMap = new Map(live.map((f) => [String(f.value), f.count]));
  const items = base.filter((f) => !q || String(f.value).toLowerCase().includes(q.toLowerCase()));
  return (
    <Box>
      {base.length > 8 && (
        <TextField fullWidth size="small" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} sx={{ mb: 1.5 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
      )}
      {base.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>Nenhuma opção cadastrada nas questões ainda.</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {items.map((f) => {
            const v = String(f.value);
            const on = selected.includes(v);
            const n = liveMap.get(v) ?? 0;
            return (
              <Chip key={v} clickable onClick={() => onToggle(v)} disabled={!n && !on}
                label={<Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {format ? format(f.value) : v}
                  <Box component="span" sx={{ fontSize: 11, fontWeight: 800, px: 0.75, borderRadius: 5, bgcolor: on ? alpha('#000', 0.15) : 'action.hover' }}>{n}</Box>
                </Box>}
                sx={{
                  height: 34, fontWeight: 600, borderRadius: 2,
                  border: '1px solid', borderColor: on ? gold : 'divider',
                  bgcolor: on ? gold : 'transparent', color: on ? '#0A0A0B' : 'text.primary',
                  '&:hover': { bgcolor: on ? gold : alpha(gold, 0.08) },
                  transition: 'all .15s',
                }} />
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function MontarContent() {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const router = useRouter();
  const sp = useSearchParams();

  // ── Seleções (pré-preenchidas quando vem do banco de questões)
  const split = (k: string) => (sp.get(k) || '').split('|').filter(Boolean);
  const [section, setSection] = useState<Section>('assuntos');
  const { tree: assuntoTree } = useAssuntos();
  const [assuntos, setAssuntos] = useState<number[]>(() => (sp.get('assuntos') || '').split(',').filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0));
  // Vindo do banco com ?discipline=Nome: marca a matéria correspondente quando a árvore carregar
  const [pendingDisciplines, setPendingDisciplines] = useState(split('discipline'));
  if (assuntoTree && pendingDisciplines.length) {
    const ids = assuntoTree.roots.filter((id) => pendingDisciplines.includes(assuntoTree.byId.get(id)!.name));
    setPendingDisciplines([]);
    if (ids.length) setAssuntos((cur) => [...new Set([...cur, ...ids])]);
  }
  const [bancas, setBancas] = useState<string[]>(split('banca'));
  const [orgaos, setOrgaos] = useState<string[]>(split('orgao'));
  const [cargos, setCargos] = useState<string[]>(split('cargo'));
  const [years, setYears] = useState<string[]>(split('year'));
  const [types, setTypes] = useState<string[]>(split('type'));
  const [diffs, setDiffs] = useState<string[]>(split('difficulty'));
  const [levels, setLevels] = useState<string[]>(split('level'));
  const [status, setStatus] = useState(sp.get('status') ?? 'nao_resolvidas');
  const [favorites, setFavorites] = useState(sp.get('favorites') === '1');
  const [hideAnnulled, setHideAnnulled] = useState(true);
  const [hideOutdated, setHideOutdated] = useState(true);

  // ── Caderno
  const [name, setName] = useState('');
  const [nameEdited, setNameEdited] = useState(false);
  const [qty, setQty] = useState(30);
  const [order, setOrder] = useState<'random' | 'recent'>('random');
  const [folderId, setFolderId] = useState(sp.get('pasta') || '');
  const [creating, setCreating] = useState(false);

  const params = useMemo(() => {
    const p: Record<string, string> = {};
    if (assuntos.length) p.assuntos = assuntos.join(',');
    if (bancas.length) p.banca = bancas.join('|');
    if (orgaos.length) p.orgao = orgaos.join('|');
    if (cargos.length) p.cargo = cargos.join('|');
    if (years.length) p.year = years.join('|');
    if (types.length) p.type = types.join('|');
    if (diffs.length) p.difficulty = diffs.join('|');
    if (levels.length) p.level = levels.join('|');
    if (status) p.status = status;
    if (favorites) p.favorites = '1';
    if (hideAnnulled) p.hideAnnulled = '1';
    if (hideOutdated) p.hideOutdated = '1';
    return p;
  }, [assuntos, bancas, orgaos, cargos, years, types, diffs, levels, status, favorites, hideAnnulled, hideOutdated]);

  // Contagens respondem às seleções com um pequeno atraso (evita uma chamada por clique)
  const [debounced, setDebounced] = useState(params);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(params), 250);
    return () => clearTimeout(t);
  }, [params]);

  // Estrutura estável (sem filtros) + contagens com os filtros atuais
  const { data: base, isLoading: baseLoading } = useQuery({
    queryKey: ['question-bank', 'facets', 'base'],
    queryFn: () => questionBankApi.facets().then((r) => r.data.data as Facets),
    staleTime: 60_000,
  });
  const { data: live, isFetching } = useQuery({
    queryKey: ['question-bank', 'facets', debounced],
    queryFn: () => questionBankApi.facets(debounced).then((r) => r.data.data as Facets),
    placeholderData: keepPreviousData,
  });
  const { data: folders = [] } = useQuery({
    queryKey: ['notebook-folders'],
    queryFn: () => notebookApi.folders().then((r) => r.data.data as any[]),
  });

  const total = live?.total ?? 0;
  const animatedTotal = useAnimatedNumber(total);
  const maxQty = Math.min(MAX_QUESTIONS, total);
  const effectiveQty = Math.min(qty, maxQty);

  // Acerto do aluno por matéria (mostrado na árvore)
  const accuracy = useMemo(() => Object.fromEntries((base?.tree || [])
    .filter((d) => d.discipline && d.mine).map((d) => [d.discipline as string, d.mine!.accuracy])), [base]);

  // ── Resumo da seleção: caminho de cada nó marcado
  const treeSummary = useMemo(() => assuntos.map((id) => {
    if (id === SEM_ASSUNTO || !assuntoTree) return { id, label: 'Sem classificação', short: 'Sem classificação' };
    const path = assuntoTree.pathOf(id).map((n) => n.name);
    return { id, label: path.length > 2 ? `${path[0]} › … › ${path[path.length - 1]}` : path.join(' › '), short: path.length > 1 ? `${path[0]} — ${path[path.length - 1]}` : path[0] };
  }), [assuntos, assuntoTree]);
  const suggestedName = useMemo(() => {
    if (!treeSummary.length) return bancas.length ? `Questões ${bancas.slice(0, 2).join(' e ')}` : `Caderno de ${new Date().toLocaleDateString('pt-BR')}`;
    const base = treeSummary[0].short || '';
    return (treeSummary.length > 1 ? `${base} + ${treeSummary.length - 1}` : base).slice(0, 120);
  }, [treeSummary, bancas]);
  const finalName = nameEdited ? name : suggestedName;

  const toggle = (list: string[], set: (v: string[]) => void) => (v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const clearAll = () => {
    setAssuntos([]); setBancas([]); setOrgaos([]); setCargos([]); setYears([]); setTypes([]); setDiffs([]); setLevels([]);
    setStatus(''); setFavorites(false);
  };

  const create = async () => {
    if (!effectiveQty) return;
    setCreating(true);
    try {
      const r = await notebookApi.create({ name: finalName.trim() || suggestedName, folderId: folderId || null, filters: params, limit: effectiveQty, order });
      toast.success(`Caderno criado com ${r.data.data.total} questões. Bons estudos!`);
      router.push(`/cadernos/${r.data.data.id}`);
    } catch (e: any) {
      if (e.response?.status !== 402) toast.error(e.response?.data?.message || 'Não foi possível criar o caderno');
      setCreating(false);
    }
  };

  // Últimos N anos disponíveis
  const allYears = (base?.year || []).map((y) => String(y.value));
  const lastYears = (n: number) => setYears(allYears.slice(0, n));

  const sectionCount: Record<Section, number> = {
    assuntos: assuntos.length,
    bancas: bancas.length,
    orgaos: orgaos.length + cargos.length,
    anos: years.length,
    preferencias: types.length + diffs.length + levels.length + (status ? 1 : 0) + (favorites ? 1 : 0),
  };
  const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
    { key: 'assuntos', label: 'Matérias e assuntos', icon: <AccountTree fontSize="small" /> },
    { key: 'bancas', label: 'Bancas', icon: <Gavel fontSize="small" /> },
    { key: 'orgaos', label: 'Órgãos e cargos', icon: <AccountBalance fontSize="small" /> },
    { key: 'anos', label: 'Anos', icon: <CalendarMonth fontSize="small" /> },
    { key: 'preferencias', label: 'Preferências', icon: <Tune fontSize="small" /> },
  ];

  // Chips do resumo (removíveis)
  const summaryChips: { group: string; label: string; onDelete: () => void }[] = [
    ...treeSummary.map(({ id, label }) => ({ group: 'Assuntos', label, onDelete: () => setAssuntos((l) => l.filter((x) => x !== id)) })),
    ...bancas.map((b) => ({ group: 'Bancas', label: b, onDelete: () => setBancas((l) => l.filter((x) => x !== b)) })),
    ...orgaos.map((o) => ({ group: 'Órgãos', label: o, onDelete: () => setOrgaos((l) => l.filter((x) => x !== o)) })),
    ...cargos.map((c) => ({ group: 'Cargos', label: c, onDelete: () => setCargos((l) => l.filter((x) => x !== c)) })),
    ...years.map((y) => ({ group: 'Anos', label: y, onDelete: () => setYears((l) => l.filter((x) => x !== y)) })),
    ...types.map((t) => ({ group: 'Tipo', label: TYPE_LABEL[t as keyof typeof TYPE_LABEL] || t, onDelete: () => setTypes((l) => l.filter((x) => x !== t)) })),
    ...diffs.map((t) => ({ group: 'Dificuldade', label: DIFFICULTY_LABEL[t as keyof typeof DIFFICULTY_LABEL] || t, onDelete: () => setDiffs((l) => l.filter((x) => x !== t)) })),
    ...levels.map((t) => ({ group: 'Escolaridade', label: LEVEL_LABEL[t] || t, onDelete: () => setLevels((l) => l.filter((x) => x !== t)) })),
    ...(status ? [{ group: 'Situação', label: STATUS_OPTIONS.find((s) => s.v === status)?.l || status, onDelete: () => setStatus('') }] : []),
    ...(favorites ? [{ group: 'Situação', label: 'Só favoritas', onDelete: () => setFavorites(false) }] : []),
  ];
  const groups = [...new Set(summaryChips.map((c) => c.group))];

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Button startIcon={<ArrowBack />} size="small" component={Link} href="/cadernos">Cadernos</Button>
      <Typography variant="h4" sx={{ mt: 1 }}>Montar caderno</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Escolha os assuntos e, se quiser, banca, órgão e ano. As contagens se atualizam a cada clique.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 340px' }, gap: 3, alignItems: 'start' }}>
        {/* ── Filtros */}
        <Card sx={{ overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', gap: 1, p: 1.5, overflowX: 'auto', borderBottom: 1, borderColor: 'divider', bgcolor: alpha(gold, 0.03) }}>
            {SECTIONS.map((s) => {
              const on = section === s.key;
              return (
                <Button key={s.key} onClick={() => setSection(s.key)} startIcon={s.icon} size="small"
                  sx={{
                    flexShrink: 0, borderRadius: 10, px: 2, fontWeight: 700,
                    bgcolor: on ? gold : 'transparent', color: on ? '#0A0A0B' : 'text.secondary',
                    '&:hover': { bgcolor: on ? gold : alpha(gold, 0.1) },
                  }}>
                  <Badge badgeContent={sectionCount[s.key]} color="secondary" invisible={!sectionCount[s.key]}
                    sx={{ '& .MuiBadge-badge': { right: -14, top: 2, fontSize: 10, height: 16, minWidth: 16 } }}>
                    {s.label}
                  </Badge>
                </Button>
              );
            })}
          </Box>

          <CardContent sx={{ p: { xs: 2, sm: 2.5 }, minHeight: 420 }}>
            {baseLoading || !base || (section === 'assuntos' && !assuntoTree) ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rounded" height={52} />)}</Box>
            ) : section === 'assuntos' ? (
              <>
                {base.total === 0 && <Alert severity="info" sx={{ mb: 2 }}>Ainda não há questões no banco. Cadastre ou importe questões para montar cadernos.</Alert>}
                <AssuntoTree tree={assuntoTree!} counts={live?.assuntoCounts || {}} semAssunto={live?.semAssunto ?? 0}
                  selection={assuntos} onChange={setAssuntos} accuracy={accuracy} />
              </>
            ) : section === 'bancas' ? (
              <ChipFacet base={base.banca} live={live?.banca || []} selected={bancas} onToggle={toggle(bancas, setBancas)} placeholder="Buscar banca..." />
            ) : section === 'orgaos' ? (
              <Box>
                <Typography variant="overline" color="text.secondary">Órgãos</Typography>
                <ChipFacet base={base.orgao} live={live?.orgao || []} selected={orgaos} onToggle={toggle(orgaos, setOrgaos)} placeholder="Buscar órgão..." />
                <Divider sx={{ my: 2.5 }} />
                <Typography variant="overline" color="text.secondary">Cargos</Typography>
                <ChipFacet base={base.cargo} live={live?.cargo || []} selected={cargos} onToggle={toggle(cargos, setCargos)} placeholder="Buscar cargo..." />
              </Box>
            ) : section === 'anos' ? (
              <Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  {[2, 3, 5].map((n) => (
                    <Button key={n} size="small" variant="outlined" onClick={() => lastYears(n)} disabled={allYears.length < 1}>Últimos {n} anos</Button>
                  ))}
                  <Button size="small" color="inherit" onClick={() => setYears([])}>Todos os anos</Button>
                </Box>
                <ChipFacet base={base.year} live={live?.year || []} selected={years} onToggle={toggle(years, setYears)} placeholder="Buscar ano..." />
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                  <Typography variant="overline" color="text.secondary">Situação</Typography>
                  <ToggleButtonGroup exclusive size="small" value={status} onChange={(_, v) => v !== null && setStatus(v)} sx={{ display: 'flex', flexWrap: 'wrap', mt: 0.5 }}>
                    {STATUS_OPTIONS.map((s) => <ToggleButton key={s.v} value={s.v} sx={{ flex: 1, minWidth: 120 }}>{s.l}</ToggleButton>)}
                  </ToggleButtonGroup>
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">Tipo de questão</Typography>
                  <ChipFacet base={base.type} live={live?.type || []} selected={types} onToggle={toggle(types, setTypes)} placeholder="" format={(v) => TYPE_LABEL[v as keyof typeof TYPE_LABEL] || String(v)} />
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">Dificuldade</Typography>
                  <ChipFacet base={base.difficulty} live={live?.difficulty || []} selected={diffs} onToggle={toggle(diffs, setDiffs)} placeholder="" format={(v) => DIFFICULTY_LABEL[v as keyof typeof DIFFICULTY_LABEL] || String(v)} />
                </Box>
                {base.level.length > 0 && (
                  <Box>
                    <Typography variant="overline" color="text.secondary">Escolaridade</Typography>
                    <ChipFacet base={base.level} live={live?.level || []} selected={levels} onToggle={toggle(levels, setLevels)} placeholder="" format={(v) => LEVEL_LABEL[String(v)] || String(v)} />
                  </Box>
                )}
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <FormControlLabel control={<Switch checked={favorites} onChange={(e) => setFavorites(e.target.checked)} />} label="Só questões favoritas" />
                  <FormControlLabel control={<Switch checked={hideAnnulled} onChange={(e) => setHideAnnulled(e.target.checked)} />} label="Excluir questões anuladas" />
                  <FormControlLabel control={<Switch checked={hideOutdated} onChange={(e) => setHideOutdated(e.target.checked)} />} label="Excluir questões desatualizadas" />
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>

        {/* ── Resumo ao vivo */}
        <Card sx={{ position: { md: 'sticky' }, top: { md: 88 }, overflow: 'hidden', borderColor: alpha(gold, 0.45) }}>
          <Box sx={{
            p: 3, textAlign: 'center', color: '#F5F5F4',
            background: `radial-gradient(400px 160px at 50% 0%, ${alpha(gold, 0.35)}, transparent 70%), #0A0A0B`,
          }}>
            <Typography variant="overline" sx={{ color: alpha('#F5F5F4', 0.7) }}>Questões encontradas</Typography>
            <Typography sx={{ fontSize: 56, fontWeight: 900, lineHeight: 1, letterSpacing: '-0.04em', color: total ? gold : alpha('#F5F5F4', 0.4), my: 0.5 }}>
              {animatedTotal.toLocaleString('pt-BR')}
            </Typography>
            <Typography variant="caption" sx={{ color: alpha('#F5F5F4', 0.6), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, minHeight: 20 }}>
              {isFetching ? <><CircularProgress size={12} sx={{ color: gold }} /> atualizando...</> : `${summaryChips.length} filtro(s) ativo(s)`}
            </Typography>
          </Box>
          <CardContent>
            {summaryChips.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
                <AutoAwesome sx={{ color: alpha(gold, 0.7) }} />
                <Typography variant="body2" sx={{ mt: 1 }}>Nenhum filtro: o caderno usa todo o banco. Marque matérias e assuntos para focar.</Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 320, overflowY: 'auto' }}>
                  {groups.map((g) => (
                    <Box key={g}>
                      <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10 }}>{g}</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {summaryChips.filter((c) => c.group === g).map((c) => (
                          <Chip key={c.label} size="small" label={c.label} onDelete={c.onDelete} deleteIcon={<Close />}
                            sx={{ maxWidth: '100%', bgcolor: alpha(gold, 0.12), fontWeight: 600 }} />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Button fullWidth size="small" color="inherit" startIcon={<FilterAltOff fontSize="small" />} onClick={clearAll} sx={{ mt: 2, color: 'text.secondary' }}>
                  Limpar filtros
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </Box>

      {/* ── Barra de criação (gruda no fim da área visível, com o menu aberto ou fechado) */}
      <Box sx={{
        position: 'sticky', bottom: 12, zIndex: 20, mt: 3, borderRadius: 3,
        bgcolor: alpha(theme.palette.background.paper, 0.94), backdropFilter: 'blur(12px)',
        border: `1px solid ${alpha(gold, 0.45)}`, boxShadow: `0 12px 40px ${alpha('#000', 0.25)}`,
      }}>
        <Box sx={{ px: { xs: 2, md: 2.5 }, py: 1.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField size="small" label="Nome do caderno" value={finalName} sx={{ flex: '2 1 240px' }}
            onChange={(e) => { setName(e.target.value); setNameEdited(true); }} />
          <TextField select size="small" label="Pasta" value={folderId} onChange={(e) => setFolderId(e.target.value)} sx={{ flex: '1 1 140px' }}>
            <MenuItem value="">Sem pasta</MenuItem>
            {folders.map((f) => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
          </TextField>
          <Box sx={{ flex: '2 1 220px', minWidth: 200, px: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Quantidade: <strong style={{ color: theme.palette.text.primary }}>{effectiveQty}</strong> de {total.toLocaleString('pt-BR')}{total > MAX_QUESTIONS ? ` (máx. ${MAX_QUESTIONS})` : ''}
            </Typography>
            <Slider size="small" value={effectiveQty} min={maxQty ? 1 : 0} max={Math.max(1, maxQty)} disabled={!maxQty}
              onChange={(_, v) => setQty(v as number)} aria-label="Quantidade de questões"
              marks={maxQty >= 10 ? [10, 20, 30, 50, 100, 200].filter((m) => m <= maxQty).map((m) => ({ value: m })) : []} />
          </Box>
          <ToggleButtonGroup exclusive size="small" value={order} onChange={(_, v) => v && setOrder(v)}>
            <ToggleButton value="random">Sorteadas</ToggleButton>
            <ToggleButton value="recent">Mais recentes</ToggleButton>
          </ToggleButtonGroup>
          <Button variant="contained" size="large" startIcon={creating ? <CircularProgress size={18} color="inherit" /> : <PlayArrow />}
            onClick={create} disabled={!effectiveQty || creating} sx={{ px: 3, fontWeight: 800, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}>
            {creating ? 'Criando...' : `Criar e começar (${effectiveQty})`}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

export default function MontarCadernoPage() {
  return (
    <Suspense fallback={null}>
      <MontarContent />
    </Suspense>
  );
}
