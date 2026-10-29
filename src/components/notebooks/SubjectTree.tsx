'use client';

import { useMemo, useState } from 'react';
import {
  Box, Typography, Checkbox, IconButton, TextField, InputAdornment, Collapse, Chip, Tooltip, alpha, useTheme,
} from '@mui/material';
import { Search, ExpandMore, ChevronRight, UnfoldMore, UnfoldLess } from '@mui/icons-material';

export type TreeNode = {
  discipline: string | null;
  count: number;
  color: string | null;
  fromEdital: boolean;
  mine: { answered: number; accuracy: number | null } | null;
  topics: { topic: string | null; count: number; fromEdital: boolean }[];
};
// Seleção: disciplina inteira ('all') ou conjunto de assuntos
export type TreeSelection = Record<string, 'all' | string[]>;

export const keyOf = (v: string | null) => v ?? '';
const label = (v: string | null, fallback: string) => v ?? fallback;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function selectionToParam(sel: TreeSelection) {
  const out: { d: string | null; t?: string | null }[] = [];
  for (const [dk, v] of Object.entries(sel)) {
    const d = dk === '' ? null : dk;
    if (v === 'all') out.push({ d });
    else for (const tk of v) out.push({ d, t: tk === '' ? null : tk });
  }
  return out;
}

