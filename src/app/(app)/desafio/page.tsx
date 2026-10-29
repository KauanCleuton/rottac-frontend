'use client';

import {
  Box, Grid, Card, CardContent, Typography, Button, Chip,
  CircularProgress, alpha, useTheme, Paper, LinearProgress,
  List, ListItem, ListItemText, Divider, Alert,
} from '@mui/material';
import {
  EmojiEvents, LocalFireDepartment, CheckCircle, Cancel,
  Timer, School, Bolt, TrendingUp, History, QuestionAnswer,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dailyChallengeApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { useState, useEffect } from 'react';
import { BRAND_GRADIENT } from '@/theme';

dayjs.locale('pt-br');

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

export default function DesafioPage() {
  const theme = useTheme();
  const qc = useQueryClient();

  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['daily-challenge'],
    queryFn: () => dailyChallengeApi.getToday().then(r => r.data.data),
  });

  const { data: historyData } = useQuery({
    queryKey: ['daily-challenge-history'],
    queryFn: () => dailyChallengeApi.getHistory().then(r => r.data.data),
    staleTime: 1000 * 60 * 2,
  });

  const challenge = data?.challenge;
  const streak = data?.streak || 0;

  // Inicia timer ao carregar desafio não respondido
  useEffect(() => {
    if (challenge && !challenge.answeredAt) {
      setTimerRunning(true);
    }
    if (challenge?.answeredAt) {
      setAnswered(true);
    }
  }, [challenge]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const answerMutation = useMutation({
    mutationFn: () => dailyChallengeApi.answer(challenge!.id, {
      selectedOption: selectedOption!,
      timeSpent: timer,
    }),
    onSuccess: (data) => {
      setTimerRunning(false);
      setAnswered(true);
      setResult(data.data.data);
      qc.invalidateQueries({ queryKey: ['daily-challenge'] });
      qc.invalidateQueries({ queryKey: ['daily-challenge-history'] });
      if (data.data.data.isCorrect) {
        toast.success(`Correto! +${data.data.data.xpEarned} XP`);
      } else {
        toast.error('Errou! Mas veja a explicação.');
      }
    },
  });

  const options: string[] = challenge?.options
    ? (typeof challenge.options === 'string' ? JSON.parse(challenge.options) : challenge.options)
    : [];

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const stats = historyData?.stats;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Desafio Diário</Typography>
        <Typography color="text.secondary" variant="body2">
          Uma questão por dia — mantenha o streak e evolua consistentemente
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Streak + Stats */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Streak Card */}
          <Card
            sx={{
              mb: 2,
              background: streak > 0 ? 'linear-gradient(135deg, #F59E0B, #EF4444)' : undefined,
              color: streak > 0 ? '#fff' : undefined,
            }}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <LocalFireDepartment sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="h2" fontWeight={900}>{streak}</Typography>
              <Typography variant="h6" fontWeight={700}>dias seguidos</Typography>
              {streak === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Responda hoje para começar seu streak!
                </Typography>
              )}
              {streak >= 7 && (
                <Chip label="🔥 Em chamas!" sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          {stats && (
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
                  Estatísticas
                </Typography>
                {[
                  { label: 'Total respondidas', value: stats.answered, icon: <QuestionAnswer fontSize="small" /> },
                  { label: 'Taxa de acerto', value: `${stats.accuracy}%`, icon: <TrendingUp fontSize="small" /> },
                  { label: 'Corretas', value: stats.correct, icon: <CheckCircle fontSize="small" sx={{ color: '#10B981' }} /> },
                ].map((s) => (
                  <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {s.icon}
                      <Typography variant="body2">{s.label}</Typography>
                    </Box>
                    <Typography variant="body2" fontWeight={700}>{s.value}</Typography>
                  </Box>
                ))}
                <LinearProgress
                  variant="determinate"
                  value={stats.accuracy}
                  sx={{
                    mt: 1, height: 6, borderRadius: 3,
                    bgcolor: alpha('#10B981', 0.1),
                    '& .MuiLinearProgress-bar': { bgcolor: '#10B981' },
                  }}
                />
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Questão Principal */}
        <Grid size={{ xs: 12, md: 8 }}>
          {!challenge ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <EmojiEvents sx={{ fontSize: 64, color: alpha('#F59E0B', 0.4), mb: 2 }} />
                <Typography variant="h6">Carregando desafio do dia...</Typography>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                {/* Meta info */}
                <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip
                    label={dayjs().format('dddd, DD [de] MMMM')}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                  />
                  {challenge.subject && (
                    <Chip
                      icon={<School sx={{ fontSize: 14 }} />}
                      label={challenge.subject.name}
                      size="small"
                      sx={{
                        bgcolor: alpha(challenge.subject.color || '#F2B705', 0.12),
                        color: challenge.subject.color || '#F2B705',
                      }}
                    />
                  )}
                  {challenge.banca && (
                    <Chip label={`Banca: ${challenge.banca}`} size="small" variant="outlined" />
                  )}
                  <Box sx={{ flex: 1 }} />
                  {timerRunning && (
                    <Chip
                      icon={<Timer sx={{ fontSize: 14 }} />}
                      label={formatTimer(timer)}
                      size="small"
                      sx={{ fontFamily: 'monospace', fontWeight: 700 }}
                    />
                  )}
                </Box>

                {/* Enunciado */}
                <Paper
                  sx={{
                    p: 3, mb: 3,
                    bgcolor: alpha('#F2B705', 0.04),
                    border: `1px solid ${alpha('#F2B705', 0.12)}`,
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body1" fontWeight={500} sx={{ lineHeight: 1.7 }}>
                    {challenge.question}
                  </Typography>
                </Paper>

                {/* Alternativas */}
                <Box sx={{ mb: 3 }}>
                  {options.map((opt, idx) => {
                    const letter = OPTION_LETTERS[idx];
                    const isSelected = selectedOption === letter;
                    const isCorrect = answered && letter === (result?.correctOption || challenge.correctOption);
                    const isWrong = answered && isSelected && !isCorrect;
                    const wasAnswered = answered;

                    return (
                      <Paper
                        key={letter}
                        onClick={() => !wasAnswered && setSelectedOption(letter)}
                        sx={{
                          p: 2, mb: 1.5, borderRadius: 2,
                          cursor: wasAnswered ? 'default' : 'pointer',
                          border: `2px solid ${
                            isCorrect ? '#10B981' :
                            isWrong ? '#EF4444' :
                            isSelected ? '#F2B705' :
                            alpha(theme.palette.divider, 0.5)
                          }`,
                          bgcolor: isCorrect ? alpha('#10B981', 0.08) :
                                   isWrong ? alpha('#EF4444', 0.08) :
                                   isSelected ? alpha('#F2B705', 0.08) : undefined,
                          transition: 'all 0.15s',
                          '&:hover': wasAnswered ? {} : {
                            bgcolor: alpha('#F2B705', 0.05),
                            borderColor: alpha('#F2B705', 0.4),
                          },
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                          <Box
                            sx={{
                              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              bgcolor: isCorrect ? '#10B981' : isWrong ? '#EF4444' : isSelected ? '#F2B705' : alpha(theme.palette.divider, 0.5),
                              color: '#fff',
                              fontWeight: 700,
                              fontSize: 13,
                            }}
                          >
                            {isCorrect ? <CheckCircle sx={{ fontSize: 16 }} /> :
                             isWrong ? <Cancel sx={{ fontSize: 16 }} /> : letter}
                          </Box>
                          <Typography variant="body2" sx={{ pt: 0.3 }}>{opt}</Typography>
                        </Box>
                      </Paper>
                    );
                  })}
                </Box>

                {/* Botão responder */}
                {!answered && (
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={() => answerMutation.mutate()}
                    disabled={!selectedOption || answerMutation.isPending}
                    sx={{ background: BRAND_GRADIENT, py: 1.5, fontSize: 16, fontWeight: 700 }}
                  >
                    Responder
                  </Button>
                )}

                {/* Resultado + Explicação */}
                {answered && (result || challenge.answeredAt) && (
                  <Alert
                    severity={(result?.isCorrect || challenge.isCorrect) ? 'success' : 'error'}
                    sx={{ mt: 2 }}
                  >
                    <Typography fontWeight={700} sx={{ mb: 0.5 }}>
                      {(result?.isCorrect || challenge.isCorrect) ? '🎯 Correto!' : '❌ Errou!'}
                      {result?.xpEarned && ` +${result.xpEarned} XP`}
                    </Typography>
                    {(result?.explanation || challenge.explanation) && (
                      <Typography variant="body2">
                        {result?.explanation || challenge.explanation}
                      </Typography>
                    )}
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}

          {/* Histórico resumido */}
          {historyData?.challenges?.length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <History sx={{ color: '#F2B705' }} />
                  <Typography variant="h6" fontWeight={700}>Últimos desafios</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {historyData.challenges.slice(0, 14).map((c: any) => (
                    <Chip
                      key={c.id}
                      size="small"
                      label={dayjs(c.createdAt).format('DD/MM')}
                      icon={
                        !c.answeredAt ? <Timer sx={{ fontSize: 12 }} /> :
                        c.isCorrect ? <CheckCircle sx={{ fontSize: 12 }} /> :
                        <Cancel sx={{ fontSize: 12 }} />
                      }
                      sx={{
                        bgcolor: alpha(
                          !c.answeredAt ? '#9CA3AF' :
                          c.isCorrect ? '#10B981' : '#EF4444',
                          0.12
                        ),
                        fontSize: 11,
                      }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
