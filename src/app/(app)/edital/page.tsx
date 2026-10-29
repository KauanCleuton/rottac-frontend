'use client';

import {
  Box, Grid, Card, CardContent, Typography, Button, Chip,
  LinearProgress, CircularProgress, alpha, useTheme, Paper,
  Stepper, Step, StepLabel, StepContent, Alert, IconButton,
  List, ListItem, ListItemText, TextField, Slider,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Accordion, AccordionSummary, AccordionDetails, Divider,
} from '@mui/material';
import {
  UploadFile, AutoAwesome, CheckCircle, Edit, Delete,
  Add, ExpandMore, Article, School, Analytics, Refresh,
  Warning, Info,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { editalApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { useState, useRef, useCallback } from 'react';
import { BRAND_GRADIENT } from '@/theme';

const STEPS = ['Upload do Edital', 'Extração Automática', 'Revisar & Confirmar', 'Concluído'];

interface SubjectExtracted {
  name: string;
  weight: number;
  topics: string[];
  confidence?: number;
}

export default function EditalPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [currentImportId, setCurrentImportId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectExtracted[]>([]);
  const [contestName, setContestName] = useState('');
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [editingSubjectIdx, setEditingSubjectIdx] = useState<number | null>(null);
  const [addTopicSubjectIdx, setAddTopicSubjectIdx] = useState<number | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const { data: imports = [], isLoading } = useQuery({
    queryKey: ['edital-imports'],
    queryFn: () => editalApi.getAll().then(r => r.data.data),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('edital', file);
      return editalApi.upload(fd);
    },
    onSuccess: (data) => {
      const id = data.data.data.id;
      setCurrentImportId(id);
      setActiveStep(1);
      qc.invalidateQueries({ queryKey: ['edital-imports'] });
      startPolling(id);
    },
    onError: () => toast.error('Erro ao enviar arquivo'),
  });

  const confirmMutation = useMutation({
    mutationFn: () => editalApi.confirm(currentImportId!, { contestName, year, subjects }),
    onSuccess: () => {
      setActiveStep(3);
      qc.invalidateQueries({ queryKey: ['edital-imports'] });
      toast.success('Edital importado! Disciplinas criadas no sistema.');
    },
    onError: () => toast.error('Erro ao confirmar edital'),
  });

  const startPolling = useCallback((id: string) => {
    const interval = setInterval(async () => {
      try {
        const resp = await editalApi.getStatus(id);
        const record = resp.data.data;

        if (record.status === 'AGUARDANDO_CONFIRMACAO') {
          clearInterval(interval);
          setPollingInterval(null);
          const extracted = record.extractedData?.subjects || [];
          setSubjects(extracted);
          setActiveStep(2);
        } else if (record.status === 'ERRO') {
          clearInterval(interval);
          setPollingInterval(null);
          toast.error('Erro na extração: ' + (record.errorMessage || 'Tente novamente'));
          setActiveStep(0);
        }
      } catch {}
    }, 2000);
    setPollingInterval(interval as any);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Apenas arquivos PDF são aceitos');
      return;
    }
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/pdf') uploadMutation.mutate(file);
  };

  const updateSubjectWeight = (idx: number, weight: number) => {
    setSubjects(prev => prev.map((s, i) => i === idx ? { ...s, weight } : s));
  };

  const removeSubject = (idx: number) => {
    setSubjects(prev => prev.filter((_, i) => i !== idx));
  };

  const removeTopic = (subjectIdx: number, topicIdx: number) => {
    setSubjects(prev => prev.map((s, i) => {
      if (i !== subjectIdx) return s;
      return { ...s, topics: s.topics.filter((_, ti) => ti !== topicIdx) };
    }));
  };

  const addTopic = (subjectIdx: number) => {
    if (!newTopic.trim()) return;
    setSubjects(prev => prev.map((s, i) => {
      if (i !== subjectIdx) return s;
      return { ...s, topics: [...s.topics, newTopic.trim()] };
    }));
    setNewTopic('');
    setAddTopicSubjectIdx(null);
  };

  const addSubject = () => {
    setSubjects(prev => [...prev, { name: 'Nova Disciplina', weight: 1.0, topics: [], confidence: 0.5 }]);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Importação de Edital</Typography>
        <Typography color="text.secondary" variant="body2">
          Envie o PDF do edital e o sistema extrai disciplinas, tópicos e pesos automaticamente
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* ── Wizard Principal ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Stepper activeStep={activeStep} orientation="vertical">
                {/* Step 0: Upload */}
                <Step>
                  <StepLabel>Upload do Edital (PDF)</StepLabel>
                  <StepContent>
                    <Box
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      sx={{
                        border: `2px dashed ${alpha('#F2B705', 0.4)}`,
                        borderRadius: 3,
                        p: 6,
                        textAlign: 'center',
                        cursor: 'pointer',
                        bgcolor: alpha('#F2B705', 0.03),
                        transition: 'all 0.2s',
                        '&:hover': {
                          bgcolor: alpha('#F2B705', 0.08),
                          borderColor: '#F2B705',
                        },
                      }}
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <CircularProgress sx={{ mb: 2 }} />
                          <Typography>Enviando arquivo...</Typography>
                        </>
                      ) : (
                        <>
                          <UploadFile sx={{ fontSize: 56, color: alpha('#F2B705', 0.5), mb: 2 }} />
                          <Typography variant="h6" fontWeight={600}>
                            Arraste o PDF do edital aqui
                          </Typography>
                          <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                            ou clique para selecionar o arquivo (máx. 50MB)
                          </Typography>
                        </>
                      )}
                    </Box>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />
                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        O sistema usa <strong>IA + NLP</strong> para extrair automaticamente disciplinas e tópicos.
                        Quanto mais estruturado o edital, melhor a extração.
                      </Typography>
                    </Alert>
                  </StepContent>
                </Step>

                {/* Step 1: Processando */}
                <Step>
                  <StepLabel>Processando extração automática</StepLabel>
                  <StepContent>
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CircularProgress size={48} sx={{ mb: 2 }} />
                      <Typography fontWeight={600}>Analisando o edital...</Typography>
                      <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                        Lendo PDF → Identificando seções → Extraindo disciplinas → Inferindo pesos
                      </Typography>
                    </Box>
                  </StepContent>
                </Step>

                {/* Step 2: Revisão */}
                <Step>
                  <StepLabel>Revisar e confirmar dados</StepLabel>
                  <StepContent>
                    {/* Dados do concurso */}
                    <Box sx={{ mb: 3 }}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 8 }}>
                          <TextField
                            fullWidth
                            label="Nome do Concurso"
                            value={contestName}
                            onChange={(e) => setContestName(e.target.value)}
                            placeholder="Ex: Polícia Federal 2025"
                            size="small"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <TextField
                            fullWidth
                            label="Ano"
                            type="number"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            size="small"
                          />
                        </Grid>
                      </Grid>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" fontWeight={700}>
                        {subjects.length} disciplinas extraídas
                      </Typography>
                      <Button size="small" startIcon={<Add />} onClick={addSubject}>
                        Adicionar
                      </Button>
                    </Box>

                    {subjects.map((s, idx) => (
                      <Accordion key={idx} sx={{ mb: 1, border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, boxShadow: 'none' }}>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2 }}>
                            <School sx={{ color: '#F2B705', fontSize: 20 }} />
                            <Typography fontWeight={600} sx={{ flex: 1 }}>{s.name}</Typography>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Chip
                                label={`Peso ${s.weight.toFixed(1)}`}
                                size="small"
                                sx={{ bgcolor: alpha('#F2B705', 0.1) }}
                              />
                              {s.confidence !== undefined && (
                                <Chip
                                  label={`${Math.round((s.confidence || 0) * 100)}% conf.`}
                                  size="small"
                                  sx={{
                                    bgcolor: alpha(s.confidence >= 0.8 ? '#10B981' : s.confidence >= 0.6 ? '#F59E0B' : '#EF4444', 0.1),
                                    fontSize: 11,
                                  }}
                                />
                              )}
                              <Chip label={`${s.topics.length} tópicos`} size="small" variant="outlined" />
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); removeSubject(idx); }}>
                                <Delete fontSize="small" sx={{ color: '#EF4444' }} />
                              </IconButton>
                            </Box>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          {/* Nome da disciplina */}
                          <TextField
                            fullWidth
                            label="Nome da disciplina"
                            value={s.name}
                            onChange={(e) => setSubjects(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))}
                            size="small"
                            sx={{ mb: 2 }}
                          />

                          {/* Peso */}
                          <Typography variant="body2" gutterBottom>
                            Peso / Importância: <strong>{s.weight.toFixed(1)}</strong>
                          </Typography>
                          <Slider
                            value={s.weight}
                            onChange={(_, v) => updateSubjectWeight(idx, v as number)}
                            min={0.5}
                            max={5}
                            step={0.5}
                            marks
                            valueLabelDisplay="auto"
                            sx={{ mb: 2, color: '#F2B705' }}
                          />

                          {/* Tópicos */}
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                            Tópicos ({s.topics.length})
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                            {s.topics.map((t, ti) => (
                              <Chip
                                key={ti}
                                label={t}
                                size="small"
                                onDelete={() => removeTopic(idx, ti)}
                                sx={{ fontSize: 11 }}
                              />
                            ))}
                          </Box>
                          {addTopicSubjectIdx === idx ? (
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <TextField
                                size="small"
                                placeholder="Nome do tópico"
                                value={newTopic}
                                onChange={(e) => setNewTopic(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addTopic(idx)}
                                autoFocus
                                sx={{ flex: 1 }}
                              />
                              <Button size="small" variant="contained" onClick={() => addTopic(idx)}>Adicionar</Button>
                              <Button size="small" onClick={() => setAddTopicSubjectIdx(null)}>Cancelar</Button>
                            </Box>
                          ) : (
                            <Button
                              size="small"
                              startIcon={<Add />}
                              onClick={() => setAddTopicSubjectIdx(idx)}
                            >
                              Adicionar Tópico
                            </Button>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    ))}

                    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                      <Button
                        variant="contained"
                        startIcon={<CheckCircle />}
                        onClick={() => confirmMutation.mutate()}
                        disabled={confirmMutation.isPending || subjects.length === 0}
                        sx={{ background: BRAND_GRADIENT }}
                      >
                        {confirmMutation.isPending ? 'Salvando...' : 'Confirmar e Criar Disciplinas'}
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<Refresh />}
                        onClick={() => { setActiveStep(0); setCurrentImportId(null); setSubjects([]); }}
                      >
                        Recomeçar
                      </Button>
                    </Box>
                  </StepContent>
                </Step>

                {/* Step 3: Concluído */}
                <Step>
                  <StepLabel>Importação concluída</StepLabel>
                  <StepContent>
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <CheckCircle sx={{ fontSize: 64, color: '#10B981', mb: 2 }} />
                      <Typography variant="h6" fontWeight={700}>Edital importado com sucesso!</Typography>
                      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                        As disciplinas e tópicos foram criados no sistema.
                        Acesse "Disciplinas" para verificar.
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                        <Button
                          variant="contained"
                          href="/disciplinas"
                          sx={{ background: BRAND_GRADIENT }}
                        >
                          Ver Disciplinas
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => { setActiveStep(0); setCurrentImportId(null); setSubjects([]); setContestName(''); }}
                        >
                          Novo Edital
                        </Button>
                      </Box>
                    </Box>
                  </StepContent>
                </Step>
              </Stepper>
            </CardContent>
          </Card>
        </Grid>

        {/* ── Sidebar: histórico + informações ── */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Como funciona */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Info sx={{ color: '#F2B705' }} />
                <Typography variant="h6" fontWeight={700}>Como funciona</Typography>
              </Box>
              {[
                { icon: '📄', title: 'Upload do PDF', desc: 'Envie o edital oficial do concurso' },
                { icon: '🤖', title: 'Extração com IA', desc: 'NLP + regex identificam disciplinas e tópicos' },
                { icon: '⚖️', title: 'Inferência de pesos', desc: 'Sistema calcula importância por número de tópicos' },
                { icon: '✏️', title: 'Revisão manual', desc: 'Você ajusta o que a IA extraiu' },
                { icon: '✅', title: 'Criação automática', desc: 'Disciplinas criadas com cronograma inteligente' },
              ].map((item, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 2, mb: 1.5 }}>
                  <Typography sx={{ fontSize: 20 }}>{item.icon}</Typography>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{item.title}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Histórico de importações */}
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                Histórico de Importações
              </Typography>
              {isLoading ? (
                <CircularProgress size={24} />
              ) : imports.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  Nenhum edital importado ainda.
                </Typography>
              ) : (
                <List disablePadding>
                  {imports.map((imp: any) => (
                    <ListItem
                      key={imp.id}
                      disablePadding
                      sx={{ mb: 1, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.divider, 0.3) }}
                    >
                      <ListItemText
                        primary={imp.contestName || imp.fileName}
                        secondaryTypographyProps={{ component: 'div' }}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                            <Chip
                              label={imp.status}
                              size="small"
                              sx={{
                                fontSize: 10,
                                bgcolor: alpha(
                                  imp.status === 'CONFIRMADO' ? '#10B981' :
                                  imp.status === 'ERRO' ? '#EF4444' :
                                  imp.status === 'PROCESSANDO' ? '#F59E0B' : '#F2B705',
                                  0.15
                                ),
                              }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(imp.createdAt).format('DD/MM/YYYY')}
                            </Typography>
                          </Box>
                        }
                        primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
