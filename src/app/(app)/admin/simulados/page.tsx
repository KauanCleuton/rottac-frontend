'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  FormControlLabel, Switch, Alert, Skeleton, IconButton, Tooltip, CircularProgress, Autocomplete,
} from '@mui/material';
import { EmojiEvents, Add, Edit, DeleteOutline, Leaderboard, RemoveCircleOutline } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { examApi, questionBankApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { AssuntoMultiPicker } from '@/components/questions/AssuntoPicker';
import ConfirmDialog from '@/components/common/ConfirmDialog';

type Exam = {
  id: string; title: string; description: string | null; banca: string | null; cargo: string | null;
  startsAt: string; endsAt: string; durationMinutes: number; cutoffScore: number | null; wrongPenalty: boolean;
  isPremium: boolean; isPublished: boolean; phase: string; questions: number; participants: number;
};
type Block = { assuntos: number[]; count: number };
type Form = {
  id?: string; title: string; description: string; banca: string; cargo: string; startsAt: string; endsAt: string;
  durationMinutes: number; cutoffScore: string; wrongPenalty: boolean; isPremium: boolean; isPublished: boolean;
  filterBanca: string | null; blocks: Block[]; participants?: number;
};

const local = (d: Date | string) => dayjs(d).format('YYYY-MM-DDTHH:mm');
const PHASE: Record<string, string> = { upcoming: 'Em breve', open: 'Aberto', closed: 'Encerrado' };

function ExamDialog({ initial, onClose, onSaved }: { initial: Form; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Form>(initial);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const editing = Boolean(f.id);
  const { data: filters } = useQuery({ queryKey: ['question-bank-filters'], queryFn: () => questionBankApi.filters().then((r) => r.data.data) });
  const bancas: string[] = (filters?.banca || []).map((b: { value: string }) => b.value);
  const total = f.blocks.reduce((s, b) => s + (Number(b.count) || 0), 0);
  const locked = editing && (f.participants || 0) > 0;

  const save = async () => {
    setBusy(true);
    const body: Record<string, unknown> = {
      title: f.title, description: f.description || null, banca: f.banca || null, cargo: f.cargo || null,
      startsAt: new Date(f.startsAt).toISOString(), endsAt: new Date(f.endsAt).toISOString(),
      durationMinutes: Number(f.durationMinutes), cutoffScore: f.cutoffScore === '' ? null : Number(f.cutoffScore),
      wrongPenalty: f.wrongPenalty, isPremium: f.isPremium, isPublished: f.isPublished,
    };
    if (!editing) {
      body.filters = { ...(f.filterBanca ? { banca: f.filterBanca } : {}), hideOutdated: '1' };
      body.blocks = f.blocks.map((b) => ({ ...(b.assuntos.length ? { assuntos: b.assuntos.join(',') } : {}), count: b.count }));
    }
    try {
      const r = editing ? await examApi.update(f.id!, body) : await examApi.create(body);
      toast.success(r.data.message);
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar');
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{editing ? 'Editar simulado' : 'Novo simulado'}</DialogTitle>
      <DialogContent dividers sx={{ display: 'grid', gap: 2 }}>
        <TextField label="Título" placeholder="Simulado TJ-CE — Técnico Judiciário" value={f.title} onChange={(e) => set({ title: e.target.value })} required autoFocus />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Banca (exibida)" value={f.banca} onChange={(e) => set({ banca: e.target.value })} />
          <TextField label="Cargo (exibido)" value={f.cargo} onChange={(e) => set({ cargo: e.target.value })} />
        </Box>
        <TextField label="Descrição / orientações" multiline minRows={2} value={f.description} onChange={(e) => set({ description: e.target.value })} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Pode começar a partir de" type="datetime-local" value={f.startsAt} onChange={(e) => set({ startsAt: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
          <TextField label="Pode começar até" type="datetime-local" value={f.endsAt} onChange={(e) => set({ endsAt: e.target.value })} slotProps={{ inputLabel: { shrink: true } }}
            helperText="Para uma prova no mesmo horário para todos, deixe uma janela curta (ex.: 15 min)." />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <TextField label="Duração da prova (minutos)" type="number" value={f.durationMinutes} disabled={locked}
            onChange={(e) => set({ durationMinutes: Number(e.target.value) })} />
          <TextField label="Nota de corte (pontos)" type="number" value={f.cutoffScore} onChange={(e) => set({ cutoffScore: e.target.value })}
            helperText="Vazio = sem nota de corte" />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControlLabel disabled={locked} control={<Switch checked={f.wrongPenalty} onChange={(e) => set({ wrongPenalty: e.target.checked })} />} label="Uma errada anula uma certa" />
          <FormControlLabel control={<Switch checked={f.isPremium} onChange={(e) => set({ isPremium: e.target.checked })} />} label="Só assinantes (recurso Simulados)" />
          <FormControlLabel control={<Switch checked={f.isPublished} onChange={(e) => set({ isPublished: e.target.checked })} />} label="Publicado" />
        </Box>
        {locked && <Alert severity="info">Já há participantes: duração e penalidade ficaram travadas.</Alert>}

        {!editing && (
          <Box>
            <Typography fontWeight={800}>Questões ({total})</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Monte blocos como na prova real (ex.: 10 de Português, 10 de Constitucional). As questões são sorteadas entre as públicas com gabarito, sem repetir.
            </Typography>
            <Autocomplete size="small" options={bancas} value={f.filterBanca} onChange={(_, v) => set({ filterBanca: v })} sx={{ mb: 1.5, maxWidth: 360 }}
              renderInput={(p) => <TextField {...p} label="Só questões da banca (opcional)" />} />
            {f.blocks.map((b, i) => (
              <Box key={i} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 90px auto', sm: '1fr 110px auto' }, gap: 1, mb: 1, alignItems: 'center' }}>
                <AssuntoMultiPicker value={b.assuntos} label={`Bloco ${i + 1}: matérias/assuntos`}
                  onChange={(ids) => set({ blocks: f.blocks.map((x, j) => (j === i ? { ...x, assuntos: ids } : x)) })} />
                <TextField size="small" type="number" label="Qtd." value={b.count}
                  onChange={(e) => set({ blocks: f.blocks.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)) })} />
                <IconButton size="small" disabled={f.blocks.length === 1} onClick={() => set({ blocks: f.blocks.filter((_, j) => j !== i) })} aria-label="Remover bloco">
                  <RemoveCircleOutline fontSize="small" />
                </IconButton>
              </Box>
            ))}
            <Button size="small" startIcon={<Add />} onClick={() => set({ blocks: [...f.blocks, { assuntos: [], count: 10 }] })}>Adicionar bloco</Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="contained" onClick={save} disabled={busy || !f.title.trim() || !f.startsAt || !f.endsAt || (!editing && !total)}>
          {busy ? <CircularProgress size={18} color="inherit" /> : editing ? 'Salvar' : `Criar com ${total} questões`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AdminSimuladosPage() {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [form, setForm] = useState<Form | null>(null);
  const [toDelete, setToDelete] = useState<Exam | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ['admin', 'exams'],
    queryFn: () => examApi.adminList().then((r) => r.data.data as Exam[]),
    enabled: isAdmin,
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin', 'exams'] }); qc.invalidateQueries({ queryKey: ['exams'] }); };

  if (!isAdmin) return <Alert severity="warning">Área exclusiva para administradores.</Alert>;

  const blank = (): Form => {
    const start = dayjs().add(1, 'day').hour(9).minute(0);
    return {
      title: '', description: '', banca: '', cargo: '', startsAt: local(start.toDate()), endsAt: local(start.add(15, 'minute').toDate()),
      durationMinutes: 240, cutoffScore: '', wrongPenalty: false, isPremium: false, isPublished: true,
      filterBanca: null, blocks: [{ assuntos: [], count: 10 }],
    };
  };
  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await examApi.remove(toDelete.id);
      toast.success('Simulado excluído');
      setToDelete(null);
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEvents sx={{ color: 'primary.main', fontSize: 32 }} /> Simulados com ranking
          </Typography>
          <Typography color="text.secondary">Crie edições com data marcada, nota de corte e acesso livre ou só para assinantes.</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setForm(blank())}>Novo simulado</Button>
      </Box>

      {isLoading ? <Skeleton variant="rounded" height={200} /> : !data.length ? (
        <Alert severity="info">Nenhum simulado criado.</Alert>
      ) : data.map((e) => (
        <Card key={e.id} sx={{ mb: 1.5 }}>
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Box sx={{ flexGrow: 1, minWidth: 220 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography fontWeight={800}>{e.title}</Typography>
                <Chip size="small" label={PHASE[e.phase]} color={e.phase === 'open' ? 'success' : 'default'} variant="outlined" />
                {!e.isPublished && <Chip size="small" label="Rascunho" />}
                {e.isPremium && <Chip size="small" label="Premium" color="primary" />}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {dayjs(e.startsAt).format('DD/MM HH:mm')} → {dayjs(e.endsAt).format('DD/MM HH:mm')} · {e.questions} questões · {e.durationMinutes} min · {e.participants} participantes
              </Typography>
            </Box>
            <Button size="small" startIcon={<Leaderboard />} component={Link} href={`/simulados/${e.id}?ver=resultado`}>Ranking</Button>
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => setForm({
                id: e.id, title: e.title, description: e.description || '', banca: e.banca || '', cargo: e.cargo || '',
                startsAt: local(e.startsAt), endsAt: local(e.endsAt), durationMinutes: e.durationMinutes,
                cutoffScore: e.cutoffScore === null ? '' : String(e.cutoffScore), wrongPenalty: e.wrongPenalty, isPremium: e.isPremium,
                isPublished: e.isPublished, filterBanca: null, blocks: [], participants: e.participants,
              })} aria-label="Editar"><Edit fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Excluir">
              <IconButton size="small" onClick={() => setToDelete(e)} aria-label="Excluir"><DeleteOutline fontSize="small" /></IconButton>
            </Tooltip>
          </CardContent>
        </Card>
      ))}

      {form && <ExamDialog initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); refresh(); }} />}
      <ConfirmDialog open={Boolean(toDelete)} title="Excluir simulado?" danger loading={deleting}
        message={`"${toDelete?.title}" e o ranking (${toDelete?.participants || 0} participantes) serão apagados. As respostas já contam nas estatísticas dos alunos.`}
        confirmLabel="Excluir" onConfirm={remove} onClose={() => setToDelete(null)} />
    </Box>
  );
}
