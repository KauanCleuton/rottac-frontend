'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button, Chip,
  IconButton, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, alpha, useTheme, CircularProgress, LinearProgress,
  FormControl, InputLabel, Select, MenuItem, Tooltip, Avatar,
} from '@mui/material';
import {
  Add, Delete, CheckCircle, RadioButtonUnchecked, FitnessCenter, LocalFireDepartment, EmojiEvents, CalendarMonth,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { habitApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');

const HABIT_ICONS = ['📚', '💪', '🧠', '✍️', '🎯', '⏱️', '📝', '🔄', '💡', '🌟'];
const FREQUENCIES = [
  { value: 'DIARIO', label: 'Diário' },
  { value: 'DIAS_UTEIS', label: 'Dias Úteis' },
  { value: 'SEMANAL', label: 'Semanal' },
];

// Gerar últimas 12 semanas para o heatmap
function getLast12Weeks() {
  const weeks = [];
  for (let w = 11; w >= 0; w--) {
    const days = [];
    for (let d = 6; d >= 0; d--) {
      days.push(dayjs().subtract(w, 'week').startOf('week').add(d === 6 ? 6 : d, 'day'));
    }
    weeks.push(days);
  }
  return weeks;
}

export default function HabitosPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', icon: '📚', frequency: 'DIARIO', targetDays: '7' });

  const { data: habits = [], isLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: () => habitApi.getAll().then(r => r.data.data || []),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => habitApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] });
      setCreateOpen(false);
      setForm({ name: '', description: '', icon: '📚', frequency: 'DIARIO', targetDays: '7' });
      toast.success('Hábito criado!');
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => habitApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['habits'] });
      toast.success('+10 XP! Hábito concluído hoje 🔥');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => habitApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['habits'] }); toast.success('Hábito removido'); },
  });

  const totalCompletedToday = habits.filter((h: any) => {
    const completions = h.completions || [];
    return completions.some((c: any) => dayjs(c.completedAt).isToday?.() || dayjs(c.completedAt).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD'));
  }).length;

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Hábitos</Typography>
          <Typography color="text.secondary" variant="body2">
            {totalCompletedToday}/{habits.length} hábitos concluídos hoje
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Novo Hábito
        </Button>
      </Box>

      {/* Progress bar do dia */}
      {habits.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ py: '12px !important' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2" fontWeight={600}>Progresso de Hoje</Typography>
              <Typography variant="body2" fontWeight={700} color="primary">
                {habits.length > 0 ? Math.round((totalCompletedToday / habits.length) * 100) : 0}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate"
              value={habits.length > 0 ? (totalCompletedToday / habits.length) * 100 : 0}
              sx={{ height: 10, borderRadius: 5, bgcolor: alpha(theme.palette.primary.main, 0.1),
                '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #F2B705, #FFD34D)', borderRadius: 5 } }} />
            <Box sx={{ display: 'flex', gap: 2, mt: 1.5, justifyContent: 'center' }}>
              {habits.slice(0, 5).map((h: any) => {
                const done = (h.completions || []).some((c: any) =>
                  dayjs(c.completedAt).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD'));
                return (
                  <Tooltip key={h.id} title={h.name}>
                    <Avatar sx={{ width: 32, height: 32, fontSize: 16,
                      bgcolor: done ? alpha('#22C55E', 0.15) : alpha(theme.palette.action.disabled, 0.1),
                      border: done ? '2px solid #22C55E' : '2px solid transparent' }}>
                      {h.icon || '📚'}
                    </Avatar>
                  </Tooltip>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}

      {habits.length === 0 ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 8 }}>
          <FitnessCenter sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h6">Nenhum hábito cadastrado</Typography>
          <Typography color="text.secondary" mb={2}>Crie hábitos de estudo para manter consistência diária</Typography>
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>Criar primeiro hábito</Button>
        </CardContent></Card>
      ) : (
        <Grid container spacing={2}>
          {habits.map((habit: any) => {
            const completions = habit.completions || [];
            const doneToday = completions.some((c: any) =>
              dayjs(c.completedAt).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD'));

            // Heatmap: últimos 84 dias (12 semanas)
            const completionDays = new Set(completions.map((c: any) => dayjs(c.completedAt).format('YYYY-MM-DD')));
            const last84 = Array.from({ length: 84 }, (_, i) =>
              dayjs().subtract(83 - i, 'day').format('YYYY-MM-DD'));

            return (
              <Grid size={{ xs: 12, md: 6 }} key={habit.id}>
                <Card sx={{
                  borderLeft: `4px solid ${doneToday ? '#22C55E' : theme.palette.divider}`,
                  transition: 'transform 0.15s',
                  '&:hover': { transform: 'translateY(-2px)' },
                }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                        <Avatar sx={{ width: 40, height: 40, fontSize: 20,
                          bgcolor: doneToday ? alpha('#22C55E', 0.12) : alpha(theme.palette.primary.main, 0.1) }}>
                          {habit.icon || '📚'}
                        </Avatar>
                        <Box>
                          <Typography fontWeight={700}>{habit.name}</Typography>
                          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                            <Chip label={`🔥 ${habit.currentStreak || 0} dias`} size="small"
                              sx={{ height: 18, fontSize: 10, bgcolor: alpha('#FF6B35', 0.1), color: '#FF6B35' }} />
                            <Chip label={FREQUENCIES.find(f => f.value === habit.frequency)?.label || 'Diário'}
                              size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}>
                        <Tooltip title={doneToday ? 'Concluído hoje' : 'Marcar como feito'}>
                          <IconButton size="small" color={doneToday ? 'success' : 'default'}
                            onClick={() => !doneToday && completeMutation.mutate(habit.id)}
                            disabled={doneToday}>
                            {doneToday ? <CheckCircle /> : <RadioButtonUnchecked />}
                          </IconButton>
                        </Tooltip>
                        <IconButton size="small" color="error" onClick={() => deleteMutation.mutate(habit.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    {habit.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: 12 }}>
                        {habit.description}
                      </Typography>
                    )}

                    {/* Mini heatmap - últimas 12 semanas */}
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>
                        Últimas 12 semanas
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
                        {last84.map((day) => {
                          const done = completionDays.has(day);
                          const isToday = day === dayjs().format('YYYY-MM-DD');
                          return (
                            <Tooltip key={day} title={`${day}${done ? ' ✅' : ''}`}>
                              <Box sx={{
                                width: 8, height: 8, borderRadius: 1,
                                bgcolor: done ? '#22C55E' : alpha(theme.palette.divider, 0.4),
                                border: isToday ? `1px solid ${theme.palette.primary.main}` : 'none',
                                transition: 'background 0.2s',
                              }} />
                            </Tooltip>
                          );
                        })}
                      </Box>
                    </Box>

                    {/* Stats */}
                    <Box sx={{ mt: 1.5, display: 'flex', gap: 2 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={800} color="primary">{habit.totalCompletions || 0}</Typography>
                        <Typography variant="caption" color="text.secondary">Total</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={800} sx={{ color: '#FF6B35' }}>{habit.currentStreak || 0}</Typography>
                        <Typography variant="caption" color="text.secondary">Sequência</Typography>
                      </Box>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h6" fontWeight={800} color="success.main">{habit.bestStreak || 0}</Typography>
                        <Typography variant="caption" color="text.secondary">Recorde</Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialog Criar Hábito */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Novo Hábito</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Nome do hábito *" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Resolver 10 questões por dia" />

          <TextField label="Descrição (opcional)" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" mb={0.75}>Ícone</Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {HABIT_ICONS.map(icon => (
                <Box key={icon} onClick={() => setForm(f => ({ ...f, icon }))}
                  sx={{ width: 36, height: 36, borderRadius: 2, fontSize: 20, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: 'pointer',
                    bgcolor: form.icon === icon ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
                    border: form.icon === icon ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                  {icon}
                </Box>
              ))}
            </Box>
          </Box>

          <FormControl size="small">
            <InputLabel>Frequência</InputLabel>
            <Select value={form.frequency} label="Frequência"
              onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
              {FREQUENCIES.map(f => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => createMutation.mutate({ ...form, targetDays: parseInt(form.targetDays) })}
            disabled={!form.name || createMutation.isPending}>
            Criar Hábito
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
