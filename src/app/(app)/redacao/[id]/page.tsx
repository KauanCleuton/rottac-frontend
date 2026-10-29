'use client';

import { useState, type ReactElement } from 'react';
import dynamic from 'next/dynamic';

const PdfAnnotator = dynamic(() => import('@/components/essay/PdfAnnotator'), { ssr: false });
import {
  Box, Card, CardContent, Typography, Button, Chip, alpha, useTheme,
  Grid, LinearProgress, Avatar, Divider, CircularProgress, Paper,
  Tooltip, IconButton, Accordion, AccordionSummary, AccordionDetails,
} from '@mui/material';
import {
  ArrowBack, CheckCircle, Warning, Refresh, Download, Headphones,
  Edit, ExpandMore, Person, Schedule, Lightbulb,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { essayApi } from '@/lib/api';
import { useRouter, useParams } from 'next/navigation';
import { BRAND_GRADIENT } from '@/theme';
import dayjs from 'dayjs';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:           { label: 'Aguardando correção', color: '#F59E0B' },
  UNDER_REVIEW:      { label: 'Em revisão', color: '#3B82F6' },
  CORRECTED:         { label: 'Corrigida', color: '#22C55E' },
  REWRITE_REQUESTED: { label: 'Reescrita solicitada', color: '#EF4444' },
  REWRITTEN:         { label: 'Reescrita enviada', color: '#D4A017' },
};

const COMMENT_TYPE_COLORS: Record<string, string> = {
  GRAMMAR: '#EF4444', COHESION: '#F59E0B', ARGUMENT: '#3B82F6',
  SUGGESTION: '#D4A017', PRAISE: '#22C55E', ANNOTATION: '#9CA3AF',
};
const COMMENT_TYPE_LABELS: Record<string, string> = {
  GRAMMAR: 'Gramática', COHESION: 'Coesão', ARGUMENT: 'Argumento',
  SUGGESTION: 'Sugestão', PRAISE: 'Elogio', ANNOTATION: 'Anotação',
};

const SCORE_COLOR = (s: number | null) =>
  !s ? '#9CA3AF' : s >= 700 ? '#22C55E' : s >= 500 ? '#F59E0B' : '#EF4444';

