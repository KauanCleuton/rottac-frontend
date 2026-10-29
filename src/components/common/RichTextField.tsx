'use client';

import { useRef, useState } from 'react';
import {
  Box, TextField, IconButton, Tooltip, Divider, Menu, MenuItem, ToggleButton, Typography, type TextFieldProps,
} from '@mui/material';
import { FormatBold, FormatItalic, FormatUnderlined, BorderColor, FormatColorText, Visibility, Edit } from '@mui/icons-material';
import RichText from './RichText';
import { RICH_COLORS, wrapSelection, type RichColor } from '@/lib/richText';

type Props = Omit<TextFieldProps, 'onChange' | 'value'> & {
  value: string;
  onChange: (v: string) => void;
  compact?: boolean; // barra menor (comentários)
};

// Campo de texto com barra de formatação: seleciona a palavra e aplica negrito, destaque, cor...
export default function RichTextField({ value, onChange, compact, ...props }: Props) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);
  const [preview, setPreview] = useState(false);

  const apply = (open: string, close: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const r = wrapSelection(value, start, end, open, close);
    onChange(r.value);
    // Restaura a seleção no texto marcado depois do re-render
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(r.selStart, r.selEnd);
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); apply('**', '**'); }
    else if (k === 'i') { e.preventDefault(); apply('_', '_'); }
    else if (k === 'u') { e.preventDefault(); apply('__', '__'); }
  };

  const btn = (title: string, icon: React.ReactNode, open: string, close: string) => (
    <Tooltip title={title}>
      <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={() => apply(open, close)} aria-label={title} disabled={preview}>
        {icon}
      </IconButton>
    </Tooltip>
  );

  return (
    <Box>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 0.25, px: 0.5, py: 0.25, mb: 0.5, borderRadius: 1.5,
        border: '1px solid', borderColor: 'divider', width: 'fit-content', flexWrap: 'wrap',
      }}>
        {btn('Negrito (Ctrl+B)', <FormatBold fontSize="small" />, '**', '**')}
        {btn('Itálico (Ctrl+I)', <FormatItalic fontSize="small" />, '_', '_')}
        {btn('Sublinhado (Ctrl+U)', <FormatUnderlined fontSize="small" />, '__', '__')}
        {btn('Marca-texto', <BorderColor fontSize="small" sx={{ color: '#EAB308' }} />, '==', '==')}
        <Tooltip title="Cor do texto">
          <IconButton size="small" onMouseDown={(e) => e.preventDefault()} onClick={(e) => setColorAnchor(e.currentTarget)} aria-label="Cor do texto" disabled={preview}>
            <FormatColorText fontSize="small" />
          </IconButton>
        </Tooltip>
        {!compact && (
          <>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <ToggleButton value="preview" size="small" selected={preview} onChange={() => setPreview((p) => !p)}
              sx={{ border: 0, px: 1, py: 0.25, gap: 0.5, textTransform: 'none', fontSize: 12 }}>
              {preview ? <Edit sx={{ fontSize: 16 }} /> : <Visibility sx={{ fontSize: 16 }} />}
              {preview ? 'Editar' : 'Visualizar'}
            </ToggleButton>
          </>
        )}
      </Box>
      <Menu anchorEl={colorAnchor} open={Boolean(colorAnchor)} onClose={() => setColorAnchor(null)}>
        {(Object.keys(RICH_COLORS) as RichColor[]).map((c) => (
          <MenuItem key={c} onClick={() => { setColorAnchor(null); apply(`[${c}]`, `[/${c}]`); }} sx={{ gap: 1.25 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: RICH_COLORS[c] }} />
            <Typography variant="body2" sx={{ color: RICH_COLORS[c], fontWeight: 700, textTransform: 'capitalize' }}>{c}</Typography>
          </MenuItem>
        ))}
      </Menu>

      {preview ? (
        <Box sx={{ p: 1.5, minHeight: 56, borderRadius: 1.5, border: '1px dashed', borderColor: 'divider', lineHeight: 1.75 }}>
          {value ? <RichText text={value} /> : <Typography color="text.disabled">Nada para visualizar.</Typography>}
        </Box>
      ) : (
        <TextField {...props} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
          inputRef={(el: HTMLInputElement | HTMLTextAreaElement | null) => { inputRef.current = el; }} />
      )}
    </Box>
  );
}
