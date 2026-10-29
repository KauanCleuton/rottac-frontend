'use client';

import {
  Box, Card, CardContent, Grid, Typography, Button, CircularProgress,
  IconButton, Tooltip, alpha, useTheme, TextField, Dialog,
  DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import { Add, Delete, Edit, AccountTree } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mindMapApi } from '@/lib/api';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';

export default function MindMapsPage() {
  const theme = useTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');

  const { data: maps = [], isLoading } = useQuery({
    queryKey: ['mind-maps'],
    queryFn: () => mindMapApi.getAll().then((r) => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => mindMapApi.create({
      title,
      data: {
        nodes: [{ id: 'root_1', type: 'mindNode', position: { x: 400, y: 200 }, data: { label: title, isRoot: true, color: '#F2B705' } }],
        edges: [],
      },
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['mind-maps'] });
      setCreateOpen(false);
      setTitle('');
      router.push(`/mapas-mentais/${res.data.data.id}`);
      toast.success('Mapa criado! Abrindo editor...');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => mindMapApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mind-maps'] });
      toast.success('Mapa removido');
    },
  });

  if (isLoading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Mapas Mentais</Typography>
          <Typography color="text.secondary">Crie e visualize seus mapas mentais interativos</Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Novo Mapa
        </Button>
      </Box>

      {maps.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <AccountTree sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" gutterBottom>Nenhum mapa mental ainda</Typography>
            <Typography color="text.secondary" gutterBottom>
              Crie mapas mentais para organizar visualmente seu conteúdo de estudo
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)} sx={{ mt: 2 }}>
              Criar Primeiro Mapa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {maps.map((map: any) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={map.id}>
              <Card
                sx={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
                  },
                }}
                onClick={() => router.push(`/mapas-mentais/${map.id}`)}
              >
                <Box
                  sx={{
                    height: 140,
                    background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)}, ${alpha(theme.palette.secondary.main, 0.15)})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '16px 16px 0 0',
                    position: 'relative',
                  }}
                >
                  {map.thumbnail ? (
                    <img src={map.thumbnail} alt={map.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '16px 16px 0 0' }} />
                  ) : (
                    <AccountTree sx={{ fontSize: 48, color: theme.palette.primary.main, opacity: 0.6 }} />
                  )}
                  <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                    <Tooltip title="Deletar">
                      <IconButton
                        size="small"
                        sx={{ bgcolor: alpha('#000', 0.4), color: '#fff', '&:hover': { bgcolor: 'error.main' } }}
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(map.id); }}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <CardContent sx={{ pb: '12px !important' }}>
                  <Typography fontWeight={600} noWrap>{map.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {dayjs(map.updatedAt).format('DD/MM/YYYY [às] HH:mm')}
                  </Typography>
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {map.data?.nodes?.length || 0} nós · {map.data?.edges?.length || 0} conexões
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Dialog criar */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Novo Mapa Mental</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Título do mapa"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && title.trim() && createMutation.mutate()}
            sx={{ mt: 1 }}
            placeholder="Ex: Direito Constitucional"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => createMutation.mutate()}
            disabled={!title.trim() || createMutation.isPending}
          >
            Criar e Abrir Editor
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
