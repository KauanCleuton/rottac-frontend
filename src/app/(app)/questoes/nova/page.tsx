'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, Typography } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import QuestionForm, { emptyForm, toPayload, type QuestionFormValues } from '@/components/questions/QuestionForm';

export default function NovaQuestaoPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [saving, setSaving] = useState(false);
  // Trocar a key remonta o formulário com os valores iniciais novos
  const [formKey, setFormKey] = useState(0);
  const [initial, setInitial] = useState<QuestionFormValues>(() => emptyForm(isAdmin));
  const [count, setCount] = useState(0);

  const handleSubmit = async (values: QuestionFormValues, { another }: { another: boolean }) => {
    setSaving(true);
    try {
      await questionBankApi.create(toPayload(values));
      qc.invalidateQueries({ queryKey: ['question-bank'] });
      qc.invalidateQueries({ queryKey: ['question-bank-filters'] });
      setCount((c) => c + 1);
      toast.success(values.isPublic ? 'Questão publicada no banco!' : 'Questão salva!');
      if (another) {
        // Mantém a classificação para cadastrar questões da mesma prova em sequência
        const base = emptyForm(isAdmin);
        setInitial({
          ...base,
          type: values.type,
          discipline: values.discipline, topic: values.topic, banca: values.banca, orgao: values.orgao,
          cargo: values.cargo, year: values.year, level: values.level, source: values.source,
          difficulty: values.difficulty, isPublic: values.isPublic,
          text: values.text, // mesma série de questões do mesmo texto de apoio
        });
        setFormKey((k) => k + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        router.push(isAdmin ? '/admin/questoes' : '/questoes/banco?escopo=minhas');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar questão');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto' }}>
      <Button startIcon={<ArrowBack />} size="small" onClick={() => router.back()}>Voltar</Button>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 2, flexWrap: 'wrap', mt: 1, mb: 3 }}>
        <Typography variant="h4">Nova questão</Typography>
        {count > 0 && <Typography color="text.secondary">{count} cadastrada(s) nesta sessão</Typography>}
      </Box>
      <QuestionForm key={formKey} initial={initial} isAdmin={isAdmin} submitting={saving}
        submitLabel={isAdmin && initial.isPublic ? 'Publicar questão' : 'Salvar questão'}
        onSubmit={handleSubmit} allowAnother />
    </Box>
  );
}
