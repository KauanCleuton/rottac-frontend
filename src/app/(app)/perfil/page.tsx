'use client';

import { useState, useEffect } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button, Chip,
  IconButton, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, alpha, useTheme, CircularProgress, Divider,
  FormControl, InputLabel, Select, MenuItem, Avatar, Tabs, Tab,
  ToggleButtonGroup, ToggleButton, Paper, Tooltip,
} from '@mui/material';
import {
  Edit, Save, School, CalendarMonth, Person, Lock,
  Add, Delete, EmojiEvents, AccessTime,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi, authApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ROUTINE_TYPES = ['ESTUDO', 'TRABALHO', 'LIVRE', 'SONO'];
const ROUTINE_COLORS: Record<string, string> = {
  ESTUDO: '#F2B705', TRABALHO: '#3B82F6', LIVRE: '#22C55E', SONO: '#F59E0B',
};

const EXPERIENCE_LEVELS = [
  { value: 'INICIANTE', label: 'Iniciante (começando agora)' },
  { value: 'INTERMEDIARIO', label: 'Intermediário (já estudou antes)' },
  { value: 'AVANCADO', label: 'Avançado (experiência em concursos)' },
];
const LEARNING_STYLES = [
  { value: 'VISUAL', label: '👁️ Visual (mapas, diagramas)' },
  { value: 'LEITURA', label: '📖 Leitura (textos, resumos)' },
  { value: 'PRATICA', label: '💪 Prática (exercícios)' },
  { value: 'AUDITIVO', label: '🎧 Auditivo (vídeos, áudios)' },
];

export default function PerfilPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { setUser } = useAuthStore();
  const [tab, setTab] = useState(0);
  const [editingProfile, setEditingProfile] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [profileForm, setProfileForm] = useState<any>({});
  const [routines, setRoutines] = useState<any[]>([]);
  const [addRoutineOpen, setAddRoutineOpen] = useState(false);
  const [newRoutine, setNewRoutine] = useState({ dayOfWeek: 1, startTime: '08:00', endTime: '12:00', type: 'ESTUDO', label: '' });

  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile'],
    queryFn: () => userApi.getProfile().then(r => r.data.data),
  });

  const { data: routinesData = [] } = useQuery({
    queryKey: ['routines'],
    queryFn: () => userApi.getRoutines().then(r => r.data.data || []),
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        name: profile.name || '',
        examName: profile.examName || '',
        examDate: profile.examDate ? dayjs(profile.examDate).format('YYYY-MM-DD') : '',
        targetRole: profile.targetRole || '',
        experienceLevel: profile.experienceLevel || 'INICIANTE',
        learningStyle: profile.learningStyle || 'LEITURA',
        dailyStudyHours: profile.dailyStudyHours || 2,
      });
    }
  }, [profile]);

  useEffect(() => {
    setRoutines(routinesData);
  }, [routinesData]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => userApi.updateProfile(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['user-profile'] });
      setUser(res.data.data);
      setEditingProfile(false);
      toast.success('Perfil atualizado!');
    },
  });

  const saveRoutinesMutation = useMutation({
    mutationFn: (data: any[]) => userApi.saveRoutines(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routines'] });
      toast.success('Rotina salva!');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: any) => authApi.changePassword(data),
    onSuccess: () => {
      setPasswordOpen(false);
      setPasswordForm({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Senha alterada com sucesso!');
    },
    onError: () => toast.error('Senha atual incorreta'),
  });

  const addRoutine = () => {
    setRoutines(r => [...r, { ...newRoutine }]);
    setAddRoutineOpen(false);
    setNewRoutine({ dayOfWeek: 1, startTime: '08:00', endTime: '12:00', type: 'ESTUDO', label: '' });
  };

  const removeRoutine = (idx: number) => setRoutines(r => r.filter((_, i) => i !== idx));

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  // Dias de estudo por semana
  const studyDays = [...new Set(routines.filter(r => r.type === 'ESTUDO').map(r => r.dayOfWeek))].length;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Meu Perfil</Typography>
        <Typography color="text.secondary" variant="body2">Configure seu concurso, rotina e preferências</Typography>
      </Box>

      {/* Hero card */}
      <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.secondary?.main || '#FFD34D', 0.1)})` }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <Avatar sx={{ width: 72, height: 72, fontSize: 28, bgcolor: 'primary.main', color: '#0A0A0B', fontWeight: 800 }}>
              {profile?.name?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h5" fontWeight={800}>{profile?.name}</Typography>
              <Typography color="text.secondary">{profile?.email}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {profile?.examName && (
                  <Chip icon={<EmojiEvents fontSize="small" />} label={profile.examName} size="small" color="primary" variant="outlined" />
                )}
                {profile?.examDate && (
                  <Chip icon={<CalendarMonth fontSize="small" />}
                    label={`Prova: ${dayjs(profile.examDate).format('DD/MM/YYYY')}`}
                    size="small" color={dayjs(profile.examDate).isBefore(dayjs()) ? 'error' : 'default'}
                    variant="outlined" />
                )}
                {profile?.targetRole && (
                  <Chip icon={<School fontSize="small" />} label={profile.targetRole} size="small" variant="outlined" />
                )}
                <Chip label={`${studyDays}d/semana`} size="small" variant="outlined" />
                <Chip label={`${profile?.dailyStudyHours || 0}h/dia`} size="small" variant="outlined" />
              </Box>
            </Box>
            <Button variant="outlined" startIcon={<Edit />} onClick={() => setEditingProfile(true)}>
              Editar
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Countdown para o concurso */}
      {profile?.examDate && !dayjs(profile.examDate).isBefore(dayjs()) && (
        <Card sx={{ mb: 3, borderLeft: `4px solid ${theme.palette.primary.main}` }}>
          <CardContent sx={{ py: '12px !important' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Contagem regressiva para</Typography>
                <Typography fontWeight={700}>{profile.examName || 'seu concurso'}</Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h4" fontWeight={900} color="primary">
                  {dayjs(profile.examDate).diff(dayjs(), 'day')}
                </Typography>
                <Typography variant="caption" color="text.secondary">dias restantes</Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Concurso & Metas" />
        <Tab label="Rotina Semanal" />
        <Tab label="Segurança" />
      </Tabs>

      {/* Tab: Concurso & Preferências */}
      {tab === 0 && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>🎯 Concurso Alvo</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {[
                    { label: 'Nome do Concurso', value: profile?.examName || '—' },
                    { label: 'Data da Prova', value: profile?.examDate ? dayjs(profile.examDate).format('DD/MM/YYYY') : '—' },
                    { label: 'Cargo/Vaga', value: profile?.targetRole || '—' },
                  ].map(item => (
                    <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.4)}` }}>
                      <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                    </Box>
                  ))}
                </Box>
                <Button variant="outlined" fullWidth startIcon={<Edit />} sx={{ mt: 2 }}
                  onClick={() => setEditingProfile(true)}>
                  Atualizar Concurso
                </Button>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>📊 Preferências de Estudo</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {[
                    { label: 'Nível', value: EXPERIENCE_LEVELS.find(e => e.value === profile?.experienceLevel)?.label || '—' },
                    { label: 'Estilo', value: LEARNING_STYLES.find(e => e.value === profile?.learningStyle)?.label || '—' },
                    { label: 'Horas por dia', value: `${profile?.dailyStudyHours || 0}h` },
                  ].map(item => (
                    <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.4)}` }}>
                      <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tab: Rotina */}
      {tab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Rotina Semanal</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="outlined" startIcon={<Add />} onClick={() => setAddRoutineOpen(true)}>Adicionar</Button>
              <Button variant="contained" startIcon={<Save />} onClick={() => saveRoutinesMutation.mutate(routines)}
                disabled={saveRoutinesMutation.isPending}>
                Salvar Rotina
              </Button>
            </Box>
          </Box>

          <Grid container spacing={1}>
            {DAYS.map((day, idx) => {
              const dayRoutines = routines.filter(r => r.dayOfWeek === idx);
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={day}>
                  <Card sx={{ minHeight: 80 }}>
                    <CardContent sx={{ py: '8px !important' }}>
                      <Typography variant="caption" fontWeight={700} color="text.secondary"
                        sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{day}</Typography>
                      {dayRoutines.length === 0 ? (
                        <Typography variant="caption" color="text.disabled" display="block">Livre</Typography>
                      ) : (
                        dayRoutines.map((r, i) => (
                          <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                            <Chip
                              label={`${r.startTime}–${r.endTime} ${r.label || r.type}`}
                              size="small"
                              sx={{ height: 22, fontSize: 10,
                                bgcolor: alpha(ROUTINE_COLORS[r.type] || '#888', 0.15),
                                color: ROUTINE_COLORS[r.type] || 'text.secondary' }}
                            />
                            <IconButton size="small" color="error" onClick={() => removeRoutine(routines.indexOf(r))}>
                              <Delete sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            💡 A rotina é usada para gerar o cronograma automático de estudos
          </Typography>
        </Box>
      )}

      {/* Tab: Segurança */}
      {tab === 2 && (
        <Card sx={{ maxWidth: 480 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} gutterBottom>🔒 Segurança da Conta</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Altere sua senha periodicamente para manter a conta segura.
            </Typography>
            <Button variant="outlined" startIcon={<Lock />} onClick={() => setPasswordOpen(true)}>
              Alterar Senha
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialog Editar Perfil */}
      <Dialog open={editingProfile} onClose={() => setEditingProfile(false)} maxWidth="sm" fullWidth>
        <DialogTitle fontWeight={700}>Editar Perfil</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Nome completo" value={profileForm.name || ''}
            onChange={e => setProfileForm((f: any) => ({ ...f, name: e.target.value }))} />

          <Divider><Typography variant="caption" color="text.secondary">🎯 Concurso Alvo</Typography></Divider>

          <TextField label="Nome do Concurso" value={profileForm.examName || ''}
            onChange={e => setProfileForm((f: any) => ({ ...f, examName: e.target.value }))}
            placeholder="Ex: Concurso TRF 4ª Região, Polícia Federal, INSS..." />

          <TextField label="Data da Prova" type="date" value={profileForm.examDate || ''}
            onChange={e => setProfileForm((f: any) => ({ ...f, examDate: e.target.value }))}
            InputLabelProps={{ shrink: true }} />

          <TextField label="Cargo / Vaga almejada" value={profileForm.targetRole || ''}
            onChange={e => setProfileForm((f: any) => ({ ...f, targetRole: e.target.value }))}
            placeholder="Ex: Analista Judiciário, Delegado, Técnico..." />

          <Divider><Typography variant="caption" color="text.secondary">📊 Preferências</Typography></Divider>

          <FormControl size="small">
            <InputLabel>Nível de Experiência</InputLabel>
            <Select value={profileForm.experienceLevel || 'INICIANTE'} label="Nível de Experiência"
              onChange={e => setProfileForm((f: any) => ({ ...f, experienceLevel: e.target.value }))}>
              {EXPERIENCE_LEVELS.map(e => <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>)}
            </Select>
          </FormControl>

          <FormControl size="small">
            <InputLabel>Estilo de Aprendizado</InputLabel>
            <Select value={profileForm.learningStyle || 'LEITURA'} label="Estilo de Aprendizado"
              onChange={e => setProfileForm((f: any) => ({ ...f, learningStyle: e.target.value }))}>
              {LEARNING_STYLES.map(e => <MenuItem key={e.value} value={e.value}>{e.label}</MenuItem>)}
            </Select>
          </FormControl>

          <TextField label="Horas de estudo por dia" type="number"
            value={profileForm.dailyStudyHours || 2}
            onChange={e => setProfileForm((f: any) => ({ ...f, dailyStudyHours: e.target.value }))}
            inputProps={{ min: 0.5, max: 16, step: 0.5 }} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setEditingProfile(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => updateProfileMutation.mutate(profileForm)}
            disabled={updateProfileMutation.isPending}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Adicionar Rotina */}
      <Dialog open={addRoutineOpen} onClose={() => setAddRoutineOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Adicionar Bloco de Rotina</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <FormControl size="small">
            <InputLabel>Dia da semana</InputLabel>
            <Select value={newRoutine.dayOfWeek} label="Dia da semana"
              onChange={e => setNewRoutine(r => ({ ...r, dayOfWeek: Number(e.target.value) }))}>
              {DAYS.map((d, i) => <MenuItem key={i} value={i}>{d}</MenuItem>)}
            </Select>
          </FormControl>
          <Grid container spacing={1}>
            <Grid size={6}>
              <TextField fullWidth label="Início" type="time" value={newRoutine.startTime} size="small"
                onChange={e => setNewRoutine(r => ({ ...r, startTime: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid size={6}>
              <TextField fullWidth label="Fim" type="time" value={newRoutine.endTime} size="small"
                onChange={e => setNewRoutine(r => ({ ...r, endTime: e.target.value }))}
                InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
          <FormControl size="small">
            <InputLabel>Tipo</InputLabel>
            <Select value={newRoutine.type} label="Tipo"
              onChange={e => setNewRoutine(r => ({ ...r, type: e.target.value }))}>
              {ROUTINE_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Rótulo (opcional)" value={newRoutine.label}
            onChange={e => setNewRoutine(r => ({ ...r, label: e.target.value }))}
            placeholder="Ex: Estudo matutino, Revisão noturna" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setAddRoutineOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={addRoutine}>Adicionar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Alterar Senha */}
      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Alterar Senha</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Senha atual" type="password" value={passwordForm.currentPassword}
            onChange={e => setPasswordForm(f => ({ ...f, currentPassword: e.target.value }))} />
          <TextField label="Nova senha" type="password" value={passwordForm.newPassword}
            onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))} />
          <TextField label="Confirmar nova senha" type="password" value={passwordForm.confirm}
            onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
            error={passwordForm.confirm !== '' && passwordForm.confirm !== passwordForm.newPassword}
            helperText={passwordForm.confirm !== '' && passwordForm.confirm !== passwordForm.newPassword ? 'Senhas não conferem' : ''} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setPasswordOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => changePasswordMutation.mutate({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword })}
            disabled={!passwordForm.currentPassword || !passwordForm.newPassword || passwordForm.newPassword !== passwordForm.confirm || changePasswordMutation.isPending}>
            Alterar Senha
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
