'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, alpha, useTheme,
  Grid, LinearProgress, Avatar, Divider, Tab, Tabs, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton,
  Tooltip, Paper,
} from '@mui/material';
import {
  Add, ContentCopy, CheckCircle, Schedule, Edit, Visibility,
  TrendingUp, School, Link as LinkIcon, Close, AutoStories,
  Person, Refresh,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { essayApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { BRAND_GRADIENT } from '@/theme';
import dayjs from 'dayjs';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:           { label: 'Aguardando correção', color: '#F59E0B' },
  UNDER_REVIEW:      { label: 'Em revisão',          color: '#3B82F6' },
  CORRECTED:         { label: 'Corrigida',            color: '#22C55E' },
  REWRITE_REQUESTED: { label: 'Reescrita solicitada', color: '#EF4444' },
  REWRITTEN:         { label: 'Reescrita enviada',    color: '#D4A017' },
  ARCHIVED:          { label: 'Arquivada',            color: '#9CA3AF' },
};

const SCORE_COLOR = (score: number | null) =>
  !score ? '#9CA3AF' : score >= 700 ? '#22C55E' : score >= 500 ? '#F59E0B' : '#EF4444';

export default function RedacaoPage() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  const { data: essays = [], isLoading } = useQuery({
    queryKey: ['essays'],
    queryFn: () => essayApi.list().then(r => r.data.data),
  });

  const { data: evolution } = useQuery({
    queryKey: ['essay-evolution'],
    queryFn: () => essayApi.getEvolution().then(r => r.data.data),
    enabled: tab === 1,
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['my-teachers'],
    queryFn: () => essayApi.listMyTeachers().then(r => r.data.data),
  });

  const inviteMutation = useMutation({
    mutationFn: () => essayApi.generateInvite(),
    onSuccess: (res) => {
      setInviteLink(res.data.data.link);
      setInviteOpen(true);
    },
  });

  const pending = (essays as any[]).filter(e => e.status === 'PENDING' || e.status === 'REWRITE_REQUESTED' || e.status === 'REWRITTEN');
  const corrected = (essays as any[]).filter(e => e.status === 'CORRECTED');
  const avgScore = corrected.length
    ? Math.round(corrected.reduce((s, e) => s + (e.corrections[0]?.totalScore || 0), 0) / corrected.length)
    : null;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Redações</Typography>
          <Typography color="text.secondary" variant="body2">
            Escreva, envie para correção e acompanhe sua evolução
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<LinkIcon />} onClick={() => inviteMutation.mutate()}
            disabled={inviteMutation.isPending}>
            Convidar Professor
          </Button>
          <Button variant="contained" startIcon={<Add />} sx={{ background: BRAND_GRADIENT }}
            onClick={() => router.push('/redacao/nova')}>
            Nova Redação
          </Button>
        </Box>
      </Box>

      {/* Stats rápidas */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Total escritas', value: (essays as any[]).length, color: '#F2B705' },
          { label: 'Pendentes', value: pending.length, color: '#F59E0B' },
          { label: 'Corrigidas', value: corrected.length, color: '#22C55E' },
          { label: 'Nota média', value: avgScore ? `${avgScore}/1000` : '—', color: SCORE_COLOR(avgScore) },
        ].map(s => (
          <Grid size={{ xs: 6, md: 3 }} key={s.label}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 2 }}>
                <Typography variant="h4" fontWeight={800} color={s.color}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Professores vinculados */}
      {(teachers as any[]).length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Professores vinculados</Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {(teachers as any[]).map((t: any) => (
                <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={t.avatar} sx={{ width: 32, height: 32 }}>{t.name[0]}</Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>{t.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.email}</Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Minhas Redações" />
        <Tab label="Evolução" />
      </Tabs>

      {/* Lista */}
      {tab === 0 && (
        <Box>
          {isLoading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
          ) : (essays as any[]).length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <AutoStories sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                <Typography fontWeight={600} mb={1}>Nenhuma redação ainda</Typography>
                <Typography color="text.secondary" variant="body2" mb={3}>
                  Escreva sua primeira redação e envie para correção do professor
                </Typography>
                <Button variant="contained" sx={{ background: BRAND_GRADIENT }} startIcon={<Add />}
                  onClick={() => router.push('/redacao/nova')}>
                  Escrever agora
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {(essays as any[]).map((essay: any) => {
                const st = STATUS_LABEL[essay.status] || STATUS_LABEL.PENDING;
                const correction = essay.corrections?.[0];
                return (
                  <Card key={essay.id} sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                    onClick={() => router.push(`/redacao/${essay.id}`)}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" fontWeight={700}>{essay.title}</Typography>
                          {essay.theme && (
                            <Typography variant="caption" color="text.secondary">Tema: {essay.theme}</Typography>
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
                          {correction?.totalScore != null && (
                            <Chip
                              label={`${correction.totalScore}/1000`}
                              sx={{ bgcolor: alpha(SCORE_COLOR(correction.totalScore), 0.1), color: SCORE_COLOR(correction.totalScore), fontWeight: 800, fontSize: 15 }}
                            />
                          )}
                          <Chip label={st.label} size="small" sx={{ bgcolor: alpha(st.color, 0.1), color: st.color, fontWeight: 600 }} />
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Typography variant="caption" color="text.secondary">
                          <Schedule sx={{ fontSize: 12, mr: 0.5 }} />
                          {dayjs(essay.submittedAt).format('DD/MM/YYYY')}
                        </Typography>
                        {essay.wordCount && (
                          <Typography variant="caption" color="text.secondary">{essay.wordCount} palavras</Typography>
                        )}
                        {essay.version > 1 && (
                          <Chip label={`v${essay.version}`} size="small" variant="outlined" />
                        )}
                        {correction?.teacher && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Person sx={{ fontSize: 13, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">{correction.teacher.name}</Typography>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </Box>
      )}

      {/* Evolução */}
      {tab === 1 && (
        <Box>
          {!evolution ? (
            <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
          ) : evolution.totalEssays === 0 ? (
            <Card><CardContent sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="text.secondary">Nenhuma redação corrigida ainda</Typography>
            </CardContent></Card>
          ) : (
            <Grid container spacing={2}>
              {/* Médias por competência */}
              <Grid size={{ xs: 12, md: 7 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>Médias por Competência ENEM</Typography>
                    {[
                      { label: 'C1 — Domínio da norma culta', key: 'scoreC1' },
                      { label: 'C2 — Compreensão da proposta', key: 'scoreC2' },
                      { label: 'C3 — Seleção de argumentos', key: 'scoreC3' },
                      { label: 'C4 — Coesão e coerência', key: 'scoreC4' },
                      { label: 'C5 — Proposta de intervenção', key: 'scoreC5' },
                    ].map(({ label, key }) => {
                      const val = evolution.averages?.[key];
                      const pct = val != null ? (val / 200) * 100 : 0;
                      const color = pct >= 70 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
                      return (
                        <Box key={key} sx={{ mb: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2">{label}</Typography>
                            <Typography variant="body2" fontWeight={700} color={color}>
                              {val != null ? `${val}/200` : '—'}
                            </Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={pct}
                            sx={{ height: 8, borderRadius: 4, bgcolor: alpha('#EF4444', 0.1),
                              '& .MuiLinearProgress-bar': { bgcolor: color } }} />
                        </Box>
                      );
                    })}
                  </CardContent>
                </Card>
              </Grid>
              {/* Erros recorrentes */}
              <Grid size={{ xs: 12, md: 5 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} mb={2}>Anotações recorrentes</Typography>
                    {(evolution.recurringErrors || []).length === 0 ? (
                      <Typography color="text.secondary" variant="body2">Sem dados ainda</Typography>
                    ) : (evolution.recurringErrors || []).map((e: any) => (
                      <Box key={e.type} sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="body2">{e.type}</Typography>
                        <Chip label={e.count} size="small" />
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
              {/* Timeline de notas */}
              {(evolution.timeline || []).length > 0 && (
                <Grid size={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="subtitle1" fontWeight={700} mb={2}>Histórico de notas</Typography>
                      <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
                        {(evolution.timeline as any[]).map((t: any, i: number) => (
                          <Paper key={i} elevation={0} sx={{ p: 2, borderRadius: 2, minWidth: 140, flexShrink: 0,
                            border: `1px solid ${alpha(SCORE_COLOR(t.totalScore), 0.3)}`,
                            bgcolor: alpha(SCORE_COLOR(t.totalScore), 0.05) }}>
                            <Typography variant="h5" fontWeight={900} color={SCORE_COLOR(t.totalScore)}>
                              {t.totalScore ?? '—'}
                            </Typography>
                            <Typography variant="caption" fontWeight={600} display="block" noWrap>{t.title}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {dayjs(t.date).format('DD/MM/YY')}
                            </Typography>
                          </Paper>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )}
            </Grid>
          )}
        </Box>
      )}

      {/* Dialog: Invite */}
      <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link de convite para professor</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary" variant="body2" mb={2}>
            Compartilhe este link com seu professor. Ele valerá por 7 dias.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField fullWidth size="small" value={inviteLink} InputProps={{ readOnly: true }} />
            <Tooltip title="Copiar">
              <IconButton onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Copiado!'); }}>
                <ContentCopy />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
