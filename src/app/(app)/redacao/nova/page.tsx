'use client';

import { useState, useRef, Suspense } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, Chip, alpha,
  useTheme, CircularProgress, LinearProgress, Paper, Grid, Tooltip,
  Divider, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  ArrowBack, Send, Lightbulb, Psychology, CheckCircle, Warning,
  Edit as EditIcon, UploadFile, PictureAsPdf, Close,
} from '@mui/icons-material';
import { useMutation } from '@tanstack/react-query';
import { essayApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { BRAND_GRADIENT } from '@/theme';

const THEMES_SUGGESTIONS = [
  'A importância da leitura na formação do cidadão',
  'Desafios da saúde mental no Brasil contemporâneo',
  'O papel da tecnologia na educação pública',
  'Violência contra a mulher: caminhos para a solução',
  'Segurança alimentar e o combate à fome no Brasil',
  'Desafios para a valorização de comunidades e povos tradicionais',
];

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

function NovaRedacaoContent() {
  const theme = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentId = searchParams.get('rewrite');
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'text' | 'pdf'>('text');
  const [title, setTitle] = useState('');
  const [theme2, setTheme2] = useState('');
  const [content, setContent] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const words = countWords(content);
  const chars = content.length;
  const paragraphs = content.split('\n').filter(p => p.trim().length > 0).length;
  const wordProgress = Math.min(100, (words / 300) * 100);
  const wordColor = words < 200 ? '#F59E0B' : words <= 300 ? '#22C55E' : '#EF4444';

  const submitMutation = useMutation({
    mutationFn: () => {
      if (mode === 'pdf' && pdfFile) {
        const fd = new FormData();
        fd.append('title', title);
        if (theme2) fd.append('theme', theme2);
        if (parentId) fd.append('parentId', parentId);
        fd.append('pdf', pdfFile);
        return essayApi.submitWithFile(fd);
      }
      return essayApi.submit({ title, theme: theme2 || null, content, parentId });
    },
    onSuccess: (res) => {
      toast.success('Redação enviada com sucesso!');
      router.push(`/redacao/${res.data.data.id}`);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error || 'Erro ao enviar.'),
  });

  const canSubmit = title.trim() && (
    mode === 'text' ? content.trim().length >= 50 : pdfFile != null
  );

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/redacao')} size="small">Voltar</Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={700}>
            {parentId ? 'Reescrever Redação' : 'Nova Redação'}
          </Typography>
          <Typography color="text.secondary" variant="body2">
            Escreva ou envie seu PDF para correção.
          </Typography>
        </Box>
        <Button
          variant="contained"
          sx={{ background: BRAND_GRADIENT, fontWeight: 700 }}
          startIcon={submitMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <Send />}
          onClick={() => submitMutation.mutate()}
          disabled={!canSubmit || submitMutation.isPending}
        >
          Enviar para correção
        </Button>
      </Box>

      <Grid container spacing={2}>
        {/* Editor */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <TextField
                fullWidth label="Título da redação *" size="small" sx={{ mb: 2 }}
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Ex: A importância da educação..."
              />

              <Box sx={{ position: 'relative', mb: 2 }}>
                <TextField
                  fullWidth label="Tema / proposta (opcional)" size="small"
                  value={theme2} onChange={e => setTheme2(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                {showSuggestions && (
                  <Paper elevation={4} sx={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, p: 1, mt: 0.5, borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>Sugestões de tema</Typography>
                    {THEMES_SUGGESTIONS.map(s => (
                      <Box key={s} onClick={() => { setTheme2(s); setShowSuggestions(false); }}
                        sx={{ p: 1, borderRadius: 1, cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
                        <Typography variant="body2">{s}</Typography>
                      </Box>
                    ))}
                  </Paper>
                )}
              </Box>

              {/* Toggle modo */}
              <Box sx={{ mb: 2 }}>
                <ToggleButtonGroup value={mode} exclusive onChange={(_, v) => v && setMode(v)} size="small">
                  <ToggleButton value="text">
                    <EditIcon sx={{ fontSize: 16, mr: 0.5 }} /> Digitar
                  </ToggleButton>
                  <ToggleButton value="pdf">
                    <UploadFile sx={{ fontSize: 16, mr: 0.5 }} /> Enviar PDF
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {mode === 'text' ? (
                <TextField
                  fullWidth multiline rows={20} label="Texto da redação *"
                  value={content} onChange={e => setContent(e.target.value)}
                  placeholder="Desenvolva sua redação aqui..."
                  sx={{
                    '& .MuiOutlinedInput-root': { fontFamily: 'Georgia, serif', fontSize: 15, lineHeight: 1.8 },
                  }}
                />
              ) : (
                <Box>
                  <input ref={fileRef} type="file" accept=".pdf" hidden
                    onChange={e => setPdfFile(e.target.files?.[0] || null)} />
                  {pdfFile ? (
                    <Box sx={{ p: 2.5, borderRadius: 2, border: `2px solid ${alpha('#22C55E', 0.4)}`,
                      bgcolor: alpha('#22C55E', 0.04), display: 'flex', alignItems: 'center', gap: 2 }}>
                      <PictureAsPdf sx={{ color: '#EF4444', fontSize: 36 }} />
                      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography fontWeight={600} noWrap>{pdfFile.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(pdfFile.size / 1024).toFixed(0)} KB
                        </Typography>
                      </Box>
                      <Button size="small" color="error" startIcon={<Close />}
                        onClick={() => { setPdfFile(null); if (fileRef.current) fileRef.current.value = ''; }}>
                        Remover
                      </Button>
                    </Box>
                  ) : (
                    <Box onClick={() => fileRef.current?.click()}
                      sx={{ p: 4, borderRadius: 2, border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
                        bgcolor: alpha(theme.palette.primary.main, 0.03), textAlign: 'center',
                        cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.07) },
                        transition: 'background 0.2s' }}>
                      <UploadFile sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                      <Typography fontWeight={600}>Clique para selecionar o PDF</Typography>
                      <Typography variant="body2" color="text.secondary">Tamanho máximo: 20 MB</Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Painel lateral */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* Contador — só no modo texto */}
          {mode === 'text' && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={1.5}>Análise em tempo real</Typography>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">Palavras</Typography>
                    <Typography variant="body2" fontWeight={700} color={wordColor}>{words}</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={wordProgress}
                    sx={{ height: 6, borderRadius: 3, bgcolor: alpha('#EF4444', 0.1),
                      '& .MuiLinearProgress-bar': { bgcolor: wordColor } }} />
                  <Typography variant="caption" color="text.secondary">
                    {words < 200 ? `${200 - words} palavras até o mínimo` :
                     words > 300 ? `${words - 300} acima do ideal` :
                     'Dentro do ideal ENEM'}
                  </Typography>
                </Box>

                <Divider sx={{ mb: 1.5 }} />

                {[
                  { label: 'Parágrafos', value: paragraphs, ideal: '4-5', ok: paragraphs >= 4 && paragraphs <= 5 },
                  { label: 'Caracteres', value: chars, ideal: '1.200+', ok: chars >= 1200 },
                ].map(item => (
                  <Box key={item.label} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">{item.label}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
                      {item.ok
                        ? <CheckCircle sx={{ fontSize: 14, color: '#22C55E' }} />
                        : <Warning sx={{ fontSize: 14, color: '#F59E0B' }} />}
                    </Box>
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Estrutura ENEM */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Lightbulb sx={{ color: '#F59E0B', fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight={700}>Estrutura ENEM</Typography>
              </Box>
              {[
                { label: '§ 1 — Introdução', desc: 'Apresente o tema e tese' },
                { label: '§ 2 — Desenvolvimento 1', desc: 'Argumento + dados/exemplos' },
                { label: '§ 3 — Desenvolvimento 2', desc: 'Segundo argumento' },
                { label: '§ 4 — Conclusão', desc: 'Retome a tese + proposta de intervenção' },
              ].map((item, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 1.5, mb: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.2,
                    bgcolor: alpha('#F2B705', 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="caption" fontWeight={800} color="primary">{i + 1}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" fontWeight={700}>{item.label}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">{item.desc}</Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Competências */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Psychology sx={{ color: '#3B82F6', fontSize: 18 }} />
                <Typography variant="subtitle2" fontWeight={700}>Competências ENEM</Typography>
              </Box>
              {[
                { label: 'C1', desc: 'Domínio da norma culta' },
                { label: 'C2', desc: 'Compreensão da proposta' },
                { label: 'C3', desc: 'Seleção de argumentos' },
                { label: 'C4', desc: 'Coesão e coerência' },
                { label: 'C5', desc: 'Proposta de intervenção (0-200 cada)' },
              ].map(c => (
                <Box key={c.label} sx={{ display: 'flex', gap: 1, mb: 0.75 }}>
                  <Chip label={c.label} size="small"
                    sx={{ bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6', fontWeight: 700, minWidth: 32 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25 }}>{c.desc}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default function NovaRedacaoPage() {
  return (
    <Suspense fallback={<Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>}>
      <NovaRedacaoContent />
    </Suspense>
  );
}
