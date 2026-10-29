'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, Chip, alpha,
  useTheme, CircularProgress, Grid, Slider, Paper, Divider, IconButton,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Tooltip, Accordion, AccordionSummary,
  AccordionDetails, FormControlLabel, Checkbox, Tab, Tabs,
} from '@mui/material';
import {
  ArrowBack, Send, Mic, Upload, Add, ExpandMore, Delete,
  CheckCircle, Lightbulb, Save, Schedule, Psychology, PictureAsPdf,
  Draw,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherApi, essayApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter, useParams } from 'next/navigation';
import { BRAND_GRADIENT } from '@/theme';
import dayjs from 'dayjs';
import dynamic from 'next/dynamic';

const PdfAnnotator = dynamic(() => import('@/components/essay/PdfAnnotator'), { ssr: false });

const COMMENT_TYPES = [
  { value: 'GRAMMAR',    label: 'Gramática',   color: '#EF4444' },
  { value: 'COHESION',   label: 'Coesão',      color: '#F59E0B' },
  { value: 'ARGUMENT',   label: 'Argumento',   color: '#3B82F6' },
  { value: 'SUGGESTION', label: 'Sugestão',    color: '#D4A017' },
  { value: 'PRAISE',     label: 'Elogio',      color: '#22C55E' },
  { value: 'ANNOTATION', label: 'Anotação',    color: '#9CA3AF' },
];

const COMMENT_COLORS: Record<string, string> = Object.fromEntries(
  COMMENT_TYPES.map(t => [t.value, t.color])
);

const scoreLabel = (v: number) =>
  v === 0 ? 'Fuga ao tema' : v <= 80 ? 'Insatisfatório' : v <= 120 ? 'Regular' : v <= 160 ? 'Bom' : 'Excelente';

