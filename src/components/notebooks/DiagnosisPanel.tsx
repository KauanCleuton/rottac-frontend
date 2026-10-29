'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Chip, Grid, LinearProgress, Alert, CircularProgress,
  alpha, useTheme,
} from '@mui/material';
import {
  Gavel, MenuBook, FlashOn, Replay, PictureAsPdf, AccountTree, Timer, TrendingUp, OpenInNew,
  Psychology, WarningAmber, InfoOutlined, ReportProblem, CheckCircle,
} from '@mui/icons-material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { notebookApi } from '@/lib/api';

export type Diagnosis = {
  level: 'insuficiente' | 'critico' | 'atencao' | 'bom' | 'excelente';
  label: string;
  headline: string;
  message: string;
  stats: { total: number; answered: number; correct: number; wrong: number; blank: number; accuracy: number; avgTime: number | null };
  byTopic: { name: string; total: number; correct: number; wrong: number; accuracy: number }[];
  insights: { type: string; severity: 'high' | 'medium' | 'low'; title: string; text: string }[];
  actions: { key: string; kind: 'link' | 'action'; title: string; description: string; href?: string; external?: boolean; primary?: boolean; payload?: any }[];
};

const LEVEL_COLOR: Record<Diagnosis['level'], string> = {
  insuficiente: '#9CA3AF', critico: '#EF4444', atencao: '#F59E0B', bom: '#22C55E', excelente: '#F2B705',
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  law: <Gavel />, theory: <MenuBook />, flashcards: <FlashOn />, redo: <Replay />, pdfs: <PictureAsPdf />,
  mindmap: <AccountTree />, simulado: <Timer />, harder: <TrendingUp />,
};

const SEVERITY: Record<string, { severity: 'error' | 'warning' | 'info'; icon: React.ReactNode }> = {
  high: { severity: 'error', icon: <ReportProblem /> },
  medium: { severity: 'warning', icon: <WarningAmber /> },
  low: { severity: 'info', icon: <InfoOutlined /> },
};

