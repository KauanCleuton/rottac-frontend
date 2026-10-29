'use client';

import {
  Box, Card, CardContent, Typography, Button, Chip, alpha, useTheme,
  Grid, Avatar, CircularProgress, Paper, Divider,
} from '@mui/material';
import { Assignment, Group, CheckCircle, Schedule, TrendingUp, ArrowForward } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { BRAND_GRADIENT } from '@/theme';
import dayjs from 'dayjs';

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B', REWRITTEN: '#D4A017', CORRECTED: '#22C55E', REWRITE_REQUESTED: '#EF4444',
};

export default function ProfessorDashboard() {
  const theme = useTheme();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-dashboard'],
    queryFn: () => teacherApi.getDashboard().then(r => r.data.data),
  });

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Painel do Professor</Typography>
        <Typography color="text.secondary" variant="body2">Gerencie as redações dos seus alunos</Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'Para corrigir', value: data?.pendingCount ?? 0, color: '#F59E0B', icon: <Schedule /> },
          { label: 'Corrigidas', value: data?.correctedCount ?? 0, color: '#22C55E', icon: <CheckCircle /> },
          { label: 'Alunos vinculados', value: data?.students ?? 0, color: '#F2B705', icon: <Group /> },
        ].map(s => (
          <Grid size={{ xs: 12, sm: 4 }} key={s.label}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: s.color, fontSize: 32 }}>{s.icon}</Box>
                <Box>
                  <Typography variant="h4" fontWeight={800}>{s.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        {/* Pendentes */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Redações pendentes</Typography>
                <Button size="small" endIcon={<ArrowForward />}
                  onClick={() => router.push('/professor/redacoes')}>
                  Ver todas
                </Button>
              </Box>
              {(!data?.recentEssays || data.recentEssays.length === 0) ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CheckCircle sx={{ fontSize: 48, color: '#22C55E', mb: 1 }} />
                  <Typography fontWeight={600}>Tudo em dia!</Typography>
                  <Typography color="text.secondary" variant="body2">Nenhuma redação aguardando correção</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {(data.recentEssays as any[]).map((essay: any) => (
                    <Box key={essay.id}
                      onClick={() => router.push(`/professor/redacoes/${essay.id}`)}
                      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                        cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                      <Avatar src={essay.student?.avatar} sx={{ width: 36, height: 36 }}>
                        {essay.student?.name?.[0]}
                      </Avatar>
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>{essay.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{essay.student?.name}</Typography>
                      </Box>
                      <Box sx={{ flexShrink: 0, display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip label={STATUS_COLOR[essay.status] === '#D4A017' ? 'Reescrita' : 'Pendente'}
                          size="small" sx={{ bgcolor: alpha(STATUS_COLOR[essay.status] || '#F59E0B', 0.1),
                            color: STATUS_COLOR[essay.status] || '#F59E0B', fontWeight: 600 }} />
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
                          {dayjs(essay.submittedAt).format('DD/MM')}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Ações rápidas */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} mb={2}>Ações rápidas</Typography>
              {[
                { label: 'Ver todas as redações', icon: <Assignment />, path: '/professor/redacoes' },
                { label: 'Meus alunos', icon: <Group />, path: '/professor/alunos' },
              ].map(action => (
                <Button key={action.label} fullWidth variant="outlined" startIcon={action.icon}
                  onClick={() => router.push(action.path)}
                  sx={{ mb: 1, justifyContent: 'flex-start' }}>
                  {action.label}
                </Button>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
