'use client';

import { useState } from 'react';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, CircularProgress, Typography,
} from '@mui/material';
import { PlaylistAdd, MenuBook, Add } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { notebookApi } from '@/lib/api';

export default function AddToNotebookButton({ questionId }: { questionId: string }) {
  const qc = useQueryClient();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: notebooks = [], isLoading } = useQuery({
    queryKey: ['notebooks', 'all'],
    queryFn: () => notebookApi.list().then((r) => r.data.data as any[]),
    enabled: Boolean(anchor),
    staleTime: 30_000,
  });

  const add = async (notebookId: string) => {
    setAnchor(null);
    try {
      const r = await notebookApi.addQuestions(notebookId, [questionId]);
      toast.success(r.data.message);
      qc.invalidateQueries({ queryKey: ['notebooks'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao adicionar');
    }
  };

  const createWith = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await notebookApi.create({ name: name.trim(), questionIds: [questionId] });
      toast.success(`Caderno "${name.trim()}" criado com esta questão`);
      qc.invalidateQueries({ queryKey: ['notebooks'] });
      setNewOpen(false);
      setName('');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao criar caderno');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="small" color="inherit" startIcon={<PlaylistAdd fontSize="small" />} onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: 'text.secondary' }}>
        Caderno
      </Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} slotProps={{ paper: { sx: { maxHeight: 360, minWidth: 260 } } }}>
        <MenuItem onClick={() => { setAnchor(null); setNewOpen(true); }}>
          <ListItemIcon><Add fontSize="small" /></ListItemIcon>
          <ListItemText primary="Novo caderno" />
        </MenuItem>
        <Divider />
        {isLoading && <MenuItem disabled><CircularProgress size={16} sx={{ mr: 1 }} /> Carregando...</MenuItem>}
        {!isLoading && notebooks.length === 0 && (
          <MenuItem disabled><Typography variant="body2">Você ainda não tem cadernos</Typography></MenuItem>
        )}
        {notebooks.map((n) => (
          <MenuItem key={n.id} onClick={() => add(n.id)}>
            <ListItemIcon><MenuBook fontSize="small" sx={{ color: n.folder?.color }} /></ListItemIcon>
            <ListItemText primary={n.name} secondary={`${n.total} questões${n.folder ? ` · ${n.folder.name}` : ''}`} />
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Novo caderno</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Nome do caderno" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createWith(); }} sx={{ mt: 1 }} placeholder="Ex.: Revisão de Constitucional" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setNewOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={createWith} disabled={!name.trim() || saving}>
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
