'use client';

import { Box, Typography, alpha } from '@mui/material';
import Link from 'next/link';
import { LogoMark } from '@/components/brand/Logo';
import { GOLD } from '@/theme';

// Rodapé sempre escuro (nos dois temas), com detalhes em dourado
const INK = '#0A0A0B';
const TEXT = alpha('#F5F5F4', 0.62);

const LINKS = [
  { href: '/', label: 'Conheça a Rotta' },
  { href: '/planos', label: 'Planos' },
  { href: '/questoes/banco', label: 'Banco de questões' },
  { href: '/cadernos', label: 'Cadernos' },
];

export default function Footer({ compact = false }: { compact?: boolean }) {
  const year = new Date().getFullYear();
  return (
    <Box
      component="footer"
      sx={{
        bgcolor: INK,
        color: TEXT,
        borderTop: `1px solid ${alpha(GOLD, 0.25)}`,
        px: { xs: 2.5, md: 4 },
        py: compact ? 2 : 3,
        mt: 'auto',
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <LogoMark size={28} />
          <Box>
            <Typography sx={{ color: '#F5F5F4', fontWeight: 900, fontSize: 15, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Rotta <Box component="span" sx={{ color: GOLD, fontWeight: 600 }}>Concursos</Box>
            </Typography>
            <Typography sx={{ color: TEXT, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Sua rota até a aprovação
            </Typography>
          </Box>
        </Box>

        {!compact && (
          <Box component="nav" sx={{ display: 'flex', gap: { xs: 2, md: 3 }, flexWrap: 'wrap' }}>
            {LINKS.map((l) => (
              <Box key={l.href} component={Link} href={l.href}
                sx={{ color: TEXT, fontSize: 13, textDecoration: 'none', transition: 'color .15s', '&:hover': { color: GOLD } }}>
                {l.label}
              </Box>
            ))}
          </Box>
        )}

        <Typography sx={{ fontSize: 12, color: TEXT }}>
          © {year} Rotta Concursos · Desenvolvido por{' '}
          <Box component="a" href="https://www.instagram.com/kauan.cleuton" target="_blank" rel="noopener noreferrer"
            sx={{ color: '#F5F5F4', fontWeight: 600, textDecoration: 'none', '&:hover': { color: GOLD } }}>
            Kauan Cleuton
          </Box>
        </Typography>
      </Box>

      {!compact && (
        <Typography sx={{ maxWidth: 1200, mx: 'auto', mt: 2, pt: 2, borderTop: `1px solid ${alpha('#FFFFFF', 0.06)}`, fontSize: 10.5, color: alpha('#F5F5F4', 0.4), lineHeight: 1.6 }}>
          Todos os direitos reservados. É proibida a reprodução, cópia, distribuição ou uso comercial sem autorização expressa do titular.
          Direitos econômicos e patrimoniais pertencentes a Kauan Cleuton — Lei 9.610/98 (Lei de Direitos Autorais).
        </Typography>
      )}
    </Box>
  );
}
