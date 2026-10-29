'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button, Chip,
  IconButton, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, alpha, useTheme, CircularProgress, LinearProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip, Divider,
} from '@mui/material';
import {
  Add, Delete, Edit, TrackChanges, CheckCircle, AccessTime,
  EmojiEvents, TrendingUp, Update,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goalApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');

const GOAL_TYPES = [
  { value: 'TEMPO', label: 'Horas de Estudo', icon: '⏱️', unit: 'horas', color: '#F2B705' },
  { value: 'QUESTOES', label: 'Questões Resolvidas', icon: '📝', unit: 'questões', color: '#3B82F6' },
  { value: 'TOPICOS', label: 'Tópicos Concluídos', icon: '📚', unit: 'tópicos', color: '#22C55E' },
  { value: 'REVISOES', label: 'Revisões Feitas', icon: '🔄', unit: 'revisões', color: '#F59E0B' },
];

const GOAL_PERIODS = [
  { value: 'DIARIO', label: 'Diário' },
  { value: 'SEMANAL', label: 'Semanal' },
  { value: 'MENSAL', label: 'Mensal' },
];

export default function MetasPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);
  const [updateProgressOpen, setUpdateProgressOpen] = useState<any>(null);
  const [progressValue, setProgressValue] = useState('');
  const [form, setForm] = useState({
    title: '', type: 'TEMPO', targetValue: '', period: 'SEMANAL',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    subjectId: '',
  });

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals'],
    queryFn: () => goalApi.getAll().then(r => r.data.data || []),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-simple'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => goalApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      setCreateOpen(false);
      resetForm();
      toast.success('Meta criada!');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => goalApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] });
      setUpdateProgressOpen(null);
      setEditGoal(null);
      resetForm();
      toast.success('Meta atualizada!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => goalApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); toast.success('Meta removida'); },
  });

  const resetForm = () => setForm({
    title: '', type: 'TEMPO', targetValue: '', period: 'SEMANAL',
    startDate: dayjs().format('YYYY-MM-DD'),
    endDate: dayjs().add(7, 'day').format('YYYY-MM-DD'),
    subjectId: '',
  });

  const handleSubmit = () => {
    const gt = GOAL_TYPES.find(t => t.value === form.type);
    const payload = {
      title: form.title,
      type: form.type,
      period: form.period,
      target: parseFloat(form.targetValue),
      unit: gt?.unit || '',
      startDate: form.startDate,
      endDate: form.endDate,
    };
    if (editGoal) updateMutation.mutate({ id: editGoal.id, data: payload });
    else createMutation.mutate(payload);
  };

  const handleUpdateProgress = () => {
    if (!updateProgressOpen) return;
    updateMutation.mutate({ id: updateProgressOpen.id, data: { current: parseFloat(progressValue) } });
    setProgressValue('');
  };

  const activeGoals = goals.filter((g: any) => !g.isCompleted);
  const completedGoals = goals.filter((g: any) => g.isCompleted);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  const GoalCard = ({ goal }: { goal: any }) => {
    const gt = GOAL_TYPES.find(t => t.value === goal.type) || GOAL_TYPES[0];
    const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
    const daysLeft = dayjs(goal.endDate).diff(dayjs(), 'day');
    const isOverdue = daysLeft < 0 && !goal.isCompleted;
    const isDanger = daysLeft <= 2 && daysLeft >= 0 && !goal.isCompleted && pct < 80;

    return (
      <Card sx={{
        borderLeft: `4px solid ${goal.isCompleted ? '#22C55E' : gt.color}`,
        opacity: goal.isCompleted ? 0.75 : 1,
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${alpha(gt.color, 0.2)}` },
      }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Typography fontSize={20}>{gt.icon}</Typography>
              <Box>
                <Typography fontWeight={700} variant="body1">{goal.title}</Typography>
                <Typography variant="caption" color="text.secondary">{gt.label}</Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
              {goal.isCompleted && <Chip label="✅ Concluída" size="small" color="success" />}
              {isOverdue && <Chip label="⚠️ Atrasada" size="small" color="error" />}
              {isDanger && <Chip label="⏰ Urgente" size="small" color="warning" />}
              {!goal.isCompleted && (
                <Tooltip title="Atualizar progresso">
                  <IconButton size="small" color="primary"
                    onClick={() => { setUpdateProgressOpen(goal); setProgressValue(String(goal.current || 0)); }}>
                    <Update fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(goal.id)}>
                <Delete fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                {goal.current || 0} / {goal.target} {gt.unit}
              </Typography>
              <Typography variant="body2" fontWeight={700} color={pct >= 100 ? 'success.main' : gt.color}>
                {pct}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={pct}
              sx={{ height: 8, borderRadius: 4,
                bgcolor: alpha(gt.color, 0.12),
                '& .MuiLinearProgress-bar': { bgcolor: pct >= 100 ? '#22C55E' : gt.color, borderRadius: 4 } }} />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip label={GOAL_PERIODS.find(p => p.value === goal.period)?.label || goal.period}
                size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
              {goal.subject && (
                <Chip label={goal.subject.name} size="small"
                  sx={{ height: 18, fontSize: 10, bgcolor: alpha(goal.subject.color || '#888', 0.1), color: goal.subject.color }} />
              )}
            </Box>
            <Typography variant="caption" color={isOverdue ? 'error.main' : 'text.secondary'}>
              {goal.isCompleted ? `Concluída em ${dayjs(goal.updatedAt).format('DD/MM')}` :
               isOverdue ? `${Math.abs(daysLeft)}d atrasada` :
               daysLeft === 0 ? 'Vence hoje!' :
               `${daysLeft}d restantes`}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Metas</Typography>
          <Typography color="text.secondary" variant="body2">
            {activeGoals.length} ativas · {completedGoals.length} concluídas
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { resetForm(); setCreateOpen(true); }}>
          Nova Meta
        </Button>
      </Box>

      {/* Resumo rápido */}
      {activeGoals.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {GOAL_TYPES.map(gt => {
            const typeGoals = activeGoals.filter((g: any) => g.type === gt.value);
            if (typeGoals.length === 0) return null;
            const avgPct = Math.round(typeGoals.reduce((acc: number, g: any) =>
              acc + Math.min(100, (g.current / g.target) * 100), 0) / typeGoals.length);
            return (
              <Grid size={{ xs: 6, md: 3 }} key={gt.value}>
                <Card sx={{ textAlign: 'center', borderTop: `3px solid ${gt.color}` }}>
                  <CardContent sx={{ py: '12px !important' }}>
                    <Typography fontSize={24}>{gt.icon}</Typography>
                    <Typography variant="h5" fontWeight={800} color={gt.color}>{avgPct}%</Typography>
                    <Typography variant="caption" color="text.secondary">{gt.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {goals.length === 0 ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 8 }}>
          <TrackChanges sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6">Nenhuma meta definida</Typography>
          <Typography color="text.secondary" mb={2}>Defina metas para manter o foco e medir seu progresso</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>Criar primeira meta</Button>
        </CardContent></Card>
      ) : (
        <Box>
          {activeGoals.length > 0 && (
            <>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Metas Ativas</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {activeGoals.map((goal: any) => (
                  <Grid size={{ xs: 12, md: 6 }} key={goal.id}><GoalCard goal={goal} /></Grid>
                ))}
              </Grid>
            </>
          )}
          {completedGoals.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }} color="success.main">
                🏆 Metas Concluídas
              </Typography>
              <Grid container spacing={2}>
                {completedGoals.map((goal: any) => (
                  <Grid size={{ xs: 12, md: 6 }} key={goal.id}><GoalCard goal={goal} /></Grid>
                ))}
              </Grid>
            </>
          )}
        </Box>
      )}

      {/* Dialog Nova Meta */}
      <Dialog open={createOpen || Boolean(editGoal)} onClose={() => { setCreateOpen(false); setEditGoal(null); }} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>{editGoal ? 'Editar Meta' : 'Nova Meta'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Título da meta *" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Ex: Estudar 20h de Direito Constitucional" />

          <FormControl size="small">
            <InputLabel>Tipo de Meta</InputLabel>
            <Select value={form.type} label="Tipo de Meta" onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {GOAL_TYPES.map(t => <MenuItem key={t.value} value={t.value}>{t.icon} {t.label}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField label={`Valor alvo (${GOAL_TYPES.find(t => t.value === form.type)?.unit})`}
            type="number" value={form.targetValue}
            onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))} />

          <FormControl size="small">
            <InputLabel>Período</InputLabel>
            <Select value={form.period} label="Período" onChange={e => setForm(f => ({ ...f, period: e.target.value }))}>
              {GOAL_PERIODS.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
            </Select>
          </FormControl>

          <Grid container spacing={1}>
            <Grid size={6}>
              <TextField fullWidth label="Início" type="date" size="small" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Fim" type="date" size="small" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>

          <FormControl size="small">
            <InputLabel>Disciplina (opcional)</InputLabel>
            <Select value={form.subjectId} label="Disciplina (opcional)"
              onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}>
              <MenuItem value="">Geral</MenuItem>
              {subjects.map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setCreateOpen(false); setEditGoal(null); }}>Cancelar</Button>
          <Button variant="contained" onClick={handleSubmit}
            disabled={!form.title || !form.targetValue || createMutation.isPending || updateMutation.isPending}>
            {editGoal ? 'Salvar' : 'Criar Meta'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Atualizar Progresso */}
      <Dialog open={Boolean(updateProgressOpen)} onClose={() => setUpdateProgressOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Atualizar Progresso</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {updateProgressOpen && (() => {
            const gt = GOAL_TYPES.find(t => t.value === updateProgressOpen.type) || GOAL_TYPES[0];
            return (
              <Box>
                <Typography variant="body2" color="text.secondary" mb={2}>{updateProgressOpen.title}</Typography>
                <TextField fullWidth label={`Valor atual (${gt.unit})`} type="number" value={progressValue}
                  onChange={e => setProgressValue(e.target.value)} autoFocus />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Meta: {updateProgressOpen.target} {gt.unit}
                </Typography>
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUpdateProgressOpen(null)}>Cancelar</Button>
          <Button variant="contained" onClick={handleUpdateProgress} disabled={!progressValue}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
