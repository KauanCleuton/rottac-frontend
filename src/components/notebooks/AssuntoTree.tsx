'use client';

import { memo, useMemo, useState } from 'react';
import {
  Box, Typography, Checkbox, IconButton, TextField, InputAdornment, Collapse, Chip, Tooltip, FormControlLabel, Switch,
  alpha, useTheme,
} from '@mui/material';
import { Search, ExpandMore, ChevronRight, UnfoldMore, UnfoldLess, FolderOutlined, FolderOpenOutlined, Close } from '@mui/icons-material';
import { type Assuntos, normalize } from '@/hooks/useAssuntos';

// Id reservado para "Sem classificação" (questões sem nó na árvore)
export const SEM_ASSUNTO = 0;
const MAX_SEARCH_HITS = 400;

// ── Seleção mínima: marcar um nó vale para toda a subárvore, então nunca guardamos pai e filho juntos
export function toggleAssunto(tree: Assuntos, selection: number[], id: number): number[] {
  const sel = new Set(selection);
  if (id === SEM_ASSUNTO) {
    if (sel.has(id)) sel.delete(id); else sel.add(id);
    return [...sel];
  }
  const path = tree.pathOf(id).map((n) => n.id);
  const coverIdx = path.findIndex((p) => sel.has(p));

  if (coverIdx === path.length - 1) {
    sel.delete(id);                                   // estava marcado diretamente
  } else if (coverIdx >= 0) {
    // Um ancestral cobre o nó: desmarca o ancestral e marca os "irmãos" ao longo do caminho
    sel.delete(path[coverIdx]);
    for (let i = coverIdx; i < path.length - 1; i++) {
      for (const c of tree.byId.get(path[i])!.children) if (c !== path[i + 1]) sel.add(c);
    }
  } else {
    for (const d of tree.descendants(id)) sel.delete(d);
    sel.add(id);
    // Todos os filhos marcados = marca o pai (sobe enquanto fizer sentido)
    for (let i = path.length - 2; i >= 0; i--) {
      const kids = tree.byId.get(path[i])!.children;
      if (!kids.every((k) => sel.has(k))) break;
      for (const k of kids) sel.delete(k);
      sel.add(path[i]);
    }
  }
  return [...sel];
}

type RowProps = {
  id: number;
  level: number;
  tree: Assuntos;
  counts: Record<number, number>;
  selected: Set<number>;
  partial: Set<number>;
  covered: boolean;
  open: Record<number, boolean>;
  forceOpen: Set<number> | null;
  visible: Set<number> | null;
  hideEmpty: boolean;
  max: number;
  accuracy?: Record<string, number | null>;
  onToggle: (id: number) => void;
  onOpen: (id: number, v: boolean) => void;
};

