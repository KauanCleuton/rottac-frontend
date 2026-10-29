'use client';

import { Box, Typography, alpha, ThemeProvider, Button } from '@mui/material';
import { CheckCircle, ArrowBack } from '@mui/icons-material';
import Link from 'next/link';
import Logo from '@/components/brand/Logo';
import Footer from '@/components/layout/Footer';
import { GOLD, darkTheme } from '@/theme';

const HIGHLIGHTS = [
  'Banco de questões com filtros por banca, órgão, cargo e assunto',
  'Cadernos com diagnóstico que diz o que estudar em seguida',
  'Revisão espaçada: cada erro volta no dia certo',
  'Simulados cronometrados e itens Certo/Errado no padrão Cebraspe',
];

// Telas de entrada sempre no visual escuro da marca, independente do tema escolhido
export default function AuthShell({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#F5F5F4', bgcolor: '#0A0A0B',
        backgroundImage: `radial-gradient(900px 500px at 15% 10%, ${alpha(GOLD, 0.16)}, transparent 60%),
          radial-gradient(700px 400px at 90% 90%, ${alpha(GOLD, 0.08)}, transparent 60%),
          linear-gradient(${alpha('#FFFFFF', 0.025)} 1px, transparent 1px),
          linear-gradient(90deg, ${alpha('#FFFFFF', 0.025)} 1px, transparent 1px)`,
        backgroundSize: 'auto, auto, 48px 48px, 48px 48px',
      }}>
        {/* Topo */}
        <Box sx={{ px: { xs: 2.5, md: 5 }, py: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box component={Link} href="/" sx={{ textDecoration: 'none' }}><Logo size={36} /></Box>
          <Button component={Link} href="/" startIcon={<ArrowBack />} size="small" sx={{ color: alpha('#F5F5F4', 0.7) }}>
            Conhecer a plataforma
          </Button>
        </Box>

        <Box sx={{
          flex: 1, display: 'grid', alignItems: 'center', gap: { xs: 4, md: 8 },
          gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
          maxWidth: 1200, width: '100%', mx: 'auto', px: { xs: 2.5, md: 5 }, py: { xs: 2, md: 6 },
        }}>
          {/* Apresentação */}
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography variant="overline" sx={{ color: GOLD }}>Plataforma de estudos para concursos</Typography>
            <Typography sx={{ fontSize: { md: 44, lg: 52 }, fontWeight: 900, lineHeight: 1.05, letterSpacing: '-0.035em', mt: 1, mb: 3 }}>
              Estude com método.<br />
              <Box component="span" sx={{
                background: `linear-gradient(90deg, #FFE38A, ${GOLD} 55%, #C99A06)`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>
                Passe com estratégia.
              </Box>
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 480 }}>
              {HIGHLIGHTS.map((h) => (
                <Box key={h} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <CheckCircle sx={{ color: GOLD, fontSize: 20, mt: 0.25 }} />
                  <Typography sx={{ color: alpha('#F5F5F4', 0.8) }}>{h}</Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Cartão do formulário */}
          <Box sx={{
            width: '100%', maxWidth: 440, justifySelf: { xs: 'center', md: 'end' },
            p: { xs: 3, sm: 4 }, borderRadius: 4,
            bgcolor: alpha('#141416', 0.85), backdropFilter: 'blur(14px)',
            border: `1px solid ${alpha(GOLD, 0.22)}`,
            boxShadow: `0 30px 80px ${alpha('#000', 0.6)}, inset 0 1px 0 ${alpha('#FFFFFF', 0.05)}`,
          }}>
            <Typography variant="h4" sx={{ fontWeight: 800 }}>{title}</Typography>
            {subtitle && <Typography sx={{ color: alpha('#F5F5F4', 0.6), mt: 0.5, mb: 3 }}>{subtitle}</Typography>}
            {children}
          </Box>
        </Box>

        <Footer compact />
      </Box>
    </ThemeProvider>
  );
}
