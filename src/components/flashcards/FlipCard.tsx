'use client';

import { Box, Chip, Typography, alpha, useTheme } from '@mui/material';
import { TouchApp, Replay } from '@mui/icons-material';

const ANSWER = '#10B981';

// Cartão com giro 3D real: frente e verso são duas faces do mesmo objeto, giradas 180° no eixo Y.
// As faces ficam empilhadas na mesma célula do grid, então a altura acompanha o lado mais longo.
export default function FlipCard({ front, back, flipped, onFlip }: {
  front: string; back: string; flipped: boolean; onFlip: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;

  const face = {
    gridArea: '1 / 1',
    backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden',
    minHeight: 280,
    borderRadius: 4,
    p: { xs: 3, sm: 5 },
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    bgcolor: 'background.paper',
    color: 'text.primary',
    boxShadow: isDark ? '0 20px 50px rgba(0,0,0,0.55)' : '0 18px 40px rgba(0,0,0,0.10)',
  } as const;

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={flipped ? 'Resposta. Pressione para ver a pergunta' : 'Pergunta. Pressione para revelar a resposta'}
      aria-pressed={flipped}
      onClick={onFlip}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onFlip(); } }}
      sx={{
        perspective: '1400px',
        cursor: 'pointer',
        mb: 3,
        outline: 'none',
        // Entrada do card novo (sem revelar nada do verso)
        animation: 'cardIn .35s ease-out',
        '@keyframes cardIn': {
          from: { opacity: 0, transform: 'translateY(16px) scale(.98)' },
          to: { opacity: 1, transform: 'none' },
        },
        '&:focus-visible > div': { outline: `3px solid ${alpha(gold, 0.6)}`, outlineOffset: 4, borderRadius: 4 },
      }}
    >
      <Box
        sx={{
          display: 'grid',
          transformStyle: 'preserve-3d',
          transition: 'transform .7s cubic-bezier(.2,.75,.25,1.15)',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        }}
      >
        {/* Frente */}
        <Box sx={{
          ...face,
          border: `2px solid ${alpha(gold, 0.45)}`,
          backgroundImage: `linear-gradient(135deg, ${alpha(gold, isDark ? 0.10 : 0.08)}, transparent 60%)`,
        }}>
          <Chip label="Pergunta" size="small"
            sx={{ position: 'absolute', top: 14, left: 16, bgcolor: alpha(gold, 0.16), color: isDark ? gold : theme.palette.primary.dark, fontWeight: 700, fontSize: 11 }} />
          <Typography variant="h6" textAlign="center" fontWeight={600} sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'text.primary' }}>
            {front}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', bottom: 14, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TouchApp sx={{ fontSize: 15 }} /> Clique ou aperte espaço para virar
          </Typography>
        </Box>

        {/* Verso */}
        <Box sx={{
          ...face,
          transform: 'rotateY(180deg)',
          border: `2px solid ${alpha(ANSWER, 0.5)}`,
          backgroundImage: `linear-gradient(135deg, ${alpha(ANSWER, isDark ? 0.12 : 0.08)}, transparent 60%)`,
        }}>
          <Chip label="Resposta" size="small"
            sx={{ position: 'absolute', top: 14, left: 16, bgcolor: alpha(ANSWER, 0.16), color: ANSWER, fontWeight: 700, fontSize: 11 }} />
          <Typography variant="h6" textAlign="center" fontWeight={500} sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'text.primary' }}>
            {back}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', bottom: 14, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Replay sx={{ fontSize: 15 }} /> Clique para ver a pergunta
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