export default function CorrigirRedacaoPage() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const { id: essayId } = useParams<{ id: string }>();
  const audioRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Tab esquerda: texto ou PDF
  const [leftTab, setLeftTab] = useState(0);

  // Seleção de texto inline
  const [selection, setSelection] = useState<{ text: string; start: number; end: number } | null>(null);
  const [commentDialog, setCommentDialog] = useState(false);
  const [commentForm, setCommentForm] = useState({ text: '', type: 'ANNOTATION' });

  // Templates
  const [templateDialog, setTemplateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ title: '', content: '', category: '' });

  // Formulário de correção
  const [form, setForm] = useState({
    generalFeedback: '',
    strengthPoints: '',
    improvementPoints: '',
    scoreC1: 120, scoreC2: 120, scoreC3: 120, scoreC4: 120, scoreC5: 120,
    requestRewrite: false,
    rewriteDeadline: '',
  });

  const totalScore = form.scoreC1 + form.scoreC2 + form.scoreC3 + form.scoreC4 + form.scoreC5;
  const scoreColor = totalScore >= 700 ? '#22C55E' : totalScore >= 500 ? '#F59E0B' : '#EF4444';

  const { data: essay, isLoading } = useQuery<any>({
    queryKey: ['essay', essayId],
    queryFn: () => essayApi.get(essayId).then(r => r.data.data),
  });

  useEffect(() => {
    const c = essay?.corrections?.[0];
    if (c) {
      setForm({
        generalFeedback: c.generalFeedback || '',
        strengthPoints: c.strengthPoints || '',
        improvementPoints: c.improvementPoints || '',
        scoreC1: c.scoreC1 ?? 120, scoreC2: c.scoreC2 ?? 120,
        scoreC3: c.scoreC3 ?? 120, scoreC4: c.scoreC4 ?? 120, scoreC5: c.scoreC5 ?? 120,
        requestRewrite: c.requestRewrite || false,
        rewriteDeadline: c.rewriteDeadline ? dayjs(c.rewriteDeadline).format('YYYY-MM-DD') : '',
      });
    }
  }, [essay]);

  const { data: templates = [] } = useQuery({
    queryKey: ['feedback-templates'],
    queryFn: () => teacherApi.listTemplates().then(r => r.data.data),
  });

  const correctMutation = useMutation({
    mutationFn: () => teacherApi.correctEssay(essayId, form),
    onSuccess: () => {
      toast.success('Correção salva!');
      qc.invalidateQueries({ queryKey: ['essay', essayId] });
      router.push('/professor/redacoes');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao salvar'),
  });

  const addCommentMutation = useMutation({
    mutationFn: () => teacherApi.addComment(essayId, {
      ...commentForm,
      selectedText: selection?.text,
      startOffset: selection?.start,
      endOffset: selection?.end,
    }),
    onSuccess: () => {
      toast.success('Comentário adicionado!');
      qc.invalidateQueries({ queryKey: ['essay', essayId] });
      setCommentDialog(false);
      setCommentForm({ text: '', type: 'ANNOTATION' });
      setSelection(null);
    },
  });

  const uploadAudioMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('audio', file);
      return teacherApi.uploadAudio(essayId, fd);
    },
    onSuccess: () => { toast.success('Áudio enviado!'); qc.invalidateQueries({ queryKey: ['essay', essayId] }); },
  });

  const uploadFileMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData(); fd.append('file', file);
      return teacherApi.uploadCorrectedFile(essayId, fd);
    },
    onSuccess: () => { toast.success('PDF enviado!'); qc.invalidateQueries({ queryKey: ['essay', essayId] }); },
  });

  const createTemplateMutation = useMutation({
    mutationFn: () => teacherApi.createTemplate(newTemplate),
    onSuccess: () => {
      toast.success('Template salvo!');
      qc.invalidateQueries({ queryKey: ['feedback-templates'] });
      setTemplateDialog(false);
    },
  });

  // Captura seleção de texto
  const handleTextSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length === 0) return;
    const range = sel.getRangeAt(0);
    const container = document.getElementById('essay-content');
    if (!container?.contains(range.commonAncestorContainer)) return;

    // Calcula offset no conteúdo total
    const beforeRange = document.createRange();
    beforeRange.setStart(container, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const start = beforeRange.toString().length;

    setSelection({ text, start, end: start + text.length });
    setCommentDialog(true);
  };

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!essay) return null;

  const comments: any[] = essay.comments || [];

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/professor/redacoes')} size="small">Voltar</Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={700}>{essay.title}</Typography>
          <Typography color="text.secondary" variant="body2">
            {essay.student?.name} · {dayjs(essay.submittedAt).format('DD/MM/YYYY')}
            {essay.theme && ` · Tema: ${essay.theme}`}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<Mic />}
            onClick={() => audioRef.current?.click()}
            disabled={uploadAudioMutation.isPending}>
            {uploadAudioMutation.isPending ? 'Enviando...' : 'Áudio'}
          </Button>
          <Button variant="outlined" startIcon={<Upload />}
            onClick={() => fileRef.current?.click()}
            disabled={uploadFileMutation.isPending}>
            {uploadFileMutation.isPending ? 'Enviando...' : 'PDF'}
          </Button>
          <Button variant="contained" startIcon={<Save />} sx={{ background: BRAND_GRADIENT }}
            onClick={() => correctMutation.mutate()} disabled={correctMutation.isPending}>
            {correctMutation.isPending ? <CircularProgress size={20} color="inherit" /> : 'Salvar correção'}
          </Button>
        </Box>
      </Box>

      <input ref={audioRef} type="file" accept="audio/*" hidden
        onChange={e => { if (e.target.files?.[0]) uploadAudioMutation.mutate(e.target.files[0]); }} />
      <input ref={fileRef} type="file" accept=".pdf" hidden
        onChange={e => { if (e.target.files?.[0]) uploadFileMutation.mutate(e.target.files[0]); }} />

      <Grid container spacing={2}>
        {/* Texto / PDF + anotações */}
        <Grid size={{ xs: 12, lg: 6 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              {/* Tabs: texto | PDF rabiscável */}
              <Tabs value={leftTab} onChange={(_, v) => setLeftTab(v)} sx={{ mb: 1.5, minHeight: 36 }}
                TabIndicatorProps={{ style: { height: 2 } }}>
                <Tab label="Texto" sx={{ minHeight: 36, py: 0, fontSize: 13 }} />
                {essay.pdfUrl && (
                  <Tab label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Draw sx={{ fontSize: 14 }} /> PDF + Rabiscos
                    </Box>
                  } sx={{ minHeight: 36, py: 0, fontSize: 13 }} />
                )}
              </Tabs>

              {leftTab === 0 && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {essay.wordCount} palavras · {essay.charCount} caracteres
                    </Typography>
                    <Tooltip title="Selecione um trecho e clique para comentar">
                      <Chip label="Selecione para comentar" size="small" icon={<Add />}
                        sx={{ bgcolor: alpha('#F2B705', 0.1), color: '#F2B705', cursor: 'help' }} />
                    </Tooltip>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Box id="essay-content" onMouseUp={handleTextSelection}
                    sx={{ userSelect: 'text', lineHeight: 1.9, fontFamily: 'Georgia, serif', fontSize: 15,
                      whiteSpace: 'pre-wrap', cursor: 'text', minHeight: 300 }}>
                    {essay.content}
                  </Box>

                  {/* Comentários existentes */}
                  {comments.length > 0 && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
                        ANOTAÇÕES ({comments.length})
                      </Typography>
                      {comments.map((c: any) => (
                        <Box key={c.id} sx={{ mb: 1, p: 1, borderRadius: 1.5,
                          border: `1px solid ${alpha(COMMENT_COLORS[c.type] || '#9CA3AF', 0.3)}`,
                          bgcolor: alpha(COMMENT_COLORS[c.type] || '#9CA3AF', 0.04) }}>
                          <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                            <Chip label={COMMENT_TYPES.find(t => t.value === c.type)?.label || c.type}
                              size="small" sx={{ bgcolor: alpha(COMMENT_COLORS[c.type] || '#9CA3AF', 0.15),
                                color: COMMENT_COLORS[c.type] || '#9CA3AF', fontWeight: 700, fontSize: 9 }} />
                          </Box>
                          {c.selectedText && (
                            <Typography variant="caption" sx={{ fontStyle: 'italic', color: 'text.secondary',
                              display: 'block', mb: 0.5, pl: 1, borderLeft: `2px solid ${COMMENT_COLORS[c.type]}` }}>
                              "{c.selectedText}"
                            </Typography>
                          )}
                          <Typography variant="body2">{c.text}</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </>
              )}

              {leftTab === 1 && essay.pdfUrl && (
                <Box sx={{ overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                  <PdfAnnotator
                    pdfUrl={essay.pdfUrl}
                    savedAnnotations={essay.corrections?.[0]?.pdfAnnotations}
                    onSave={async (annotations) => {
                      await teacherApi.saveAnnotations(essayId, annotations);
                      qc.invalidateQueries({ queryKey: ['essay', essayId] });
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Formulário de correção */}
        <Grid size={{ xs: 12, lg: 6 }}>
          {/* Notas */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Psychology sx={{ color: '#F2B705' }} />
                <Typography variant="subtitle1" fontWeight={700}>Notas por Competência</Typography>
                <Box sx={{ ml: 'auto', textAlign: 'center' }}>
                  <Typography variant="h5" fontWeight={900} color={scoreColor}>{totalScore}</Typography>
                  <Typography variant="caption" color="text.secondary">/1000</Typography>
                </Box>
              </Box>

              {([
                { label: 'C1 — Domínio da norma culta', key: 'scoreC1' },
                { label: 'C2 — Compreensão da proposta', key: 'scoreC2' },
                { label: 'C3 — Seleção de argumentos', key: 'scoreC3' },
                { label: 'C4 — Coesão e coerência', key: 'scoreC4' },
                { label: 'C5 — Proposta de intervenção', key: 'scoreC5' },
              ] as { label: string; key: keyof typeof form }[]).map(({ label, key }) => {
                const val = form[key] as number;
                const color = val >= 160 ? '#22C55E' : val >= 120 ? '#F59E0B' : '#EF4444';
                return (
                  <Box key={key} sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{label}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">{scoreLabel(val)}</Typography>
                        <Chip label={`${val}/200`} size="small"
                          sx={{ bgcolor: alpha(color, 0.1), color, fontWeight: 700 }} />
                      </Box>
                    </Box>
                    <Slider
                      value={val} min={0} max={200} step={40}
                      marks={[{ value: 0, label: '0' }, { value: 80, label: '80' }, { value: 120, label: '120' },
                              { value: 160, label: '160' }, { value: 200, label: '200' }]}
                      onChange={(_, v) => setForm(f => ({ ...f, [key]: v as number }))}
                      sx={{ color, '& .MuiSlider-markLabel': { fontSize: 10 } }}
                    />
                  </Box>
                );
              })}
            </CardContent>
          </Card>

          {/* Feedback textual */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography variant="subtitle1" fontWeight={700}>Feedback</Typography>
                <Button size="small" startIcon={<Lightbulb />}
                  onClick={() => setTemplateDialog(true)}>Templates</Button>
              </Box>

              <TextField fullWidth multiline rows={4} size="small" label="Feedback geral *" sx={{ mb: 1.5 }}
                value={form.generalFeedback}
                onChange={e => setForm(f => ({ ...f, generalFeedback: e.target.value }))} />

              <Grid container spacing={1}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth multiline rows={3} size="small" label="Pontos positivos"
                    value={form.strengthPoints}
                    onChange={e => setForm(f => ({ ...f, strengthPoints: e.target.value }))} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField fullWidth multiline rows={3} size="small" label="A melhorar"
                    value={form.improvementPoints}
                    onChange={e => setForm(f => ({ ...f, improvementPoints: e.target.value }))} />
                </Grid>
              </Grid>

              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <FormControlLabel
                  control={<Checkbox checked={form.requestRewrite}
                    onChange={e => setForm(f => ({ ...f, requestRewrite: e.target.checked }))} />}
                  label="Solicitar reescrita"
                />
                {form.requestRewrite && (
                  <TextField type="date" size="small" label="Prazo" InputLabelProps={{ shrink: true }}
                    value={form.rewriteDeadline}
                    onChange={e => setForm(f => ({ ...f, rewriteDeadline: e.target.value }))} />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Dialog: Adicionar comentário */}
      <Dialog open={commentDialog} onClose={() => { setCommentDialog(false); setSelection(null); }} maxWidth="sm" fullWidth>
        <DialogTitle>Adicionar anotação</DialogTitle>
        <DialogContent>
          {selection?.text && (
            <Paper elevation={0} sx={{ p: 1.5, mb: 2, borderRadius: 2, bgcolor: alpha('#F2B705', 0.06),
              border: `1px solid ${alpha('#F2B705', 0.2)}` }}>
              <Typography variant="caption" color="text.secondary">Trecho selecionado:</Typography>
              <Typography variant="body2" fontStyle="italic">"{selection.text}"</Typography>
            </Paper>
          )}
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Tipo</InputLabel>
            <Select value={commentForm.type} label="Tipo"
              onChange={e => setCommentForm(f => ({ ...f, type: e.target.value }))}>
              {COMMENT_TYPES.map(t => (
                <MenuItem key={t.value} value={t.value}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: t.color }} />
                    {t.label}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField fullWidth multiline rows={3} label="Comentário" autoFocus
            value={commentForm.text} onChange={e => setCommentForm(f => ({ ...f, text: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setCommentDialog(false); setSelection(null); }}>Cancelar</Button>
          <Button variant="contained" onClick={() => addCommentMutation.mutate()}
            disabled={!commentForm.text.trim() || addCommentMutation.isPending}>
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Templates */}
      <Dialog open={templateDialog} onClose={() => setTemplateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Templates de feedback</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            {/* Lista */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>Meus templates</Typography>
              {(templates as any[]).length === 0 ? (
                <Typography color="text.secondary" variant="body2">Nenhum template criado</Typography>
              ) : (templates as any[]).map((t: any) => (
                <Box key={t.id} sx={{ p: 1.5, mb: 1, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                  cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}
                  onClick={() => {
                    setForm(f => ({ ...f, generalFeedback: f.generalFeedback + '\n' + t.content }));
                    teacherApi.useTemplate(t.id);
                    setTemplateDialog(false);
                    toast.success(`Template "${t.title}" aplicado`);
                  }}>
                  <Typography variant="body2" fontWeight={600}>{t.title}</Typography>
                  {t.category && <Chip label={t.category} size="small" sx={{ mt: 0.5 }} />}
                  <Typography variant="caption" color="text.secondary" display="block" noWrap mt={0.5}>
                    {t.content.slice(0, 80)}...
                  </Typography>
                </Box>
              ))}
            </Grid>
            {/* Criar novo */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="subtitle2" fontWeight={700} mb={1}>Criar novo template</Typography>
              <TextField fullWidth size="small" label="Título" sx={{ mb: 1.5 }}
                value={newTemplate.title} onChange={e => setNewTemplate(t => ({ ...t, title: e.target.value }))} />
              <TextField fullWidth size="small" label="Categoria (ex: gramática)"  sx={{ mb: 1.5 }}
                value={newTemplate.category} onChange={e => setNewTemplate(t => ({ ...t, category: e.target.value }))} />
              <TextField fullWidth multiline rows={4} label="Conteúdo" sx={{ mb: 1.5 }}
                value={newTemplate.content} onChange={e => setNewTemplate(t => ({ ...t, content: e.target.value }))} />
              <Button fullWidth variant="contained" onClick={() => createTemplateMutation.mutate()}
                disabled={!newTemplate.title || !newTemplate.content}>
                Salvar template
              </Button>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTemplateDialog(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
