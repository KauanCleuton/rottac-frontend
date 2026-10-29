'use client';

import { useState } from 'react';
import { Box, Typography, Button, Collapse, alpha, useTheme } from '@mui/material';
import { Article, ExpandLess, ExpandMore } from '@mui/icons-material';
import RichText from '@/components/common/RichText';

export type SupportTextData = { id: string; title?: string | null; body: string; source?: string | null };

// Texto de apoio com linhas numeradas de 5 em 5 (como nas provas, que citam "linha 12")
export default function SupportText({ text, defaultOpen = true }: { text: SupportTextData; defaultOpen?: boolean }) {
  const theme = useTheme();
  const gold = theme.palette.primary.main;
  const [open, setOpen] = useState(defaultOpen);
  const lines = text.body.split('\n');

  return (
    <Box sx={{ mb: 2.5, borderRadius: 2, border: '1px solid', borderColor: alpha(gold, 0.35), bgcolor: alpha(gold, theme.palette.mode === 'dark' ? 0.04 : 0.035), overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderBottom: open ? '1px solid' : 'none', borderColor: alpha(gold, 0.2) }}>
        <Article sx={{ color: gold, fontSize: 20 }} />
        <Typography fontWeight={800} sx={{ flex: 1 }}>{text.title || 'Texto de apoio'}</Typography>
        <Button size="small" color="inherit" onClick={() => setOpen((o) => !o)} endIcon={open ? <ExpandLess /> : <ExpandMore />} sx={{ color: 'text.secondary' }}>
          {open ? 'Recolher' : 'Ler texto'}
        </Button>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, py: 1.5, maxHeight: 460, overflowY: 'auto' }}>
          <Box component="ol" sx={{ m: 0, p: 0, listStyle: 'none', counterReset: 'linha' }}>
            {lines.map((ln, i) => (
              <Box key={i} component="li" sx={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 1, alignItems: 'baseline' }}>
                <Typography component="span" aria-hidden sx={{ fontSize: 11, color: 'text.disabled', textAlign: 'right', fontVariantNumeric: 'tabular-nums', userSelect: 'none' }}>
                  {(i + 1) % 5 === 0 ? i + 1 : ''}
                </Typography>
                <RichText text={ln || ' '} sx={{ fontSize: 15, lineHeight: 1.85, fontFamily: 'Georgia, "Times New Roman", serif' }} />
              </Box>
            ))}
          </Box>
          {text.source && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5, fontStyle: 'italic', textAlign: 'right' }}>
              {text.source}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}
