'use client';

import { useState } from 'react';
import { Box, Typography, Button, Avatar, IconButton, CircularProgress, Chip, Tooltip } from '@mui/material';
import RichText from '@/components/common/RichText';
import RichTextField from '@/components/common/RichTextField';
import { DeleteOutline, Send, ThumbUpAlt, ThumbUpOffAlt, PushPin, WorkspacePremium } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export default function CommentsPanel({ questionId, onCountChange }: { questionId: string; onCountChange?: (n: number) => void }) {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [body, setBody] = useState('');
  const key = ['question-comments', questionId];

  const { data: comments = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => questionBankApi.comments(questionId).then((r) => r.data.data as any[]),
  });

  const add = useMutation({
    mutationFn: () => questionBankApi.addComment(questionId, body.trim()),
    onSuccess: () => {
      setBody('');
      qc.invalidateQueries({ queryKey: key });
      onCountChange?.(comments.length + 1);
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao comentar'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => questionBankApi.deleteComment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      onCountChange?.(Math.max(0, comments.length - 1));
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao remover'),
  });

  // Curtida otimista: o número muda na hora, a lista é revalidada depois (a ordem pode mudar)
  const like = useMutation({
    mutationFn: (id: string) => questionBankApi.likeComment(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<any[]>(key);
      qc.setQueryData<any[]>(key, (list = []) => list.map((c) => (c.id === id
        ? { ...c, likedByMe: !c.likedByMe, likesCount: c.likesCount + (c.likedByMe ? -1 : 1) } : c)));
      return { prev };
    },
    onError: (e: any, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(e.response?.data?.message || 'Erro ao curtir');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });

  const pin = useMutation({
    mutationFn: (id: string) => questionBankApi.pinComment(id),
    onSuccess: (r) => { toast.success(r.data.message); qc.invalidateQueries({ queryKey: key }); },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao fixar'),
  });

  return (
    <Box>
      {isLoading ? (
        <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>
      ) : comments.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          Nenhum comentário ainda. Compartilhe como você resolveu esta questão.
        </Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          {comments.map((c) => (
            <Box key={c.id} sx={{
              display: 'flex', gap: 1.5,
              ...((c.isPinned || c.isTop) && { p: 1.25, mx: -1.25, borderRadius: 2, bgcolor: 'action.hover', borderLeft: 3, borderColor: 'primary.main' }),
            }}>
              <Avatar src={c.user.avatar} sx={{ width: 30, height: 30, fontSize: 13, bgcolor: 'primary.main', color: '#0A0A0B', fontWeight: 800 }}>
                {c.user.name?.[0]?.toUpperCase()}
              </Avatar>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="body2" fontWeight={700}>{c.user.name}</Typography>
                  {c.user.role === 'ADMIN' && <Chip label="Equipe" size="small" color="primary" sx={{ height: 18, fontSize: 10 }} />}
                  {c.user.role === 'TEACHER' && <Chip label="Professor" size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />}
                  {c.isPinned && <Chip icon={<PushPin sx={{ fontSize: 13 }} />} label="Fixado pela equipe" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: 10.5 }} />}
                  {c.isTop && <Chip icon={<WorkspacePremium sx={{ fontSize: 13 }} />} label="Mais útil" size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: 10.5 }} />}
                  <Typography variant="caption" color="text.disabled">{dayjs(c.createdAt).format('DD/MM/YYYY HH:mm')}</Typography>
                  {(c.user.id === user?.id || user?.role === 'ADMIN') && (
                    <Tooltip title="Excluir comentário">
                      <IconButton size="small" sx={{ ml: 'auto' }} onClick={() => remove.mutate(c.id)} aria-label="Excluir comentário">
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <RichText text={c.body} component="div" sx={{ fontSize: 14, color: 'text.secondary', mt: 0.25, lineHeight: 1.65 }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                  <Tooltip title={c.user.id === user?.id ? 'Seu comentário' : c.likedByMe ? 'Remover curtida' : 'Este comentário me ajudou'}>
                    <span>
                      <Button size="small" color={c.likedByMe ? 'primary' : 'inherit'} disabled={c.user.id === user?.id}
                        startIcon={c.likedByMe ? <ThumbUpAlt sx={{ fontSize: '16px !important' }} /> : <ThumbUpOffAlt sx={{ fontSize: '16px !important' }} />}
                        onClick={() => like.mutate(c.id)}
                        sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: 12, color: c.likedByMe ? undefined : 'text.secondary' }}>
                        {c.likesCount > 0 ? c.likesCount : 'Útil'}
                      </Button>
                    </span>
                  </Tooltip>
                  {user?.role === 'ADMIN' && (
                    <Button size="small" color="inherit" startIcon={<PushPin sx={{ fontSize: '16px !important' }} />} onClick={() => pin.mutate(c.id)}
                      sx={{ px: 1, py: 0.25, fontSize: 12, color: 'text.secondary' }}>
                      {c.isPinned ? 'Desafixar' : 'Fixar como melhor'}
                    </Button>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {/* Selecione um termo e destaque com negrito, marca-texto ou cor */}
      <RichTextField compact fullWidth size="small" multiline minRows={2} maxRows={8}
        placeholder="Explique sua resolução... Ex.: A resposta é a B porque o art. 7º diz..."
        value={body} onChange={setBody} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
        <Typography variant="caption" color="text.disabled">Selecione um trecho e use a barra para destacar.</Typography>
        <Button variant="contained" size="small" endIcon={add.isPending ? <CircularProgress size={14} color="inherit" /> : <Send fontSize="small" />}
          onClick={() => add.mutate()} disabled={body.trim().length < 2 || add.isPending}>
          Publicar
        </Button>
      </Box>
    </Box>
  );
}
