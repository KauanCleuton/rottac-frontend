'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, Chip,
  IconButton, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, List, ListItem, ListItemText, ListItemIcon,
  alpha, useTheme, CircularProgress, Tabs, Tab, Divider,
  Select, MenuItem, FormControl, InputLabel, LinearProgress, Tooltip,
  Menu,
} from '@mui/material';
import {
  Add, CalendarMonth, AutoAwesome, CheckCircle,
  RadioButtonUnchecked, Timer, Delete, Edit, PlayArrow,
  FileDownload, PictureAsPdf, Event,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planApi, taskApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import isToday from 'dayjs/plugin/isToday';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(isToday);
dayjs.extend(isSameOrBefore);
dayjs.locale('pt-br');

const TASK_TYPES = ['LEITURA','REVISAO','EXERCICIOS','VIDEO','RESUMO','FLASHCARDS','SIMULADO'];
const TASK_LABEL: Record<string,string> = { LEITURA:'Leitura', REVISAO:'Revisão', EXERCICIOS:'Exercícios', VIDEO:'Vídeo', RESUMO:'Resumo', FLASHCARDS:'Flashcards', SIMULADO:'Simulado' };
const TASK_COLOR: Record<string,string> = { LEITURA:'#F2B705', REVISAO:'#EC4899', EXERCICIOS:'#22C55E', VIDEO:'#F59E0B', RESUMO:'#3B82F6', FLASHCARDS:'#D4A017', SIMULADO:'#EF4444' };

export default function PlanoPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [createPlanOpen, setCreatePlanOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);
  const [planForm, setPlanForm] = useState({ name:'', startDate: dayjs().format('YYYY-MM-DD'), endDate: dayjs().add(3,'month').format('YYYY-MM-DD') });
  const [taskForm, setTaskForm] = useState({ title:'', scheduledDate: dayjs().format('YYYY-MM-DD'), estimatedMinutes:'60', type:'LEITURA', topicId:'' });

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['study-plans'],
    queryFn: () => planApi.getAll().then(r => r.data.data),
  });

  const { data: todayData } = useQuery({
    queryKey: ['today-tasks'],
    queryFn: () => planApi.getToday().then(r => r.data.data),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-simple'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  const activePlan = plans.find((p: any) => p.isActive);

  const createPlanMutation = useMutation({
    mutationFn: () => planApi.create({ ...planForm, startDate: planForm.startDate, endDate: planForm.endDate }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-plans'] }); setCreatePlanOpen(false); toast.success('Plano criado!'); },
  });

  const generateMutation = useMutation({
    mutationFn: () => planApi.generate({ planId: activePlan?.id, startDate: activePlan?.startDate, endDate: activePlan?.endDate }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['study-plans'] });
      qc.invalidateQueries({ queryKey: ['today-tasks'] });
      setGenerateOpen(false);
      toast.success(res.data.message || 'Cronograma gerado!');
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: () => taskApi.create({ ...taskForm, studyPlanId: activePlan?.id, estimatedMinutes: parseInt(taskForm.estimatedMinutes) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-plans'] }); qc.invalidateQueries({ queryKey: ['today-tasks'] }); setCreateTaskOpen(false); toast.success('Tarefa criada!'); },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => taskApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['study-plans'] });
      qc.invalidateQueries({ queryKey: ['today-tasks'] });
      qc.invalidateQueries({ queryKey: ['intel-plan-today'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      toast.success('Concluída! +10 XP 🎉');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error || 'Erro ao concluir tarefa'),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => taskApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['study-plans'] }); qc.invalidateQueries({ queryKey: ['today-tasks'] }); },
  });

  // Agrupar tarefas do plano ativo por data
  const tasksByDate: Record<string, any[]> = {};
  activePlan?.tasks?.forEach((t: any) => {
    const d = dayjs(t.scheduledDate).format('YYYY-MM-DD');
    if (!tasksByDate[d]) tasksByDate[d] = [];
    tasksByDate[d].push(t);
  });

  const allTopics = subjects.flatMap((s: any) => s.modules?.flatMap((m: any) => m.topics?.map((t: any) => ({ ...t, subjectName: s.name })) || []) || []);

  // ─── Export como PDF (jsPDF, client-side) ──────────────────────────────────
  const exportPDF = async () => {
    if (!activePlan) return;
    setExportAnchor(null);
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageW = doc.internal.pageSize.getWidth();
    const margin = 14;
    let y = 20;

    // Cabeçalho
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(123, 47, 247);
    doc.text('RottaConcursos — Plano de Estudos', margin, y);
    y += 8;

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text(activePlan.name, margin, y);
    y += 6;
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${dayjs(activePlan.startDate).format('DD/MM/YYYY')} → ${dayjs(activePlan.endDate).format('DD/MM/YYYY')}`,
      margin, y
    );
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    const sorted = Object.keys(tasksByDate).sort();
    for (const date of sorted) {
      const tasks = tasksByDate[date];

      // Verifica se precisa de nova página
      if (y > 265) { doc.addPage(); y = 20; }

      // Data
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text(dayjs(date).format('dddd, DD/MM/YYYY').toUpperCase(), margin, y);
      y += 5;

      for (const t of tasks) {
        if (y > 270) { doc.addPage(); y = 20; }

        const check = t.isCompleted ? '[x]' : '[ ]';
        const label = TASK_LABEL[t.type] || t.type;
        const line = `  ${check} ${t.title}  (${label} · ${t.estimatedMinutes}min)`;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(t.isCompleted ? 150 : 40, t.isCompleted ? 150 : 40, t.isCompleted ? 150 : 40);
        const lines = doc.splitTextToSize(line, pageW - margin * 2);
        doc.text(lines, margin, y);
        y += lines.length * 5;
      }

      y += 3;
    }

    // Rodapé
    const totalTasks = activePlan.tasks?.length || 0;
    const doneTasks = activePlan.tasks?.filter((t: any) => t.isCompleted).length || 0;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Total: ${totalTasks} tarefas · ${doneTasks} concluídas · Gerado em ${dayjs().format('DD/MM/YYYY HH:mm')}`,
      margin, doc.internal.pageSize.getHeight() - 8
    );

    doc.save(`plano-${activePlan.name.replace(/\s+/g, '-')}.pdf`);
    toast.success('PDF exportado!');
  };

  // ─── Export como iCal (.ics) ───────────────────────────────────────────────
  const exportIcal = () => {
    if (!activePlan) return;
    setExportAnchor(null);

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//RottaConcursos//StudyPlan//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${activePlan.name}`,
    ];

    const fmt = (d: string) => d.replace(/[-:]/g, '').replace('T', 'T');
    const stamp = dayjs().format('YYYYMMDDTHHmmss') + 'Z';

    for (const date of Object.keys(tasksByDate).sort()) {
      const tasks = tasksByDate[date];
      let startHour = 8; // começa às 08:00

      for (const t of tasks) {
        const mins = t.estimatedMinutes || 60;
        const dtStart = dayjs(date).hour(startHour).minute(0);
        const dtEnd = dtStart.add(mins, 'minute');
        startHour = dtEnd.hour() + (dtEnd.minute() > 0 ? 1 : 0);

        const uid = `${t.id}@aprova-ai`;
        lines.push('BEGIN:VEVENT');
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${stamp}`);
        lines.push(`DTSTART:${dtStart.format('YYYYMMDDTHHmmss')}`);
        lines.push(`DTEND:${dtEnd.format('YYYYMMDDTHHmmss')}`);
        lines.push(`SUMMARY:${t.title}`);
        lines.push(`DESCRIPTION:${TASK_LABEL[t.type] || t.type} - ${mins} minutos estimados`);
        lines.push(`CATEGORIES:ESTUDO`);
        if (t.isCompleted) lines.push('STATUS:COMPLETED');
        lines.push('END:VEVENT');
      }
    }

    lines.push('END:VCALENDAR');

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plano-${activePlan.name.replace(/\s+/g, '-')}.ics`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Calendário exportado! Abra o arquivo .ics para importar.');
  };

  if (plansLoading) return <Box sx={{ display:'flex', justifyContent:'center', mt:8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display:'flex', justifyContent:'space-between', alignItems:'center', mb:3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Plano de Estudos</Typography>
          <Typography color="text.secondary">{activePlan ? `Plano ativo: ${activePlan.name}` : 'Nenhum plano ativo'}</Typography>
        </Box>
        <Box sx={{ display:'flex', gap:1 }}>
          {activePlan && (
            <>
              <Button variant="outlined" startIcon={<AutoAwesome />} onClick={() => setGenerateOpen(true)}>
                Gerar Automático
              </Button>
              <Button variant="outlined" startIcon={<Add />} onClick={() => setCreateTaskOpen(true)}>
                Tarefa
              </Button>
              <Button variant="outlined" startIcon={<FileDownload />} onClick={e => setExportAnchor(e.currentTarget)}>
                Exportar
              </Button>
              <Menu anchorEl={exportAnchor} open={Boolean(exportAnchor)} onClose={() => setExportAnchor(null)}>
                <MenuItem onClick={exportPDF} sx={{ gap:1 }}>
                  <PictureAsPdf fontSize="small" color="error" /> Exportar PDF
                </MenuItem>
                <MenuItem onClick={exportIcal} sx={{ gap:1 }}>
                  <Event fontSize="small" color="primary" /> Exportar Calendário (.ics)
                </MenuItem>
              </Menu>
            </>
          )}
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreatePlanOpen(true)}>
            Novo Plano
          </Button>
        </Box>
      </Box>

      <Tabs value={tab} onChange={(_,v) => setTab(v)} sx={{ mb:3 }}>
        <Tab label="Hoje" />
        <Tab label="Calendário" />
        <Tab label="Todos os Planos" />
      </Tabs>

      {/* Aba Hoje */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs:12, md:4 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Resumo de Hoje</Typography>
                {todayData ? (
                  <>
                    <Box sx={{ mb:2 }}>
                      <Box sx={{ display:'flex', justifyContent:'space-between', mb:0.5 }}>
                        <Typography variant="body2" color="text.secondary">Progresso</Typography>
                        <Typography variant="body2" fontWeight={700}>{todayData.summary?.progressPercent || 0}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={todayData.summary?.progressPercent || 0} sx={{ height:8 }} />
                    </Box>
                    {[
                      { label:'Total', value: todayData.summary?.total || 0 },
                      { label:'Concluídas', value: todayData.summary?.completed || 0, color:'success.main' },
                      { label:'Pendentes', value: todayData.summary?.pending || 0, color:'warning.main' },
                      { label:'Tempo estimado', value: `${todayData.summary?.totalMinutes || 0} min` },
                    ].map(s => (
                      <Box key={s.label} sx={{ display:'flex', justifyContent:'space-between', py:0.5, borderBottom:`1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                        <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                        <Typography variant="body2" fontWeight={700} color={s.color}>{s.value}</Typography>
                      </Box>
                    ))}
                  </>
                ) : (
                  <Typography color="text.secondary">Sem tarefas para hoje</Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs:12, md:8 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Tarefas — {dayjs().format('DD/MM/YYYY')}
                </Typography>
                {!todayData?.tasks?.length ? (
                  <Box sx={{ textAlign:'center', py:4 }}>
                    <Typography color="text.secondary">Nenhuma tarefa para hoje.</Typography>
                    {!activePlan && (
                      <Button variant="contained" sx={{ mt:2 }} onClick={() => setCreatePlanOpen(true)}>
                        Criar Plano de Estudos
                      </Button>
                    )}
                  </Box>
                ) : (
                  <List disablePadding>
                    {todayData.tasks.map((t: any) => (
                      <ListItem key={t.id} disablePadding sx={{ py:0.5 }}>
                        <ListItemIcon sx={{ minWidth:36 }}>
                          <IconButton size="small" onClick={() => !t.isCompleted && completeMutation.mutate(t.id)}
                            sx={{ color: t.isCompleted ? 'success.main' : 'text.disabled' }}>
                            {t.isCompleted ? <CheckCircle /> : <RadioButtonUnchecked />}
                          </IconButton>
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight={500} sx={{ textDecoration: t.isCompleted ? 'line-through' : 'none', opacity: t.isCompleted ? 0.6 : 1 }}>{t.title}</Typography>}
                          secondaryTypographyProps={{ component: 'div' }}
                          secondary={
                            <Box sx={{ display:'flex', gap:0.5, mt:0.25 }}>
                              <Chip label={TASK_LABEL[t.type]} size="small" sx={{ height:18, fontSize:11, bgcolor: alpha(TASK_COLOR[t.type], 0.1), color: TASK_COLOR[t.type] }} />
                              <Chip icon={<Timer sx={{ fontSize:'12px !important' }} />} label={`${t.estimatedMinutes}min`} size="small" sx={{ height:18, fontSize:11 }} />
                            </Box>
                          }
                        />
                        <IconButton size="small" color="error" onClick={() => deleteTaskMutation.mutate(t.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </ListItem>
                    ))}
                  </List>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Aba Calendário */}
      {tab === 1 && activePlan && (
        <Box>
          {Object.keys(tasksByDate).sort().map(date => (
            <Box key={date} sx={{ mb:3 }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb:1 }}>
                {dayjs(date).format('dddd, DD/MM')}
                {dayjs(date).isToday() && <Chip label="Hoje" size="small" color="primary" sx={{ ml:1 }} />}
              </Typography>
              <Card>
                <List disablePadding>
                  {tasksByDate[date].map((t: any, i: number) => (
                    <Box key={t.id}>
                      {i > 0 && <Divider />}
                      <ListItem>
                        <ListItemIcon sx={{ minWidth:36 }}>
                          <IconButton size="small" onClick={() => !t.isCompleted && completeMutation.mutate(t.id)}
                            sx={{ color: t.isCompleted ? 'success.main' : 'text.disabled' }}>
                            {t.isCompleted ? <CheckCircle /> : <RadioButtonUnchecked />}
                          </IconButton>
                        </ListItemIcon>
                        <ListItemText
                          primary={<Typography variant="body2" fontWeight={500} sx={{ textDecoration: t.isCompleted ? 'line-through' : 'none' }}>{t.title}</Typography>}
                          secondary={<Chip label={TASK_LABEL[t.type]} size="small" sx={{ height:18, fontSize:11, mt:0.25, bgcolor: alpha(TASK_COLOR[t.type], 0.1), color: TASK_COLOR[t.type] }} />}
                        />
                        <Chip label={`${t.estimatedMinutes}min`} size="small" icon={<Timer sx={{ fontSize:'12px !important' }} />} />
                      </ListItem>
                    </Box>
                  ))}
                </List>
              </Card>
            </Box>
          ))}
          {Object.keys(tasksByDate).length === 0 && (
            <Card><CardContent sx={{ textAlign:'center', py:6 }}>
              <Typography color="text.secondary">Nenhuma tarefa no plano ainda.</Typography>
              <Button variant="contained" startIcon={<AutoAwesome />} onClick={() => setGenerateOpen(true)} sx={{ mt:2 }}>Gerar Cronograma Automático</Button>
            </CardContent></Card>
          )}
        </Box>
      )}

      {/* Aba Todos os Planos */}
      {tab === 2 && (
        <Grid container spacing={2}>
          {plans.map((plan: any) => (
            <Grid size={{ xs:12, md:6 }} key={plan.id}>
              <Card sx={{ borderLeft: plan.isActive ? '4px solid #F2B705' : '4px solid transparent' }}>
                <CardContent>
                  <Box sx={{ display:'flex', justifyContent:'space-between', mb:1 }}>
                    <Typography fontWeight={700}>{plan.name}</Typography>
                    {plan.isActive && <Chip label="Ativo" size="small" color="primary" />}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(plan.startDate).format('DD/MM/YYYY')} → {dayjs(plan.endDate).format('DD/MM/YYYY')}
                  </Typography>
                  <Box sx={{ mt:1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {plan.tasks?.length || 0} tarefas · {plan.tasks?.filter((t: any) => t.isCompleted).length || 0} concluídas
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog Novo Plano */}
      <Dialog open={createPlanOpen} onClose={() => setCreatePlanOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Novo Plano de Estudos</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <TextField label="Nome do plano" value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
          <TextField label="Início" type="date" value={planForm.startDate} onChange={e => setPlanForm(f => ({ ...f, startDate: e.target.value }))} InputLabelProps={{ shrink:true }} />
          <TextField label="Fim" type="date" value={planForm.endDate} onChange={e => setPlanForm(f => ({ ...f, endDate: e.target.value }))} InputLabelProps={{ shrink:true }} />
        </DialogContent>
        <DialogActions sx={{ p:2 }}>
          <Button onClick={() => setCreatePlanOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => createPlanMutation.mutate()} disabled={!planForm.name}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Nova Tarefa */}
      <Dialog open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Nova Tarefa</DialogTitle>
        <DialogContent sx={{ display:'flex', flexDirection:'column', gap:2, pt:2 }}>
          <TextField label="Título *" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
          <TextField label="Data" type="date" value={taskForm.scheduledDate} onChange={e => setTaskForm(f => ({ ...f, scheduledDate: e.target.value }))} InputLabelProps={{ shrink:true }} />
          <TextField label="Minutos estimados" type="number" value={taskForm.estimatedMinutes} onChange={e => setTaskForm(f => ({ ...f, estimatedMinutes: e.target.value }))} />
          <FormControl size="small">
            <InputLabel>Tipo</InputLabel>
            <Select value={taskForm.type} label="Tipo" onChange={e => setTaskForm(f => ({ ...f, type: e.target.value }))}>
              {TASK_TYPES.map(t => <MenuItem key={t} value={t}>{TASK_LABEL[t]}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Tópico (opcional)</InputLabel>
            <Select value={taskForm.topicId} label="Tópico (opcional)" onChange={e => setTaskForm(f => ({ ...f, topicId: e.target.value }))}>
              <MenuItem value="">Nenhum</MenuItem>
              {allTopics.map((t: any) => <MenuItem key={t.id} value={t.id}>{t.subjectName} — {t.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p:2 }}>
          <Button onClick={() => setCreateTaskOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => createTaskMutation.mutate()} disabled={!taskForm.title || !activePlan}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Gerar Automático */}
      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Gerar Cronograma Automático</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            O sistema vai distribuir automaticamente todos os tópicos das suas disciplinas nos dias de estudo da sua rotina, priorizando pelo peso de cada disciplina.
          </Typography>
          {!activePlan && (
            <Typography color="error" sx={{ mt:1 }}>Crie um plano de estudos primeiro.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p:2 }}>
          <Button onClick={() => setGenerateOpen(false)}>Cancelar</Button>
          <Button variant="contained" startIcon={<AutoAwesome />} onClick={() => generateMutation.mutate()}
            disabled={!activePlan || generateMutation.isPending}>
            {generateMutation.isPending ? 'Gerando...' : 'Gerar Agora'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
