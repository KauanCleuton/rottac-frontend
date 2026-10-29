'use client';

import { useId } from 'react';
import { Box, Typography } from '@mui/material';

// Marca: "R" dourado cuja perna é uma rota terminando no ponto de destino (a aprovação).
export function LogoMark({ size = 36 }: { size?: number }) {
  const uid = useId().replace(/:/g, '');
  const gold = `gold-${uid}`;
  const bg = `bg-${uid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="Rotta Concursos" style={{ flexShrink: 0, display: 'block' }}>
      <defs>
        <linearGradient id={gold} gradientUnits="userSpaceOnUse" x1="150" y1="100" x2="380" y2="440">
          <stop offset="0" stopColor="#FFE38A" />
          <stop offset="0.45" stopColor="#F2B705" />
          <stop offset="1" stopColor="#B8860B" />
        </linearGradient>
        <radialGradient id={bg} cx="0.3" cy="0.2" r="0.9">
          <stop offset="0" stopColor="#26262A" />
          <stop offset="1" stopColor="#0A0A0B" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${bg})`} />
      <rect x="6" y="6" width="500" height="500" rx="110" fill="none" stroke="#F2B705" strokeOpacity="0.18" strokeWidth="4" />
      <path d="M164 366V122h92a76 76 0 0 1 0 152h-92M236 274l60 68" fill="none" stroke={`url(#${gold})`} strokeWidth="54" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="348" cy="401" r="30" fill={`url(#${gold})`} />
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