export default function SubjectTree({ structure, counts, selection, onChange }: {
  structure: TreeNode[];                           // estrutura estável (carregada uma vez)
  counts: Map<string, { count: number; topics: Map<string, number> }>; // contagens com os filtros atuais
  selection: TreeSelection;
  onChange: (s: TreeSelection) => void;
}) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const max = Math.max(1, ...structure.map((d) => d.count));
  const q = norm(query.trim());

  // Busca filtra disciplinas e assuntos; abre automaticamente os ramos encontrados
  const visible = useMemo(() => structure
    .map((d) => {
      if (!q) return { d, topics: d.topics, forceOpen: false };
      const discMatch = norm(label(d.discipline, 'sem disciplina')).includes(q);
      const topics = d.topics.filter((t) => norm(label(t.topic, 'sem assunto')).includes(q));
      if (!discMatch && !topics.length) return null;
      return { d, topics: discMatch ? d.topics : topics, forceOpen: topics.length > 0 };
    })
    .filter(Boolean) as { d: TreeNode; topics: TreeNode['topics']; forceOpen: boolean }[], [structure, q]);

  const toggleDiscipline = (d: TreeNode) => {
    const k = keyOf(d.discipline);
    const next = { ...selection };
    if (next[k] === 'all') delete next[k];
    else next[k] = 'all';
    onChange(next);
  };

  const toggleTopic = (d: TreeNode, topic: string | null) => {
    const dk = keyOf(d.discipline);
    const tk = keyOf(topic);
    const next = { ...selection };
    const cur = next[dk];
    const selectable = d.topics.filter((t) => t.count > 0).map((t) => keyOf(t.topic));
    let set: string[];
    if (cur === 'all') set = selectable.filter((x) => x !== tk);           // desmarca um assunto de "tudo"
    else set = cur?.includes(tk) ? cur.filter((x) => x !== tk) : [...(cur || []), tk];
    if (!set.length) delete next[dk];
    else if (selectable.length > 1 && selectable.every((x) => set.includes(x))) next[dk] = 'all';
    else next[dk] = set;
    onChange(next);
  };

  const allOpen = visible.length > 0 && visible.every(({ d }) => open[keyOf(d.discipline)]);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
        <TextField fullWidth size="small" placeholder="Buscar disciplina ou assunto..." value={query} onChange={(e) => setQuery(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        <Tooltip title={allOpen ? 'Recolher tudo' : 'Expandir tudo'}>
          <IconButton aria-label={allOpen ? 'Recolher tudo' : 'Expandir tudo'}
            onClick={() => setOpen(allOpen ? {} : Object.fromEntries(visible.map(({ d }) => [keyOf(d.discipline), true])))}>
            {allOpen ? <UnfoldLess /> : <UnfoldMore />}
          </IconButton>
        </Tooltip>
      </Box>

      {visible.length === 0 && (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Nada encontrado para “{query}”.</Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {visible.map(({ d, topics, forceOpen }) => {
          const k = keyOf(d.discipline);
          const live = counts.get(k);
          const liveCount = live?.count ?? 0;
          const sel = selection[k];
          const selectedTopics = sel === 'all' ? null : sel || [];
          const checked = sel === 'all';
          const partial = Array.isArray(sel) && sel.length > 0;
          const isOpen = forceOpen || Boolean(open[k]);
          const color = d.color && d.color !== '#1976d2' ? d.color : gold;
          const active = checked || partial;
          const acc = d.mine?.accuracy;
          const accColor = acc === null || acc === undefined ? null : acc >= 70 ? '#22C55E' : acc >= 40 ? '#F59E0B' : '#EF4444';

          return (
            <Box key={k} sx={{
              borderRadius: 2.5, border: '1px solid', overflow: 'hidden',
              borderColor: active ? alpha(gold, 0.55) : 'divider',
              bgcolor: active ? alpha(gold, theme.palette.mode === 'dark' ? 0.06 : 0.05) : 'transparent',
              transition: 'border-color .2s, background-color .2s',
            }}>
              {/* Disciplina */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pr: 1.5, pl: 0.5, py: 0.5, position: 'relative' }}>
                {/* Barra de volume ao fundo: proporção de questões da disciplina */}
                <Box sx={{ position: 'absolute', left: 0, bottom: 0, height: 3, width: `${(d.count / max) * 100}%`, bgcolor: alpha(color, 0.5), transition: 'width .4s' }} />
                <IconButton size="small" onClick={() => setOpen((o) => ({ ...o, [k]: !isOpen }))} aria-label={isOpen ? 'Recolher' : 'Expandir'} disabled={!topics.length}>
                  {isOpen ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
                </IconButton>
                <Checkbox size="small" checked={checked} indeterminate={partial} disabled={!d.count}
                  onChange={() => toggleDiscipline(d)} inputProps={{ 'aria-label': `Selecionar ${label(d.discipline, 'Sem disciplina')}` }}
                  sx={{ '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: gold } }} />
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, flexShrink: 0, mr: 0.5, opacity: d.count ? 1 : 0.4 }} />
                <Box sx={{ flex: 1, minWidth: 0, cursor: topics.length ? 'pointer' : 'default' }} onClick={() => setOpen((o) => ({ ...o, [k]: !isOpen }))}>
                  <Typography fontWeight={700} noWrap sx={{ opacity: d.count ? 1 : 0.5, fontStyle: d.discipline ? 'normal' : 'italic' }}>
                    {label(d.discipline, 'Sem disciplina cadastrada')}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {topics.length} assunto(s){partial ? ` · ${selectedTopics!.length} selecionado(s)` : ''}{!d.count && d.fromEdital ? ' · do seu edital, sem questões' : ''}
                  </Typography>
                </Box>
                {accColor && (
                  <Tooltip title={`Seu acerto nesta disciplina (${d.mine!.answered} respostas)`}>
                    <Chip size="small" label={`você: ${acc}%`}
                      sx={{ height: 22, fontSize: 11, fontWeight: 700, bgcolor: alpha(accColor, 0.14), color: accColor, display: { xs: 'none', sm: 'flex' } }} />
                  </Tooltip>
                )}
                <Box sx={{
                  minWidth: 44, textAlign: 'center', px: 1, py: 0.25, borderRadius: 10, fontWeight: 800, fontSize: 13,
                  bgcolor: liveCount ? alpha(gold, 0.16) : 'action.hover', color: liveCount ? 'text.primary' : 'text.disabled',
                  transition: 'all .2s',
                }}>
                  {liveCount}
                </Box>
              </Box>

              {/* Assuntos */}
              <Collapse in={isOpen} unmountOnExit>
                <Box sx={{ pl: 6.5, pr: 1.5, pb: 1, display: 'flex', flexDirection: 'column' }}>
                  {topics.map((t) => {
                    const tk = keyOf(t.topic);
                    const n = live?.topics.get(tk) ?? 0;
                    const on = checked || Boolean(selectedTopics?.includes(tk));
                    return (
                      <Box key={tk} component="label" sx={{
                        display: 'flex', alignItems: 'center', gap: 1, py: 0.25, pl: 1, borderLeft: '2px solid',
                        borderColor: on ? gold : 'divider', cursor: t.count ? 'pointer' : 'default', opacity: t.count ? 1 : 0.5,
                        '&:hover': t.count ? { bgcolor: 'action.hover' } : {}, borderRadius: '0 8px 8px 0',
                      }}>
                        <Checkbox size="small" checked={on} disabled={!t.count} onChange={() => toggleTopic(d, t.topic)}
                          sx={{ p: 0.5, '&.Mui-checked': { color: gold } }} />
                        <Typography variant="body2" sx={{ flex: 1, fontStyle: t.topic ? 'normal' : 'italic' }}>
                          {label(t.topic, 'Sem assunto definido')}
                          {!t.count && t.fromEdital && <Typography component="span" variant="caption" color="text.secondary"> · sem questões ainda</Typography>}
                        </Typography>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: n ? 'text.secondary' : 'text.disabled', minWidth: 28, textAlign: 'right' }}>{n}</Typography>
                      </Box>
                    );
                  })}
                </Box>
              </Collapse>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
