'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Button, Typography, CircularProgress, Alert } from '@mui/material';
import { ArrowBack, DeleteOutline } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import QuestionForm, { formFromQuestion, toPayload, type QuestionFormValues } from '@/components/questions/QuestionForm';
import type { BankQuestion } from '@/components/questions/types';
import ConfirmDialog from '@/components/common/ConfirmDialog';

export default function EditarQuestaoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: question, isLoading, error } = useQuery({
    queryKey: ['question-bank', 'item', id],
    queryFn: () => questionBankApi.get(id).then((r) => r.data.data as BankQuestion),
  });

  const handleSubmit = async (values: QuestionFormValues) => {
    setSaving(true);
    try {
      await questionBankApi.update(id, toPayload(values));
      qc.invalidateQueries({ queryKey: ['question-bank'] });
      qc.invalidateQueries({ queryKey: ['question-bank-filters'] });
      toast.success('Questão atualizada!');
      router.back();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await questionBankApi.remove(id);
      qc.invalidateQueries({ queryKey: ['question-bank'] });
      toast.success('Questão excluída');
      router.push(isAdmin ? '/admin/questoes' : '/questoes/banco');
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao excluir');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>;
  if (error || !question) return <Alert severity="error">Questão não encontrada.</Alert>;
  if (!question.isOwner && !isAdmin) return <Alert severity="warning">Você só pode editar suas próprias questões.</Alert>;

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button startIcon={<ArrowBack />} size="small" onClick={() => router.back()}>Voltar</Button>
        <Button startIcon={<DeleteOutline />} size="small" color="error" onClick={() => setConfirmOpen(true)}>Excluir</Button>
      </Box>
      <Typography variant="h4" sx={{ mt: 1, mb: 3 }}>Editar questão</Typography>
      <QuestionForm initial={formFromQuestion(question)} isAdmin={isAdmin} submitting={saving}
        submitLabel="Salvar alterações" onSubmit={handleSubmit} />
      <ConfirmDialog open={confirmOpen} danger loading={deleting} title="Excluir questão?"
        message="As respostas e os comentários desta questão também serão removidos. Essa ação não pode ser desfeita."
        confirmLabel="Excluir" onConfirm={handleDelete} onClose={() => setConfirmOpen(false)} />
    </Box>
  );
}
