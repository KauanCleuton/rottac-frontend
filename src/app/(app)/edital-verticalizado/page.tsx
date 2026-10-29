'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, CardActionArea, Typography, Button, Grid, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, LinearProgress, Skeleton, Alert, Chip, CircularProgress, Accordion, AccordionSummary, AccordionDetails,
  IconButton, Tooltip,
} from '@mui/material';
import { Checklist, Add, ExpandMore, CheckCircle, HelpOutline, DeleteOutline, Event } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { studyEditalApi } from '@/lib/api';
import AssuntoPicker from '@/components/questions/AssuntoPicker';
import ConfirmDialog from '@/components/common/ConfirmDialog';

type Summary = { id: string; name: string; banca?: string | null; examDate?: string | null; total: number; studied: number; progress: number; createdAt: string };
type PItem = { label: string; assuntoId: number | null; path: string[] | null; exact: boolean };
type PDisc = { name: string; assuntoId: number | null; items: PItem[] };

const EXAMPLE = `LÍNGUA PORTUGUESA: 1 Compreensão e interpretação de textos. 2 Ortografia oficial. 3 Emprego do sinal indicativo de crase.
DIREITO ADMINISTRATIVO: 1 Ato administrativo: conceito, requisitos, atributos e espécies. 2 Agentes públicos. 3 Licitações (Lei nº 14.133/2021).`;

function NewEditalDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [step, setStep] = useState<'text' | 'review'>('text');
  const [name, setName] = useState('');
  const [banca, setBanca] = useState('');
  const [examDate, setExamDate] = useState('');
  const [text, setText] = useState('');
  const [discs, setDiscs] = useState<PDisc[]>([]);
  const [stats, setStats] = useState({ items: 0, matched: 0 });
  const [busy, setBusy] = useState(false);

  const analyze = async () => {
    setBusy(true);
    try {
      const r = await studyEditalApi.parse(text);
      setDiscs(r.data.data.disciplines);
      setStats({ items: r.data.data.items, matched: r.data.data.matched });
      setStep('review');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Não consegui ler o texto');
    } finally {
      setBusy(false);
    }
  };

  const setItem = (di: number, ii: number, patch: Partial<PItem>) =>
    setDiscs((list) => list.map((d, i) => (i !== di ? d : { ...d, items: d.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) })));
  const removeItem = (di: number, ii: number) =>
    setDiscs((list) => list.map((d, i) => (i !== di ? d : { ...d, items: d.items.filter((_, j) => j !== ii) })).filter((d) => d.items.length));

  const save = async () => {
    setBusy(true);
    try {
      const r = await studyEditalApi.create({
        name, banca: banca || null, examDate: examDate || null,
        disciplines: discs.map((d) => ({ name: d.name, items: d.items.map((i) => ({ label: i.label, assuntoId: i.assuntoId })) })),
      });
      toast.success(r.data.message);
      qc.invalidateQueries({ queryKey: ['study-editais'] });
      router.push(`/edital-verticalizado/${r.data.data.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao criar');
      setBusy(false);
    }
  };

  const total = discs.reduce((s, d) => s + d.items.length, 0);
  const unmatched = discs.reduce((s, d) => s + d.items.filter((i) => !i.assuntoId).length, 0);

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{step === 'text' ? 'Novo edital verticalizado' : 'Confira os tópicos'}</DialogTitle>
      <DialogContent dividers>
        {step === 'text' ? (
          <Box sx={{ display: 'grid', gap: 2, pt: 0.5 }}>
            <TextField label="Nome" placeholder="Ex.: TJ-CE 2026 — Técnico Judiciário" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField label="Banca (opcional)" value={banca} onChange={(e) => setBanca(e.target.value)} />
              <TextField label="Data da prova (opcional)" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            </Box>
            <TextField label="Conteúdo programático" multiline minRows={10} maxRows={20} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              helperText="Copie do PDF do edital a parte de conhecimentos (cada matéria seguida dos tópicos numerados) e cole aqui." />
          </Box>
        ) : (
          <Box>
            <Alert severity={unmatched ? 'info' : 'success'} sx={{ mb: 2 }}>
              {stats.matched} de {stats.items} tópicos foram reconhecidos na árvore de assuntos.
              {unmatched > 0 && ` ${unmatched} ficaram só com a matéria ou sem assunto — escolha abaixo para ver as questões deles (opcional).`}
            </Alert>
            {discs.map((d, di) => (
              <Accordion key={di} defaultExpanded={discs.length <= 3} disableGutters variant="outlined" sx={{ mb: 1, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography fontWeight={800} sx={{ flexGrow: 1 }}>{d.name}</Typography>
                  <Chip size="small" label={`${d.items.length} tópicos`} sx={{ mr: 1 }} />
                </AccordionSummary>
                <AccordionDetails sx={{ display: 'grid', gap: 1.5 }}>
                  {d.items.map((it, ii) => (
                    <Box key={ii} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' }, gap: 1, alignItems: 'center', pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', minWidth: 0 }}>
                        {it.exact ? <CheckCircle fontSize="small" color="success" sx={{ mt: 0.25 }} /> : <HelpOutline fontSize="small" color="disabled" sx={{ mt: 0.25 }} />}
                        <Typography variant="body2">{it.label}</Typography>
                      </Box>
                      <AssuntoPicker value={it.assuntoId} onChange={(id) => setItem(di, ii, { assuntoId: id, exact: Boolean(id) })} label="Assunto na árvore" />
                      <Tooltip title="Remover tópico">
                        <IconButton size="small" onClick={() => removeItem(di, ii)} aria-label="Remover tópico"><DeleteOutline fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {step === 'review' && <Button color="inherit" onClick={() => setStep('text')} disabled={busy} sx={{ mr: 'auto' }}>Voltar ao texto</Button>}
        <Button color="inherit" onClick={onClose} disabled={busy}>Cancelar</Button>
        {step === 'text' ? (
          <Button variant="contained" onClick={analyze} disabled={busy || !name.trim() || text.trim().length < 10}>
            {busy ? <CircularProgress size={18} color="inherit" /> : 'Analisar edital'}
          </Button>
        ) : (
          <Button variant="contained" onClick={save} disabled={busy || !total}>
            {busy ? <CircularProgress size={18} color="inherit" /> : `Criar com ${total} tópicos`}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

export default function EditalVerticalizadoPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Summary | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ['study-editais'],
    queryFn: () => studyEditalApi.list().then((r) => r.data.data as Summary[]),
  });

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await studyEditalApi.remove(toDelete.id);
      toast.success('Edital excluído');
      qc.invalidateQueries({ queryKey: ['study-editais'] });
      setToDelete(null);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checklist sx={{ color: 'primary.main', fontSize: 32 }} /> Edital verticalizado
          </Typography>
          <Typography color="text.secondary">
            Cole o conteúdo do edital e acompanhe cada tópico: teoria, revisões, questões resolvidas e acerto.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Novo edital</Button>
      </Box>

      {isLoading ? (
        <Grid container spacing={2}>{[0, 1].map((i) => <Grid key={i} size={{ xs: 12, md: 6 }}><Skeleton variant="rounded" height={140} /></Grid>)}</Grid>
      ) : !data.length ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Checklist sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="h6" sx={{ mt: 1 }}>Nenhum edital ainda</Typography>
            <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 520, mx: 'auto' }}>
              Copie o conteúdo programático do PDF do edital e cole aqui. O sistema separa matérias e tópicos e liga cada um às questões do banco.
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Criar meu edital</Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {data.map((e) => {
            const days = e.examDate ? dayjs(e.examDate).startOf('day').diff(dayjs().startOf('day'), 'day') : null;
            return (
              <Grid key={e.id} size={{ xs: 12, md: 6 }}>
                <Card sx={{ height: '100%', position: 'relative' }}>
                  <CardActionArea component={Link} href={`/edital-verticalizado/${e.id}`} sx={{ height: '100%' }}>
                    <CardContent>
                      <Typography variant="h6" fontWeight={800} sx={{ pr: 4 }}>{e.name}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', my: 1 }}>
                        {e.banca && <Chip size="small" label={e.banca} />}
                        {days !== null && (
                          <Chip size="small" icon={<Event sx={{ fontSize: 15 }} />} variant="outlined"
                            label={days > 0 ? `Prova em ${days} dia${days > 1 ? 's' : ''}` : days === 0 ? 'Prova hoje' : 'Prova realizada'} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">{e.studied} de {e.total} tópicos estudados</Typography>
                        <Typography variant="body2" fontWeight={800}>{e.progress}%</Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={e.progress} sx={{ height: 8, borderRadius: 4 }} />
                    </CardContent>
                  </CardActionArea>
                  <Tooltip title="Excluir edital">
                    <IconButton size="small" onClick={() => setToDelete(e)} sx={{ position: 'absolute', top: 10, right: 10 }} aria-label="Excluir edital">
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {open && <NewEditalDialog open onClose={() => setOpen(false)} />}
      <ConfirmDialog open={Boolean(toDelete)} title="Excluir edital?" danger loading={deleting}
        message={`"${toDelete?.name}" e o progresso marcado nele serão apagados. Suas respostas às questões continuam.`}
        confirmLabel="Excluir" onConfirm={remove} onClose={() => setToDelete(null)} />
    </Box>
  );
}
