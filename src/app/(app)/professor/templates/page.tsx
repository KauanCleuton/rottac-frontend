'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, Chip, alpha,
  useTheme, CircularProgress, Grid, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Paper,
} from '@mui/material';
import { Add, Delete, RateReview } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teacherApi } from '@/lib/api';
import toast from 'react-hot-toast';

const CATEGORIES = ['Gramática', 'Coesão', 'Argumentação', 'Intervenção', 'Geral'];

export default function TemplatesPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: '' });

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['feedback-templates'],
    queryFn: () => teacherApi.listTemplates().then(r => r.data.data),
  });

  const createMutation = useMutation({
    mutationFn: () => teacherApi.createTemplate(form),
    onSuccess: () => {
      toast.success('Template criado!');
      qc.invalidateQueries({ queryKey: ['feedback-templates'] });
      setOpen(false);
      setForm({ title: '', content: '', category: '' });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro'),
  });

  const grouped = CATEGORIES.reduce<Record<string, any[]>>((acc, cat) => {
    const items = (templates as any[]).filter((t: any) => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});
  const uncategorized = (templates as any[]).filter((t: any) => !t.category || !CATEGORIES.includes(t.category));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Templates de Feedback</Typography>
          <Typography color="text.secondary" variant="body2">
            {(templates as any[]).length} templates criados
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />}
          sx={{ background: 'linear-gradient(135deg,#F2B705,#FFD34D)' }}
          onClick={() => setOpen(true)}>
          Novo template
        </Button>
      </Box>

      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
      ) : (templates as any[]).length === 0 ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 6 }}>
          <RateReview sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography fontWeight={600}>Nenhum template ainda</Typography>
          <Typography color="text.secondary" variant="body2" mt={1}>
            Crie templates de feedback reutilizáveis para agilizar suas correções
          </Typography>
        </CardContent></Card>
      ) : (
        <Box>
          {Object.entries(grouped).map(([cat, items]) => (
            <Box key={cat} sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1.5}
                sx={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                {cat}
              </Typography>
              <Grid container spacing={2}>
                {items.map((t: any) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
                    <TemplateCard template={t} onUse={() => toast.success('Template copiado para a área de transferência!')} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          ))}
          {uncategorized.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} color="text.secondary" mb={1.5}
                sx={{ textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                Outros
              </Typography>
              <Grid container spacing={2}>
                {uncategorized.map((t: any) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={t.id}>
                    <TemplateCard template={t} onUse={() => {
                      navigator.clipboard.writeText(t.content);
                      teacherApi.useTemplate(t.id);
                      toast.success('Copiado para a área de transferência!');
                    }} />
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Box>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Novo template de feedback</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth size="small" label="Título *" sx={{ mb: 2 }}
            value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" mb={0.5} display="block">Categoria</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <Chip key={cat} label={cat} size="small" clickable
                  onClick={() => setForm(f => ({ ...f, category: f.category === cat ? '' : cat }))}
                  sx={{
                    bgcolor: form.category === cat ? alpha('#F2B705', 0.15) : undefined,
                    color: form.category === cat ? '#F2B705' : undefined,
                    fontWeight: form.category === cat ? 700 : 400,
                  }} />
              ))}
            </Box>
          </Box>
          <TextField fullWidth multiline rows={5} label="Conteúdo *"
            value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="Escreva o feedback padrão aqui..." />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => createMutation.mutate()}
            disabled={!form.title || !form.content || createMutation.isPending}>
            Criar template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function TemplateCard({ template, onUse }: { template: any; onUse: () => void }) {
  const theme = useTheme();
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>{template.title}</Typography>
          {template.category && (
            <Chip label={template.category} size="small"
              sx={{ bgcolor: alpha('#F2B705', 0.08), color: '#F2B705', fontSize: 10 }} />
          )}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{
          display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {template.content}
        </Typography>
        {template.usageCount > 0 && (
          <Typography variant="caption" color="text.disabled" display="block" mt={1}>
            Usado {template.usageCount}x
          </Typography>
        )}
      </CardContent>
      <Box sx={{ px: 2, pb: 2 }}>
        <Button fullWidth size="small" variant="outlined" onClick={onUse}>
          Copiar
        </Button>
      </Box>
    </Card>
  );
}
