'use client';

import {
  Box, Card, CardActionArea, CardContent, Typography, Grid, Chip, Skeleton, Button, Alert,
} from '@mui/material';
import { Gavel, Settings, QuestionAnswer, Article } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { lawApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type Law = { id: string; title: string; shortName: string; description: string | null; articles: number; questions: number; isPublished: boolean };

export default function LeiSecaPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const { data = [], isLoading } = useQuery({
    queryKey: ['laws'],
    queryFn: () => lawApi.list().then((r) => r.data.data as Law[]),
  });

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Gavel sx={{ color: 'primary.main', fontSize: 32 }} /> Lei seca
          </Typography>
          <Typography color="text.secondary">
            Leia a lei artigo por artigo, marque o que importa e resolva as questões que cobraram cada artigo.
          </Typography>
        </Box>
        {isAdmin && <Button variant="outlined" startIcon={<Settings />} component={Link} href="/admin/lei-seca">Gerenciar leis</Button>}
      </Box>

      {isLoading ? (
        <Grid container spacing={2}>{[0, 1, 2].map((i) => <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}><Skeleton variant="rounded" height={150} /></Grid>)}</Grid>
      ) : !data.length ? (
        <Alert severity="info">
          Nenhuma lei publicada ainda.{isAdmin && ' Cadastre a primeira em "Gerenciar leis" colando o texto do Planalto.'}
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {data.map((l) => (
            <Grid key={l.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%' }}>
                <CardActionArea component={Link} href={`/lei-seca/${l.id}`} sx={{ height: '100%', alignItems: 'stretch' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="h6" fontWeight={800}>{l.shortName}</Typography>
                      {!l.isPublished && <Chip size="small" label="Rascunho" variant="outlined" />}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{l.title}</Typography>
                    {l.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>{l.description}</Typography>}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip size="small" icon={<Article sx={{ fontSize: 15 }} />} label={`${l.articles} artigos`} />
                      <Chip size="small" icon={<QuestionAnswer sx={{ fontSize: 15 }} />} label={`${l.questions} questões`} color={l.questions ? 'primary' : 'default'} variant="outlined" />
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
