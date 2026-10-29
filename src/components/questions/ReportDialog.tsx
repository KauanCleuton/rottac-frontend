'use client';

import { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Box, CircularProgress, alpha, useTheme,
} from '@mui/material';
import { ReportProblem, Gavel, Update, Edit, Category, HelpOutline } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';

export const REPORT_TYPES = [
  { v: 'ERRO_GABARITO', l: 'Gabarito errado', d: 'A resposta correta não é a indicada', icon: <ReportProblem /> },
  { v: 'PEDIDO_ANULACAO', l: 'Pedir anulação', d: 'A questão tem mais de uma resposta ou nenhuma', icon: <Gavel /> },
  { v: 'DESATUALIZADA', l: 'Desatualizada', d: 'A lei ou o entendimento mudou', icon: <Update /> },
  { v: 'ERRO_ENUNCIADO', l: 'Erro no texto', d: 'Enunciado, alternativa ou texto com erro', icon: <Edit /> },
  { v: 'CLASSIFICACAO_ERRADA', l: 'Classificação errada', d: 'Disciplina, assunto, banca ou ano incorretos', icon: <Category /> },
  { v: 'OUTRO', l: 'Outro problema', d: 'Qualquer outra correção', icon: <HelpOutline /> },
] as const;

export default function ReportDialog({ questionId, open, onClose }: { questionId: string; open: boolean; onClose: () => void }) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const [type, setType] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const r = await questionBankApi.report(questionId, { type, message });
      toast.success(r.data.message);
      setType('');
      setMessage('');
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Não foi possível enviar');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onClose={sending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Reportar questão</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A equipe analisa cada solicitação e você recebe a resposta nas notificações.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, mb: 2 }}>
          {REPORT_TYPES.map((t) => {
            const on = type === t.v;
            return (
              <Box key={t.v} role="button" tabIndex={0} onClick={() => setType(t.v)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setType(t.v); } }}
                sx={{
                  display: 'flex', gap: 1.25, p: 1.25, borderRadius: 2, cursor: 'pointer', border: '1.5px solid',
                  borderColor: on ? gold : 'divider', bgcolor: on ? alpha(gold, 0.08) : 'transparent', transition: 'all .15s',
                  '&:hover': { borderColor: alpha(gold, 0.6) },
                }}>
                <Box sx={{ color: on ? gold : 'text.secondary', mt: 0.25 }}>{t.icon}</Box>
                <Box>
                  <Typography variant="body2" fontWeight={700}>{t.l}</Typography>
                  <Typography variant="caption" color="text.secondary">{t.d}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
        <TextField fullWidth multiline minRows={3} maxRows={10} label="Explique o problema" value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Ex.: o gabarito é C, conforme o art. 7º, XIII, da CF/88..." helperText={message.trim().length < 10 ? 'Mínimo de 10 caracteres' : ' '} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={sending}>Cancelar</Button>
        <Button variant="contained" onClick={send} disabled={!type || message.trim().length < 10 || sending}>
          {sending ? <CircularProgress size={18} color="inherit" /> : 'Enviar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
