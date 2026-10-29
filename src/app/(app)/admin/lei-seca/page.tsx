'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Alert, Skeleton, IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import { Gavel, Add, Edit, DeleteOutline, AutoFixHigh, Visibility } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { lawApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import AssuntoPicker from '@/components/questions/AssuntoPicker';
import ConfirmDialog from '@/components/common/ConfirmDialog';

type Law = {
  id: string; title: string; shortName: string; aliases: string | null; description: string | null; assuntoId: number | null;
  isPublished: boolean; articles: number; questions: number;
};
type Form = { id?: string; title: string; shortName: string; aliases: string; description: string; assuntoId: number | null; isPublished: boolean; text: string };

const EMPTY: Form = { title: '', shortName: '', aliases: '', description: '', assuntoId: null, isPublished: true, text: '' };

function LawDialog({ initial, onClose, onSaved }: { initial: Form; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(initial);
  const [preview, setPreview] = useState<{ total: number; sample: { number: string; heading: string | null; text: string }[]; last: any } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setF((x) => ({ ...x, ...patch }));
  const editing = Boolean(f.id);

  const check = async () => {
    setBusy(true);
    try {
      setPreview((await lawApi.preview(f.text)).data.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao ler o texto');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        title: f.title, shortName: f.shortName, aliases: f.aliases, description: f.description || null,
        assuntoId: f.assuntoId, isPublished: f.isPublished,
      };
      if (f.text.trim()) body.text = f.text;
      const r = editing ? await lawApi.update(f.id!, body) : await lawApi.create(body);
      const d = r.data.data;
      toast.success(editing
        ? d.sync ? `Texto atualizado: ${d.sync.created} novos, ${d.sync.updated} mantidos, ${d.sync.removed} removidos` : 'Lei atualizada'
        : `${r.data.message}${d.linked ? ` · ${d.linked.questions} questões vinculadas` : ''}`);
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar');
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{editing ? 'Editar lei' : 'Nova lei'}</DialogTitle>
      <DialogContent dividers sx={{ display: 'grid', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
          <TextField label="Nome" placeholder="Constituição Federal de 1988" value={f.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
          <TextField label="Sigla" placeholder="CF/88" value={f.shortName} onChange={(e) => set({ shortName: e.target.value })} required />
        </Box>
        <TextField label="Outros nomes usados nas questões" placeholder="Constituição Federal | CF | Carta Magna" value={f.aliases}
          onChange={(e) => set({ aliases: e.target.value })}
          helperText='Separe por "|". A vinculação automática só liga uma questão que cita "art. N" se ela for da matéria abaixo ou citar um destes nomes.' />
        <AssuntoPicker value={f.assuntoId} onChange={(id) => set({ assuntoId: id })} label="Matéria da lei (opcional)" placeholder="Ex.: Direito Constitucional" />
        <TextField label="Descrição (opcional)" value={f.description} onChange={(e) => set({ description: e.target.value })} />
        <TextField label={editing ? 'Substituir texto (opcional)' : 'Texto da lei'} multiline minRows={8} maxRows={16} value={f.text}
          onChange={(e) => { set({ text: e.target.value }); setPreview(null); }}
          placeholder={'Cole o texto compilado do Planalto, por exemplo:\nTÍTULO I\nDOS PRINCÍPIOS FUNDAMENTAIS\nArt. 1º A República Federativa do Brasil...'}
          helperText={editing ? 'Artigos com o mesmo número são mantidos (com questões e marcações dos alunos); novos são criados e os que sumiram, removidos.' : 'Cada artigo deve começar em uma linha com "Art. 1º", "Art. 2º"...'} />
        {f.text.trim() && (
          <Box>
            <Button size="small" startIcon={busy ? <CircularProgress size={14} /> : <Visibility />} onClick={check} disabled={busy}>Conferir leitura</Button>
            {preview && (
              <Alert severity={preview.total ? 'success' : 'error'} sx={{ mt: 1 }}>
                {preview.total
                  ? <>Encontrei <strong>{preview.total}</strong> artigos — do art. {preview.sample[0]?.number} ao art. {preview.last?.number}.
                    {preview.sample[0]?.heading && <> Primeiro cabeçalho: <em>{preview.sample[0].heading}</em>.</>}</>
                  : 'Nenhum artigo encontrado. Confira se cada artigo começa em linha própria com "Art."'}
              </Alert>
            )}
          </Box>
        )}
        <FormControlLabel control={<Switch checked={f.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />} label="Publicada para os alunos" />
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="contained" onClick={save} disabled={busy || !f.title.trim() || !f.shortName.trim() || (!editing && !f.text.trim())}>
          {busy ? <CircularProgress size={18} color="inherit" /> : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminLeiSecaPage() {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [form, setForm] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<Law | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ['laws'],
    queryFn: () => lawApi.list().then((r) => r.data.data as Law[]),
    enabled: isAdmin,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['laws'] });

  if (!isAdmin) return <Alert severity="warning">Área exclusiva para administradores.</Alert>;

  const autoLink = async (l: Law) => {
    setBusy(l.id);
    try {
      const r = await lawApi.autoLink(l.id);
      toast.success(`${r.data.message} (${r.data.data.links} vínculos)`);
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro');
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    if (!toDelete) return;
    setBusy(toDelete.id);
    try {
      await lawApi.remove(toDelete.id);
      toast.success('Lei excluída');
      setToDelete(null);
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Gavel sx={{ color: 'primary.main', fontSize: 32 }} /> Leis (lei seca)
          </Typography>
          <Typography color="text.secondary">Cadastre leis colando o texto; as questões que citam &quot;art. N&quot; são ligadas aos artigos automaticamente.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setForm(EMPTY)}>Nova lei</Button>
      </Box>

      {isLoading ? <Skeleton variant="rounded" height={200} /> : !data.length ? (
        <Alert severity="info">Nenhuma lei cadastrada.</Alert>
      ) : data.map((l) => (
        <Card key={l.id} sx={{ mb: 1.5 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ flexGrow: 1, minWidth: 200 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Typography fontWeight={800}>{l.shortName}</Typography>
                <Chip size="small" label={l.isPublished ? 'Publicada' : 'Rascunho'} color={l.isPublished ? 'success' : 'default'} variant="outlined" />
              </Box>
              <Typography variant="body2" color="text.secondary">{l.title} · {l.articles} artigos · {l.questions} questões</Typography>
            </Box>
            <Button size="small" component={Link} href={`/lei-seca/${l.id}`} startIcon={<Visibility />}>Abrir</Button>
            <Tooltip title="Ler de novo todas as questões públicas e ligar as que citam artigos desta lei">
              <span>
                <Button size="small" startIcon={busy === l.id ? <CircularProgress size={14} /> : <AutoFixHigh />} onClick={() => autoLink(l)} disabled={Boolean(busy)}>
                  Vincular questões
                </Button>
              </span>
            </Tooltip>
            <IconButton size="small" aria-label="Editar" onClick={() => setForm({
              id: l.id, title: l.title, shortName: l.shortName, aliases: (l.aliases || '').split('|').join(' | '),
              description: l.description || '', assuntoId: l.assuntoId, isPublished: l.isPublished, text: '',
            })}><Edit fontSize="small" /></IconButton>
            <IconButton size="small" aria-label="Excluir" onClick={() => setToDelete(l)}><DeleteOutline fontSize="small" /></IconButton>
          </CardContent>
        </Card>
      ))}

      {form && <LawDialog initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
      <ConfirmDialog open={Boolean(toDelete)} title="Excluir lei?" danger loading={busy === toDelete?.id}
        message={`"${toDelete?.shortName}" será removida com os vínculos de questões e as marcações dos alunos.`}
        confirmLabel="Excluir" onConfirm={remove} onClose={() => setToDelete(null)} />
    </Box>
  );
}