const Row = memo(function Row(p: RowProps) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const node = p.tree.byId.get(p.id)!;
  const count = p.counts[p.id] || 0;
  const checked = p.covered || p.selected.has(p.id);
  const indeterminate = !checked && p.partial.has(p.id);
  const kids = node.children.filter((c) => (!p.visible || p.visible.has(c)) && (!p.hideEmpty || p.counts[c] || p.selected.has(c) || p.partial.has(c)));
  const isOpen = Boolean(p.forceOpen?.has(p.id) || p.open[p.id]);
  const isRoot = p.level === 0;
  const active = checked || indeterminate;
  const acc = isRoot ? p.accuracy?.[node.name] : undefined;
  const accColor = acc === null || acc === undefined ? null : acc >= 70 ? '#22C55E' : acc >= 40 ? '#F59E0B' : '#EF4444';

  const row = (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 0.25, pr: 1.25, py: isRoot ? 0.5 : 0.1, position: 'relative',
      borderRadius: isRoot ? 0 : '0 8px 8px 0', '&:hover': { bgcolor: 'action.hover' },
    }}>
      {isRoot && <Box sx={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${(count / p.max) * 100}%`, bgcolor: alpha(gold, 0.5), transition: 'width .4s' }} />}
      <IconButton size="small" onClick={() => p.onOpen(p.id, !isOpen)} aria-label={isOpen ? 'Recolher' : 'Expandir'}
        sx={{ visibility: kids.length ? 'visible' : 'hidden', p: isRoot ? 0.75 : 0.4 }}>
        {isOpen ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
      </IconButton>
      <Checkbox size="small" checked={checked} indeterminate={indeterminate} disabled={!count && !active}
        onChange={() => p.onToggle(p.id)} inputProps={{ 'aria-label': `Selecionar ${node.name}` }}
        sx={{ p: isRoot ? 0.75 : 0.4, '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: gold } }} />
      {!isRoot && kids.length > 0 && (isOpen
        ? <FolderOpenOutlined sx={{ fontSize: 16, color: alpha(gold, 0.9), mr: 0.5 }} />
        : <FolderOutlined sx={{ fontSize: 16, color: 'text.secondary', mr: 0.5 }} />)}
      <Box sx={{ flex: 1, minWidth: 0, cursor: kids.length ? 'pointer' : 'default', py: 0.25 }}
        onClick={() => (kids.length ? p.onOpen(p.id, !isOpen) : count || active ? p.onToggle(p.id) : undefined)}>
        <Typography fontWeight={isRoot ? 800 : kids.length ? 650 : 400} variant={isRoot ? 'body1' : 'body2'}
          sx={{ opacity: count || active ? 1 : 0.5, lineHeight: 1.35, wordBreak: 'break-word' }}>
          {node.name}
        </Typography>
        {isRoot && (
          <Typography variant="caption" color="text.secondary">
            {node.children.length ? `${node.children.length} assunto(s)` : 'sem subdivisões'}
          </Typography>
        )}
      </Box>
      {accColor && (
        <Tooltip title="Seu acerto nesta matéria">
          <Chip size="small" label={`você: ${acc}%`}
            sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: alpha(accColor, 0.14), color: accColor, display: { xs: 'none', sm: 'flex' }, mr: 1 }} />
        </Tooltip>
      )}
      <Box sx={{
        minWidth: isRoot ? 44 : 34, textAlign: 'center', px: 0.75, py: 0.1, borderRadius: 10, fontWeight: 800, fontSize: isRoot ? 13 : 12,
        bgcolor: count ? alpha(gold, isRoot ? 0.18 : 0.1) : 'transparent', color: count ? 'text.primary' : 'text.disabled', flexShrink: 0,
      }}>
        {count.toLocaleString('pt-BR')}
      </Box>
    </Box>
  );

  return (
    <Box sx={isRoot ? {
      borderRadius: 2.5, border: '1px solid', overflow: 'hidden',
      borderColor: active ? alpha(gold, 0.55) : 'divider',
      bgcolor: active ? alpha(gold, theme.palette.mode === 'dark' ? 0.06 : 0.05) : 'transparent',
      transition: 'border-color .2s, background-color .2s',
    } : undefined}>
      {row}
      {kids.length > 0 && (
        <Collapse in={isOpen} unmountOnExit timeout={150}>
          <Box sx={{ ml: isRoot ? 2.25 : 1.6, pl: 0.75, borderLeft: '1px dashed', borderColor: active ? alpha(gold, 0.5) : 'divider', pb: isRoot ? 0.75 : 0 }}>
            {kids.map((c) => <Row key={c} {...p} id={c} level={p.level + 1} covered={checked} />)}
          </Box>
        </Collapse>
      )}
    </Box>
  );
});

export default function AssuntoTree({ tree, counts, semAssunto, selection, onChange, accuracy }: {
  tree: Assuntos;
  counts: Record<number, number>;     // questões por nó (já somando a subárvore) com os filtros atuais
  semAssunto: number;
  selection: number[];
  onChange: (s: number[]) => void;
  accuracy?: Record<string, number | null>;
}) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [hideEmpty, setHideEmpty] = useState(false);

  const selected = useMemo(() => new Set(selection), [selection]);
  // Ancestrais de algo marcado aparecem como "parcialmente marcados"
  const partial = useMemo(() => {
    const s = new Set<number>();
    for (const id of selection) for (const n of tree.pathOf(id).slice(0, -1)) s.add(n.id);
    return s;
  }, [selection, tree]);

  // Busca: mostra os nós encontrados e o caminho até eles (abrindo os ramos)
  const q = normalize(query.trim());
  const search = useMemo(() => {
    if (q.length < 2) return null;
    const visible = new Set<number>();
    const forceOpen = new Set<number>();
    let hits = 0;
    for (const n of tree.byId.values()) {
      if (!n.search.includes(q)) continue;
      if (++hits > MAX_SEARCH_HITS) break;
      const path = tree.pathOf(n.id);
      path.forEach((x, i) => { visible.add(x.id); if (i < path.length - 1) forceOpen.add(x.id); });
      for (const d of tree.descendants(n.id)) visible.add(d);   // o que está dentro do achado continua navegável
    }
    return { visible, forceOpen, hits };
  }, [q, tree]);

  const roots = tree.roots
    .filter((id) => (!search || search.visible.has(id)) && (!hideEmpty || counts[id] || selected.has(id) || partial.has(id)))
    // Matérias com questões primeiro (mais questões antes), depois a ordem original
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  const max = Math.max(1, ...roots.map((id) => counts[id] || 0));
  const anyOpen = Object.values(open).some(Boolean);

  const onToggle = (id: number) => onChange(toggleAssunto(tree, selection, id));
  const onOpen = (id: number, v: boolean) => setOpen((o) => ({ ...o, [id]: v }));
  const expandWithQuestions = () => {
    const next: Record<number, boolean> = {};
    for (const n of tree.byId.values()) if (n.children.length && counts[n.id]) next[n.id] = true;
    setOpen(next);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
        <TextField fullWidth size="small" placeholder="Buscar matéria, assunto ou subassunto..." value={query} onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
            endAdornment: query ? <IconButton size="small" onClick={() => setQuery('')} aria-label="Limpar busca"><Close fontSize="small" /></IconButton> : null,
          }} />
        <Tooltip title={anyOpen ? 'Recolher tudo' : 'Abrir tudo que tem questões'}>
          <IconButton aria-label={anyOpen ? 'Recolher tudo' : 'Expandir'} onClick={() => (anyOpen ? setOpen({}) : expandWithQuestions())}>
            {anyOpen ? <UnfoldLess /> : <UnfoldMore />}
          </IconButton>
        </Tooltip>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
        <FormControlLabel control={<Switch size="small" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />}
          label={<Typography variant="body2">Mostrar só assuntos com questões</Typography>} />
        <Typography variant="caption" color="text.secondary">
          {search ? `${Math.min(search.hits, MAX_SEARCH_HITS)}${search.hits > MAX_SEARCH_HITS ? '+' : ''} resultado(s)` : `${tree.roots.length} matérias · ${tree.byId.size.toLocaleString('pt-BR')} assuntos`}
        </Typography>
      </Box>

      {roots.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {search ? `Nada encontrado para “${query}”.` : 'Nenhuma matéria com questões para esses filtros.'}
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {roots.map((id) => (
          <Row key={id} id={id} level={0} tree={tree} counts={counts} selected={selected} partial={partial} covered={false}
            open={open} forceOpen={search?.forceOpen ?? null} visible={search?.visible ?? null} hideEmpty={hideEmpty}
            max={max} accuracy={accuracy} onToggle={onToggle} onOpen={onOpen} />
        ))}

        {semAssunto > 0 && !search && (
          <Box component="label" sx={{
            display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.5, borderRadius: 2.5, border: '1px dashed', cursor: 'pointer',
            borderColor: selected.has(SEM_ASSUNTO) ? alpha(gold, 0.55) : 'divider',
          }}>
            <Checkbox size="small" checked={selected.has(SEM_ASSUNTO)} onChange={() => onToggle(SEM_ASSUNTO)} sx={{ '&.Mui-checked': { color: gold } }} />
            <Box sx={{ flex: 1 }}>
              <Typography fontWeight={700} fontStyle="italic">Sem classificação</Typography>
              <Typography variant="caption" color="text.secondary">Questões ainda não ligadas a um assunto da árvore</Typography>
            </Box>
            <Typography fontWeight={800} fontSize={13} sx={{ px: 1 }}>{semAssunto}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
