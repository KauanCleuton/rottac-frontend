'use client';

import {
  Box, Card, CardContent, Typography, Button, Chip, Grid, Skeleton, Alert,
} from '@mui/material';
import { EmojiEvents, Settings, Timer, Groups, Lock, PlayArrow, Leaderboard, Schedule, QuestionAnswer } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import { examApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

dayjs.locale('pt-br');

export type ExamSummary = {
  id: string; title: string; description: string | null; banca: string | null; cargo: string | null;
  startsAt: string; endsAt: string; durationMinutes: number; cutoffScore: number | null; wrongPenalty: boolean; isPremium: boolean;
  phase: 'upcoming' | 'open' | 'closed'; questions: number; participants: number; locked: boolean;
  myStatus: 'none' | 'in_progress' | 'finished'; myScore: number | null;
};

const fmt = (d: string) => dayjs(d).format('DD/MM [às] HH:mm');

function ExamCard({ e }: { e: ExamSummary }) {
  const cta = e.myStatus === 'finished' ? { label: 'Ver resultado', icon: <Leaderboard /> }
    : e.myStatus === 'in_progress' ? { label: 'Continuar prova', icon: <PlayArrow /> }
      : e.phase === 'open' ? { label: e.locked ? 'Exclusivo para assinantes' : 'Fazer simulado', icon: e.locked ? <Lock /> : <PlayArrow /> }
        : e.phase === 'upcoming' ? { label: 'Ver detalhes', icon: <Schedule /> }
          : { label: 'Ver ranking', icon: <Leaderboard /> };
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          {e.phase === 'open' && <Chip size="small" color="success" label="Aberto agora" />}
          {e.phase === 'upcoming' && <Chip size="small" color="info" variant="outlined" label={`Começa ${fmt(e.startsAt)}`} />}
          {e.phase === 'closed' && <Chip size="small" variant="outlined" label="Encerrado" />}
          {e.isPremium && <Chip size="small" color="primary" label="Premium" />}
          {e.myStatus === 'finished' && <Chip size="small" variant="outlined" color="primary" label={`Sua nota: ${e.myScore}`} />}
        </Box>
        <Typography variant="h6" fontWeight={800}>{e.title}</Typography>
        {(e.banca || e.cargo) && <Typography variant="body2" color="text.secondary">{[e.banca, e.cargo].filter(Boolean).join(' · ')}</Typography>}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1.5, color: 'text.secondary' }}>
          <Typography variant="caption" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><QuestionAnswer sx={{ fontSize: 15 }} />{e.questions} questões</Typography>
          <Typography variant="caption" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><Timer sx={{ fontSize: 15 }} />{e.durationMinutes} min</Typography>
          <Typography variant="caption" sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}><Groups sx={{ fontSize: 15 }} />{e.participants} participantes</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Início de {fmt(e.startsAt)} até {fmt(e.endsAt)}
        </Typography>
      </CardContent>
      <Box sx={{ px: 2, pb: 2 }}>
        <Button fullWidth variant={e.phase === 'open' && e.myStatus !== 'finished' ? 'contained' : 'outlined'} startIcon={cta.icon}
          component={Link} href={`/simulados/${e.id}`}>
          {cta.label}
        </Button>
      </Box>
    </Card>
  );
}

export default function SimuladosPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { data = [], isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examApi.list().then((r) => r.data.data as ExamSummary[]),
    refetchInterval: 60_000,
  });
  const sections = [
    { key: 'open', title: 'Abertos agora', list: data.filter((e) => e.phase === 'open') },
    { key: 'upcoming', title: 'Em breve', list: data.filter((e) => e.phase === 'upcoming').reverse() },
    { key: 'closed', title: 'Encerrados', list: data.filter((e) => e.phase === 'closed') },
  ];

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEvents sx={{ color: 'primary.main', fontSize: 32 }} /> Simulados com ranking
          </Typography>
          <Typography color="text.secondary">A mesma prova para todos, com tempo de prova real. No fim: sua posição, percentil e se você passaria na nota de corte.</Typography>
        </Box>
        {isAdmin && <Button variant="outlined" startIcon={<Settings />} component={Link} href="/admin/simulados">Gerenciar simulados</Button>}
      </Box>

      {isLoading ? (
        <Grid container spacing={2}>{[0, 1, 2].map((i) => <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}><Skeleton variant="rounded" height={230} /></Grid>)}</Grid>
      ) : !data.length ? (
        <Alert severity="info">Nenhum simulado publicado ainda. Fique de olho: os próximos aparecem aqui com data e hora.</Alert>
      ) : sections.filter((s) => s.list.length).map((s) => (
        <Box key={s.key} sx={{ mb: 4 }}>
          <Typography variant="overline" color="text.secondary" fontWeight={800}>{s.title}</Typography>
          <Grid container spacing={2}>
            {s.list.map((e) => <Grid key={e.id} size={{ xs: 12, sm: 6, md: 4 }}><ExamCard e={e} /></Grid>)}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
