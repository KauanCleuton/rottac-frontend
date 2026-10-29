'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, Button, Chip, InputAdornment, Skeleton,
  Pagination, Alert, alpha, useTheme, Tooltip,
} from '@mui/material';
import { Search, TravelExplore, OpenInNew, FileUpload, InfoOutlined } from '@mui/icons-material';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { provasApi } from '@/lib/api';

type Exam = {
  title: string; year: number | null; orgao: string | null; orgaoSlug: string | null;
  banca: string | null; bancaSlug: string | null; url: string;
};

const QUICK = ['Cebraspe', 'FGV', 'FCC', 'Vunesp', 'Cesgranrio', 'Analista Judiciário', 'Técnico Judiciário', 'Polícia Federal', 'Auditor Fiscal', 'Escrivão'];

export default function ProvasPage() {
  const theme = useTheme();
  const router = useRouter();
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const gold = theme.palette.primary.main;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['provas', query, page],
    queryFn: () => provasApi.search({ q: query, page }).then((r) => r.data.data),
    enabled: Boolean(query),
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });

  const { data: suggestions = [] } = useQuery({
    queryKey: ['provas-sugestoes'],
    queryFn: () => provasApi.suggestions().then((r) => r.data.data as { slug: string; label: string }[]),
    staleTime: 60 * 60_000,
  });

  const go = (q: string) => { setInput(q); setQuery(q); setPage(1); };

  // Pré-preenche o importador com os metadados da prova escolhida
  const importExam = (e: Exam) => {
    const p = new URLSearchParams();
    if (e.banca) p.set('banca', e.banca);
    if (e.orgao) p.set('orgao', e.orgao.replace('/', '-'));
    if (e.year) p.set('year', String(e.year));
    p.set('cargo', e.title);
    p.set('source', `${e.title} — ${[e.orgao, e.banca, e.year].filter(Boolean).join(' · ')}`);
    router.push(`/questoes/importar?${p.toString()}`);
  };

  const exams: Exam[] = data?.exams || [];
  const matchingSuggestions = input.length >= 2
    ? suggestions.filter((s) => s.label.toLowerCase().includes(input.toLowerCase())).slice(0, 8)
    : [];

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <TravelExplore sx={{ color: 'primary.main', fontSize: 32 }} /> Provas Anteriores
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Encontre provas por cargo, banca ou órgão e transforme-as em questões para praticar.
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box component="form" onSubmit={(e) => { e.preventDefault(); if (input.trim()) go(input.trim()); }}
            sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <TextField fullWidth placeholder="Ex.: analista judiciário, cebraspe, tj-ce, polícia federal..."
              value={input} onChange={(e) => setInput(e.target.value)} sx={{ flex: 1, minWidth: 240 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} />
            <Button type="submit" variant="contained" disabled={!input.trim()} sx={{ px: 4 }}>Buscar</Button>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 2 }}>
            {(matchingSuggestions.length ? matchingSuggestions.map((s) => s.label) : QUICK).map((label) => (
              <Chip key={label} label={label} size="small" clickable onClick={() => go(label)}
                variant={query === label ? 'filled' : 'outlined'} color={query === label ? 'primary' : 'default'} />
            ))}
          </Box>
        </CardContent>
      </Card>

      <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 3 }}>
        O catálogo vem do <strong>PCI Concursos</strong>. Abra a prova no site deles, baixe o PDF da prova e do gabarito e clique em
        <strong> Importar questões</strong>: os dados da prova já vão preenchidos no importador.
      </Alert>

      {!query ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <TravelExplore sx={{ fontSize: 56, color: 'text.disabled' }} />
            <Typography variant="h6" sx={{ mt: 1 }}>Busque o cargo ou a banca do seu concurso</Typography>
            <Typography color="text.secondary">Mais de 260 mil provas catalogadas.</Typography>
          </CardContent>
        </Card>
      ) : error ? (
        <Alert severity="error">{(error as any)?.response?.data?.message || 'Não foi possível consultar as provas agora.'}</Alert>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} variant="rounded" height={72} />)}
        </Box>
      ) : exams.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 5 }}>
            <Typography variant="h6">Nenhuma prova encontrada para “{query}”</Typography>
            <Typography color="text.secondary">Tente o nome do cargo (ex.: “técnico judiciário”) ou a sigla da banca/órgão.</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Página {data.page} de {data.pages}{isFetching && ' · carregando...'}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, opacity: isFetching ? 0.6 : 1 }}>
            {exams.map((e) => (
              <Card key={e.url} sx={{ '&:hover': { borderColor: alpha(gold, 0.5) }, transition: 'border-color .15s' }}>
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 }, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flexGrow: 1, minWidth: 220 }}>
                    <Typography fontWeight={700}>{e.title}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, mt: 0.5, flexWrap: 'wrap' }}>
                      {e.year && <Chip size="small" label={e.year} sx={{ height: 22 }} />}
                      {e.orgao && (
                        <Tooltip title={`Ver todas as provas de ${e.orgao}`}>
                          <Chip size="small" label={e.orgao} variant="outlined" clickable sx={{ height: 22 }}
                            onClick={() => e.orgaoSlug && go(e.orgaoSlug)} />
                        </Tooltip>
                      )}
                      {e.banca && (
                        <Tooltip title={`Ver todas as provas da ${e.banca}`}>
                          <Chip size="small" label={e.banca} variant="outlined" clickable sx={{ height: 22, borderColor: alpha(gold, 0.5) }}
                            onClick={() => e.bancaSlug && go(e.bancaSlug)} />
                        </Tooltip>
                      )}
                    </Box>
                  </Box>
                  <Button size="small" variant="outlined" endIcon={<OpenInNew fontSize="small" />}
                    component="a" href={e.url} target="_blank" rel="noopener noreferrer">
                    Abrir no PCI
                  </Button>
                  <Button size="small" variant="contained" startIcon={<FileUpload fontSize="small" />} onClick={() => importExam(e)}>
                    Importar questões
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
          {data.pages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Pagination count={Math.min(data.pages, 500)} page={page} shape="rounded" color="primary"
                onChange={(_, p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
