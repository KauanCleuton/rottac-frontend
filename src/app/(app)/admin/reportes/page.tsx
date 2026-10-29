'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, ToggleButtonGroup, ToggleButton, Chip, Button, TextField, Skeleton, Alert,
  FormControlLabel, Checkbox, Collapse, Avatar,
} from '@mui/material';
import { OutlinedFlag, Edit, CheckCircle, Block, HourglassTop } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import RichText from '@/components/common/RichText';
import { REPORT_TYPES } from '@/components/questions/ReportDialog';
import { answerLabel } from '@/components/questions/types';

const STATUS: Record<string, { label: string; color: 'warning' | 'info' | 'success' | 'default' }> = {
  ABERTO: { label: 'Aberto', color: 'warning' },
  EM_ANALISE: { label: 'Em análise', color: 'info' },
  RESOLVIDO: { label: 'Resolvido', color: 'success' },
  REJEITADO: { label: 'Rejeitado', color: 'default' },
};

function ReportItem({ r, onDone }: { r: any; onDone: () => void }) {
  const [open, setOpen] = useState(r.status === 'ABERTO');
  const [reply, setReply] = useState(r.adminReply || '');
  const [markAnnulled, setMarkAnnulled] = useState(false);
  const [markOutdated, setMarkOutdated] = useState(false);
  const [busy, setBusy] = useState(false);
  const type = REPORT_TYPES.find((t) => t.v === r.type);
  const q = r.question;

  const save = async (status: string) => {
    setBusy(true);
    try {
      await adminApi.updateReport(r.id, { status, adminReply: reply, markAnnulled, markOutdated });
      toast.success(status === 'RESOLVIDO' ? 'Reporte resolvido e aluno avisado' : status === 'REJEITADO' ? 'Reporte rejeitado e aluno avisado' : 'Reporte atualizado');
      onDone();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
          <Box sx={{ color: 'primary.main', mt: 0.25 }}>{type?.icon}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography fontWeight={800}>{type?.l || r.type}</Typography>
              <Chip size="small" label={STATUS[r.status].label} color={STATUS[r.status].color} variant="outlined" />
              <Typography variant="caption" color="text.secondary">{dayjs(r.createdAt).format('DD/MM/YYYY HH:mm')}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" noWrap>
              {[q.discipline, q.topic].filter(Boolean).join(' › ') || 'Sem disciplina'} · {[q.banca, q.year].filter(Boolean).join(' ')}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: 'primary.main', color: '#0A0A0B', fontWeight: 800 }}>{r.user.name?.[0]?.toUpperCase()}</Avatar>
            <Typography variant="caption" sx={{ display: { xs: 'none', sm: 'block' } }}>{r.user.name}</Typography>
          </Box>
        </Box>

        <Collapse in={open}>
          <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            <Box>
              <Typography variant="overline" color="text.secondary">Mensagem do aluno</Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>{r.message}</Typography>
              <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mt: 2 }}>Questão</Typography>
              <Box sx={{ p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', maxHeight: 180, overflowY: 'auto' }}>
                <RichText text={q.statement} sx={{ fontSize: 14 }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                <Typography variant="body2">Gabarito atual: <strong>{answerLabel(q.type, q.answer)}</strong></Typography>
                {q.isAnnulled && <Chip size="small" label="Anulada" color="error" variant="outlined" />}
                {q.isOutdated && <Chip size="small" label="Desatualizada" color="warning" variant="outlined" />}
                <Button size="small" startIcon={<Edit fontSize="small" />} component={Link} href={`/questoes/${q.id}/editar`} sx={{ ml: 'auto' }}>
                  Editar questão
                </Button>
              </Box>
            </Box>
            <Box>
              <Typography variant="overline" color="text.secondary">Resposta ao aluno</Typography>
              <TextField fullWidth multiline minRows={4} value={reply} onChange={(e) => setReply(e.target.value)}
                placeholder="Ex.: Você tem razão, o gabarito foi corrigido para C conforme o art. 7º..." />
              <Box sx={{ display: 'flex', flexDirection: 'column', mt: 1 }}>
                {!q.isAnnulled && <FormControlLabel control={<Checkbox checked={markAnnulled} onChange={(e) => setMarkAnnulled(e.target.checked)} />} label="Marcar a questão como anulada" />}
                {!q.isOutdated && <FormControlLabel control={<Checkbox checked={markOutdated} onChange={(e) => setMarkOutdated(e.target.checked)} />} label="Marcar a questão como desatualizada" />}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained" startIcon={<CheckCircle />} disabled={busy} onClick={() => save('RESOLVIDO')}>Resolver</Button>
                {r.status !== 'EM_ANALISE' && <Button variant="outlined" startIcon={<HourglassTop />} disabled={busy} onClick={() => save('EM_ANALISE')}>Em análise</Button>}
                <Button color="inherit" startIcon={<Block />} disabled={busy} onClick={() => save('REJEITADO')}>Não procede</Button>
              </Box>
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}

export default function AdminReportesPage() {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [status, setStatus] = useState('pendentes');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'reports', status],
    queryFn: () => adminApi.reports(status).then((r) => r.data.data),
    enabled: isAdmin,
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });

  if (!isAdmin) return <Alert severity="warning">Área exclusiva para administradores.</Alert>;
  const c = data?.counts || {};

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <OutlinedFlag sx={{ color: 'primary.main', fontSize: 32 }} /> Reportes de questões
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Erros de gabarito, pedidos de anulação, questões desatualizadas e correções enviadas pelos alunos.</Typography>

      <ToggleButtonGroup exclusive size="small" value={status} onChange={(_, v) => v && setStatus(v)} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <ToggleButton value="pendentes">Pendentes ({(c.ABERTO || 0) + (c.EM_ANALISE || 0)})</ToggleButton>
        <ToggleButton value="RESOLVIDO">Resolvidos ({c.RESOLVIDO || 0})</ToggleButton>
        <ToggleButton value="REJEITADO">Rejeitados ({c.REJEITADO || 0})</ToggleButton>
        <ToggleButton value="todos">Todos</ToggleButton>
      </ToggleButtonGroup>

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={80} />)}</Box>
      ) : !data?.reports.length ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>Nenhum reporte aqui. 🎉</CardContent></Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {data.reports.map((r: any) => <ReportItem key={r.id} r={r} onDone={refresh} />)}
        </Box>
      )}
    </Box>
  );
}
