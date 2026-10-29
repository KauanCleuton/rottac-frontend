'use client';

import { Box, alpha, useTheme, type SxProps, type Theme } from '@mui/material';
import { parseRich, RICH_COLORS } from '@/lib/richText';

// Renderiza a marcação (**negrito**, ==destaque==, [azul]..[/azul]...) como elementos React — sem HTML cru
export default function RichText({ text, sx, component = 'span' }: { text: string | null | undefined; sx?: SxProps<Theme>; component?: React.ElementType }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  if (!text) return null;
  return (
    <Box component={component} sx={{ whiteSpace: 'pre-wrap', ...((sx as object) || {}) }}>
      {parseRich(text).map((s, i) => {
        const style: React.CSSProperties = {};
        if (s.b) style.fontWeight = 800;
        if (s.i) style.fontStyle = 'italic';
        if (s.u) { style.textDecoration = 'underline'; style.textUnderlineOffset = '3px'; }
        if (s.color) style.color = RICH_COLORS[s.color];
        if (s.hl) {
          style.backgroundColor = alpha('#FDE047', isDark ? 0.35 : 0.65);
          style.borderRadius = 3;
          style.padding = '0 2px';
          if (!s.color) style.color = isDark ? '#FFF7C2' : 'inherit';
        }
        return Object.keys(style).length ? <span key={i} style={style}>{s.text}</span> : <span key={i}>{s.text}</span>;
      })}
    </Box>
  );
}
