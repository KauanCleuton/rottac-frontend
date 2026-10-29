'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Card, CardContent, Typography, Button, Pagination, TextField, MenuItem, Skeleton, Grid,
  Collapse, Badge, alpha, useTheme,
} from '@mui/material';
import { PostAdd, Timer, Tune, LibraryBooks, TravelExplore, CollectionsBookmark } from '@mui/icons-material';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import { questionBankApi } from '@/lib/api';
import QuestionCard from '@/components/questions/QuestionCard';
import QuestionFilters, {
  type Filters, filtersFromParams, filtersToParams, activeFilterCount,
} from '@/components/questions/QuestionFilters';
import type { BankQuestion } from '@/components/questions/types';

const PAGE_SIZE = 10;

function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10 }}>{label}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{value}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </CardContent>
    </Card>
  );
}

function BancoContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<Filters>(() => filtersFromParams(searchParams));
  const [applied, setApplied] = useState<Filters>(draft);
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState('recent');
  const [showFilters, setShowFilters] = useState(true);

  const params = { ...filtersToParams(applied), page, limit: PAGE_SIZE, order };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['question-bank', 'list', params],
    queryFn: () => questionBankApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
  });

  const { data: stats } = useQuery({
    queryKey: ['question-bank', 'stats'],
    queryFn: () => questionBankApi.myStats().then((r) => r.data.data),
  });
  const { data: filterData } = useQuery({
    queryKey: ['question-bank-filters'],
    queryFn: () => questionBankApi.filters().then((r) => r.data.data),
    staleTime: 60_000,
  });

  // Mantém a URL em sincronia com os filtros aplicados (link compartilhável)
  useEffect(() => {
    const qs = new URLSearchParams(filtersToParams(applied)).toString();
    router.replace(qs ? `/questoes/banco?${qs}` : '/questoes/banco', { scroll: false });
  }, [applied, router]);

  const apply = () => { setApplied(draft); setPage(1); };
  const questions: BankQuestion[] = data?.questions || [];
  const simuladoHref = `/questoes/praticar?modo=simulado&${new URLSearchParams(filtersToParams(applied)).toString()}`;

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      {/* Cabeçalho */}
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LibraryBooks sx={{ color: 'primary.main', fontSize: 32 }} /> Banco de Questões
          </Typography>
          <Typography color="text.secondary">
            Resolva, comente e acompanhe seu desempenho por disciplina e banca.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<PostAdd />} component={Link} href="/questoes/nova">Criar questão</Button>
        <Button variant="outlined" startIcon={<CollectionsBookmark />} component={Link} href={`/cadernos/novo?${new URLSearchParams(filtersToParams(applied)).toString()}`}>Criar caderno com estes filtros</Button>
        <Button variant="contained" startIcon={<Timer />} component={Link} href={simuladoHref}>Simulado com estes filtros</Button>
      </Box>

      {/* Resumo pessoal */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="No banco" value={filterData?.total ?? '—'} hint="questões disponíveis" /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Resolvidas" value={stats?.distinctSolved ?? 0} hint={`${stats?.total ?? 0} respostas no total`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}><StatTile label="Aproveitamento" value={`${stats?.accuracy ?? 0}%`} hint={`${stats?.correct ?? 0} acertos · ${stats?.wrong ?? 0} erros`} /></Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile label="Ponto fraco" value={stats?.byDiscipline?.filter((d: any) => d.total >= 3).sort((a: any, b: any) => a.accuracy - b.accuracy)[0]?.name ?? '—'}
            hint="menor % de acerto (mín. 3 resp.)" />
        </Grid>
      </Grid>

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: showFilters ? 2 : 0 }}>
            <Button color="inherit" startIcon={
              <Badge badgeContent={activeFilterCount(applied)} color="primary"><Tune /></Badge>
            } onClick={() => setShowFilters((s) => !s)} sx={{ fontWeight: 700 }}>
              Filtros
            </Button>
          </Box>
          <Collapse in={showFilters}>
            <QuestionFilters value={draft} onChange={setDraft} onApply={apply} />
          </Collapse>
        </CardContent>
      </Card>

      {/* Barra de resultados */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
          {isLoading ? 'Carregando...' : <><strong style={{ color: theme.palette.text.primary }}>{data?.total ?? 0}</strong> questões encontradas</>}
          {isFetching && !isLoading && ' · atualizando...'}
        </Typography>
        <TextField select size="small" label="Ordenar" value={order} onChange={(e) => { setOrder(e.target.value); setPage(1); }} sx={{ minWidth: 170 }}>
          <MenuItem value="recent">Mais recentes</MenuItem>
          <MenuItem value="year">Ano da prova</MenuItem>
          <MenuItem value="oldest">Mais antigas</MenuItem>
          <MenuItem value="random">Aleatória</MenuItem>
        </TextField>
      </Box>

      {/* Lista */}
      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={260} />)}
        </Box>
      ) : questions.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <LibraryBooks sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
            <Typography variant="h6">Nenhuma questão encontrada</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {activeFilterCount(applied) > 0 ? 'Tente remover alguns filtros.' : 'O banco ainda está vazio. Cadastre ou importe questões.'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="contained" startIcon={<PostAdd />} component={Link} href="/questoes/nova">Criar questão</Button>
              <Button variant="outlined" startIcon={<TravelExplore />} component={Link} href="/provas">Buscar provas anteriores</Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: isFetching ? 0.7 : 1, transition: 'opacity .2s' }}>
          {questions.map((q, i) => (
            <QuestionCard key={q.id} question={q} index={order === 'random' ? i + 1 : (page - 1) * PAGE_SIZE + i + 1} />
          ))}
        </Box>
      )}

      {order !== 'random' && (data?.pages ?? 1) > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination count={data.pages} page={page} shape="rounded" color="primary"
            onChange={(_, p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
        </Box>
      )}
      {order === 'random' && questions.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button variant="outlined" onClick={() => setPage((p) => p + 1)} sx={{ borderColor: alpha(theme.palette.primary.main, 0.5) }}>
            Sortear outras {PAGE_SIZE}
          </Button>
        </Box>
      )}

    </Box>
  );
}

export default function BancoQuestoesPage() {
  return (
    <Suspense fallback={null}>
      <BancoContent />
    </Suspense>
  );
}
