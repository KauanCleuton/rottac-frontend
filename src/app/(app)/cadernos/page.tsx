'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, List, ListItemButton, ListItemIcon, ListItemText,
  IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip,
  LinearProgress, Skeleton, alpha, useTheme, Tooltip,
} from '@mui/material';
import {
  Add, CreateNewFolder, Folder, FolderOpen, MoreVert, MenuBook, Inbox, PlayArrow, LibraryBooks,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { notebookApi } from '@/lib/api';
import ConfirmDialog from '@/components/common/ConfirmDialog';

const FOLDER_COLORS = ['#F2B705', '#EF4444', '#3B82F6', '#22C55E', '#A855F7', '#F97316', '#14B8A6', '#9CA3AF'];

type Folder = { id: string; name: string; color: string; notebookCount: number };
type Notebook = {
  id: string; name: string; description?: string | null; folder?: { id: string; name: string; color: string } | null;
  total: number; answered: number; correct: number; accuracy: number | null; disciplines: string[]; updatedAt: string;
};

export default function CadernosPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>(''); // '' = todos, 'none' = sem pasta
  const [folderDialog, setFolderDialog] = useState<{ id?: string; name: string; color: string } | null>(null);
  const [folderMenu, setFolderMenu] = useState<{ anchor: HTMLElement; folder: Folder } | null>(null);
  const [nbMenu, setNbMenu] = useState<{ anchor: HTMLElement; nb: Notebook } | null>(null);
  const [moveTarget, setMoveTarget] = useState<Notebook | null>(null);
  const [toDelete, setToDelete] = useState<{ kind: 'folder' | 'notebook'; id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: folders = [] } = useQuery({
    queryKey: ['notebook-folders'],
    queryFn: () => notebookApi.folders().then((r) => r.data.data as Folder[]),
  });
  const { data: notebooks = [], isLoading } = useQuery({
    queryKey: ['notebooks', selected],
    queryFn: () => notebookApi.list(selected || undefined).then((r) => r.data.data as Notebook[]),
  });

  // Novo caderno já nasce na pasta aberta
  const newHref = selected && selected !== 'none' ? `/cadernos/novo?pasta=${selected}` : '/cadernos/novo';

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notebooks'] });
    qc.invalidateQueries({ queryKey: ['notebook-folders'] });
  };

  const saveFolder = async () => {
    if (!folderDialog?.name.trim()) return;
    try {
      if (folderDialog.id) await notebookApi.updateFolder(folderDialog.id, { name: folderDialog.name, color: folderDialog.color });
      else await notebookApi.createFolder({ name: folderDialog.name, color: folderDialog.color });
      toast.success(folderDialog.id ? 'Pasta atualizada' : 'Pasta criada');
      setFolderDialog(null);
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar pasta');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      if (toDelete.kind === 'folder') {
        await notebookApi.deleteFolder(toDelete.id);
        if (selected === toDelete.id) setSelected('');
      } else {
        await notebookApi.remove(toDelete.id);
      }
      toast.success(toDelete.kind === 'folder' ? 'Pasta removida (cadernos mantidos)' : 'Caderno excluído');
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const moveTo = async (folderId: string | null) => {
    if (!moveTarget) return;
    try {
      await notebookApi.update(moveTarget.id, { folderId });
      toast.success('Caderno movido');
      setMoveTarget(null);
      refresh();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao mover');
    }
  };

  const folderItem = (key: string, label: string, icon: React.ReactNode, count?: number, folder?: Folder) => (
    <ListItemButton key={key} selected={selected === key} onClick={() => setSelected(key)} sx={{ borderRadius: 2, mb: 0.25, pr: folder ? 0.5 : 2 }}>
      <ListItemIcon sx={{ minWidth: 34 }}>{icon}</ListItemIcon>
      <ListItemText primary={label} primaryTypographyProps={{ noWrap: true, fontSize: 14, fontWeight: selected === key ? 700 : 500 }} />
      {count !== undefined && <Typography variant="caption" color="text.secondary" sx={{ mr: folder ? 0 : 0 }}>{count}</Typography>}
      {folder && (
        <IconButton size="small" aria-label="Opções da pasta" onClick={(e) => { e.stopPropagation(); setFolderMenu({ anchor: e.currentTarget, folder }); }}>
          <MoreVert fontSize="small" />
        </IconButton>
      )}
    </ListItemButton>
  );

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MenuBook sx={{ color: 'primary.main', fontSize: 32 }} /> Cadernos de Questões
          </Typography>
          <Typography color="text.secondary">
            Organize questões por objetivo. Ao resolver, você recebe um diagnóstico com o próximo passo de estudo.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<CreateNewFolder />} onClick={() => setFolderDialog({ name: '', color: FOLDER_COLORS[0] })}>
          Nova pasta
        </Button>
        <Button variant="contained" startIcon={<Add />} component={Link} href={newHref}>Novo caderno</Button>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>Pastas</Typography>
              <List dense disablePadding>
                {folderItem('', 'Todos os cadernos', <LibraryBooks fontSize="small" />)}
                {folderItem('none', 'Sem pasta', <Inbox fontSize="small" />)}
                {folders.map((f) => folderItem(f.id, f.name,
                  selected === f.id ? <FolderOpen fontSize="small" sx={{ color: f.color }} /> : <Folder fontSize="small" sx={{ color: f.color }} />,
                  f.notebookCount, f))}
              </List>
              {folders.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: 'block', mt: 1 }}>
                  Crie pastas para separar por matéria, concurso ou fase de estudo.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 9 }}>
          {isLoading ? (
            <Grid container spacing={2}>
              {[0, 1, 2].map((i) => <Grid key={i} size={{ xs: 12, sm: 6, lg: 4 }}><Skeleton variant="rounded" height={190} /></Grid>)}
            </Grid>
          ) : notebooks.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 7 }}>
                <MenuBook sx={{ fontSize: 56, color: 'text.disabled' }} />
                <Typography variant="h6" sx={{ mt: 1 }}>Nenhum caderno aqui</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Monte um caderno por filtros (ex.: 50 questões de Direito Constitucional) ou adicione questões pelo banco.
                </Typography>
                <Button variant="contained" startIcon={<Add />} component={Link} href={newHref}>Montar caderno</Button>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={2}>
              {notebooks.map((n) => {
                const progress = n.total ? Math.round((n.answered / n.total) * 100) : 0;
                const accColor = n.accuracy === null ? theme.palette.text.secondary : n.accuracy >= 70 ? '#22C55E' : n.accuracy >= 40 ? '#F59E0B' : '#EF4444';
                return (
                  <Grid key={n.id} size={{ xs: 12, sm: 6, lg: 4 }}>
                    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'border-color .15s', '&:hover': { borderColor: alpha(theme.palette.primary.main, 0.5) } }}>
                      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', '&:last-child': { pb: 2 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={800} sx={{ lineHeight: 1.3 }}>{n.name}</Typography>
                            {n.folder && (
                              <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                <Folder sx={{ fontSize: 13, color: n.folder.color }} /> {n.folder.name}
                              </Typography>
                            )}
                          </Box>
                          <IconButton size="small" aria-label="Opções do caderno" onClick={(e) => setNbMenu({ anchor: e.currentTarget, nb: n })}>
                            <MoreVert fontSize="small" />
                          </IconButton>
                        </Box>

                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1, minHeight: 24 }}>
                          {n.disciplines.map((d) => <Chip key={d} label={d} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />)}
                        </Box>

                        <Box sx={{ mt: 'auto', pt: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">{n.answered}/{n.total} resolvidas</Typography>
                            <Tooltip title="Aproveitamento neste caderno">
                              <Typography variant="caption" sx={{ fontWeight: 800, color: accColor }}>
                                {n.accuracy === null ? '—' : `${n.accuracy}%`}
                              </Typography>
                            </Tooltip>
                          </Box>
                          <LinearProgress variant="determinate" value={progress} sx={{ height: 6 }} />
                          <Button fullWidth variant={n.answered ? 'outlined' : 'contained'} startIcon={<PlayArrow />} sx={{ mt: 1.5 }}
                            component={Link} href={`/cadernos/${n.id}`}>
                            {n.answered === 0 ? 'Começar' : n.answered < n.total ? 'Continuar' : 'Ver resultado'}
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Grid>
      </Grid>

      {/* Menus */}
      <Menu anchorEl={folderMenu?.anchor} open={Boolean(folderMenu)} onClose={() => setFolderMenu(null)}>
        <MenuItem onClick={() => { setFolderDialog({ id: folderMenu!.folder.id, name: folderMenu!.folder.name, color: folderMenu!.folder.color }); setFolderMenu(null); }}>
          Renomear / cor
        </MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { setToDelete({ kind: 'folder', id: folderMenu!.folder.id, name: folderMenu!.folder.name }); setFolderMenu(null); }}>
          Excluir pasta
        </MenuItem>
      </Menu>
      <Menu anchorEl={nbMenu?.anchor} open={Boolean(nbMenu)} onClose={() => setNbMenu(null)}>
        <MenuItem onClick={() => { setMoveTarget(nbMenu!.nb); setNbMenu(null); }}>Mover para pasta</MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { setToDelete({ kind: 'notebook', id: nbMenu!.nb.id, name: nbMenu!.nb.name }); setNbMenu(null); }}>
          Excluir caderno
        </MenuItem>
      </Menu>

      {/* Pasta: criar/editar */}
      <Dialog open={Boolean(folderDialog)} onClose={() => setFolderDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{folderDialog?.id ? 'Editar pasta' : 'Nova pasta'}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Nome" value={folderDialog?.name || ''} sx={{ mt: 1 }}
            onChange={(e) => setFolderDialog((f) => f && { ...f, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') saveFolder(); }} placeholder="Ex.: TJ-CE 2026" />
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
            {FOLDER_COLORS.map((c) => (
              <Box key={c} role="button" tabIndex={0} aria-label={`Cor ${c}`}
                onClick={() => setFolderDialog((f) => f && { ...f, color: c })}
                onKeyDown={(e) => { if (e.key === 'Enter') setFolderDialog((f) => f && { ...f, color: c }); }}
                sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                  outline: folderDialog?.color === c ? `3px solid ${theme.palette.text.primary}` : 'none', outlineOffset: 2 }} />
            ))}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setFolderDialog(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveFolder} disabled={!folderDialog?.name.trim()}>Salvar</Button>
        </DialogActions>
      </Dialog>

      {/* Mover caderno */}
      <Dialog open={Boolean(moveTarget)} onClose={() => setMoveTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Mover “{moveTarget?.name}”</DialogTitle>
        <List sx={{ px: 1, pb: 2 }}>
          <ListItemButton onClick={() => moveTo(null)} selected={!moveTarget?.folder}>
            <ListItemIcon><Inbox /></ListItemIcon><ListItemText primary="Sem pasta" />
          </ListItemButton>
          {folders.map((f) => (
            <ListItemButton key={f.id} onClick={() => moveTo(f.id)} selected={moveTarget?.folder?.id === f.id}>
              <ListItemIcon><Folder sx={{ color: f.color }} /></ListItemIcon><ListItemText primary={f.name} />
            </ListItemButton>
          ))}
        </List>
      </Dialog>

      <ConfirmDialog open={Boolean(toDelete)} danger loading={deleting}
        title={toDelete?.kind === 'folder' ? 'Excluir pasta?' : 'Excluir caderno?'}
        message={toDelete?.kind === 'folder'
          ? `A pasta "${toDelete?.name}" será removida. Os cadernos dentro dela continuam existindo, sem pasta.`
          : `O caderno "${toDelete?.name}" será excluído. Suas respostas continuam no histórico e nas estatísticas.`}
        confirmLabel="Excluir" onConfirm={confirmDelete} onClose={() => setToDelete(null)} />

    </Box>
  );
}
