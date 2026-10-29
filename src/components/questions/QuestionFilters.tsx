'use client';

import {
  Box, Grid, TextField, Autocomplete, MenuItem, FormControlLabel, Switch, Button, InputAdornment, Chip,
} from '@mui/material';
import { Search, FilterAltOff } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { questionBankApi } from '@/lib/api';
import { DIFFICULTY_LABEL, TYPE_LABEL } from './types';
import { AssuntoMultiPicker } from './AssuntoPicker';

export type Filters = {
  search: string;
  assuntos: number[];
  discipline: string[];
  topic: string[];
  banca: string[];
  orgao: string[];
  cargo: string[];
  year: string[];
  type: string;
  difficulty: string;
  status: string;
  scope: string;
  favorites: boolean;
  hideAnnulled: boolean;
  hideOutdated: boolean;
};

export const emptyFilters = (): Filters => ({
  search: '', assuntos: [], discipline: [], topic: [], banca: [], orgao: [], cargo: [], year: [],
  type: '', difficulty: '', status: '', scope: 'all', favorites: false, hideAnnulled: false, hideOutdated: false,
});

const LIST_KEYS = ['discipline', 'topic', 'banca', 'orgao', 'cargo', 'year'] as const;

// Filtros -> query string da API (listas separadas por "|")
export function filtersToParams(f: Filters): Record<string, string> {
  const p: Record<string, string> = {};
  if (f.search.trim()) p.search = f.search.trim();
  if (f.assuntos.length) p.assuntos = f.assuntos.join(',');
  for (const k of LIST_KEYS) if (f[k].length) p[k] = f[k].join('|');
  if (f.type) p.type = f.type;
  if (f.difficulty) p.difficulty = f.difficulty;
  if (f.status) p.status = f.status;
  if (f.scope && f.scope !== 'all') p.scope = f.scope;
  if (f.favorites) p.favorites = '1';
  if (f.hideAnnulled) p.hideAnnulled = '1';
  if (f.hideOutdated) p.hideOutdated = '1';
  return p;
}

export function filtersFromParams(sp: URLSearchParams): Filters {
  const f = emptyFilters();
  f.search = sp.get('search') || '';
  f.assuntos = (sp.get('assuntos') || '').split(',').filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 0);
  for (const k of LIST_KEYS) f[k] = (sp.get(k) || '').split('|').filter(Boolean);
  f.type = sp.get('type') || '';
  f.difficulty = sp.get('difficulty') || '';
  f.status = sp.get('status') || '';
  f.scope = sp.get('scope') || (sp.get('escopo') === 'minhas' ? 'mine' : 'all');
  f.favorites = sp.get('favorites') === '1';
  f.hideAnnulled = sp.get('hideAnnulled') === '1';
  f.hideOutdated = sp.get('hideOutdated') === '1';
  return f;
}

export function activeFilterCount(f: Filters) {
  return Object.keys(filtersToParams(f)).length;
}

const LIST_LABEL: Record<(typeof LIST_KEYS)[number], string> = {
  discipline: 'Disciplina', topic: 'Assunto', banca: 'Banca', orgao: 'Órgão', cargo: 'Cargo', year: 'Ano',
};

