'use client';

import { useMemo } from 'react';
import { Autocomplete, Box, Chip, TextField, Typography } from '@mui/material';
import { AccountTree } from '@mui/icons-material';
import { useAssuntos, normalize, type Assuntos } from '@/hooks/useAssuntos';

type Option = { id: number; name: string; path: string; depth: number; search: string };

// Todas as palavras digitadas precisam aparecer no caminho; nós mais rasos primeiro
const filterOptions = (opts: Option[], { inputValue }: { inputValue: string }) => {
  const words = normalize(inputValue).split(/\s+/).filter(Boolean);
  const hits = words.length ? opts.filter((o) => words.every((w) => o.search.includes(w))) : opts.filter((o) => o.depth === 1);
  return hits.sort((a, b) => a.depth - b.depth).slice(0, 80);
};

export const assuntoLabel = (tree: Assuntos | null, id: number | null | undefined) =>
  (tree && id ? tree.pathOf(id).map((n) => n.name).join(' › ') : '');

function useOptions() {
  const { tree, isLoading } = useAssuntos();
  const options = useMemo<Option[]>(() => {
    if (!tree) return [];
    return [...tree.byId.values()].map((n) => {
      const path = tree.pathOf(n.id).map((x) => x.name).join(' › ');
      return { id: n.id, name: n.name, path, depth: n.depth, search: normalize(path) };
    });
  }, [tree]);
  return { tree, options, isLoading };
}

const renderOption = (props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key }, o: Option) => {
  const { key, ...rest } = props;
  const parent = o.path.slice(0, Math.max(0, o.path.length - o.name.length - 3));
  return (
    <li key={key} {...rest}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={o.depth === 1 ? 800 : 600}>{o.name}</Typography>
        {parent && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>{parent}</Typography>}
      </Box>
    </li>
  );
};

// Escolhe um nó da árvore de matérias/assuntos digitando qualquer parte do caminho
// ("crase", "atos atributos", "constitucional sociais"...)
export default function AssuntoPicker({ value, onChange, label = 'Matéria / assunto', size = 'small', helperText, placeholder }: {
  value: number | null;
  onChange: (id: number | null, path: string[]) => void;
  label?: string;
  size?: 'small' | 'medium';
  helperText?: React.ReactNode;
  placeholder?: string;
}) {
  const { tree, options, isLoading } = useOptions();
  const selected = options.find((o) => o.id === value) || null;
  return (
    <Autocomplete
      size={size} options={options} value={selected} loading={isLoading}
      filterOptions={filterOptions}
      getOptionLabel={(o) => o.path}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderOption={renderOption}
      onChange={(_, o) => onChange(o?.id ?? null, o && tree ? tree.pathOf(o.id).map((n) => n.name) : [])}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder || 'Digite para buscar (ex.: crase, atos administrativos)'} helperText={helperText}
          InputProps={{ ...params.InputProps, startAdornment: <><AccountTree fontSize="small" sx={{ color: 'text.secondary', ml: 0.5, mr: 0.5 }} />{params.InputProps.startAdornment}</> }} />
      )}
      noOptionsText="Nenhum assunto encontrado"
      loadingText="Carregando assuntos..."
    />
  );
}

export function AssuntoMultiPicker({ value, onChange, label = 'Matérias / assuntos', limitTags = 2 }: {
  value: number[];
  onChange: (ids: number[]) => void;
  label?: string;
  limitTags?: number;
}) {
  const { options, isLoading } = useOptions();
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const selected = value.map((id) => byId.get(id)).filter(Boolean) as Option[];
  return (
    <Autocomplete
      multiple size="small" limitTags={limitTags} options={options} value={selected} loading={isLoading}
      filterOptions={filterOptions}
      getOptionLabel={(o) => o.path}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      renderOption={renderOption}
      renderTags={(tags, getTagProps) => tags.map((o, i) => {
        const { key, ...rest } = getTagProps({ index: i });
        return <Chip key={key} {...rest} size="small" label={o.name} title={o.path} />;
      })}
      onChange={(_, list) => onChange(list.map((o) => o.id))}
      renderInput={(params) => <TextField {...params} label={label} placeholder={value.length ? '' : 'Buscar matéria ou assunto...'} />}
      noOptionsText="Nenhum assunto encontrado"
      loadingText="Carregando assuntos..."
    />
  );
}