export default function EssayDetailPage() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [highlightComment, setHighlightComment] = useState<string | null>(null);

  const { data: essay, isLoading } = useQuery({
    queryKey: ['essay', id],
    queryFn: () => essayApi.get(id).then(r => r.data.data),
  });

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!essay) return <Box sx={{ textAlign: 'center', py: 8 }}><Typography>Redação não encontrada.</Typography></Box>;

  const correction = essay.corrections?.[0];
  const comments = essay.comments || [];
  const st = STATUS_LABEL[essay.status] || STATUS_LABEL.PENDING;
  const totalScore = correction?.totalScore;

  // Renderiza texto com comentários destacados
  const renderContent = () => {
    const content: string = essay.content;
    // Coleta trechos com comentários inline
    const inlineComments = comments.filter((c: any) => c.startOffset != null && c.selectedText);

    if (inlineComments.length === 0) {
      return (
        <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, fontFamily: 'Georgia, serif', fontSize: 15 }}>
          {content}
        </Typography>
      );
    }

    // Constrói segmentos de texto com highlights
    const sorted = [...inlineComments].sort((a: any, b: any) => a.startOffset - b.startOffset);
    const segments: ReactElement[] = [];
    let lastIdx = 0;

    sorted.forEach((c: any, i: number) => {
      const start = c.startOffset;
      const end = c.endOffset || start + (c.selectedText?.length || 0);
      if (start > lastIdx) {
        segments.push(<span key={`t${i}`}>{content.slice(lastIdx, start)}</span>);
      }
      const color = COMMENT_TYPE_COLORS[c.type] || '#F59E0B';
      segments.push(
        <Tooltip key={`h${i}`} title={c.text} arrow>
          <span
            style={{
              background: alpha(color, highlightComment === c.id ? 0.3 : 0.15),
              borderBottom: `2px solid ${color}`,
              cursor: 'help',
              borderRadius: 2,
              transition: 'background 0.2s',
            }}
            onMouseEnter={() => setHighlightComment(c.id)}
            onMouseLeave={() => setHighlightComment(null)}
          >
            {content.slice(start, end)}
          </span>
        </Tooltip>
      );
      lastIdx = end;
    });
    if (lastIdx < content.length) segments.push(<span key="tend">{content.slice(lastIdx)}</span>);

    return (
      <Typography component="div" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, fontFamily: 'Georgia, serif', fontSize: 15 }}>
        {segments}
      </Typography>
    );
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button startIcon={<ArrowBack />} onClick={() => router.push('/redacao')} size="small">Voltar</Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h5" fontWeight={700}>{essay.title}</Typography>
          {essay.theme && <Typography color="text.secondary" variant="body2">Tema: {essay.theme}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip label={st.label} sx={{ bgcolor: alpha(st.color, 0.1), color: st.color, fontWeight: 600 }} />
          {totalScore != null && (
            <Chip label={`${totalScore}/1000`} sx={{ bgcolor: alpha(SCORE_COLOR(totalScore), 0.1),
              color: SCORE_COLOR(totalScore), fontWeight: 800, fontSize: 16 }} />
          )}
          {(essay.status === 'REWRITE_REQUESTED' || essay.status === 'CORRECTED') && (
            <Button variant="outlined" startIcon={<Refresh />}
              onClick={() => router.push(`/redacao/nova?rewrite=${essay.id}`)}>
              Reescrever
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={2}>
        {/* Texto da redação */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                <Typography variant="caption" color="text.secondary">
                  <Schedule sx={{ fontSize: 12, mr: 0.5 }} />
                  {dayjs(essay.submittedAt).format('DD/MM/YYYY HH:mm')}
                </Typography>
                {essay.wordCount && <Typography variant="caption" color="text.secondary">{essay.wordCount} palavras</Typography>}
                {essay.version > 1 && <Chip label={`Versão ${essay.version}`} size="small" variant="outlined" />}
              </Box>
              <Divider sx={{ mb: 2 }} />
              {renderContent()}

              {/* PDF do aluno (somente leitura) */}
              {essay.pdfUrl && (
                <Box sx={{ mt: 3, pt: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
                  <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                    PDF enviado
                  </Typography>
                  <PdfAnnotator
                    pdfUrl={essay.pdfUrl}
                    savedAnnotations={correction?.pdfAnnotations}
                    readOnly
                  />
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Versões anteriores */}
          {(essay.versions || []).length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={700} mb={1}>Histórico de versões</Typography>
                {(essay.versions as any[]).map((v: any) => (
                  <Box key={v.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75,
                    cursor: 'pointer', '&:hover': { opacity: 0.7 } }}
                    onClick={() => router.push(`/redacao/${v.id}`)}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip label={`v${v.version}`} size="small" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(v.submittedAt).format('DD/MM/YYYY')}
                      </Typography>
                    </Box>
                    <Chip label={STATUS_LABEL[v.status]?.label || v.status} size="small"
                      sx={{ bgcolor: alpha(STATUS_LABEL[v.status]?.color || '#9CA3AF', 0.1),
                        color: STATUS_LABEL[v.status]?.color || '#9CA3AF' }} />
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* Painel de correção */}
        <Grid size={{ xs: 12, lg: 5 }}>
          {!correction ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Schedule sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography fontWeight={600}>Aguardando correção</Typography>
                <Typography color="text.secondary" variant="body2" mt={1}>
                  Seu professor irá corrigir em breve
                </Typography>
                {correction?.rewriteDeadline && (
                  <Chip label={`Prazo: ${dayjs(correction.rewriteDeadline).format('DD/MM/YYYY')}`}
                    color="error" sx={{ mt: 2 }} />
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Professor */}
              <Card sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Avatar src={correction.teacher?.avatar} sx={{ width: 40, height: 40 }}>
                      {correction.teacher?.name?.[0]}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" fontWeight={700}>{correction.teacher?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Corrigido em {dayjs(correction.correctedAt).format('DD/MM/YYYY')}
                      </Typography>
                    </Box>
                    {correction.requestRewrite && (
                      <Chip label="Reescrita solicitada" size="small" color="error" sx={{ ml: 'auto' }} />
                    )}
                  </Box>

                  {/* Notas C1-C5 */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" mb={1}>
                      NOTAS POR COMPETÊNCIA
                    </Typography>
                    {[
                      { label: 'C1 — Norma culta', key: 'scoreC1' },
                      { label: 'C2 — Proposta', key: 'scoreC2' },
                      { label: 'C3 — Argumentação', key: 'scoreC3' },
                      { label: 'C4 — Coesão', key: 'scoreC4' },
                      { label: 'C5 — Intervenção', key: 'scoreC5' },
                    ].map(({ label, key }) => {
                      const val: number | null = correction[key];
                      const pct = val != null ? (val / 200) * 100 : 0;
                      const color = pct >= 70 ? '#22C55E' : pct >= 50 ? '#F59E0B' : '#EF4444';
                      return (
                        <Box key={key} sx={{ mb: 1 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                            <Typography variant="caption">{label}</Typography>
                            <Typography variant="caption" fontWeight={700} color={color}>
                              {val != null ? `${val}/200` : '—'}
                            </Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={pct}
                            sx={{ height: 5, borderRadius: 3, bgcolor: alpha('#EF4444', 0.1),
                              '& .MuiLinearProgress-bar': { bgcolor: color } }} />
                        </Box>
                      );
                    })}
                    <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2,
                      bgcolor: alpha(SCORE_COLOR(totalScore), 0.08), textAlign: 'center' }}>
                      <Typography variant="h4" fontWeight={900} color={SCORE_COLOR(totalScore)}>
                        {totalScore ?? '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">NOTA TOTAL / 1000</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>

              {/* Feedback geral */}
              {correction.generalFeedback && (
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} mb={1}>Feedback geral</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {correction.generalFeedback}
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {/* Pontos + / - */}
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {correction.strengthPoints && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${alpha('#22C55E', 0.3)}`, bgcolor: alpha('#22C55E', 0.04), height: '100%' }}>
                      <Typography variant="caption" fontWeight={700} color="#22C55E" display="block" mb={0.5}>PONTOS POSITIVOS</Typography>
                      <Typography variant="body2" color="text.secondary">{correction.strengthPoints}</Typography>
                    </Paper>
                  </Grid>
                )}
                {correction.improvementPoints && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${alpha('#F59E0B', 0.3)}`, bgcolor: alpha('#F59E0B', 0.04), height: '100%' }}>
                      <Typography variant="caption" fontWeight={700} color="#F59E0B" display="block" mb={0.5}>A MELHORAR</Typography>
                      <Typography variant="body2" color="text.secondary">{correction.improvementPoints}</Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>

              {/* Recursos extra */}
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                {correction.audioUrl && (
                  <Button variant="outlined" size="small" startIcon={<Headphones />}
                    href={correction.audioUrl} target="_blank">
                    Ouvir áudio
                  </Button>
                )}
                {correction.correctedFileUrl && (
                  <Button variant="outlined" size="small" startIcon={<Download />}
                    href={correction.correctedFileUrl} target="_blank">
                    PDF corrigido
                  </Button>
                )}
              </Box>

              {/* Comentários inline */}
              {comments.length > 0 && (
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} mb={1.5}>
                      Anotações do professor ({comments.length})
                    </Typography>
                    {(comments as any[]).map((c: any) => (
                      <Box key={c.id}
                        onMouseEnter={() => setHighlightComment(c.id)}
                        onMouseLeave={() => setHighlightComment(null)}
                        sx={{ mb: 1.5, p: 1.5, borderRadius: 2,
                          border: `1px solid ${alpha(COMMENT_TYPE_COLORS[c.type] || '#9CA3AF', 0.3)}`,
                          bgcolor: highlightComment === c.id
                            ? alpha(COMMENT_TYPE_COLORS[c.type] || '#9CA3AF', 0.08)
                            : 'transparent',
                          transition: 'background 0.2s', cursor: 'default' }}>
                        <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
                          <Chip label={COMMENT_TYPE_LABELS[c.type] || c.type} size="small"
                            sx={{ bgcolor: alpha(COMMENT_TYPE_COLORS[c.type] || '#9CA3AF', 0.1),
                              color: COMMENT_TYPE_COLORS[c.type] || '#9CA3AF', fontWeight: 600, fontSize: 10 }} />
                          {c.isResolved && <Chip label="Resolvido" size="small" sx={{ bgcolor: alpha('#22C55E', 0.1), color: '#22C55E' }} />}
                        </Box>
                        {c.selectedText && (
                          <Typography variant="caption" sx={{ fontFamily: 'Georgia, serif', fontStyle: 'italic',
                            display: 'block', mb: 0.5, color: 'text.secondary', borderLeft: `2px solid ${COMMENT_TYPE_COLORS[c.type]}`, pl: 1 }}>
                            "{c.selectedText}"
                          </Typography>
                        )}
                        <Typography variant="body2">{c.text}</Typography>
                      </Box>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}