export default function DiagnosisPanel({ notebookId, diagnosis }: { notebookId: string; diagnosis: Diagnosis }) {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [running, setRunning] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, { message: string; href?: string; hrefLabel?: string }>>({});
  const color = LEVEL_COLOR[diagnosis.level];
  const { stats } = diagnosis;

  const run = async (a: Diagnosis['actions'][number]) => {
    setRunning(a.key);
    try {
      const r = await notebookApi.action(notebookId, a.key as 'flashcards' | 'redo' | 'theory', a.payload);
      const d = r.data.data;
      const result = a.key === 'flashcards'
        ? { message: r.data.message, href: '/flashcards', hrefLabel: 'Estudar flashcards' }
        : a.key === 'redo'
          ? { message: r.data.message, href: `/cadernos/${d.notebookId}`, hrefLabel: 'Abrir caderno de erros' }
          : { message: r.data.message, href: '/plano', hrefLabel: 'Ver plano' };
      setDone((s) => ({ ...s, [a.key]: result }));
      toast.success(r.data.message);
      qc.invalidateQueries({ queryKey: ['notebooks'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Não foi possível executar a ação');
    } finally {
      setRunning(null);
    }
  };

  return (
    <Box>
      <Card sx={{ mb: 2, overflow: 'hidden', borderColor: alpha(color, 0.5) }}>
        <Box sx={{ height: 4, bgcolor: color }} />
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Box sx={{ width: 52, height: 52, borderRadius: 3, bgcolor: alpha(color, 0.15), color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Psychology sx={{ fontSize: 30 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Chip label={diagnosis.label} size="small" sx={{ bgcolor: alpha(color, 0.15), color, fontWeight: 800, mb: 1 }} />
              <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.25 }}>{diagnosis.headline}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1 }}>{diagnosis.message}</Typography>
            </Box>
          </Box>

          <Grid container spacing={1.5} sx={{ mt: 2 }}>
            {[
              { l: 'Aproveitamento', v: `${stats.accuracy}%`, c: color },
              { l: 'Acertos', v: stats.correct, c: '#22C55E' },
              { l: 'Erros', v: stats.wrong, c: '#EF4444' },
              { l: 'Não resolvidas', v: stats.blank, c: theme.palette.text.secondary },
              { l: 'Tempo médio', v: stats.avgTime ? `${Math.floor(stats.avgTime / 60)}:${String(stats.avgTime % 60).padStart(2, '0')}` : '—', c: theme.palette.text.secondary },
            ].map((s) => (
              <Grid key={s.l} size={{ xs: 6, sm: 2.4 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: s.c }}>{s.v}</Typography>
                  <Typography variant="caption" color="text.secondary">{s.l}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {diagnosis.insights.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          {diagnosis.insights.map((i) => (
            <Alert key={i.type} severity={SEVERITY[i.severity].severity} icon={SEVERITY[i.severity].icon} variant="outlined">
              <strong>{i.title}.</strong> {i.text}
            </Alert>
          ))}
        </Box>
      )}

      {diagnosis.actions.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: 3, mb: 1.5 }}>O que fazer agora</Typography>
          <Grid container spacing={1.5} sx={{ mb: 3 }}>
            {diagnosis.actions.map((a, idx) => {
              const result = done[a.key];
              const isRunning = running === a.key;
              return (
                <Grid key={`${a.key}-${idx}`} size={{ xs: 12, md: 6 }}>
                  <Card sx={{
                    height: '100%',
                    borderColor: a.primary ? alpha(theme.palette.primary.main, 0.6) : undefined,
                    bgcolor: a.primary ? alpha(theme.palette.primary.main, 0.05) : undefined,
                  }}>
                    <CardContent sx={{ display: 'flex', gap: 1.5, height: '100%', '&:last-child': { pb: 2 } }}>
                      <Box sx={{ color: a.primary ? 'primary.main' : 'text.secondary', mt: 0.25 }}>{ACTION_ICON[a.key] ?? <CheckCircle />}</Box>
                      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography fontWeight={700}>
                          {a.title}
                          {a.primary && <Chip label="Prioridade" size="small" color="primary" sx={{ ml: 1, height: 20, fontSize: 10 }} />}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, flex: 1 }}>{a.description}</Typography>
                        {result ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip icon={<CheckCircle />} label="Feito" size="small" sx={{ bgcolor: alpha('#22C55E', 0.15), color: '#22C55E' }} />
                            {result.href && <Button size="small" component={Link} href={result.href}>{result.hrefLabel}</Button>}
                          </Box>
                        ) : a.kind === 'link' ? (
                          <Box>
                            {a.external ? (
                              <Button size="small" variant={a.primary ? 'contained' : 'outlined'} endIcon={<OpenInNew fontSize="small" />}
                                component="a" href={a.href} target="_blank" rel="noopener noreferrer">Abrir</Button>
                            ) : (
                              <Button size="small" variant={a.primary ? 'contained' : 'outlined'} onClick={() => router.push(a.href!)}>Abrir</Button>
                            )}
                          </Box>
                        ) : (
                          <Box>
                            <Button size="small" variant={a.primary ? 'contained' : 'outlined'} onClick={() => run(a)} disabled={Boolean(running)}>
                              {isRunning ? <CircularProgress size={16} color="inherit" /> : 'Fazer agora'}
                            </Button>
                          </Box>
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {diagnosis.byTopic.length > 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Desempenho por assunto</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {diagnosis.byTopic.map((t) => {
                const c = t.accuracy >= 70 ? '#22C55E' : t.accuracy >= 40 ? '#F59E0B' : '#EF4444';
                return (
                  <Box key={t.name}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{t.name}</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{t.correct}/{t.total} · <strong style={{ color: c }}>{t.accuracy}%</strong></Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={t.accuracy} sx={{ height: 7, mt: 0.5, '& .MuiLinearProgress-bar': { bgcolor: c } }} />
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
