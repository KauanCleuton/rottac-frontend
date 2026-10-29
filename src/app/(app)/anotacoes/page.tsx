'use client';

import { useState, useMemo } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button, Chip,
  IconButton, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, alpha, useTheme, CircularProgress, Tooltip,
  InputAdornment, FormControl, InputLabel, Select, MenuItem,
} from '@mui/material';
import {
  Add, Delete, Edit, Notes, Search, PushPin, PushPinOutlined,
  Label, Close,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { noteApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');

const NOTE_COLORS = ['#F2B705', '#3B82F6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6'];

export default function AnotacoesPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editNote, setEditNote] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [form, setForm] = useState({ title: '', content: '', tags: '', subjectId: '', color: '#F2B705' });

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['notes'],
    queryFn: () => noteApi.getAll().then(r => r.data.data || []),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-simple'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach((n: any) => n.tags?.forEach((t: string) => tags.add(t)));
    return Array.from(tags);
  }, [notes]);

  const filtered = useMemo(() => {
    let result = notes as any[];
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((n: any) => n.title?.toLowerCase().includes(lower) || n.content?.toLowerCase().includes(lower));
    }
    if (filterTag) result = result.filter((n: any) => n.tags?.includes(filterTag));
    const pinned = result.filter((n: any) => n.isPinned);
    const unpinned = result.filter((n: any) => !n.isPinned);
    return [...pinned, ...unpinned];
  }, [notes, search, filterTag]);

  const createMutation = useMutation({
    mutationFn: (data: any) => noteApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      setCreateOpen(false);
      resetForm();
      toast.success('Anotação criada!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => noteApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] });
      setEditNote(null);
      resetForm();
      toast.success('Anotação atualizada!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => noteApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); toast.success('Removida'); },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }: any) => noteApi.update(id, { isPinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  });

  const resetForm = () => setForm({ title: '', content: '', tags: '', subjectId: '', color: '#F2B705' });

  const openEdit = (note: any) => {
    setForm({ title: note.title || '', content: note.content || '', tags: note.tags?.join(', ') || '', subjectId: note.subjectId || '', color: note.color || '#F2B705' });
    setEditNote(note);
  };

  const handleSubmit = () => {
    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      subjectId: form.subjectId || null,
    };
    if (editNote) updateMutation.mutate({ id: editNote.id, data: payload });
    else createMutation.mutate(payload);
  };

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Anotações</Typography>
          <Typography color="text.secondary" variant="body2">{notes.length} anotações · {notes.filter((n: any) => n.isPinned).length} fixadas</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { resetForm(); setCreateOpen(true); }}>
          Nova Anotação
        </Button>
      </Box>

      {/* Search + Tag Filter */}
      <Box sx={{ mb: 2.5, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Buscar anotações..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flexGrow: 1, minWidth: 200 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        {allTags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">Tags:</Typography>
            {allTags.map(tag => (
              <Chip key={tag} label={tag} size="small" icon={<Label sx={{ fontSize: '12px !important' }} />}
                onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                color={filterTag === tag ? 'primary' : 'default'}
                variant={filterTag === tag ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        )}
      </Box>

      {notes.length === 0 ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 8 }}>
          <Notes sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6">Nenhuma anotação ainda</Typography>
          <Typography color="text.secondary" mb={2}>Registre conceitos, resumos e macetes importantes</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>Criar primeira anotação</Button>
        </CardContent></Card>
      ) : (
        <Grid container spacing={2}>
          {filtered.map((note: any) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={note.id}>
              <Card sx={{
                borderTop: `4px solid ${note.color || '#F2B705'}`,
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${alpha(note.color || '#F2B705', 0.2)}` },
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography fontWeight={700} noWrap sx={{ flexGrow: 1 }}>{note.title || 'Sem título'}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.25 }}>
                      <Tooltip title={note.isPinned ? 'Desafixar' : 'Fixar'}>
                        <IconButton size="small" onClick={() => pinMutation.mutate({ id: note.id, isPinned: !note.isPinned })}>
                          {note.isPinned ? <PushPin fontSize="small" color="primary" /> : <PushPinOutlined fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" onClick={() => openEdit(note)}><Edit fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(note.id)}><Delete fontSize="small" /></IconButton>
                    </Box>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{
                    display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden', whiteSpace: 'pre-wrap', mb: 1.5,
                  }}>
                    {note.content || 'Sem conteúdo'}
                  </Typography>

                  {note.tags?.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                      {note.tags.map((tag: string) => (
                        <Chip key={tag} label={tag} size="small"
                          sx={{ height: 18, fontSize: 10, bgcolor: alpha(note.color || '#F2B705', 0.1), color: note.color || 'text.secondary' }} />
                      ))}
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(note.updatedAt).format('DD/MM/YYYY')}
                    </Typography>
                    {note.subject && (
                      <Chip label={note.subject.name} size="small"
                        sx={{ height: 18, fontSize: 10, bgcolor: alpha(note.subject.color || '#888', 0.1), color: note.subject.color }} />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog Criar/Editar */}
      <Dialog open={createOpen || Boolean(editNote)} onClose={() => { setCreateOpen(false); setEditNote(null); }} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>{editNote ? 'Editar Anotação' : 'Nova Anotação'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Título" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título da anotação..." />

          <TextField label="Conteúdo *" multiline rows={8} value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="Escreva seus conceitos, resumos, macetes..." />

          <TextField label="Tags (separadas por vírgula)" value={form.tags}
            onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            placeholder="Ex: lei seca, princípios, resumo" />

          <Grid container spacing={2}>
            <Grid size={8}>
              <FormControl fullWidth size="small">
                <InputLabel>Disciplina (opcional)</InputLabel>
                <Select value={form.subjectId} label="Disciplina (opcional)"
                  onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}>
                  <MenuItem value="">Nenhuma</MenuItem>
                  {subjects.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={4}>
              <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Cor</Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {NOTE_COLORS.map(c => (
                  <Box key={c} onClick={() => setForm(f => ({ ...f, color: c }))}
                    sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                      border: form.color === c ? '2px solid #fff' : '2px solid transparent',
                      boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none', transition: 'transform 0.1s',
                      '&:hover': { transform: 'scale(1.15)' } }}
                  />
                ))}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setCreateOpen(false); setEditNote(null); }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit}
            disabled={!form.content || createMutation.isPending || updateMutation.isPending}>
            {editNote ? 'Salvar' : 'Criar Anotação'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
