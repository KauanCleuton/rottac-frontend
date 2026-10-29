'use client';

import {
  Box, Grid, Card, CardContent, Typography, Button, Chip,
  CircularProgress, alpha, useTheme, Paper, Avatar,
  List, ListItem, ListItemText, ListItemAvatar, IconButton,
  TextField, Tab, Tabs, Divider, Dialog, DialogTitle,
  DialogContent, DialogActions, Rating, Alert, Badge,
  LinearProgress,
} from '@mui/material';
import {
  Person, Chat, CalendarMonth, Assignment, Psychology,
  Send, VideoCall, Star, School, CheckCircle, Add,
  TrendingUp, Analytics, Notifications, EmojiEvents,
  AccessTime, FiberManualRecord,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mentorApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useState, useRef, useEffect } from 'react';
import { BRAND_GRADIENT, HERO_GRADIENT } from '@/theme';
import { useAuthStore } from '@/store/auth.store';

dayjs.locale('pt-br');

export default function MentoriaPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { user } = useAuthStore();

  const [tab, setTab] = useState(0);
  const [message, setMessage] = useState('');
  const [requestDialog, setRequestDialog] = useState(false);
  const [registerDialog, setRegisterDialog] = useState(false);
  const [sessionDialog, setSessionDialog] = useState(false);
  const [mentorBio, setMentorBio] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionUrl, setSessionUrl] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Queries ────────────────────────────────────────────────────────────
  const { data: myMentoring, isLoading: loadingMentoring } = useQuery({
    queryKey: ['my-mentoring'],
    queryFn: () => mentorApi.getMyMentoring().then(r => r.data.data),
    staleTime: 1000 * 30,
  });

  const { data: mentors = [], isLoading: loadingMentors } = useQuery({
    queryKey: ['mentors-list'],
    queryFn: () => mentorApi.getMentors().then(r => r.data.data),
    staleTime: 1000 * 60 * 5,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['mentoring-messages', myMentoring?.id],
    queryFn: () => mentorApi.getMessages(myMentoring!.id).then(r => r.data.data),
    enabled: !!myMentoring?.id,
    refetchInterval: 5000,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['mentoring-sessions', myMentoring?.id],
    queryFn: () => mentorApi.getSessions(myMentoring!.id).then(r => r.data.data),
    enabled: !!myMentoring?.id,
    staleTime: 1000 * 60,
  });

  const { data: mentorDashboard } = useQuery({
    queryKey: ['mentor-dashboard'],
    queryFn: () => mentorApi.getMentorDashboard().then(r => r.data.data),
    staleTime: 1000 * 60,
    enabled: false, // Only for mentors
  });

  // Auto-scroll em mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Mutations ──────────────────────────────────────────────────────────
  const requestMentoring = useMutation({
    mutationFn: (mentorId: string) => mentorApi.requestMentoring(mentorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-mentoring'] });
      toast.success('Solicitação enviada ao mentor!');
      setRequestDialog(false);
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Erro ao solicitar mentoria'),
  });

  const sendMessage = useMutation({
    mutationFn: () => mentorApi.sendMessage(myMentoring!.id, { content: message }),
    onSuccess: () => {
      setMessage('');
      qc.invalidateQueries({ queryKey: ['mentoring-messages', myMentoring?.id] });
    },
    onError: () => toast.error('Erro ao enviar mensagem'),
  });

  const scheduleSession = useMutation({
    mutationFn: () => mentorApi.scheduleSession(myMentoring!.id, {
      scheduledAt: sessionDate,
      meetUrl: sessionUrl,
      platform: 'google_meet',
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mentoring-sessions', myMentoring?.id] });
      toast.success('Sessão agendada!');
      setSessionDialog(false);
    },
  });

  const registerAsMentor = useMutation({
    mutationFn: () => mentorApi.registerAsMentor({ bio: mentorBio }),
    onSuccess: () => {
      toast.success('Perfil de mentor criado!');
      setRegisterDialog(false);
    },
  });

  // ─── Render ─────────────────────────────────────────────────────────────

  if (loadingMentoring) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // ── Sem mentoria ativa — mostra mentores disponíveis ──
  if (!myMentoring) {
    return (
      <Box>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Mentoria Humana</Typography>
            <Typography color="text.secondary" variant="body2">
              Conecte-se com um mentor especializado e acelere sua aprovação
            </Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => setRegisterDialog(true)}
          >
            Quero ser Mentor
          </Button>
        </Box>

        {/* Hero */}
        <Card sx={{ mb: 3, background: HERO_GRADIENT, color: '#fff', border: '1px solid rgba(242,183,5,0.25)' }}>
          <CardContent sx={{ py: 4 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid size={{ xs: 12, md: 8 }}>
                <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
                  Mentoria + IA = Aprovação mais rápida
                </Typography>
                <Typography sx={{ opacity: 0.9, mb: 2 }}>
                  Seu mentor recebe sugestões da IA baseadas no seu desempenho real.
                  Ele ajusta seu plano, cobra você e conduz sessões ao vivo.
                </Typography>
                {[
                  'Plano semanal personalizado pelo mentor',
                  'Chat direto para dúvidas e motivação',
                  'Sessões ao vivo com Google Meet / Zoom',
                  'Mentor recebe insights de IA sobre você',
                ].map((item, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <CheckCircle sx={{ fontSize: 16 }} />
                    <Typography variant="body2">{item}</Typography>
                  </Box>
                ))}
              </Grid>
              <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: 'center' }}>
                <Psychology sx={{ fontSize: 100, opacity: 0.3 }} />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Lista de mentores */}
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Mentores Disponíveis
        </Typography>

        {loadingMentors ? (
          <CircularProgress />
        ) : mentors.length === 0 ? (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Person sx={{ fontSize: 64, color: alpha('#F2B705', 0.3), mb: 2 }} />
              <Typography variant="h6" color="text.secondary">Nenhum mentor disponível no momento</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                Seja o primeiro mentor da plataforma!
              </Typography>
              <Button
                variant="contained"
                sx={{ mt: 2, background: BRAND_GRADIENT }}
                onClick={() => setRegisterDialog(true)}
              >
                Registrar como Mentor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {mentors.map((mentor: any) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={mentor.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                      <Avatar
                        src={mentor.user?.avatar}
                        sx={{ width: 52, height: 52, bgcolor: '#F2B705', fontSize: 20 }}
                      >
                        {mentor.user?.name?.[0]}
                      </Avatar>
                      <Box>
                        <Typography fontWeight={700}>{mentor.user?.name}</Typography>
                        <Rating value={mentor.rating} readOnly size="small" precision={0.5} />
                      </Box>
                    </Box>
                    {mentor.bio && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {mentor.bio}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                      {(mentor.specialties || []).slice(0, 3).map((s: string) => (
                        <Chip key={s} label={s} size="small" sx={{ fontSize: 10 }} />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {mentor.totalStudents} alunos
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => requestMentoring.mutate(mentor.id)}
                        disabled={requestMentoring.isPending}
                        sx={{ background: BRAND_GRADIENT }}
                      >
                        Solicitar Mentoria
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Dialog: Registrar como mentor */}
        <Dialog open={registerDialog} onClose={() => setRegisterDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Registrar como Mentor</DialogTitle>
          <DialogContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Como mentor, você receberá insights de IA sobre o desempenho dos seus alunos e
              poderá ajustar o plano de estudos deles diretamente pela plataforma.
            </Alert>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Sua apresentação"
              placeholder="Descreva sua experiência, concursos aprovados, áreas de especialidade..."
              value={mentorBio}
              onChange={(e) => setMentorBio(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRegisterDialog(false)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={() => registerAsMentor.mutate()}
              disabled={!mentorBio || registerAsMentor.isPending}
            >
              Registrar
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // ── Com mentoria ativa — painel completo ──
  const mentor = myMentoring.mentor;
  const upcomingSessions = sessions.filter((s: any) =>
    dayjs(s.scheduledAt).isAfter(dayjs()) && s.status === 'AGENDADA'
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Minha Mentoria</Typography>
          <Chip
            label={myMentoring.status}
            size="small"
            sx={{
              bgcolor: myMentoring.status === 'ATIVA' ? alpha('#10B981', 0.15) : alpha('#F59E0B', 0.15),
              color: myMentoring.status === 'ATIVA' ? '#10B981' : '#F59E0B',
              fontWeight: 700,
              mt: 0.5,
            }}
          />
        </Box>
        <Button
          variant="outlined"
          startIcon={<VideoCall />}
          onClick={() => setSessionDialog(true)}
        >
          Agendar Sessão
        </Button>
      </Box>

      {/* Mentor card */}
      <Card sx={{ mb: 3, background: `linear-gradient(135deg, ${alpha('#F2B705', 0.08)}, ${alpha('#FFD34D', 0.05)})`, border: `1px solid ${alpha('#F2B705', 0.2)}` }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Avatar
              src={mentor?.user?.avatar}
              sx={{ width: 64, height: 64, bgcolor: '#F2B705', fontSize: 24 }}
            >
              {mentor?.user?.name?.[0]}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700}>{mentor?.user?.name}</Typography>
              <Typography variant="body2" color="text.secondary">{mentor?.user?.email}</Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {(mentor?.specialties || []).map((s: string) => (
                  <Chip key={s} label={s} size="small" sx={{ fontSize: 11 }} />
                ))}
              </Box>
            </Box>
            <Box sx={{ textAlign: 'center' }}>
              <Rating value={mentor?.rating || 0} readOnly size="small" precision={0.5} />
              <Typography variant="caption" color="text.secondary" display="block">
                {mentor?.totalStudents} alunos
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
        <Tab icon={<Chat fontSize="small" />} iconPosition="start" label="Chat" />
        <Tab icon={<CalendarMonth fontSize="small" />} iconPosition="start" label={`Sessões (${upcomingSessions.length})`} />
        <Tab icon={<Assignment fontSize="small" />} iconPosition="start" label="Planos Semanais" />
        <Tab icon={<Analytics fontSize="small" />} iconPosition="start" label="Meus Dados" />
      </Tabs>

      {/* ── Tab 0: Chat ── */}
      {tab === 0 && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            {/* Messages */}
            <Box
              sx={{
                height: 480, overflowY: 'auto', p: 2,
                display: 'flex', flexDirection: 'column', gap: 1,
              }}
            >
              {messages.length === 0 ? (
                <Box sx={{ textAlign: 'center', mt: 8 }}>
                  <Chat sx={{ fontSize: 48, color: alpha('#F2B705', 0.3), mb: 2 }} />
                  <Typography color="text.secondary">
                    Nenhuma mensagem ainda. Inicie a conversa com seu mentor!
                  </Typography>
                </Box>
              ) : (
                messages.map((msg: any) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <Box
                      key={msg.id}
                      sx={{
                        display: 'flex',
                        justifyContent: isMe ? 'flex-end' : 'flex-start',
                        gap: 1,
                      }}
                    >
                      {!isMe && (
                        <Avatar src={msg.sender?.avatar} sx={{ width: 32, height: 32, bgcolor: '#F2B705', fontSize: 12 }}>
                          {msg.sender?.name?.[0]}
                        </Avatar>
                      )}
                      <Box
                        sx={{
                          maxWidth: '70%',
                          p: 1.5,
                          borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                          bgcolor: isMe
                            ? '#F2B705'
                            : alpha(theme.palette.divider, 0.5),
                          color: isMe ? '#0A0A0B' : 'text.primary',
                        }}
                      >
                        <Typography variant="body2">{msg.content}</Typography>
                        <Typography
                          variant="caption"
                          sx={{ opacity: 0.7, mt: 0.5, display: 'block', textAlign: 'right' }}
                        >
                          {dayjs(msg.sentAt).format('HH:mm')}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </Box>

            <Divider />

            {/* Input */}
            <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                placeholder="Digite sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
                    e.preventDefault();
                    sendMessage.mutate();
                  }
                }}
                size="small"
                multiline
                maxRows={3}
              />
              <IconButton
                color="primary"
                onClick={() => sendMessage.mutate()}
                disabled={!message.trim() || sendMessage.isPending}
                sx={{ bgcolor: alpha('#F2B705', 0.1), '&:hover': { bgcolor: alpha('#F2B705', 0.2) } }}
              >
                <Send />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* ── Tab 1: Sessões ── */}
      {tab === 1 && (
        <Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setSessionDialog(true)}
            sx={{ mb: 2, background: BRAND_GRADIENT }}
          >
            Agendar Nova Sessão
          </Button>
          {sessions.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <CalendarMonth sx={{ fontSize: 48, color: alpha('#F2B705', 0.3), mb: 2 }} />
                <Typography color="text.secondary">Nenhuma sessão agendada ainda</Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={2}>
              {sessions.map((s: any) => (
                <Grid size={{ xs: 12, md: 6 }} key={s.id}>
                  <Card sx={{ border: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography fontWeight={700}>
                          {dayjs(s.scheduledAt).format('DD/MM/YYYY [às] HH:mm')}
                        </Typography>
                        <Chip
                          label={s.status}
                          size="small"
                          sx={{
                            bgcolor: alpha(
                              s.status === 'REALIZADA' ? '#10B981' :
                              s.status === 'CANCELADA' ? '#EF4444' : '#F2B705', 0.1
                            ),
                            fontSize: 11,
                          }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Chip icon={<AccessTime />} label={`${s.durationMin} min`} size="small" variant="outlined" />
                        {s.platform && <Chip label={s.platform} size="small" variant="outlined" />}
                      </Box>
                      {s.meetUrl && (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<VideoCall />}
                          href={s.meetUrl}
                          target="_blank"
                        >
                          Entrar na Sessão
                        </Button>
                      )}
                      {s.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{s.notes}</Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* ── Tab 2: Planos ── */}
      {tab === 2 && (
        <Box>
          {(myMentoring.plans || []).length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Assignment sx={{ fontSize: 48, color: alpha('#F2B705', 0.3), mb: 2 }} />
                <Typography color="text.secondary">
                  Seu mentor ainda não criou um plano semanal para você.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Grid container spacing={2}>
              {myMentoring.plans.map((p: any) => (
                <Grid size={{ xs: 12 }} key={p.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                        Semana {p.weekNumber} — {dayjs(p.weekStart).format('DD/MM')} a {dayjs(p.weekEnd).format('DD/MM')}
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Metas da semana</Typography>
                          {(p.goals || []).map((g: string, i: number) => (
                            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                              <FiberManualRecord sx={{ fontSize: 8, mt: 0.8, color: '#F2B705', flexShrink: 0 }} />
                              <Typography variant="body2">{g}</Typography>
                            </Box>
                          ))}
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Tarefas</Typography>
                          {(p.tasks || []).map((t: any, i: number) => (
                            <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                              <CheckCircle sx={{ fontSize: 14, mt: 0.3, color: '#10B981', flexShrink: 0 }} />
                              <Typography variant="body2">{typeof t === 'string' ? t : t.title}</Typography>
                            </Box>
                          ))}
                        </Grid>
                      </Grid>
                      {p.feedback && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          <Typography variant="body2"><strong>Feedback do mentor:</strong> {p.feedback}</Typography>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      )}

      {/* ── Tab 3: Meus Dados (visão do mentor) ── */}
      {tab === 3 && (
        <Alert severity="info">
          <Typography variant="body2">
            Seu mentor pode ver seu desempenho, insights de IA, padrão de erros e taxa de consistência.
            Isso permite que ele ajuste seu plano com precisão cirúrgica.
          </Typography>
        </Alert>
      )}

      {/* Dialog: Agendar sessão */}
      <Dialog open={sessionDialog} onClose={() => setSessionDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Agendar Sessão ao Vivo</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Data e horário"
                type="datetime-local"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Link do Meet / Zoom (opcional)"
                placeholder="https://meet.google.com/..."
                value={sessionUrl}
                onChange={(e) => setSessionUrl(e.target.value)}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSessionDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => scheduleSession.mutate()}
            disabled={!sessionDate || scheduleSession.isPending}
          >
            Agendar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
