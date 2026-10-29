'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, Chip,
  IconButton, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Accordion, AccordionSummary, AccordionDetails,
  LinearProgress, alpha, useTheme, Tooltip, CircularProgress,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import {
  Add, Delete, Edit, ExpandMore, School, CheckCircle,
  FiberManualRecord, DragIndicator,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';

const COLORS = [
  '#F2B705','#FFD34D','#22C55E','#F59E0B','#EF4444',
  '#EC4899','#27272A','#14B8A6','#D4A017','#111113',
];
const DIFFICULTIES = ['FACIL','MEDIO','DIFICIL'];
const DIFF_LABEL: Record<string,string> = { FACIL:'Fácil', MEDIO:'Médio', DIFICIL:'Difícil' };
const DIFF_COLOR: Record<string,string> = { FACIL:'#22C55E', MEDIO:'#F59E0B', DIFICIL:'#EF4444' };

export default function DisciplinasPage() {
  const theme = useTheme();
  const qc = useQueryClient();

  const [subjectDialog, setSubjectDialog] = useState(false);
  const [moduleDialog, setModuleDialog] = useState<string|null>(null);
  const [topicDialog, setTopicDialog] = useState<string|null>(null);
  const [editSubject, setEditSubject] = useState<any>(null);

  const [sForm, setSForm] = useState({ name:'', color: COLORS[0], weight:'1' });
  const [mForm, setMForm] = useState({ name:'' });
  const [tForm, setTForm] = useState({ name:'', difficulty:'MEDIO', estimatedHours:'1' });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  const createSubjectMutation = useMutation({
    mutationFn: () => subjectApi.create({ ...sForm, weight: parseFloat(sForm.weight) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setSubjectDialog(false);
      setSForm({ name:'', color: COLORS[0], weight:'1' });
      toast.success('Disciplina criada!');
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: () => subjectApi.update(editSubject.id, sForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setSubjectDialog(false);
      setEditSubject(null);
      toast.success('Disciplina atualizada!');
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: (id: string) => subjectApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); toast.success('Disciplina removida'); },
  });

  const createModuleMutation = useMutation({
    mutationFn: (subjectId: string) => subjectApi.createModule(subjectId, mForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setModuleDialog(null);
      setMForm({ name:'' });
      toast.success('Módulo criado!');
    },
  });

  const createTopicMutation = useMutation({
    mutationFn: (moduleId: string) => subjectApi.createTopic(moduleId, {
      ...tForm, estimatedHours: parseFloat(tForm.estimatedHours),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      setTopicDialog(null);
      setTForm({ name:'', difficulty:'MEDIO', estimatedHours:'1' });
      toast.success('Tópico criado!');
    },
  });

  const updateTopicMutation = useMutation({
    mutationFn: ({ id, data }: any) => subjectApi.updateTopic(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subjects'] }),
  });

  const deleteTopicMutation = useMutation({
    mutationFn: (id: string) => subjectApi.deleteTopic(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['subjects'] }); toast.success('Tópico removido'); },
  });

  const openEditSubject = (s: any) => {
    setEditSubject(s);
    setSForm({ name: s.name, color: s.color, weight: String(s.weight) });
    setSubjectDialog(true);
  };

  if (isLoading) return <Box sx={{ display:'flex', justifyContent:'center', mt:8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Disciplinas</Typography>
          <Typography color="text.secondary">{subjects.length} disciplina{subjects.length !== 1 ? 's' : ''} cadastrada{subjects.length !== 1 ? 's' : ''}</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { setEditSubject(null); setSForm({ name:'', color:COLORS[0], weight:'1' }); setSubjectDialog(true); }}>
          Nova Disciplina
        </Button>
      </Box>

      {subjects.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign:'center', py:8 }}>
            <School sx={{ fontSize:64, color:'text.disabled', mb:2 }} />
            <Typography variant="h6" gutterBottom>Nenhuma disciplina cadastrada</Typography>
            <Typography color="text.secondary" gutterBottom>Adicione as matérias do seu concurso</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setSubjectDialog(true)} sx={{ mt:2 }}>
              Adicionar Disciplina
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {subjects.map((s: any) => {
            const allTopics = s.modules?.flatMap((m: any) => m.topics) || [];
            const completed = allTopics.filter((t: any) => t.isCompleted).length;
            const progress = allTopics.length > 0 ? Math.round((completed / allTopics.length) * 100) : 0;

            return (
              <Grid size={12} key={s.id}>
                <Card sx={{ borderLeft: `4px solid ${s.color}` }}>
                  <CardContent sx={{ pb: '8px !important' }}>
                    {/* Header */}
                    <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:1.5 }}>
                      <Box sx={{ display:'flex', alignItems:'center', gap:1 }}>
                        <Box sx={{ width:12, height:12, borderRadius:'50%', bgcolor: s.color }} />
                        <Typography variant="h6" fontWeight={700}>{s.name}</Typography>
                        <Chip label={`Peso ${s.weight}x`} size="small" sx={{ bgcolor: alpha(s.color, 0.1), color: s.color, fontWeight:700 }} />
                      </Box>
                      <Box sx={{ display:'flex', gap:0.5 }}>
                        <Tooltip title="Adicionar módulo">
                          <IconButton size="small" onClick={() => setModuleDialog(s.id)}><Add fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEditSubject(s)}><Edit fontSize="small" /></IconButton>
                        </Tooltip>
                        <Tooltip title="Deletar">
                          <IconButton size="small" color="error" onClick={() => deleteSubjectMutation.mutate(s.id)}><Delete fontSize="small" /></IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {/* Progress */}
                    <Box sx={{ display:'flex', alignItems:'center', gap:1, mb:1.5 }}>
                      <LinearProgress
                        variant="determinate" value={progress}
                        sx={{ flexGrow:1, height:6, bgcolor: alpha(s.color, 0.1), '& .MuiLinearProgress-bar': { bgcolor: s.color } }}
                      />
                      <Typography variant="caption" color="text.secondary">{completed}/{allTopics.length} tópicos</Typography>
                    </Box>

                    {/* Módulos */}
                    {s.modules?.map((m: any) => (
                      <Accordion key={m.id} disableGutters elevation={0}
                        sx={{ bgcolor:'transparent', border:`1px solid ${theme.palette.divider}`, borderRadius:'8px !important', mb:0.5, '&:before': { display:'none' } }}>
                        <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight:44, py:0 }}>
                          <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', pr:1 }}>
                            <Typography variant="body2" fontWeight={600}>{m.name}</Typography>
                            <Box sx={{ display:'flex', gap:0.5 }}>
                              <Chip label={`${m.topics?.length || 0} tópicos`} size="small" />
                              <IconButton size="small" onClick={e => { e.stopPropagation(); setTopicDialog(m.id); }}
                                sx={{ width:24, height:24 }}>
                                <Add sx={{ fontSize:16 }} />
                              </IconButton>
                            </Box>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt:0 }}>
                          {m.topics?.map((t: any) => (
                            <Box key={t.id} sx={{
                              display:'flex', alignItems:'center', gap:1, py:0.75,
                              borderBottom:`1px solid ${alpha(theme.palette.divider, 0.5)}`,
                              '&:last-child': { borderBottom:'none' },
                            }}>
                              <IconButton size="small" onClick={() => updateTopicMutation.mutate({ id: t.id, data: { isCompleted: !t.isCompleted, progress: !t.isCompleted ? 100 : 0 } })}
                                sx={{ color: t.isCompleted ? 'success.main' : 'text.disabled' }}>
                                <CheckCircle sx={{ fontSize:18 }} />
                              </IconButton>
                              <Typography variant="body2" sx={{ flexGrow:1, textDecoration: t.isCompleted ? 'line-through' : 'none', opacity: t.isCompleted ? 0.6 : 1 }}>
                                {t.name}
                              </Typography>
                              <Chip label={DIFF_LABEL[t.difficulty]} size="small"
                                sx={{ bgcolor: alpha(DIFF_COLOR[t.difficulty], 0.1), color: DIFF_COLOR[t.difficulty], height:20, fontSize:11 }} />
                              <Typography variant="caption" color="text.secondary">{t.estimatedHours}h</Typography>
                              <IconButton size="small" color="error" onClick={() => deleteTopicMutation.mutate(t.id)}>
                                <Delete sx={{ fontSize:14 }} />
                              </IconButton>
                            </Box>
                          ))}
                          {(!m.topics || m.topics.length === 0) && (
                            <Typography variant="caption" color="text.secondary" sx={{ py:1, display:'block', textAlign:'center' }}>
                              Nenhum tópico. Clique em + para adicionar.
                            </Typography>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialog Disciplina */}
      <Dialog open={subjectDialog} onClose={() => { setSubjectDialog(false); setEditSubject(null); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{editSubject ? 'Editar Disciplina' : 'Nova Disciplina'}</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <TextField label="Nome *" value={sForm.name} onChange={e => setSForm(f => ({ ...f, name: e.target.value }))} />
          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>Cor</Typography>
            <Box sx={{ display:'flex', gap:0.75, flexWrap:'wrap' }}>
              {COLORS.map(c => (
                <Box key={c} onClick={() => setSForm(f => ({ ...f, color: c }))}
                  sx={{ width:28, height:28, borderRadius:'50%', bgcolor:c, cursor:'pointer',
                    border: sForm.color === c ? '3px solid white' : '3px solid transparent',
                    boxShadow: sForm.color === c ? `0 0 0 2px ${c}` : 'none' }} />
              ))}
            </Box>
          </Box>
          <TextField label="Peso (1-3)" type="number" value={sForm.weight}
            onChange={e => setSForm(f => ({ ...f, weight: e.target.value }))}
            helperText="Disciplinas com maior peso recebem mais tempo no cronograma" />
        </DialogContent>
        <DialogActions sx={{ p:2 }}>
          <Button onClick={() => { setSubjectDialog(false); setEditSubject(null); }}>Cancelar</Button>
          <Button variant="contained" disabled={!sForm.name}
            onClick={() => editSubject ? updateSubjectMutation.mutate() : createSubjectMutation.mutate()}>
            {editSubject ? 'Salvar' : 'Criar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Módulo */}
      <Dialog open={Boolean(moduleDialog)} onClose={() => setModuleDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Novo Módulo</DialogTitle>
        <DialogContent sx={{ pt:2 }}>
          <TextField fullWidth label="Nome do módulo *" value={mForm.name}
            onChange={e => setMForm({ name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && mForm.name && createModuleMutation.mutate(moduleDialog!)} />
        </DialogContent>
        <DialogActions sx={{ p:2 }}>
          <Button onClick={() => setModuleDialog(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!mForm.name} onClick={() => createModuleMutation.mutate(moduleDialog!)}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Tópico */}
      <Dialog open={Boolean(topicDialog)} onClose={() => setTopicDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Novo Tópico</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <TextField label="Nome do tópico *" value={tForm.name} onChange={e => setTForm(f => ({ ...f, name: e.target.value }))} />
          <FormControl size="small">
            <InputLabel>Dificuldade</InputLabel>
            <Select value={tForm.difficulty} label="Dificuldade" onChange={e => setTForm(f => ({ ...f, difficulty: e.target.value }))}>
              {DIFFICULTIES.map(d => <MenuItem key={d} value={d}>{DIFF_LABEL[d]}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Horas estimadas" type="number" value={tForm.estimatedHours}
            onChange={e => setTForm(f => ({ ...f, estimatedHours: e.target.value }))} />
        </DialogContent>
        <DialogActions sx={{ p:2 }}>
          <Button onClick={() => setTopicDialog(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!tForm.name} onClick={() => createTopicMutation.mutate(topicDialog!)}>Criar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
