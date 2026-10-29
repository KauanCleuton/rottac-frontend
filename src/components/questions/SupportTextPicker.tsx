'use client';

import { useEffect, useState } from 'react';
import {
  Box, Button, Autocomplete, TextField, Typography, Collapse, CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import { Add, LinkOff, SwapHoriz } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';
import RichTextField from '@/components/common/RichTextField';
import SupportText, { type SupportTextData } from './SupportText';
import { stripRich } from '@/lib/richText';

type Option = { id: string; title?: string | null; preview: string; questions: number; source?: string | null };

// Escolhe um texto de apoio existente ou cria um novo para ligar à questão
export default function SupportTextPicker({ value, onChange, isAdmin }: {
  value: SupportTextData | null;
  onChange: (t: SupportTextData | null) => void;
  isAdmin: boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'search' | 'new'>('idle');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', source: '', isPublic: isAdmin });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== 'search') return;
    let cancel = false;
    const t = setTimeout(() => {
      setLoading(true);
      questionBankApi.texts(query || undefined)
        .then((r) => { if (!cancel) setOptions(r.data.data); })
        .finally(() => { if (!cancel) setLoading(false); });
    }, 250);
    return () => { cancel = true; clearTimeout(t); };
  }, [query, mode]);

  const pick = async (o: Option | null) => {
    if (!o) return;
    try {
      const r = await questionBankApi.getText(o.id);
      onChange(r.data.data);
      setMode('idle');
    } catch {
      toast.error('Não foi possível carregar o texto');
    }
  };

  const create = async () => {
    setSaving(true);
    try {
      const r = await questionBankApi.createText({ title: draft.title || undefined, body: draft.body, source: draft.source || undefined, isPublic: draft.isPublic });
      onChange(r.data.data);
      setDraft({ title: '', body: '', source: '', isPublic: isAdmin });
      setMode('idle');
      toast.success('Texto de apoio criado e ligado à questão');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao criar o texto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      {value ? (
        <>
          <SupportText text={value} defaultOpen={false} />
          <Box sx={{ display: 'flex', gap: 1, mt: -1.5, mb: 1 }}>
            <Button size="small" startIcon={<SwapHoriz />} onClick={() => setMode('search')}>Trocar texto</Button>
            <Button size="small" color="inherit" startIcon={<LinkOff />} onClick={() => onChange(null)} sx={{ color: 'text.secondary' }}>Desvincular</Button>
          </Box>
        </>
      ) : (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" onClick={() => setMode(mode === 'search' ? 'idle' : 'search')}>Usar texto já cadastrado</Button>
          <Button size="small" variant="outlined" startIcon={<Add />} onClick={() => setMode(mode === 'new' ? 'idle' : 'new')}>Novo texto</Button>
        </Box>
      )}

      <Collapse in={mode === 'search'} unmountOnExit>
        <Autocomplete
          sx={{ mt: 1.5 }} options={options} loading={loading} filterOptions={(x) => x}
          getOptionLabel={(o) => o.title || stripRich(o.preview).slice(0, 60)}
          onInputChange={(_, v) => setQuery(v)} onChange={(_, o) => pick(o)}
          noOptionsText={query ? 'Nenhum texto encontrado' : 'Digite para buscar'}
          renderOption={(props, o) => {
            const { key, ...rest } = props as any;
            return (
              <li key={key} {...rest}>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{o.title || 'Sem título'} · {o.questions} questão(ões)</Typography>
                  <Typography variant="caption" color="text.secondary">{stripRich(o.preview).slice(0, 140)}…</Typography>
                </Box>
              </li>
            );
          }}
          renderInput={(params) => (
            <TextField {...params} size="small" label="Buscar texto pelo título ou trecho" autoFocus
              InputProps={{ ...params.InputProps, endAdornment: <>{loading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</> }} />
          )}
        />
      </Collapse>

      <Collapse in={mode === 'new'} unmountOnExit>
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField size="small" label="Título" placeholder="Texto I" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          <RichTextField fullWidth multiline minRows={6} maxRows={24} label="Texto"
            placeholder="Cole o texto aqui. Selecione palavras para destacar com negrito ou marca-texto."
            value={draft.body} onChange={(v) => setDraft((d) => ({ ...d, body: v }))} />
          <TextField size="small" label="Fonte (autor, obra, veículo)" value={draft.source} onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))} />
          {isAdmin && (
            <FormControlLabel control={<Switch checked={draft.isPublic} onChange={(e) => setDraft((d) => ({ ...d, isPublic: e.target.checked }))} />}
              label={<Typography variant="body2">Texto público (pode ser usado em outras questões do banco)</Typography>} />
          )}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button color="inherit" onClick={() => setMode('idle')}>Cancelar</Button>
            <Button variant="contained" onClick={create} disabled={draft.body.trim().length < 10 || saving}>
              {saving ? <CircularProgress size={18} color="inherit" /> : 'Criar e ligar à questão'}
            </Button>
          </Box>
        </Box>
      </Collapse>
    </Box>
  );
}