export default function QuestionFilters({ value, onChange, onApply, compact }: {
  value: Filters; onChange: (f: Filters) => void; onApply?: () => void; compact?: boolean;
}) {
  const { data: options } = useQuery({
    queryKey: ['question-bank-filters'],
    queryFn: () => questionBankApi.filters().then((r) => r.data.data),
    staleTime: 60_000,
  });

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...value, [k]: v });
  const listKeys = (compact ? (['banca', 'orgao', 'year'] as const) : LIST_KEYS)
    .filter((k) => (k !== 'discipline' && k !== 'topic') || value[k].length > 0);

  return (
    <Box>
      {!compact && (
        <TextField
          fullWidth size="small" placeholder="Buscar no enunciado, assunto ou fonte..."
          value={value.search} onChange={(e) => set('search', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onApply?.(); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          sx={{ mb: 2 }}
        />
      )}

      <Grid container spacing={1.5}>
        <Grid size={{ xs: 12, md: compact ? 12 : 8 }}>
          <AssuntoMultiPicker value={value.assuntos} onChange={(ids) => set('assuntos', ids)} limitTags={compact ? 2 : 4} />
        </Grid>
        {listKeys.map((k) => {
          const opts: { value: string | number; count: number }[] = options?.[k] || [];
          return (
            <Grid key={k} size={{ xs: 12, sm: 6, md: compact ? 6 : 4 }}>
              <Autocomplete
                multiple size="small" limitTags={2}
                options={opts.map((o) => String(o.value))}
                value={value[k]}
                onChange={(_, v) => set(k, v)}
                getOptionLabel={(o) => o}
                renderOption={(props, o) => {
                  const { key, ...rest } = props as any;
                  const count = opts.find((x) => String(x.value) === o)?.count;
                  return (
                    <li key={key} {...rest} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{o}</span>
                      {count !== undefined && <Chip label={count} size="small" sx={{ height: 18, fontSize: 10 }} />}
                    </li>
                  );
                }}
                renderInput={(params) => <TextField {...params} label={LIST_LABEL[k]} />}
                noOptionsText="Nenhuma opção"
              />
            </Grid>
          );
        })}

        <Grid size={{ xs: 6, sm: 3, md: compact ? 6 : 2 }}>
          <TextField select fullWidth size="small" label="Tipo" value={value.type} onChange={(e) => set('type', e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {Object.entries(TYPE_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 3, md: compact ? 6 : 2 }}>
          <TextField select fullWidth size="small" label="Dificuldade" value={value.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            {Object.entries(DIFFICULTY_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 3, md: compact ? 6 : 2 }}>
          <TextField select fullWidth size="small" label="Situação" value={value.status} onChange={(e) => set('status', e.target.value)}>
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="nao_resolvidas">Não resolvidas</MenuItem>
            <MenuItem value="resolvidas">Já resolvidas</MenuItem>
            <MenuItem value="acertei">Que acertei</MenuItem>
            <MenuItem value="errei">Que errei</MenuItem>
          </TextField>
        </Grid>
        <Grid size={{ xs: 6, sm: 3, md: compact ? 6 : 2 }}>
          <TextField select fullWidth size="small" label="Origem" value={value.scope} onChange={(e) => set('scope', e.target.value)}>
            <MenuItem value="all">Todas</MenuItem>
            <MenuItem value="public">Banco Rotta</MenuItem>
            <MenuItem value="mine">Minhas questões</MenuItem>
          </TextField>
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
        <FormControlLabel control={<Switch size="small" checked={value.favorites} onChange={(e) => set('favorites', e.target.checked)} />}
          label="Só favoritas" slotProps={{ typography: { variant: 'body2' } }} />
        {!compact && (
          <>
            <FormControlLabel control={<Switch size="small" checked={value.hideAnnulled} onChange={(e) => set('hideAnnulled', e.target.checked)} />}
              label="Ocultar anuladas" slotProps={{ typography: { variant: 'body2' } }} />
            <FormControlLabel control={<Switch size="small" checked={value.hideOutdated} onChange={(e) => set('hideOutdated', e.target.checked)} />}
              label="Ocultar desatualizadas" slotProps={{ typography: { variant: 'body2' } }} />
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {activeFilterCount(value) > 0 && (
          <Button size="small" color="inherit" startIcon={<FilterAltOff fontSize="small" />} onClick={() => onChange(emptyFilters())}>
            Limpar
          </Button>
        )}
        {onApply && <Button variant="contained" size="small" onClick={onApply} sx={{ px: 3 }}>Filtrar</Button>}
      </Box>
    </Box>
  );
}
