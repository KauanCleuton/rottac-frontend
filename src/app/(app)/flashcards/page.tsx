'use client';

import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, Chip,
  IconButton, LinearProgress, alpha, useTheme, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  CircularProgress, Tooltip, Divider, Paper, Badge, Menu, MenuItem,
  List, ListItemButton, ListItemText, ListItemIcon, InputAdornment,
} from '@mui/material';
import {
  Add, FlashOn, CheckCircle, Cancel, Schedule, FolderOpen,
  ThumbUp, ThumbDown, AutoAwesome, LocalFireDepartment,
  Star, FitnessCenter, PlayArrow, MoreVert, Edit, Delete,
  Folder, CreateNewFolder, MoveToInbox, BarChart, Close,
  KeyboardArrowLeft, KeyboardArrowRight,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flashcardApi, flashcardFolderApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { BRAND_GRADIENT } from '@/theme';
import FlipCard from '@/components/flashcards/FlipCard';

const STUDY_MODES = [
  { key: 'due', label: 'Revisar Hoje', icon: <Schedule />, color: '#F59E0B', desc: 'Cards com revisão vencida (SM-2)' },
  { key: 'weak', label: 'Cards Fracos', icon: <FitnessCenter />, color: '#EF4444', desc: 'Acerto abaixo de 60%' },
  { key: 'new', label: 'Cards Novos', icon: <Star />, color: '#10B981', desc: 'Nunca revisados' },
  { key: 'marathon', label: 'Maratona', icon: <LocalFireDepartment />, color: '#F2B705', desc: 'Todos os cards embaralhados' },
];

const FOLDER_COLORS = ['#F2B705', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#D4A017', '#14B8A6'];

const RATING_OPTIONS = [
  { value: 0, label: 'Errei', color: '#EF4444' },
  { value: 1, label: 'Difícil', color: '#F59E0B' },
  { value: 2, label: 'Ok', color: '#3B82F6' },
  { value: 3, label: 'Fácil', color: '#10B981' },
];

export default function FlashcardsPage() {
  const theme = useTheme();
  const qc = useQueryClient();

  // ── Estado principal
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = todos
  const [studyMode, setStudyMode] = useState<string | null>(null);
  const [studyQueue, setStudyQueue] = useState<any[]>([]);
  const [studyIndex, setStudyIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ correct: 0, wrong: 0, total: 0 });

  // ── Dialogs
  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [moveCardOpen, setMoveCardOpen] = useState<string | null>(null); // cardId
  const [folderMenu, setFolderMenu] = useState<{ anchor: HTMLElement; id: string } | null>(null);

  // ── Forms
  const [folderForm, setFolderForm] = useState({ name: '', color: '#F2B705' });
  const [cardForm, setCardForm] = useState({ front: '', back: '', folderId: '' });

  // ── Queries
  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['flashcard-folders'],
    queryFn: () => flashcardFolderApi.getFolders().then(r => r.data.data),
  });

  const { data: allCards = [] } = useQuery({
    queryKey: ['flashcards', selectedFolder],
    queryFn: () => flashcardApi.getAll(selectedFolder ? { folderId: selectedFolder } : {}).then(r => r.data.data),
  });

  const { data: globalStats } = useQuery({
    queryKey: ['flashcard-stats', selectedFolder || 'all'],
    queryFn: () => flashcardFolderApi.getStats(selectedFolder || 'all').then(r => r.data.data),
  });

  // ── Mutations
  const createFolderMutation = useMutation({
    mutationFn: () => flashcardFolderApi.createFolder(folderForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flashcard-folders'] }); setCreateFolderOpen(false); setFolderForm({ name: '', color: '#F2B705' }); toast.success('Pasta criada!'); },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => flashcardFolderApi.deleteFolder(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flashcard-folders'] }); setFolderMenu(null); if (selectedFolder === folderMenu?.id) setSelectedFolder(null); toast.success('Pasta removida'); },
  });

  const createCardMutation = useMutation({
    mutationFn: () => flashcardApi.create({ ...cardForm, folderId: cardForm.folderId || selectedFolder || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flashcards'] }); qc.invalidateQueries({ queryKey: ['flashcard-folders'] }); setCreateCardOpen(false); setCardForm({ front: '', back: '', folderId: '' }); toast.success('Card criado!'); },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, rating }: { id: string; rating: number }) => flashcardApi.review(id, rating),
    onSuccess: (_, vars) => {
      const correct = vars.rating >= 2;
      setSessionStats(s => ({ ...s, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) }));
      nextCard();
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, folderId }: any) => flashcardFolderApi.moveCard(cardId, folderId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['flashcards'] }); setMoveCardOpen(null); toast.success('Card movido!'); },
  });

  // ── Funções de estudo
  const startStudy = async (mode: string) => {
    const folderId = selectedFolder || 'all';
    const res = await flashcardFolderApi.getStudyQueue(folderId, mode);
    const cards = res.data.data.cards;
    if (cards.length === 0) { toast.error('Nenhum card disponível nesse modo.'); return; }
    setStudyQueue(cards);
    setStudyIndex(0);
    setFlipped(false);
    setSessionStats({ correct: 0, wrong: 0, total: cards.length });
    setStudyMode(mode);
  };

  const nextCard = () => {
    setFlipped(false);
    if (studyIndex + 1 >= studyQueue.length) {
      setStudyMode('done');
    } else {
      setStudyIndex(i => i + 1);
    }
  };

  const currentCard = studyQueue[studyIndex];

  useEffect(() => {
    if (!studyMode || studyMode === 'done') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, [role="dialog"]')) return;
      if (e.key === ' ') {
        e.preventDefault();
        setFlipped(f => !f);
      } else if (flipped && !reviewMutation.isPending && ['1', '2', '3', '4'].includes(e.key) && currentCard) {
        reviewMutation.mutate({ id: currentCard.id, rating: Number(e.key) - 1 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studyMode, flipped, currentCard, reviewMutation]);
  const modeInfo = STUDY_MODES.find(m => m.key === studyMode);

  // ── Tela de estudo
  if (studyMode && studyMode !== 'done') {
    return (
      <Box sx={{ maxWidth: 700, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
          <IconButton onClick={() => setStudyMode(null)}><KeyboardArrowLeft /></IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" fontWeight={700}>{modeInfo?.label}</Typography>
            <LinearProgress
              variant="determinate"
              value={((studyIndex) / studyQueue.length) * 100}
              sx={{ mt: 0.5, height: 6, borderRadius: 3, bgcolor: alpha(modeInfo?.color || '#F2B705', 0.15),
                '& .MuiLinearProgress-bar': { bgcolor: modeInfo?.color } }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">{studyIndex + 1}/{studyQueue.length}</Typography>
        </Box>

        {/* Stats rápidas */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Chip icon={<CheckCircle sx={{ fontSize: 14, color: '#10B981 !important' }} />} label={`${sessionStats.correct} certas`} size="small" sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981' }} />
          <Chip icon={<Cancel sx={{ fontSize: 14, color: '#EF4444 !important' }} />} label={`${sessionStats.wrong} erradas`} size="small" sx={{ bgcolor: alpha('#EF4444', 0.1), color: '#EF4444' }} />
        </Box>

        {/* Card com giro 3D */}
        {currentCard && (
          <FlipCard key={currentCard.id} front={currentCard.front} back={currentCard.back}
            flipped={flipped} onFlip={() => setFlipped(f => !f)} />
        )}

        {/* Botões de avaliação */}
        {flipped ? (
          <Grid container spacing={1.5}>
            {RATING_OPTIONS.map(opt => (
              <Grid size={{ xs: 6, sm: 3 }} key={opt.value}>
                <Button
                  fullWidth variant="outlined" size="large"
                  onClick={() => reviewMutation.mutate({ id: currentCard.id, rating: opt.value })}
                  disabled={reviewMutation.isPending}
                  sx={{
                    borderColor: opt.color, color: opt.color, fontWeight: 700, py: 1.5,
                    '&:hover': { bgcolor: alpha(opt.color, 0.08), borderColor: opt.color },
                  }}
                >
                  {opt.label}
                  <Box component="span" sx={{ ml: 1, opacity: 0.55, fontSize: 12, fontWeight: 600 }}>{opt.value + 1}</Box>
                </Button>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Button fullWidth variant="contained" size="large"
            onClick={() => setFlipped(true)}
            sx={{ background: BRAND_GRADIENT, py: 1.5, fontSize: 16, fontWeight: 700 }}>
            Revelar resposta
            <Box component="span" sx={{ ml: 1, opacity: 0.6, fontSize: 12, fontWeight: 600 }}>(espaço)</Box>
          </Button>
        )}
      </Box>
    );
  }

  // ── Tela de resultado
  if (studyMode === 'done') {
    const pct = sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0;
    return (
      <Box sx={{ maxWidth: 500, mx: 'auto', textAlign: 'center', mt: 4 }}>
        <Card>
          <CardContent sx={{ py: 5 }}>
            <Typography variant="h2">{pct >= 70 ? '🎯' : pct >= 40 ? '💪' : '📚'}</Typography>
            <Typography variant="h4" fontWeight={800} sx={{ mt: 2 }}>{pct}%</Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 3 }}>de aproveitamento</Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3 }}>
              <Chip label={`✅ ${sessionStats.correct} certas`} sx={{ bgcolor: alpha('#10B981', 0.1), color: '#10B981', fontWeight: 700 }} />
              <Chip label={`❌ ${sessionStats.wrong} erradas`} sx={{ bgcolor: alpha('#EF4444', 0.1), color: '#EF4444', fontWeight: 700 }} />
            </Box>
            {pct < 60 && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Dica: estude os cards fracos para melhorar!</Typography>}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="contained" sx={{ background: BRAND_GRADIENT }} onClick={() => startStudy('weak')}>
                Treinar os fracos
              </Button>
              <Button variant="outlined" onClick={() => setStudyMode(null)}>
                Voltar às pastas
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // ── Tela principal
  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Flashcards</Typography>
          <Typography color="text.secondary" variant="body2">Revisão espaçada inteligente para memorizar mais</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<CreateNewFolder />} onClick={() => setCreateFolderOpen(true)}>
            Nova pasta
          </Button>
          <Button variant="contained" startIcon={<Add />} sx={{ background: BRAND_GRADIENT }}
            onClick={() => setCreateCardOpen(true)}>
            Novo card
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Sidebar: pastas */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card>
            <CardContent sx={{ pb: '8px !important' }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                Pastas
              </Typography>

              {/* Todos */}
              <ListItemButton
                selected={selectedFolder === null}
                onClick={() => setSelectedFolder(null)}
                sx={{ borderRadius: 2, mb: 0.5, py: 0.75 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}><FolderOpen sx={{ color: '#F2B705', fontSize: 20 }} /></ListItemIcon>
                <ListItemText primary="Todos os cards" primaryTypographyProps={{ fontSize: 13, fontWeight: selectedFolder === null ? 600 : 400 }} />
                <Chip label={folders.reduce((a: number, f: any) => a + (f._count?.flashcards || 0), 0)} size="small" sx={{ fontSize: 10, height: 18 }} />
              </ListItemButton>

              <Divider sx={{ my: 1 }} />

              {foldersLoading ? <CircularProgress size={20} sx={{ m: 2 }} /> : folders.map((folder: any) => (
                <Box key={folder.id} sx={{ display: 'flex', alignItems: 'center' }}>
                  <ListItemButton
                    selected={selectedFolder === folder.id}
                    onClick={() => setSelectedFolder(folder.id)}
                    sx={{ borderRadius: 2, mb: 0.25, py: 0.75, flex: 1 }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Folder sx={{ color: folder.color, fontSize: 20 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={folder.name}
                      primaryTypographyProps={{ fontSize: 13, fontWeight: selectedFolder === folder.id ? 600 : 400, noWrap: true }}
                    />
                    <Chip label={folder._count?.flashcards || 0} size="small" sx={{ fontSize: 10, height: 18 }} />
                  </ListItemButton>
                  <IconButton size="small" onClick={(e) => setFolderMenu({ anchor: e.currentTarget, id: folder.id })}>
                    <MoreVert sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ))}

              {folders.length === 0 && !foldersLoading && (
                <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
                  Crie uma pasta para organizar seus cards
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Conteúdo principal */}
        <Grid size={{ xs: 12, md: 9 }}>
          {/* Stats da pasta selecionada */}
          {globalStats && (
            <Grid container spacing={1.5} sx={{ mb: 2 }}>
              {[
                { label: 'Total', value: globalStats.total, color: '#F2B705' },
                { label: 'Revisar hoje', value: globalStats.dueCount, color: '#F59E0B' },
                { label: 'Novos', value: globalStats.newCount, color: '#10B981' },
                { label: 'Dominados', value: globalStats.masteredCount, color: '#D4A017' },
                { label: 'Acerto', value: `${globalStats.accuracy}%`, color: '#3B82F6' },
              ].map(s => (
                <Grid size={{ xs: 6, sm: 'auto' }} key={s.label}>
                  <Paper sx={{ px: 2, py: 1.25, borderRadius: 2, textAlign: 'center', border: `1px solid ${alpha(s.color, 0.2)}` }}>
                    <Typography variant="h6" fontWeight={800} sx={{ color: s.color, lineHeight: 1.2 }}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          )}

          {/* Modos de estudo */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                Iniciar estudo
              </Typography>
              <Grid container spacing={1.5}>
                {STUDY_MODES.map(mode => (
                  <Grid size={{ xs: 6, sm: 3 }} key={mode.key}>
                    <Paper
                      onClick={() => startStudy(mode.key)}
                      sx={{
                        p: 2, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                        border: `1px solid ${alpha(mode.color, 0.25)}`,
                        bgcolor: alpha(mode.color, 0.04),
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: alpha(mode.color, 0.1), transform: 'translateY(-2px)' },
                      }}
                    >
                      <Box sx={{ color: mode.color, mb: 0.5 }}>{mode.icon}</Box>
                      <Typography variant="body2" fontWeight={700} sx={{ color: mode.color, fontSize: 12 }}>
                        {mode.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                        {mode.desc}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Lista de cards */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  {selectedFolder ? folders.find((f: any) => f.id === selectedFolder)?.name : 'Todos os cards'}
                </Typography>
                <Chip label={allCards.length} size="small" sx={{ ml: 1 }} />
              </Box>

              {allCards.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <FlashOn sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                  <Typography color="text.secondary">Nenhum card nesta pasta</Typography>
                  <Button size="small" sx={{ mt: 1 }} onClick={() => setCreateCardOpen(true)} startIcon={<Add />}>
                    Criar card
                  </Button>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {allCards.slice(0, 30).map((card: any) => (
                    <Paper
                      key={card.id}
                      sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                        display: 'flex', gap: 2, alignItems: 'flex-start' }}
                    >
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{card.front}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{card.back}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexShrink: 0 }}>
                        {card.totalReviews > 0 && (
                          <Chip
                            label={`${Math.round((card.correctReviews / card.totalReviews) * 100)}%`}
                            size="small"
                            sx={{
                              fontSize: 10, height: 18,
                              bgcolor: alpha(card.correctReviews / card.totalReviews >= 0.6 ? '#10B981' : '#EF4444', 0.1),
                              color: card.correctReviews / card.totalReviews >= 0.6 ? '#10B981' : '#EF4444',
                            }}
                          />
                        )}
                        <Tooltip title="Mover para pasta">
                          <IconButton size="small" onClick={() => setMoveCardOpen(card.id)}>
                            <MoveToInbox sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Paper>
                  ))}
                  {allCards.length > 30 && (
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      + {allCards.length - 30} cards (use o modo de estudo para ver todos)
                    </Typography>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Menu de pasta */}
      <Menu anchorEl={folderMenu?.anchor} open={!!folderMenu} onClose={() => setFolderMenu(null)}>
        <MenuItem onClick={() => { deleteFolderMutation.mutate(folderMenu!.id); }}>
          <Delete fontSize="small" sx={{ mr: 1, color: 'error.main' }} />
          <Typography color="error">Deletar pasta</Typography>
        </MenuItem>
      </Menu>

      {/* Dialog criar pasta */}
      <Dialog open={createFolderOpen} onClose={() => setCreateFolderOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nova pasta</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth label="Nome da pasta" value={folderForm.name} autoFocus sx={{ mt: 1, mb: 2 }}
            onChange={e => setFolderForm(f => ({ ...f, name: e.target.value }))}
          />
          <Typography variant="caption" color="text.secondary" gutterBottom>Cor</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
            {FOLDER_COLORS.map(color => (
              <Box
                key={color}
                onClick={() => setFolderForm(f => ({ ...f, color }))}
                sx={{
                  width: 28, height: 28, borderRadius: '50%', bgcolor: color, cursor: 'pointer',
                  border: folderForm.color === color ? `3px solid ${theme.palette.text.primary}` : '3px solid transparent',
                  transition: 'border 0.15s',
                }}
              />
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateFolderOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => createFolderMutation.mutate()} disabled={!folderForm.name}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog criar card */}
      <Dialog open={createCardOpen} onClose={() => setCreateCardOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo flashcard</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            fullWidth multiline rows={3} label="Frente (pergunta)"
            value={cardForm.front} onChange={e => setCardForm(f => ({ ...f, front: e.target.value }))}
          />
          <TextField
            fullWidth multiline rows={3} label="Verso (resposta)"
            value={cardForm.back} onChange={e => setCardForm(f => ({ ...f, back: e.target.value }))}
          />
          <TextField
            select fullWidth label="Pasta (opcional)"
            value={cardForm.folderId} onChange={e => setCardForm(f => ({ ...f, folderId: e.target.value }))}
          >
            <MenuItem value="">Sem pasta</MenuItem>
            {folders.map((folder: any) => (
              <MenuItem key={folder.id} value={folder.id}>{folder.name}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateCardOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => createCardMutation.mutate()} disabled={!cardForm.front || !cardForm.back}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog mover card */}
      <Dialog open={!!moveCardOpen} onClose={() => setMoveCardOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Mover card para pasta</DialogTitle>
        <DialogContent>
          <List>
            <ListItemButton onClick={() => moveCardMutation.mutate({ cardId: moveCardOpen, folderId: null })}>
              <ListItemIcon><FolderOpen /></ListItemIcon>
              <ListItemText primary="Sem pasta" />
            </ListItemButton>
            {folders.map((folder: any) => (
              <ListItemButton key={folder.id} onClick={() => moveCardMutation.mutate({ cardId: moveCardOpen, folderId: folder.id })}>
                <ListItemIcon><Folder sx={{ color: folder.color }} /></ListItemIcon>
                <ListItemText primary={folder.name} />
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
