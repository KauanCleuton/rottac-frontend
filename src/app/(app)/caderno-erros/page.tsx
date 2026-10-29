'use client';

import { useState, useRef, useMemo } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button, Chip,
  IconButton, TextField, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogActions, Tabs, Tab,
  alpha, useTheme, CircularProgress, Tooltip, LinearProgress,
  InputAdornment, ToggleButtonGroup, ToggleButton, Divider, Paper,
  Collapse, Badge,
} from '@mui/material';
import {
  Add, Mic, Stop, Image as ImageIcon, Delete, MenuBook,
  TrendingUp, Refresh, Search, FilterList, CheckCircle,
  ErrorOutline, Psychology, Visibility, VisibilityOff,
  School, Timer, Star, WarningAmber, FlipCameraAndroid,
  Close, ArrowForward, ArrowBack, EmojiEvents,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { errorNotebookApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import Link from 'next/link';
import { LibraryBooks } from '@mui/icons-material';
import 'dayjs/locale/pt-br';

dayjs.locale('pt-br');

const ERROR_TYPES = [
  { value: 'FALTA_ATENCAO', label: 'Falta de Atenção', color: '#F59E0B', icon: '👁️' },
  { value: 'CONTEUDO_NAO_ESTUDADO', label: 'Conteúdo Novo', color: '#EF4444', icon: '📚' },
  { value: 'INTERPRETACAO', label: 'Interpretação', color: '#D4A017', icon: '🧠' },
  { value: 'ESQUECIMENTO', label: 'Esquecimento', color: '#3B82F6', icon: '💭' },
];

export default function CadernoErrosPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [reviewEntryId, setReviewEntryId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const [form, setForm] = useState({
    subjectId: '', topicId: '',
    questionText: '', description: '', correctAnswer: '',
    personalNotes: '', errorType: 'FALTA_ATENCAO', difficulty: 'MEDIO',
  });

  const { data: allEntries = [], isLoading } = useQuery({
    queryKey: ['error-notebook', tab],
    queryFn: () =>
      tab === 1
        ? errorNotebookApi.getDue().then((r) => r.data.data.entries || [])
        : errorNotebookApi.getAll({ isResolved: false }).then((r) => r.data.data || []),
  });

  const { data: patterns } = useQuery({
    queryKey: ['error-patterns'],
    queryFn: () => errorNotebookApi.getPatterns().then((r) => r.data.data),
    enabled: tab === 2,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-simple'],
    queryFn: () => subjectApi.getAll().then((r) => r.data.data),
  });

  const selectedSubject = subjects.find((s: any) => s.id === form.subjectId);
  const topics = selectedSubject?.modules?.flatMap((m: any) => m.topics) || [];

  // Filtros locais
  const entries = useMemo(() => {
    let result = allEntries;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter((e: any) =>
        e.description?.toLowerCase().includes(lower) ||
        e.correctAnswer?.toLowerCase().includes(lower) ||
        e.subject?.name?.toLowerCase().includes(lower)
      );
    }
    if (filterType) result = result.filter((e: any) => e.errorType === filterType);
    if (filterSubject) result = result.filter((e: any) => e.subjectId === filterSubject);
    return result;
  }, [allEntries, searchTerm, filterType, filterSubject]);

  const dueCount = allEntries.filter((e: any) => {
    if (!e.nextReviewAt) return true;
    return dayjs(e.nextReviewAt).isBefore(dayjs());
  }).length;

  const createMutation = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (imageFile) fd.append('image', imageFile);
      if (audioBlob) fd.append('audio', audioBlob, 'audio.webm');
      return errorNotebookApi.create(fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['error-notebook'] });
      setCreateOpen(false);
      setForm({ subjectId: '', topicId: '', questionText: '', description: '', correctAnswer: '', personalNotes: '', errorType: 'FALTA_ATENCAO', difficulty: 'MEDIO' });
      setAudioBlob(null); setImageFile(null);
      toast.success('Erro registrado no caderno!');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, result }: { id: string; result: string }) => errorNotebookApi.review(id, result),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['error-notebook'] });
      setReviewEntryId(null);
      if (reviewMode) {
        setCardFlipped(false);
        if (reviewIndex < entries.length - 1) setReviewIndex(i => i + 1);
        else { setReviewMode(false); toast.success('Revisão concluída! 🎉'); }
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => errorNotebookApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['error-notebook'] }); toast.success('Registro removido'); },
  });

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => chunks.push(e.data);
    recorder.onstop = () => setAudioBlob(new Blob(chunks, { type: 'audio/webm' }));
    recorder.start();
    mediaRef.current = recorder;
    setIsRecording(true);
  };

  const stopRecording = () => { mediaRef.current?.stop(); setIsRecording(false); };

  // Estatísticas
  const statsByType = ERROR_TYPES.map(et => ({
    ...et,
    count: allEntries.filter((e: any) => e.errorType === et.value).length,
  }));
  const total = allEntries.length;

  // Review mode entry
  const currentReviewEntry = reviewMode ? entries[reviewIndex] : null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Caderno de Erros</Typography>
          <Typography color="text.secondary" variant="body2">Analise padrões e aprenda com cada erro</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {entries.length > 0 && tab !== 2 && (
            <Button variant="outlined" startIcon={<FlipCameraAndroid />} onClick={() => { setReviewMode(true); setReviewIndex(0); setCardFlipped(false); }}>
              Modo Revisão
            </Button>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            Registrar Erro
          </Button>
        </Box>
      </Box>

      {/* Stats bar */}
      {total > 0 && (
        <Card sx={{ mb: 2.5, background: alpha(theme.palette.background.paper, 0.8) }}>
          <CardContent sx={{ py: '12px !important' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={800} color="primary">{total}</Typography>
                  <Typography variant="caption" color="text.secondary">Total de Erros</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6, sm: 3 }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight={800} color="warning.main">{dueCount}</Typography>
                  <Typography variant="caption" color="text.secondary">Para Revisar</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {statsByType.filter(s => s.count > 0).map(s => (
                    <Box key={s.value} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                      <Typography variant="caption" color="text.secondary">
                        {s.icon} {s.label}: <strong style={{ color: s.color }}>{s.count}</strong>
                      </Typography>
                    </Box>
                  ))}
                </Box>
                <Box sx={{ mt: 1, display: 'flex', gap: 0.5 }}>
                  {statsByType.map(s => (
                    <Tooltip key={s.value} title={`${s.label}: ${s.count}`}>
                      <Box sx={{
                        height: 6, borderRadius: 3, flex: s.count || 0.1,
                        bgcolor: s.count > 0 ? s.color : alpha(s.color, 0.15),
                        transition: 'flex 0.3s',
                      }} />
                    </Tooltip>
                  ))}
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Todos (${allEntries.length})`} icon={<MenuBook />} iconPosition="start" />
        <Tab
          label={
            <Badge badgeContent={dueCount} color="error" max={99}>
              <Box sx={{ mr: 1 }}>Para Revisar</Box>
            </Badge>
          }
          icon={<Refresh />} iconPosition="start"
        />
        <Tab label="Padrões" icon={<TrendingUp />} iconPosition="start" />
      </Tabs>

      {/* Search + Filter bar */}
      {(tab === 0 || tab === 1) && (
        <Box sx={{ mb: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Buscar por descrição, resposta, disciplina..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment>,
            }}
          />
          <IconButton
            onClick={() => setShowFilters(v => !v)}
            color={showFilters || filterType || filterSubject ? 'primary' : 'default'}
          >
            <FilterList />
          </IconButton>
        </Box>
      )}
      <Collapse in={showFilters && (tab === 0 || tab === 1)}>
        <Box sx={{ mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Tipo de Erro</InputLabel>
            <Select value={filterType} label="Tipo de Erro" onChange={e => setFilterType(e.target.value)}>
              <MenuItem value="">Todos</MenuItem>
              {ERROR_TYPES.map(et => <MenuItem key={et.value} value={et.value}>{et.icon} {et.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Disciplina</InputLabel>
            <Select value={filterSubject} label="Disciplina" onChange={e => setFilterSubject(e.target.value)}>
              <MenuItem value="">Todas</MenuItem>
              {subjects.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          {(filterType || filterSubject) && (
            <Button size="small" onClick={() => { setFilterType(''); setFilterSubject(''); }}>
              Limpar filtros
            </Button>
          )}
        </Box>
      </Collapse>

      {/* Padrões */}
      {tab === 2 && patterns && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Por Tipo de Erro</Typography>
                {patterns.byType?.map((p: any) => {
                  const et = ERROR_TYPES.find((e) => e.value === p.errorType);
                  const pct = total > 0 ? Math.round((p._count.id / total) * 100) : 0;
                  return (
                    <Box key={p.errorType} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{et?.icon} {et?.label}</Typography>
                        <Typography variant="body2" fontWeight={700} color={et?.color}>{p._count.id} ({pct}%)</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct}
                        sx={{ height: 6, borderRadius: 3, bgcolor: alpha(et?.color || '#888', 0.1),
                          '& .MuiLinearProgress-bar': { bgcolor: et?.color, borderRadius: 3 } }} />
                    </Box>
                  );
                })}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Por Disciplina</Typography>
                {patterns.bySubject?.slice(0, 8).map((p: any) => {
                  const pct = total > 0 ? Math.round((p._count.id / total) * 100) : 0;
                  return (
                    <Box key={p.subjectId} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2">{p.subject?.name}</Typography>
                        <Typography variant="body2" fontWeight={700}>{p._count.id} erros</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={pct}
                        sx={{ height: 6, borderRadius: 3,
                          '& .MuiLinearProgress-bar': { bgcolor: p.subject?.color || theme.palette.primary.main, borderRadius: 3 } }} />
                    </Box>
                  );
                })}
                {(!patterns.bySubject || patterns.bySubject.length === 0) && (
                  <Typography color="text.secondary" variant="body2">Nenhum dado disponível</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Lista de erros */}
      {(tab === 0 || tab === 1) && (
        <>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
          ) : entries.length === 0 ? (
            <Card><CardContent sx={{ textAlign: 'center', py: 8 }}>
              <MenuBook sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6">{tab === 1 ? 'Nenhum erro para revisar agora!' : 'Nenhum erro encontrado'}</Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                {tab === 1 ? 'Ótimo! Continue estudando.' : 'Registre seus erros para aprender com eles'}
              </Typography>
              {tab === 0 && <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>Registrar Primeiro Erro</Button>}
            </CardContent></Card>
          ) : (
            <Grid container spacing={2}>
              {entries.map((entry: any) => {
                const et = ERROR_TYPES.find((e) => e.value === entry.errorType);
                const isDue = !entry.nextReviewAt || dayjs(entry.nextReviewAt).isBefore(dayjs());
                return (
                  <Grid size={{ xs: 12, md: 6 }} key={entry.id}>
                    <Card sx={{
                      borderLeft: `4px solid ${et?.color || '#888'}`,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${alpha(et?.color || '#888', 0.2)}` },
                    }}>
                      <CardContent>
                        {/* Header */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Chip
                              label={entry.subject?.name || 'Sem disciplina'}
                              size="small"
                              sx={{ bgcolor: alpha(entry.subject?.color || '#888', 0.1), color: entry.subject?.color || 'text.secondary', fontWeight: 600 }}
                            />
                            <Chip
                              label={`${et?.icon} ${et?.label}`}
                              size="small"
                              sx={{ bgcolor: alpha(et?.color || '#888', 0.1), color: et?.color }}
                            />
                            {isDue && (
                              <Chip label="Revisar" size="small" color="warning" variant="outlined"
                                sx={{ fontSize: 10, height: 18 }} />
                            )}
                            {entry.questionId && (
                              <Chip label="Do banco de questões" size="small" variant="outlined"
                                sx={{ fontSize: 10, height: 18 }} />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {entry.questionId && (
                              <Tooltip title="Refazer a questão (atualiza a revisão espaçada)">
                                <IconButton size="small" color="primary" component={Link} href={`/questoes/revisao?id=${entry.questionId}`}>
                                  <LibraryBooks fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Iniciar Revisão">
                              <IconButton size="small" color="primary" onClick={() => setReviewEntryId(entry.id)}>
                                <Refresh fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Deletar">
                              <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(entry.id)}>
                                <Delete fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        {/* Erro */}
                        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                          {entry.description}
                        </Typography>

                        {/* Resposta correta (colapsável) */}
                        <Box sx={{ mt: 1, p: 1.5, borderRadius: 2, bgcolor: alpha('#22C55E', 0.07), border: `1px solid ${alpha('#22C55E', 0.2)}` }}>
                          <Typography variant="caption" sx={{ color: '#22C55E', fontWeight: 700, display: 'block', mb: 0.5 }}>
                            ✅ Resposta Correta
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                            {entry.correctAnswer?.substring(0, 150)}{entry.correctAnswer?.length > 150 ? '...' : ''}
                          </Typography>
                        </Box>

                        {entry.imageUrl && (
                          <Box sx={{ mt: 1, borderRadius: 2, overflow: 'hidden' }}>
                            <img src={entry.imageUrl} alt="questão" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'cover' }} />
                          </Box>
                        )}

                        <Box sx={{ mt: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(entry.createdAt).format('DD/MM/YYYY')}
                            </Typography>
                            <Chip label={`${entry.reviewCount} revisões`} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                          </Box>
                          {entry.audioUrl && <Chip label="🎤 Áudio" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </>
      )}

      {/* ─── MODO REVISÃO (Flip Cards) ─── */}
      <Dialog open={reviewMode} onClose={() => setReviewMode(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 4, minHeight: 420 } }}>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography fontWeight={700}>Modo Revisão</Typography>
            <Typography variant="caption" color="text.secondary">{reviewIndex + 1} de {entries.length}</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton size="small" onClick={() => { if (reviewIndex > 0) { setReviewIndex(i => i - 1); setCardFlipped(false); } }}>
              <ArrowBack />
            </IconButton>
            <IconButton size="small" onClick={() => setReviewMode(false)}><Close /></IconButton>
          </Box>
        </DialogTitle>

        <LinearProgress variant="determinate" value={((reviewIndex + 1) / entries.length) * 100}
          sx={{ height: 4, '& .MuiLinearProgress-bar': { bgcolor: '#F2B705' } }} />

        <DialogContent sx={{ pt: 3 }}>
          {currentReviewEntry && (() => {
            const et = ERROR_TYPES.find(e => e.value === currentReviewEntry.errorType);
            return (
              <Box>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip label={currentReviewEntry.subject?.name} size="small"
                    sx={{ bgcolor: alpha(currentReviewEntry.subject?.color || '#888', 0.15), color: currentReviewEntry.subject?.color }} />
                  <Chip label={`${et?.icon} ${et?.label}`} size="small"
                    sx={{ bgcolor: alpha(et?.color || '#888', 0.1), color: et?.color }} />
                </Box>

                {/* Frente do card - O erro */}
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.06), border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`, mb: 2 }}>
                  <Typography variant="caption" fontWeight={700} color="primary" display="block" mb={1}>
                    ❓ O que você errou:
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {currentReviewEntry.description}
                  </Typography>
                  {currentReviewEntry.questionText && (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                      "{currentReviewEntry.questionText}"
                    </Typography>
                  )}
                </Paper>

                {/* Verso do card - A resposta */}
                <Collapse in={cardFlipped}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: alpha('#22C55E', 0.06), border: `1px solid ${alpha('#22C55E', 0.2)}`, mb: 2 }}>
                    <Typography variant="caption" fontWeight={700} sx={{ color: '#22C55E' }} display="block" mb={1}>
                      ✅ Resposta correta:
                    </Typography>
                    <Typography variant="body1">{currentReviewEntry.correctAnswer}</Typography>
                    {currentReviewEntry.personalNotes && (
                      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${alpha('#22C55E', 0.2)}` }}>
                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
                          📝 {currentReviewEntry.personalNotes}
                        </Typography>
                      </Box>
                    )}
                  </Paper>

                  <Typography variant="body2" fontWeight={600} mb={1} textAlign="center">Como foi?</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button fullWidth variant="outlined" color="success" size="small"
                      onClick={() => reviewMutation.mutate({ id: currentReviewEntry.id, result: 'ACERTOU' })}>
                      🎉 Acertei!
                    </Button>
                    <Button fullWidth variant="outlined" color="warning" size="small"
                      onClick={() => reviewMutation.mutate({ id: currentReviewEntry.id, result: 'PARCIALMENTE' })}>
                      🤔 Parcial
                    </Button>
                    <Button fullWidth variant="outlined" color="error" size="small"
                      onClick={() => reviewMutation.mutate({ id: currentReviewEntry.id, result: 'ERROU_NOVAMENTE' })}>
                      ❌ Errei
                    </Button>
                  </Box>
                </Collapse>

                {!cardFlipped && (
                  <Button fullWidth variant="contained" startIcon={<Visibility />} onClick={() => setCardFlipped(true)} sx={{ mt: 1 }}>
                    Ver Resposta
                  </Button>
                )}
              </Box>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog Revisão simples (por card individual) */}
      <Dialog open={Boolean(reviewEntryId) && !reviewMode} onClose={() => setReviewEntryId(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Como foi na revisão?</DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
            {[
              { value: 'ACERTOU', label: '🎉 Acertei desta vez!', color: 'success' },
              { value: 'PARCIALMENTE', label: '🤔 Acertei parcialmente', color: 'warning' },
              { value: 'ERROU_NOVAMENTE', label: '❌ Errei de novo', color: 'error' },
            ].map((opt) => (
              <Grid size={12} key={opt.value}>
                <Button fullWidth variant="outlined" color={opt.color as any}
                  onClick={() => reviewMutation.mutate({ id: reviewEntryId!, result: opt.value })}>
                  {opt.label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions><Button onClick={() => setReviewEntryId(null)}>Cancelar</Button></DialogActions>
      </Dialog>

      {/* Dialog Criar */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>📝 Registrar Novo Erro</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Grid container spacing={2}>
            <Grid size={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Disciplina *</InputLabel>
                <Select value={form.subjectId} label="Disciplina *"
                  onChange={(e) => setForm((f) => ({ ...f, subjectId: e.target.value, topicId: '' }))}>
                  {subjects.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth size="small" disabled={!form.subjectId}>
                <InputLabel>Tópico</InputLabel>
                <Select value={form.topicId} label="Tópico"
                  onChange={(e) => setForm((f) => ({ ...f, topicId: e.target.value }))}>
                  <MenuItem value="">Nenhum</MenuItem>
                  {topics.map((t: any) => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <FormControl size="small">
            <InputLabel>Tipo de Erro *</InputLabel>
            <Select value={form.errorType} label="Tipo de Erro *"
              onChange={(e) => setForm((f) => ({ ...f, errorType: e.target.value }))}>
              {ERROR_TYPES.map((e) => <MenuItem key={e.value} value={e.value}>{e.icon} {e.label}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Questão / Enunciado (opcional)" multiline rows={2} value={form.questionText}
            onChange={(e) => setForm((f) => ({ ...f, questionText: e.target.value }))}
            placeholder="Cole o enunciado da questão aqui..." />

          <TextField label="Descreva por que errou *" multiline rows={3} value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Ex: Confundi princípio da legalidade com princípio da reserva legal..." />

          <TextField label="Resposta / gabarito correto *" multiline rows={3} value={form.correctAnswer}
            onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))}
            placeholder="Ex: A alternativa correta é B porque..." />

          <TextField label="Observações pessoais (macete, dica)" multiline rows={2} value={form.personalNotes}
            onChange={(e) => setForm((f) => ({ ...f, personalNotes: e.target.value }))}
            placeholder="Ex: Lembrar que STF entende que..." />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button component="label" variant="outlined" startIcon={<ImageIcon />} size="small">
              {imageFile ? `📎 ${imageFile.name.substring(0, 20)}...` : '📷 Foto da questão'}
              <input hidden type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
            </Button>
            <Button variant="outlined" color={isRecording ? 'error' : 'primary'}
              startIcon={isRecording ? <Stop /> : <Mic />} size="small"
              onClick={isRecording ? stopRecording : startRecording}>
              {isRecording ? '⏹ Parar gravação' : audioBlob ? '🎤 Regravar áudio' : '🎤 Gravar explicação'}
            </Button>
            {audioBlob && <Chip label="✅ Áudio gravado" size="small" color="success" onDelete={() => setAudioBlob(null)} />}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => createMutation.mutate()}
            disabled={!form.subjectId || !form.description || !form.correctAnswer || createMutation.isPending}>
            {createMutation.isPending ? 'Salvando...' : 'Registrar Erro'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
