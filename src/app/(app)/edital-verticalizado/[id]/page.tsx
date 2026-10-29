'use client';

import { useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Checkbox, Chip, IconButton, Tooltip, LinearProgress, Skeleton, Alert,
  ToggleButtonGroup, ToggleButton, Collapse, Menu, MenuItem, ListItemIcon, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, alpha, useTheme,
} from '@mui/material';
import {
  Checklist, ArrowBack, ExpandMore, ExpandLess, PlayArrow, MoreVert, AccountTree, EditNote, DeleteOutline, Add,
  Replay, Event, NoteAlt,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { studyEditalApi, notebookApi } from '@/lib/api';
import AssuntoPicker from '@/components/questions/AssuntoPicker';

type Item = {
  id: string; discipline: string; label: string; assuntoId: number | null; path: string[] | null; position: number;
  studied: boolean; reviews: number; lastStudiedAt: string | null; notes: string | null;
  questions: number; solved: number; answered: number; accuracy: number | null;
};
type Edital = {
  id: string; name: string; banca: string | null; examDate: string | null; items: Item[];
  total: number; studied: number; withQuestions: number; progress: number;
};
type Filter = 'todos' | 'pendentes' | 'fracos' | 'sem-questoes';

function Accuracy({ item }: { item: Item }) {
  const theme = useTheme();
  if (item.accuracy === null) return <Typography variant="caption" color="text.disabled">—</Typography>;
  const c = item.accuracy >= 70 ? theme.palette.success.main : item.accuracy >= 50 ? theme.palette.warning.main : theme.palette.error.main;
  return (
    <Tooltip title={`${item.answered} resposta(s) neste assunto`}>
      <Chip size="small" label={`${item.accuracy}%`} sx={{ height: 22, fontSize: 11.5, fontWeight: 800, bgcolor: alpha(c, 0.12), color: c, minWidth: 48 }} />
    </Tooltip>
  );
}

export default function EditalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();
  const qc = useQueryClient();
  const key = ['study-edital', id];
  const [filter, setFilter] = useState<Filter>('todos');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState<{ anchor: HTMLElement; item: Item } | null>(null);
  const [assuntoDialog, setAssuntoDialog] = useState<{ item: Item; value: number | null } | null>(null);
  const [notesDialog, setNotesDialog] = useState<{ item: Item; value: string } | null>(null);
  const [addDialog, setAddDialog] = useState<{ discipline: string; label: string; assuntoId: number | null } | null>(null);
  const [practicing, setPracticing] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => studyEditalApi.get(id).then((r) => r.data.data as Edital),
  });

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of data?.items || []) {
      if (!map.has(it.discipline)) map.set(it.discipline, []);
      map.get(it.discipline)!.push(it);
    }
    return [...map.entries()];
  }, [data]);

  const visible = (it: Item) => filter === 'todos'
    || (filter === 'pendentes' && !it.studied)
    || (filter === 'fracos' && it.accuracy !== null && it.accuracy < 60)
    || (filter === 'sem-questoes' && it.answered === 0);

  // Atualização otimista do item (checkbox, revisão)
  const patch = async (item: Item, body: Record<string, unknown>, optimistic?: Partial<Item>) => {
    if (optimistic) qc.setQueryData<Edital>(key, (d) => d && ({
      ...d,
      items: d.items.map((i) => (i.id === item.id ? { ...i, ...optimistic } : i)),
      studied: d.studied + (optimistic.studied !== undefined ? (optimistic.studied ? 1 : 0) - (item.studied ? 1 : 0) : 0),
    }));
    try {
      await studyEditalApi.updateItem(id, item.id, body);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar');
    }
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ['study-editais'] });
  };

  const practice = async (item: Item) => {
    if (!item.assuntoId) { setAssuntoDialog({ item, value: null }); return; }
    setPracticing(item.id);
    try {
      const r = await notebookApi.create({
        name: `${data?.name ? `${data.name} · ` : ''}${item.label}`.slice(0, 180),
        description: `Edital verticalizado — ${item.discipline}`,
        filters: { assuntos: String(item.assuntoId) },
        limit: 30,
        order: 'random',
      });
      router.push(`/cadernos/${r.data.data.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao montar o caderno');
      setPracticing(null);
    }
  };

  const saveAssunto = async () => {
    if (!assuntoDialog) return;
    await patch(assuntoDialog.item, { assuntoId: assuntoDialog.value });
    setAssuntoDialog(null);
  };
  const saveNotes = async () => {
    if (!notesDialog) return;
    await patch(notesDialog.item, { notes: notesDialog.value || null }, { notes: notesDialog.value || null });
    setNotesDialog(null);
  };
  const addItem = async () => {
    if (!addDialog?.label.trim()) return;
    try {
      await studyEditalApi.addItem(id, addDialog);
      toast.success('Tópico adicionado');
      setAddDialog(null);
      qc.invalidateQueries({ queryKey: key });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao adicionar');
    }
  };
  const removeItem = async (item: Item) => {
    try {
      await studyEditalApi.removeItem(id, item.id);
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ['study-editais'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao remover');
    }
  };

  if (isLoading) return <Box sx={{ maxWidth: 1200, mx: 'auto' }}><Skeleton height={80} /><Skeleton variant="rounded" height={400} /></Box>;
  if (error || !data) return <Alert severity="error">Edital não encontrado.</Alert>;

  const days = data.examDate ? dayjs(data.examDate).startOf('day').diff(dayjs().startOf('day'), 'day') : null;
  const pending = data.total - data.studied;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Button component={Link} href="/edital-verticalizado" startIcon={<ArrowBack />} color="inherit" sx={{ mb: 1 }}>Meus editais</Button>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checklist sx={{ color: 'primary.main', fontSize: 32 }} /> {data.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {data.banca && <Chip size="small" label={data.banca} />}
            {days !== null && <Chip size="small" variant="outlined" icon={<Event sx={{ fontSize: 15 }} />}
              label={days > 0 ? `Prova em ${days} dia${days > 1 ? 's' : ''}` : days === 0 ? 'Prova hoje' : 'Prova realizada'} />}
          </Box>
        </Box>
      </Box>

      {/* Resumo */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 2 }}>
        {[
          { label: 'Teoria estudada', value: `${data.progress}%`, sub: `${data.studied} de ${data.total} tópicos`, bar: data.progress },
          { label: 'Tópicos com questões feitas', value: `${data.total ? Math.round((data.withQuestions / data.total) * 100) : 0}%`, sub: `${data.withQuestions} de ${data.total}`, bar: data.total ? (data.withQuestions / data.total) * 100 : 0 },
          { label: 'Faltam', value: String(pending), sub: 'tópicos de teoria' },
          { label: 'Ritmo necessário', value: days && days > 0 ? `${Math.ceil(pending / days)}/dia` : '—', sub: days && days > 0 ? 'tópicos até a prova' : 'informe a data da prova' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent sx={{ py: 1.75, '&:last-child': { pb: 1.75 } }}>
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              <Typography variant="h5" fontWeight={800}>{s.value}</Typography>
              <Typography variant="caption" color="text.secondary">{s.sub}</Typography>
              {s.bar !== undefined && <LinearProgress variant="determinate" value={s.bar} sx={{ mt: 1, height: 6, borderRadius: 3 }} />}
            </CardContent>
          </Card>
        ))}
      </Box>

      <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <ToggleButton value="todos">Todos</ToggleButton>
        <ToggleButton value="pendentes">Teoria pendente</ToggleButton>
        <ToggleButton value="fracos">Acerto abaixo de 60%</ToggleButton>
        <ToggleButton value="sem-questoes">Sem questões feitas</ToggleButton>
      </ToggleButtonGroup>

      {groups.map(([discipline, items]) => {
        const shown = items.filter(visible);
        if (!shown.length && filter !== 'todos') return null;
        const done = items.filter((i) => i.studied).length;
        const isOpen = !collapsed.has(discipline);
        const answered = items.reduce((s, i) => s + i.answered, 0);
        return (
          <Card key={discipline} sx={{ mb: 2 }}>
            <Box onClick={() => setCollapsed((c) => { const n = new Set(c); if (n.has(discipline)) n.delete(discipline); else n.add(discipline); return n; })}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5, cursor: 'pointer', borderBottom: isOpen ? 1 : 0, borderColor: 'divider' }}>
              {isOpen ? <ExpandLess /> : <ExpandMore />}
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography fontWeight={800} noWrap>{discipline}</Typography>
                <Typography variant="caption" color="text.secondary">{done}/{items.length} tópicos · {answered} respostas</Typography>
              </Box>
              <Box sx={{ width: { xs: 70, sm: 140 } }}>
                <LinearProgress variant="determinate" value={(done / items.length) * 100} sx={{ height: 6, borderRadius: 3 }} />
              </Box>
            </Box>
            <Collapse in={isOpen}>
              {/* Cabeçalho das colunas (telas largas) */}
              <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '42px minmax(0,1fr) 110px 110px 70px 120px', gap: 1, px: 2, pt: 1 }}>
                {['Teoria', 'Tópico', 'Revisões', 'Questões', 'Acerto', ''].map((h) => (
                  <Typography key={h} variant="caption" color="text.secondary" fontWeight={700}>{h}</Typography>
                ))}
              </Box>
              {shown.map((it) => (
                <Box key={it.id} sx={{
                  display: 'grid', alignItems: 'center', gap: 1, px: 2, py: 1,
                  gridTemplateColumns: { xs: '42px minmax(0,1fr) auto', md: '42px minmax(0,1fr) 110px 110px 70px 120px' },
                  borderTop: 1, borderColor: 'divider',
                  bgcolor: it.studied ? alpha(theme.palette.success.main, 0.04) : 'transparent',
                }}>
                  <Checkbox checked={it.studied} onChange={(e) => patch(it, { studied: e.target.checked }, { studied: e.target.checked })}
                    inputProps={{ 'aria-label': `Teoria estudada: ${it.label}` }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500}>{it.label}</Typography>
                    <Typography variant="caption" color={it.path ? 'text.secondary' : 'warning.main'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} noWrap>
                      <AccountTree sx={{ fontSize: 13 }} />
                      {it.path ? it.path.slice(1).join(' › ') || it.path[0] : 'Sem assunto ligado — escolha no menu ⋮'}
                    </Typography>
                    {it.notes && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }} noWrap>📝 {it.notes}</Typography>}
                    {/* Métricas em telas pequenas */}
                    <Box sx={{ display: { xs: 'flex', md: 'none' }, gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary">{it.reviews} rev. · {it.solved}/{it.questions} questões</Typography>
                      <Accuracy item={it} />
                    </Box>
                  </Box>
                  <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 0.5 }}>
                    <Typography fontWeight={700} sx={{ minWidth: 18 }}>{it.reviews}</Typography>
                    <Tooltip title={it.lastStudiedAt ? `Última vez: ${dayjs(it.lastStudiedAt).format('DD/MM/YYYY')}` : 'Registrar revisão'}>
                      <IconButton size="small" onClick={() => patch(it, { addReview: true }, { reviews: it.reviews + 1, studied: true })} aria-label="Registrar revisão">
                        <Replay fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body2" sx={{ display: { xs: 'none', md: 'block' } }} color={it.questions ? 'text.primary' : 'text.disabled'}>
                    {it.solved} / {it.questions}
                  </Typography>
                  <Box sx={{ display: { xs: 'none', md: 'block' } }}><Accuracy item={it} /></Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    <Tooltip title={it.questions ? `Caderno com questões de "${it.path?.at(-1)}"` : 'Sem questões no banco para este assunto'}>
                      <span>
                        <Button size="small" variant="outlined" onClick={() => practice(it)} disabled={Boolean(practicing) || (Boolean(it.assuntoId) && !it.questions)}
                          startIcon={practicing === it.id ? <CircularProgress size={14} /> : <PlayArrow />} sx={{ minWidth: 0, px: 1 }}>
                          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Praticar</Box>
                        </Button>
                      </span>
                    </Tooltip>
                    <IconButton size="small" onClick={(e) => setMenu({ anchor: e.currentTarget, item: it })} aria-label="Mais opções"><MoreVert fontSize="small" /></IconButton>
                  </Box>
                </Box>
              ))}
              <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider' }}>
                <Button size="small" startIcon={<Add />} onClick={() => setAddDialog({ discipline, label: '', assuntoId: null })}>Adicionar tópico</Button>
              </Box>
            </Collapse>
          </Card>
        );
      })}

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setAssuntoDialog({ item: menu!.item, value: menu!.item.assuntoId }); setMenu(null); }}>
          <ListItemIcon><AccountTree fontSize="small" /></ListItemIcon>Ligar a outro assunto
        </MenuItem>
        <MenuItem onClick={() => { setNotesDialog({ item: menu!.item, value: menu!.item.notes || '' }); setMenu(null); }}>
          <ListItemIcon><NoteAlt fontSize="small" /></ListItemIcon>Anotação
        </MenuItem>
        <MenuItem onClick={() => { patch(menu!.item, { reviews: 0 }, { reviews: 0 }); setMenu(null); }}>
          <ListItemIcon><EditNote fontSize="small" /></ListItemIcon>Zerar revisões
        </MenuItem>
        <MenuItem onClick={() => { removeItem(menu!.item); setMenu(null); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteOutline fontSize="small" color="error" /></ListItemIcon>Remover tópico
        </MenuItem>
      </Menu>

      <Dialog open={Boolean(assuntoDialog)} onClose={() => setAssuntoDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Assunto do tópico</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{assuntoDialog?.item.label}</Typography>
          <AssuntoPicker value={assuntoDialog?.value ?? null} onChange={(v) => setAssuntoDialog((d) => d && { ...d, value: v })}
            helperText="As questões, o acerto e o botão Praticar usam este assunto (e os subassuntos dele)." />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setAssuntoDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveAssunto}>Salvar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(notesDialog)} onClose={() => setNotesDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Anotação do tópico</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth multiline minRows={4} value={notesDialog?.value || ''} sx={{ mt: 1 }}
            onChange={(e) => setNotesDialog((d) => d && { ...d, value: e.target.value })}
            placeholder="Ex.: rever súmulas; material do curso X, aula 4" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setNotesDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveNotes}>Salvar</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(addDialog)} onClose={() => setAddDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Novo tópico em {addDialog?.discipline}</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2 }}>
          <TextField autoFocus label="Tópico" value={addDialog?.label || ''} sx={{ mt: 1 }}
            onChange={(e) => setAddDialog((d) => d && { ...d, label: e.target.value })} />
          <AssuntoPicker value={addDialog?.assuntoId ?? null} onChange={(v) => setAddDialog((d) => d && { ...d, assuntoId: v })}
            label="Assunto na árvore (opcional)" helperText="Se ficar vazio, o sistema tenta reconhecer pelo nome." />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setAddDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={addItem} disabled={!addDialog?.label.trim()}>Adicionar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
