'use client';

import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControlLabel, Switch, Typography, Box,
  CircularProgress, Alert, ToggleButtonGroup, ToggleButton,
} from '@mui/material';
import { Print, Download } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { notebookApi } from '@/lib/api';
import { buildNotebookPdf, pdfFileName, type PrintData } from '@/lib/notebookPdf';

type Which = 'all' | 'wrong' | 'pending';

export default function PrintNotebookDialog({ notebookId, open, onClose }: { notebookId: string; open: boolean; onClose: () => void }) {
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState('');
  const [answerKey, setAnswerKey] = useState(true);
  const [explanations, setExplanations] = useState(false);
  const [answerSheet, setAnswerSheet] = useState(true);
  const [which, setWhich] = useState<Which>('all');
  const [busy, setBusy] = useState<'print' | 'download' | null>(null);

  // Carrega os dados ao abrir: assim "Imprimir" abre a janela no próprio clique (sem bloqueio de pop-up)
  useEffect(() => {
    if (!open || data) return;
    notebookApi.printData(notebookId)
      .then((r) => setData(r.data.data))
      .catch((e) => setError(e.response?.data?.message || 'Não foi possível carregar o caderno'));
  }, [open, data, notebookId]);

  const selected = data?.questions.filter((q) => which === 'all' || (which === 'wrong' ? q.myResult === false : q.myResult === null)) || [];

  const generate = async (mode: 'print' | 'download') => {
    if (!data || !selected.length) return;
    // A janela de impressão precisa ser aberta já no clique
    const win = mode === 'print' ? window.open('', '_blank') : null;
    setBusy(mode);
    try {
      const doc = await buildNotebookPdf({ ...data, questions: selected }, { answerKey, explanations: answerKey && explanations, answerSheet });
      if (mode === 'download') {
        doc.save(pdfFileName(data.name));
      } else {
        doc.autoPrint();
        const url = doc.output('bloburl') as unknown as string;
        if (win) win.location.href = url;
        else window.open(url, '_blank');
      }
      onClose();
    } catch {
      win?.close();
      toast.error('Erro ao gerar o PDF');
    } finally {
      setBusy(null);
    }
  };

  const wrongCount = data?.questions.filter((q) => q.myResult === false).length ?? 0;
  const pendingCount = data?.questions.filter((q) => q.myResult === null).length ?? 0;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Imprimir caderno</DialogTitle>
      <DialogContent>
        {error ? <Alert severity="error">{error}</Alert> : !data ? (
          <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              PDF formatado com a logo da Rotta, pronto para imprimir ou salvar.
            </Typography>
            <Typography variant="overline" color="text.secondary">Quais questões</Typography>
            <ToggleButtonGroup exclusive size="small" fullWidth value={which} onChange={(_, v) => v && setWhich(v)} sx={{ mb: 2, mt: 0.5 }}>
              <ToggleButton value="all">Todas ({data.questions.length})</ToggleButton>
              <ToggleButton value="wrong" disabled={!wrongCount}>Errei ({wrongCount})</ToggleButton>
              <ToggleButton value="pending" disabled={!pendingCount}>Abertas ({pendingCount})</ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="overline" color="text.secondary">Incluir</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <FormControlLabel control={<Switch checked={answerKey} onChange={(e) => setAnswerKey(e.target.checked)} />}
                label={<Box><Typography variant="body2" fontWeight={700}>Gabarito ao final</Typography><Typography variant="caption" color="text.secondary">Desligue para treinar sem consulta</Typography></Box>} />
              <FormControlLabel disabled={!answerKey} control={<Switch checked={answerKey && explanations} onChange={(e) => setExplanations(e.target.checked)} />}
                label={<Typography variant="body2">Comentários do professor no gabarito</Typography>} />
              <FormControlLabel control={<Switch checked={answerSheet} onChange={(e) => setAnswerSheet(e.target.checked)} />}
                label={<Typography variant="body2">Folha de respostas para marcar</Typography>} />
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button color="inherit" onClick={onClose} disabled={Boolean(busy)}>Cancelar</Button>
        <Button variant="outlined" startIcon={busy === 'download' ? <CircularProgress size={16} color="inherit" /> : <Download />}
          onClick={() => generate('download')} disabled={!data || !selected.length || Boolean(busy)}>
          Baixar PDF
        </Button>
        <Button variant="contained" startIcon={busy === 'print' ? <CircularProgress size={16} color="inherit" /> : <Print />}
          onClick={() => generate('print')} disabled={!data || !selected.length || Boolean(busy)}>
          Imprimir
        </Button>
      </DialogActions>
    </Dialog>
  );
}
