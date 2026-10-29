'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Grid, TextField, MenuItem, InputAdornment,
  Table, TableBody, TableCell, TableHead, TableRow, IconButton, Tooltip, Chip, Pagination,
  Skeleton, Alert, ToggleButton, ToggleButtonGroup, alpha, useTheme,
} from '@mui/material';
import {
  PostAdd, FileUpload, TravelExplore, Search, Edit, DeleteOutline, Public, Lock,
  AdminPanelSettings, WarningAmber,
} from '@mui/icons-material';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { type BankQuestion, TYPE_LABEL, answerLabel } from '@/components/questions/types';

const PAGE_SIZE = 20;

export default function AdminQuestoesPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [scope, setScope] = useState('public');
  const [missing, setMissing] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState<BankQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: overview } = useQuery({
    queryKey: ['question-bank', 'admin-overview'],
    queryFn: () => questionBankApi.adminOverview().then((r) => r.data.data),
    enabled: isAdmin,
  });

  const params = {
    page, limit: PAGE_SIZE,
    ...(appliedSearch && { search: appliedSearch }),
    ...(scope !== 'all' && { scope }),
    ...(missing && { missing }),
    ...(type && { type }),
  };
  const { data, isLoading } = useQuery({
    queryKey: ['question-bank', 'admin-list', params],
    queryFn: () => questionBankApi.list(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return <Alert severity="warning">Esta área é exclusiva para administradores.</Alert>;
  }

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await questionBankApi.remove(toDelete.id);
      toast.success('Questão excluída');
      qc.invalidateQueries({ queryKey: ['question-bank'] });
      qc.invalidateQueries({ queryKey: ['question-bank-filters'] });
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  };

  const tiles = [
    { l: 'Questões públicas', v: overview?.publicCount, hint: 'no banco Rotta' },
    { l: 'Questões privadas', v: overview?.privateCount, hint: 'criadas por alunos' },
    { l: 'Respostas', v: overview?.attempts, hint: 'tentativas registradas' },
    { l: 'Comentários', v: overview?.comments, hint: 'da comunidade' },
  ];
  const pendencias = [
    { key: 'answer', l: 'Sem gabarito', v: overview?.withoutAnswer },
    { key: 'explanation', l: 'Sem comentário', v: overview?.withoutExplanation },
  ];

  return (
    <Box sx={{ maxWidth: 1300, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AdminPanelSettings sx={{ color: 'primary.main', fontSize: 32 }} /> Gerenciar Questões
          </Typography>
          <Typography color="text.secondary">Cadastre, revise e publique questões no banco compartilhado.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<TravelExplore />} component={Link} href="/provas">Provas do PCI</Button>
        <Button variant="outlined" startIcon={<FileUpload />} component={Link} href="/questoes/importar">Importar PDF</Button>
        <Button variant="contained" startIcon={<PostAdd />} component={Link} href="/questoes/nova">Nova questão</Button>
      </Box>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {tiles.map((t) => (
          <Grid key={t.l} size={{ xs: 6, md: 3 }}>
            <Card>
              <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: 10 }}>{t.l}</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800 }}>{t.v ?? '—'}</Typography>
                <Typography variant="caption" color="text.secondary">{t.hint}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {pendencias.some((p) => p.v) ? (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
          <WarningAmber sx={{ color: 'warning.main' }} />
          <Typography variant="body2" color="text.secondary">Pendências de curadoria:</Typography>
          {pendencias.filter((p) => p.v).map((p) => (
            <Chip key={p.key} label={`${p.l}: ${p.v}`} clickable variant={missing === p.key ? 'filled' : 'outlined'}
              color={missing === p.key ? 'primary' : 'default'}
              onClick={() => { setScope('public'); setMissing(missing === p.key ? '' : p.key); setPage(1); }} />
          ))}
        </Box>
      ) : <Box sx={{ mb: 1 }} />}

      <Card>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <TextField size="small" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setPage(1); } }}
              onBlur={() => { if (search !== appliedSearch) { setAppliedSearch(search); setPage(1); } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
              sx={{ flexGrow: 1, minWidth: 220 }} />
            <ToggleButtonGroup size="small" exclusive value={scope} onChange={(_, v) => { if (v) { setScope(v); setPage(1); } }}>
              <ToggleButton value="public">Públicas</ToggleButton>
              <ToggleButton value="mine">Minhas</ToggleButton>
              <ToggleButton value="all">Todas</ToggleButton>
            </ToggleButtonGroup>
            <TextField select size="small" label="Tipo" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} sx={{ minWidth: 170 }}>
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(TYPE_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
            </TextField>
          </Box>

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 820 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: '42%' }}>Enunciado</TableCell>
                  <TableCell>Disciplina</TableCell>
                  <TableCell>Prova</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="center">Gab.</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [0, 1, 2, 3, 4].map((i) => (
                    <TableRow key={i}><TableCell colSpan={7}><Skeleton height={32} /></TableCell></TableRow>
                  ))
                ) : (data?.questions || []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                      Nenhuma questão. Use <strong>Nova questão</strong> ou <strong>Importar PDF</strong> para começar.
                    </TableCell>
                  </TableRow>
                ) : (data.questions as BankQuestion[]).map((q) => (
                  <TableRow key={q.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {q.statement}
                      </Typography>
                      {!q.explanation && <Typography variant="caption" color="warning.main">sem comentário</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{q.discipline || '—'}</Typography>
                      {q.topic && <Typography variant="caption" color="text.secondary">{q.topic}</Typography>}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{[q.banca, q.year].filter(Boolean).join(' · ') || '—'}</Typography>
                      {q.orgao && <Typography variant="caption" color="text.secondary">{q.orgao}</Typography>}
                    </TableCell>
                    <TableCell><Typography variant="caption">{TYPE_LABEL[q.type]}</Typography></TableCell>
                    <TableCell align="center">
                      {q.answer
                        ? <Chip size="small" label={answerLabel(q.type, q.answer)} sx={{ fontWeight: 800, bgcolor: alpha('#22C55E', 0.12), color: '#22C55E' }} />
                        : <Chip size="small" label="—" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.main' }} />}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                        <Tooltip title={q.isPublic ? 'Pública' : 'Privada'}>
                          {q.isPublic ? <Public fontSize="small" sx={{ color: 'primary.main' }} /> : <Lock fontSize="small" color="disabled" />}
                        </Tooltip>
                        {q.isAnnulled && <Chip size="small" label="Anulada" color="error" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                        {q.isOutdated && <Chip size="small" label="Desatual." color="warning" variant="outlined" sx={{ height: 20, fontSize: 10 }} />}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Editar">
                        <IconButton size="small" component={Link} href={`/questoes/${q.id}/editar`} aria-label="Editar"><Edit fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" onClick={() => setToDelete(q)} aria-label="Excluir"><DeleteOutline fontSize="small" /></IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">{data?.total ?? 0} questões</Typography>
            {(data?.pages ?? 1) > 1 && (
              <Pagination count={data.pages} page={page} shape="rounded" color="primary" onChange={(_, p) => setPage(p)} />
            )}
          </Box>
        </CardContent>
      </Card>

      <ConfirmDialog open={Boolean(toDelete)} danger loading={deleting} title="Excluir questão?"
        message="As respostas e os comentários desta questão também serão removidos. Essa ação não pode ser desfeita."
        confirmLabel="Excluir" onConfirm={confirmDelete} onClose={() => setToDelete(null)} />
    </Box>
  );
}
