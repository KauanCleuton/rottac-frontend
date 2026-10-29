'use client';

import {
  Box, Card, CardContent, Grid, Typography, CircularProgress,
  alpha, useTheme, LinearProgress, Chip, Avatar, Tooltip,
  Paper,
} from '@mui/material';
import {
  EmojiEvents, Bolt, LocalFireDepartment, School, Timer, FlashOn,
  CheckCircle, Lock, Star, TrendingUp,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { gamificationApi } from '@/lib/api';
import { BRAND_GRADIENT, HERO_GRADIENT } from '@/theme';

const BADGE_ICONS: Record<string, string> = {
  first_study: '🎓',
  streak_7: '🔥',
  streak_30: '⚡',
  hours_10: '📚',
  hours_100: '🏆',
  questions_100: '📝',
  flashcards_50: '⚡',
  errors_master: '🧠',
};

export default function GamificacaoPage() {
  const theme = useTheme();

  const { data: gami, isLoading } = useQuery({
    queryKey: ['gamification-full'],
    queryFn: () => gamificationApi.getProfile().then(r => r.data.data),
  });

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  if (!gami) return (
    <Box sx={{ textAlign: 'center', mt: 8 }}>
      <Typography color="text.secondary">Complete algumas tarefas para começar sua jornada de gamificação!</Typography>
    </Box>
  );

  const earnedIds = (gami.earnedBadges || []).map((b: any) => b.id);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Gamificação</Typography>
        <Typography color="text.secondary" variant="body2">Sua jornada de evolução como concurseiro</Typography>
      </Box>

      {/* Level + XP Hero */}
      <Card sx={{ mb: 3, background: HERO_GRADIENT, color: '#fff', border: '1px solid rgba(242,183,5,0.25)', overflow: 'visible' }}>
        <CardContent sx={{ py: 3 }}>
          <Grid container spacing={3} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: 'center' }}>
              <Box sx={{
                width: 100, height: 100, borderRadius: '50%', margin: '0 auto',
                background: 'rgba(255,255,255,0.15)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: '3px solid rgba(255,255,255,0.3)',
                backdropFilter: 'blur(10px)',
              }}>
                <Typography variant="h3" fontWeight={900} sx={{ color: '#fff', lineHeight: 1 }}>
                  {gami.level}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                  NÍVEL
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Typography variant="h5" fontWeight={800} sx={{ color: '#fff', mb: 0.5 }}>
                {gami.level <= 5 ? '🌱 Aprendiz' : gami.level <= 10 ? '📚 Estudante' :
                 gami.level <= 20 ? '🎯 Dedicado' : gami.level <= 30 ? '⚡ Avançado' : '🏆 Mestre'}
              </Typography>
              <Box sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    {gami.xpCurrentLevel} / {gami.xpPerLevel} XP
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 700 }}>
                    {gami.progressPercent}%
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={gami.progressPercent}
                  sx={{ height: 10, borderRadius: 5,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    '& .MuiLinearProgress-bar': { bgcolor: '#fff', borderRadius: 5 } }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5, display: 'block' }}>
                  Faltam {gami.xpToNextLevel} XP para o nível {gami.level + 1}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip icon={<Bolt sx={{ fontSize: 14 }} />} label={`${gami.xp} XP Total`}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, borderColor: 'rgba(255,255,255,0.3)' }} variant="outlined" size="small" />
                <Chip icon={<LocalFireDepartment sx={{ fontSize: 14 }} />} label={`${gami.streak} dias seguidos`}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, borderColor: 'rgba(255,255,255,0.3)' }} variant="outlined" size="small" />
                <Chip icon={<EmojiEvents sx={{ fontSize: 14 }} />} label={`${earnedIds.length} conquistas`}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, borderColor: 'rgba(255,255,255,0.3)' }} variant="outlined" size="small" />
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stats rápidos */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { label: 'XP Total', value: gami.xp, icon: '⚡', color: '#F2B705' },
          { label: 'Streak Atual', value: `${gami.streak}d`, icon: '🔥', color: '#FF6B35' },
          { label: 'Melhor Streak', value: `${gami.bestStreak}d`, icon: '🏆', color: '#F59E0B' },
          { label: 'Horas Totais', value: `${Math.round(gami.totalHours || 0)}h`, icon: '⏱️', color: '#3B82F6' },
          { label: 'Questões', value: gami.questionCount || 0, icon: '📝', color: '#22C55E' },
          { label: 'Conquistas', value: `${earnedIds.length}/${(gami.allBadges || []).length}`, icon: '🎖️', color: '#EC4899' },
        ].map(s => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={s.label}>
            <Card sx={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
              <CardContent sx={{ py: '12px !important' }}>
                <Typography fontSize={24}>{s.icon}</Typography>
                <Typography variant="h6" fontWeight={800} color={s.color}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary">{s.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Conquistas (Badges) */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Conquistas</Typography>
          <Grid container spacing={2}>
            {(gami.allBadges || []).map((badge: any) => {
              const earned = earnedIds.includes(badge.id);
              const icon = BADGE_ICONS[badge.id] || '🏅';
              return (
                <Grid size={{ xs: 6, sm: 4, md: 3 }} key={badge.id}>
                  <Tooltip title={`${badge.description}${!earned ? ' (não conquistado)' : ''}`}>
                    <Paper elevation={0} sx={{
                      p: 2, textAlign: 'center', borderRadius: 3,
                      border: `2px solid ${earned ? alpha('#F59E0B', 0.4) : alpha(theme.palette.divider, 0.4)}`,
                      bgcolor: earned ? alpha('#F59E0B', 0.06) : alpha(theme.palette.background.default, 0.5),
                      opacity: earned ? 1 : 0.55,
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      cursor: 'default',
                      '&:hover': earned ? { transform: 'translateY(-2px)', boxShadow: `0 4px 16px ${alpha('#F59E0B', 0.25)}` } : {},
                    }}>
                      <Typography fontSize={32} mb={0.5}>
                        {earned ? icon : '🔒'}
                      </Typography>
                      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.25 }}>{badge.name}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 10 }}>
                        {badge.description}
                      </Typography>
                      {earned && (
                        <Chip label="Conquistado!" size="small" color="warning"
                          sx={{ mt: 1, height: 18, fontSize: 9, fontWeight: 700 }} />
                      )}
                    </Paper>
                  </Tooltip>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {/* Novos badges */}
      {(gami.newBadges || []).length > 0 && (
        <Box sx={{ mt: 2, p: 2, borderRadius: 3, background: HERO_GRADIENT, color: '#fff', border: '1px solid rgba(242,183,5,0.25)', textAlign: 'center' }}>
          <Typography variant="h6" fontWeight={800}>🎉 Nova Conquista!</Typography>
          {gami.newBadges.map((b: any) => (
            <Typography key={b.id} variant="body2">
              {BADGE_ICONS[b.id] || '🏅'} {b.name} — {b.description}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}
