'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Button, Grid, Skeleton, Alert, Chip, LinearProgress,
} from '@mui/material';
import { EventRepeat, ArrowForward, CheckCircle, EmojiEvents, LibraryBooks, MenuBook } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import { questionBankApi } from '@/lib/api';
import QuestionCard from '@/components/questions/QuestionCard';
import type { AnswerResult, BankQuestion } from '@/components/questions/types';

type DueQuestion = BankQuestion & { review: { interval: number; repetitions: number; lapses: number; nextReviewAt: string } };

function Tile({ label, value, hint }: { label: string; value: number | string; hint: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{hint}</Typography>
      </CardContent>
    </Card>
  );
}

function RevisaoContent() {
  const qc = useQueryClient();
  const sp = useSearchParams();
  const singleId = sp.get('id'); // vindo do Caderno de Erros: revisar uma questão específica
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [closed, setClosed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['question-bank', 'review-due'],
    queryFn: () => questionBankApi.reviewDue(50).then((r) => r.data.data as { counts: { due: number; upcoming7: number; inReview: number; mastered: number }; questions: DueQuestion[] }),
    // A fila é fixada na abertura da página: responder não deve reordenar as questões
    staleTime: Infinity,
  });
  const { data: single } = useQuery({
    queryKey: ['question-bank', 'item', singleId],
    queryFn: () => questionBankApi.get(singleId!).then((r) => r.data.data as BankQuestion),
    enabled: Boolean(singleId),
  });

  const queue: BankQuestion[] = singleId ? (single ? [single] : []) : data?.questions || [];
  const q = queue[idx];
  const done = Object.keys(results).length;
  const right = Object.values(results).filter(Boolean).length;
  const finished = closed && queue.length > 0;

  const onAnswered = (id: string) => (r: AnswerResult) => {
    setResults((s) => ({ ...s, [id]: r.isCorrect }));
    qc.invalidateQueries({ queryKey: ['question-bank', 'review-count'] });
  };

  const counts = data?.counts;

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventRepeat sx={{ color: 'primary.main', fontSize: 32 }} /> Revisão de Questões
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Toda questão que você erra volta no momento certo: amanhã, depois em 3 dias, 7 dias e intervalos cada vez maiores.
        Depois de 4 acertos seguidos espaçados, ela é considerada dominada.
      </Typography>

      {!singleId && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}><Tile label="Para hoje" value={counts?.due ?? '—'} hint="revisões vencidas" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Tile label="Próximos 7 dias" value={counts?.upcoming7 ?? '—'} hint="vão vencer em breve" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Tile label="Em revisão" value={counts?.inReview ?? '—'} hint="questões que você errou" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><Tile label="Dominadas" value={counts?.mastered ?? '—'} hint="saíram da revisão" /></Grid>
        </Grid>
      )}

      {isLoading && !singleId ? (
        <Skeleton variant="rounded" height={360} />
      ) : queue.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircle sx={{ fontSize: 56, color: '#22C55E' }} />
            <Typography variant="h6" sx={{ mt: 1 }}>Nenhuma revisão para hoje</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {counts?.upcoming7 ? `${counts.upcoming7} questão(ões) vencem nos próximos 7 dias.` : 'Quando você errar uma questão, ela aparece aqui no dia certo de revisar.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="contained" startIcon={<LibraryBooks />} component={Link} href="/questoes/banco?status=nao_resolvidas">Resolver questões novas</Button>
              <Button variant="outlined" startIcon={<MenuBook />} component={Link} href="/caderno-erros">Caderno de Erros</Button>
            </Box>
          </CardContent>
        </Card>
      ) : finished ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <EmojiEvents sx={{ fontSize: 56, color: 'primary.main' }} />
            <Typography variant="h5" sx={{ mt: 1 }}>Revisão concluída!</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {right} de {done} acertadas. As que você errou voltam amanhã; as acertadas, só daqui a alguns dias.
            </Typography>
            <Button variant="outlined" component={Link} href="/caderno-erros">Ver Caderno de Erros</Button>
          </CardContent>
        </Card>
      ) : q ? (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">Questão {idx + 1} de {queue.length}</Typography>
            {'review' in q && (q as DueQuestion).review && (
              <>
                {(q as DueQuestion).review.lapses > 1 && <Chip size="small" color="error" variant="outlined" label={`Errou ${(q as DueQuestion).review.lapses}x`} />}
                <Chip size="small" variant="outlined" label={`Vencida em ${dayjs((q as DueQuestion).review.nextReviewAt).format('DD/MM')}`} />
              </>
            )}
            <Box sx={{ flex: 1 }} />
            {done > 0 && <Typography variant="body2" color="text.secondary">{right}/{done} acertos</Typography>}
          </Box>
          <LinearProgress variant="determinate" value={(done / queue.length) * 100} sx={{ height: 5, mb: 2 }} />

          <QuestionCard key={q.id} question={q} index={idx + 1} onAnswered={onAnswered(q.id)} />

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            {idx < queue.length - 1 ? (
              <Button variant={results[q.id] !== undefined ? 'contained' : 'text'} endIcon={<ArrowForward />}
                onClick={() => { setIdx(idx + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                {results[q.id] !== undefined ? 'Próxima' : 'Pular'}
              </Button>
            ) : !singleId && (
              <Button variant="contained" onClick={() => { setClosed(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Concluir revisão
              </Button>
            )}
          </Box>
        </>
      ) : (
        <Alert severity="warning">Questão não encontrada.</Alert>
      )}
    </Box>
  );
}

export default function RevisaoPage() {
  return (
    <Suspense fallback={null}>
      <RevisaoContent />
    </Suspense>
  );
}
