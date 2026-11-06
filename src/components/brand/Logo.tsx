'use client';

import { Box, Typography } from '@mui/material';

const GOLD = '#F2B705';

// Marca: trilha pontilhada que termina no visto de "aprovado" (a rota até a aprovação).
// Abaixo de 24px a trilha some e o visto engrossa, para continuar legível.
export function LogoMark({ size = 36 }: { size?: number }) {
  const small = size < 24;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Rotta Concursos" style={{ flexShrink: 0, display: 'block' }}>
      <rect width="64" height="64" rx="16" fill="#1C1C1F" />
      {small ? (
        <path d="M16 33l11 11 22-23" fill="none" stroke={GOLD} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <>
          <circle cx="10.5" cy="27" r="2.2" fill={GOLD} fillOpacity="0.45" />
          <circle cx="15.5" cy="31" r="2.2" fill={GOLD} fillOpacity="0.7" />
          <path d="M21 35l8.5 8.5L49 22" fill="none" stroke={GOLD} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

export default function Logo({ size = 36, showTagline = false }: { size?: number; showTagline?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <LogoMark size={size} />
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="span"
          sx={{ display: 'block', fontWeight: 900, fontSize: size * 0.5, letterSpacing: '-0.04em', lineHeight: 1, color: 'text.primary' }}
        >
          Rotta
          <Box component="span" sx={{ color: 'primary.main', fontWeight: 600, letterSpacing: '-0.02em', ml: 0.5 }}>
            Concursos
          </Box>
        </Typography>
        {showTagline && (
          <Typography variant="caption" sx={{ color: 'text.secondary', letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 10, fontWeight: 600 }}>
            Sua rota até a aprovação
          </Typography>
        )}
      </Box>
    </Box>
  );
}
