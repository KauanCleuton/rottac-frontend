'use client';

import {
  Box, Grid, Card, CardContent, Typography, Button, Chip,
  CircularProgress, alpha, useTheme, Paper, Alert,
  List, ListItem, ListItemText, IconButton, TextField,
  Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, Tooltip,
} from '@mui/material';
import {
  UploadFile, AutoAwesome, CheckCircle, Edit, Delete,
  FlashOn, Refresh, Info, ArrowBack, Add, SwapHoriz,
} from '@mui/icons-material';
import { useQuery, useMutation } from '@tanstack/react-query';
import { flashcardExtractApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useState, useRef } from 'react';
import { BRAND_GRADIENT } from '@/theme';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface FlashcardPair {
  front: string;
  back: string;
  source?: string;
}

export default function FlashcardImportPage() {
  const theme = useTheme();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
  const [pairs, setPairs] = useState<FlashcardPair[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  const previewMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('pdf', file);
      return flashcardExtractApi.preview(fd);
    },
    onSuccess: (data) => {
      const extracted: FlashcardPair[] = data.data.data.pairs || [];
      setPairs(extracted);
      setStep('review');
      toast.success(`${extracted.length} flashcards detectados!`);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Erro ao processar PDF';
      const hint = err.response?.data?.hint || '';
      toast.error(msg);
      if (hint) toast(hint, { icon: 'ℹ️' });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => flashcardExtractApi.confirm({ pairs, subjectId: subjectId || null }),
    onSuccess: (data) => {
      setStep('done');
      toast.success(`${data.data.data.created} flashcards criados!`);
    },
    onError: () => toast.error('Erro ao salvar flashcards'),
  });

  const handleFile = (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos');
      return;
    }
    previewMutation.mutate(file);
  };

  const removePair = (idx: number) => {
    setPairs(prev => prev.filter((_, i) => i !== idx));
  };

  const startEdit = (idx: number) => {
    setEditIdx(idx);
    setEditFront(pairs[idx].front);
    setEditBack(pairs[idx].back);
  };

  const saveEdit = () => {
    if (editIdx === null) return;
    setPairs(prev => prev.map((p, i) => i === editIdx ? { ...p, front: editFront, back: editBack } : p));
    setEditIdx(null);
  };

  const swapPair = (idx: number) => {
    setPairs(prev => prev.map((p, i) => i === idx ? { ...p, front: p.back, back: p.front } : p));
  };

  const addPair = () => {
    // O par novo ainda não está em `pairs` neste render: abre a edição já com os campos vazios
    setPairs(prev => [...prev, { front: '', back: '' }]);
    setEditIdx(pairs.length);
    setEditFront('');
    setEditBack('');
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton component={Link} href="/flashcards" size="small">
          <ArrowBack />
        </IconButton>
        <Box>
          <Typography variant="h5" fontWeight={700}>Importar Flashcards de PDF</Typography>
          <Typography color="text.secondary" variant="body2">
            O sistema extrai automaticamente perguntas e respostas do PDF
          </Typography>
        </Box>
      </Box>

      {/* Step: Upload */}
      {step === 'upload' && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card>
              <CardContent>
                <Box
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const file = e.dataTransfer.files[0];
                    if (file) handleFile(file);
                  }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{
                    border: `3px dashed ${alpha(isDragging ? '#F2B705' : theme.palette.divider, isDragging ? 0.8 : 0.5)}`,
                    borderRadius: 3,
                    p: { xs: 4, md: 8 },
                    textAlign: 'center',
                    cursor: previewMutation.isPending ? 'default' : 'pointer',
                    bgcolor: isDragging ? alpha('#F2B705', 0.05) : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': previewMutation.isPending ? {} : {
                      bgcolor: alpha('#F2B705', 0.04),
                      borderColor: alpha('#F2B705', 0.5),
                    },
                  }}
                >
                  {previewMutation.isPending ? (
                    <>
                      <CircularProgress size={56} sx={{ mb: 2, color: '#F2B705' }} />
                      <Typography variant="h6" fontWeight={600}>Extraindo flashcards...</Typography>
                      <Typography color="text.secondary" sx={{ mt: 1 }}>
                        Analisando pares pergunta/resposta no PDF
                      </Typography>
                    </>
                  ) : (
                    <>
                      <FlashOn sx={{ fontSize: 72, color: alpha('#F2B705', 0.4), mb: 2 }} />
                      <Typography variant="h6" fontWeight={700}>
                        Arraste o PDF de flashcards aqui
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                        ou clique para selecionar (máx. 30MB)
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<UploadFile />}
                        sx={{ background: BRAND_GRADIENT, px: 4 }}
                      >
                        Selecionar PDF
                      </Button>
                    </>
                  )}
                </Box>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Info sx={{ color: '#F2B705' }} />
                  <Typography variant="h6" fontWeight={700}>Formatos suportados</Typography>
                </Box>
                {[
                  {
                    label: 'Formato numerado (recomendado)',
                    example: '1. O QUE SÃO DIREITOS HUMANOS?\nR: CONJUNTO DE DIREITOS INDISPENSÁVEIS...',
                  },
                  {
                    label: 'Formato Q/A',
                    example: 'Q: O que é tributo?\nA: Prestação compulsória em dinheiro...',
                  },
                  {
                    label: 'Blocos alternados',
                    example: 'PERGUNTA\n\nRESPOSTA\n\nPERGUNTA\n\nRESPOSTA',
                  },
                ].map((f, i) => (
                  <Box key={i} sx={{ mb: 2 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                      {f.label}
                    </Typography>
                    <Paper
                      sx={{
                        p: 1.5, bgcolor: alpha(theme.palette.divider, 0.3),
                        fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap',
                      }}
                    >
                      {f.example}
                    </Paper>
                  </Box>
                ))}
                <Alert severity="info" icon={<AutoAwesome />} sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Funciona com apostilas de concurso em maiúsculas, como o exemplo que você enviou!
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Step: Review */}
      {step === 'review' && (
        <Box>
          {/* Barra de ação */}
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle sx={{ color: '#10B981' }} />
                  <Typography fontWeight={700}>{pairs.length} flashcards detectados</Typography>
                </Box>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <InputLabel>Disciplina (opcional)</InputLabel>
                  <Select
                    value={subjectId}
                    label="Disciplina (opcional)"
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <MenuItem value="">Sem disciplina</MenuItem>
                    {subjects.map((s: any) => (
                      <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Box sx={{ flex: 1 }} />

                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={addPair}
                  size="small"
                >
                  Adicionar
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  onClick={() => { setStep('upload'); setPairs([]); }}
                  size="small"
                >
                  Novo PDF
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CheckCircle />}
                  onClick={() => confirmMutation.mutate()}
                  disabled={confirmMutation.isPending || pairs.length === 0}
                  sx={{ background: BRAND_GRADIENT }}
                >
                  {confirmMutation.isPending ? 'Salvando...' : `Salvar ${pairs.length} flashcards`}
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Lista de pares */}
          <Grid container spacing={2}>
            {pairs.map((pair, idx) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                <Card
                  sx={{
                    height: '100%',
                    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    '&:hover': { boxShadow: 3 },
                  }}
                >
                  <CardContent sx={{ pb: '8px !important' }}>
                    {/* Frente */}
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        PERGUNTA
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5, minHeight: 40 }}>
                        {pair.front || <em style={{ color: '#9CA3AF' }}>Vazio</em>}
                      </Typography>
                    </Box>

                    <Divider sx={{ my: 1 }} />

                    {/* Verso */}
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600}>
                        RESPOSTA
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 0.5,
                          minHeight: 40,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {pair.back || <em style={{ color: '#9CA3AF' }}>Vazio</em>}
                      </Typography>
                    </Box>

                    {/* Ações */}
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                      <Tooltip title="Inverter frente/verso">
                        <IconButton size="small" onClick={() => swapPair(idx)}>
                          <SwapHoriz fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => startEdit(idx)}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remover">
                        <IconButton size="small" onClick={() => removePair(idx)}>
                          <Delete fontSize="small" sx={{ color: '#EF4444' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CheckCircle sx={{ fontSize: 80, color: '#10B981', mb: 2 }} />
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              Flashcards importados com sucesso!
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 4 }}>
              Seus flashcards já estão disponíveis para revisão com repetição espaçada (SM-2).
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                href="/flashcards"
                sx={{ background: BRAND_GRADIENT }}
              >
                Ir para Flashcards
              </Button>
              <Button
                variant="outlined"
                onClick={() => { setStep('upload'); setPairs([]); }}
              >
                Importar Outro PDF
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Dialog de edição */}
      <Dialog open={editIdx !== null} onClose={() => setEditIdx(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Editar Flashcard #{(editIdx ?? 0) + 1}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Pergunta (frente)"
            value={editFront}
            onChange={(e) => setEditFront(e.target.value)}
            sx={{ mb: 2, mt: 1 }}
          />
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Resposta (verso)"
            value={editBack}
            onChange={(e) => setEditBack(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditIdx(null)}>Cancelar</Button>
          <Button variant="contained" onClick={saveEdit} disabled={!editFront.trim() || !editBack.trim()}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
