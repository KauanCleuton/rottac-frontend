'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  Box, IconButton, Tooltip, Paper, Slider, Typography, Button,
  CircularProgress, alpha, Chip, ButtonGroup,
} from '@mui/material';
import {
  NavigateBefore, NavigateNext, Save, Delete, Undo,
  Edit as PenIcon, AutoFixNormal as EraserIcon, Circle,
  Download, ZoomIn, ZoomOut,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

// pdfjs-dist v5 usa ES modules — precisa de worker com { type: 'module' }
if (typeof window !== 'undefined') {
  try {
    const worker = new Worker('/pdf.worker.min.mjs', { type: 'module' });
    (pdfjs.GlobalWorkerOptions as any).workerPort = worker;
  } catch {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }
}

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser' | 'circle';
  circleStart?: { x: number; y: number };
}

interface PageAnnotation {
  page: number;
  strokes: Stroke[];
}

interface Props {
  pdfUrl: string;
  savedAnnotations?: string; // JSON string de PageAnnotation[]
  onSave?: (annotations: PageAnnotation[]) => Promise<void>;
  readOnly?: boolean;
}

const COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#D4A017', '#000000'];

// Resolve URL relativa (/uploads/...) para URL absoluta do backend
const resolveUrl = (url: string) => {
  if (!url) return url;
  if (url.startsWith('http')) return url;
  const base = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api/v1', '');
  return `${base}${url}`;
};

export default function PdfAnnotator({ pdfUrl, savedAnnotations, onSave, readOnly = false }: Props) {
  const resolvedUrl = resolveUrl(pdfUrl);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [tool, setTool] = useState<'pen' | 'eraser' | 'circle'>('pen');
  const [color, setColor] = useState('#EF4444');
  const [brushSize, setBrushSize] = useState(3);
  const [saving, setSaving] = useState(false);
  const [pdfWidth, setPdfWidth] = useState(0);
  const [pdfHeight, setPdfHeight] = useState(0);

  // Anotações por página
  const [annotations, setAnnotations] = useState<PageAnnotation[]>(() => {
    if (!savedAnnotations) return [];
    try { return JSON.parse(savedAnnotations); } catch { return []; }
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const currentStroke = useRef<Stroke | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Strokes da página atual
  const currentPageStrokes = annotations.find(a => a.page === page)?.strokes || [];

  // Redesenha o canvas quando troca de página ou recebe anotações salvas
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const strokes = annotations.find(a => a.page === page)?.strokes || [];

    strokes.forEach(stroke => {
      if (stroke.points.length === 0) return;

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = stroke.width * 4;
      } else if (stroke.tool === 'circle') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
        if (stroke.circleStart && stroke.points.length > 0) {
          const last = stroke.points[stroke.points.length - 1];
          const rx = Math.abs(last.x - stroke.circleStart.x) / 2;
          const ry = Math.abs(last.y - stroke.circleStart.y) / 2;
          const cx = stroke.circleStart.x + (last.x - stroke.circleStart.x) / 2;
          const cy = stroke.circleStart.y + (last.y - stroke.circleStart.y) / 2;
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        return;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.width;
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });

    ctx.globalCompositeOperation = 'source-over';
  }, [annotations, page]);

  useEffect(() => { redrawCanvas(); }, [redrawCanvas]);

  // Atualiza tamanho do canvas quando o PDF renderiza
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pdfWidth || !pdfHeight) return;
    canvas.width = pdfWidth;
    canvas.height = pdfHeight;
    redrawCanvas();
  }, [pdfWidth, pdfHeight, redrawCanvas]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    e.preventDefault();
    const pos = getPos(e);
    drawing.current = true;
    currentStroke.current = {
      points: [pos],
      color,
      width: brushSize,
      tool,
      circleStart: tool === 'circle' ? pos : undefined,
    };
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !currentStroke.current || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);

    currentStroke.current.points.push(pos);

    // Redraw limpo + stroke atual (para preview)
    redrawCanvas();

    if (tool === 'circle' && currentStroke.current.circleStart) {
      const { circleStart } = currentStroke.current;
      const rx = Math.abs(pos.x - circleStart.x) / 2;
      const ry = Math.abs(pos.y - circleStart.y) / 2;
      const cx = circleStart.x + (pos.x - circleStart.x) / 2;
      const cy = circleStart.y + (pos.y - circleStart.y) / 2;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const pts = currentStroke.current.points;
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = brushSize * 4;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = brushSize;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[pts.length - 2]?.x ?? pos.x, pts[pts.length - 2]?.y ?? pos.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  };

  const endDraw = () => {
    if (!drawing.current || !currentStroke.current) return;
    drawing.current = false;

    const stroke = currentStroke.current;
    currentStroke.current = null;

    if (stroke.points.length < 2 && stroke.tool !== 'circle') return;

    setAnnotations(prev => {
      const existing = prev.find(a => a.page === page);
      if (existing) {
        return prev.map(a => a.page === page
          ? { ...a, strokes: [...a.strokes, stroke] }
          : a
        );
      }
      return [...prev, { page, strokes: [stroke] }];
    });
  };

  const undo = () => {
    setAnnotations(prev => prev.map(a =>
      a.page === page ? { ...a, strokes: a.strokes.slice(0, -1) } : a
    ));
  };

  const clearPage = () => {
    setAnnotations(prev => prev.map(a =>
      a.page === page ? { ...a, strokes: [] } : a
    ));
  };

  const handleSave = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave(annotations);
      toast.success('Anotações salvas!');
    } catch {
      toast.error('Erro ao salvar anotações');
    } finally {
      setSaving(false);
    }
  };

  const downloadAnnotated = () => {
    const pdfCanvas = pdfContainerRef.current?.querySelector('canvas') as HTMLCanvasElement;
    const annCanvas = canvasRef.current;
    if (!pdfCanvas || !annCanvas) return;

    const merged = document.createElement('canvas');
    merged.width = pdfCanvas.width;
    merged.height = pdfCanvas.height;
    const ctx = merged.getContext('2d')!;
    ctx.drawImage(pdfCanvas, 0, 0);
    ctx.drawImage(annCanvas, 0, 0);

    const link = document.createElement('a');
    link.download = `correcao_pagina_${page}.png`;
    link.href = merged.toDataURL('image/png');
    link.click();
  };

  const annotatedPages = annotations.filter(a => a.strokes.length > 0).map(a => a.page);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Toolbar */}
      {!readOnly && (
        <Paper elevation={0} sx={{ p: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap',
          border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>

          {/* Ferramentas */}
          <ButtonGroup size="small">
            <Tooltip title="Caneta">
              <IconButton size="small" onClick={() => setTool('pen')}
                sx={{ bgcolor: tool === 'pen' ? alpha('#F2B705', 0.15) : undefined }}>
                <PenIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Borracha">
              <IconButton size="small" onClick={() => setTool('eraser')}
                sx={{ bgcolor: tool === 'eraser' ? alpha('#F2B705', 0.15) : undefined }}>
                <EraserIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Círculo / Marcação">
              <IconButton size="small" onClick={() => setTool('circle')}
                sx={{ bgcolor: tool === 'circle' ? alpha('#F2B705', 0.15) : undefined }}>
                <Circle fontSize="small" />
              </IconButton>
            </Tooltip>
          </ButtonGroup>

          {/* Cores */}
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {COLORS.map(c => (
              <Box key={c} onClick={() => { setColor(c); setTool(t => t === 'eraser' ? 'pen' : t); }}
                sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                  border: color === c ? '2px solid #fff' : '2px solid transparent',
                  boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                  transition: 'all 0.15s' }} />
            ))}
          </Box>

          {/* Espessura */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 100 }}>
            <Typography variant="caption" color="text.secondary">Esp.</Typography>
            <Slider value={brushSize} min={1} max={12} step={1} size="small"
              onChange={(_, v) => setBrushSize(v as number)}
              sx={{ width: 80 }} />
            <Typography variant="caption">{brushSize}</Typography>
          </Box>

          {/* Separador */}
          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title="Desfazer último traço">
            <span>
              <IconButton size="small" onClick={undo}
                disabled={currentPageStrokes.length === 0}>
                <Undo fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Limpar página">
            <span>
              <IconButton size="small" onClick={clearPage}
                disabled={currentPageStrokes.length === 0} color="error">
                <Delete fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Baixar página com anotações">
            <IconButton size="small" onClick={downloadAnnotated}>
              <Download fontSize="small" />
            </IconButton>
          </Tooltip>
          {onSave && (
            <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={14} color="inherit" /> : <Save />}
              onClick={handleSave} disabled={saving}
              sx={{ background: 'linear-gradient(135deg,#F2B705,#FFD34D)', fontWeight: 700, fontSize: 12 }}>
              Salvar anotações
            </Button>
          )}
        </Paper>
      )}

      {/* Navegação de páginas */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
        <IconButton size="small" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
          <NavigateBefore />
        </IconButton>
        <Typography variant="body2" fontWeight={600}>
          Página {page} / {numPages}
        </Typography>
        <IconButton size="small" onClick={() => setPage(p => Math.min(numPages, p + 1))} disabled={page >= numPages}>
          <NavigateNext />
        </IconButton>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
          <IconButton size="small" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
            <ZoomOut fontSize="small" />
          </IconButton>
          <Typography variant="caption">{Math.round(scale * 100)}%</Typography>
          <IconButton size="small" onClick={() => setScale(s => Math.min(2.5, s + 0.2))}>
            <ZoomIn fontSize="small" />
          </IconButton>
        </Box>
        {annotatedPages.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, ml: 1, flexWrap: 'wrap' }}>
            {annotatedPages.map(p => (
              <Chip key={p} label={`p.${p}`} size="small" clickable onClick={() => setPage(p)}
                color={p === page ? 'primary' : 'default'}
                sx={{ fontSize: 10 }} />
            ))}
          </Box>
        )}
      </Box>

      {/* PDF + Canvas overlay */}
      <Box sx={{ position: 'relative', display: 'inline-block', mx: 'auto', boxShadow: 4, borderRadius: 1, overflow: 'hidden' }}>
        <div ref={pdfContainerRef}>
          <Document
            file={resolvedUrl}
            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
            onLoadError={(err) => console.error('[PdfAnnotator] load error:', err)}
            loading={<Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>}
            error={
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="error" mb={1}>Erro ao carregar PDF</Typography>
                <Typography variant="caption" color="text.secondary">Verifique o console para detalhes</Typography>
                <Box mt={1}>
                  <a href={resolvedUrl} target="_blank" rel="noreferrer" style={{ color: '#F2B705', fontSize: 13 }}>
                    Abrir PDF diretamente ↗
                  </a>
                </Box>
              </Box>
            }
          >
            <Page
              pageNumber={page}
              scale={scale}
              onRenderSuccess={() => {
                // Lê dimensões do canvas real do react-pdf após render
                requestAnimationFrame(() => {
                  const pdfCanvas = pdfContainerRef.current?.querySelector('canvas');
                  if (pdfCanvas) {
                    setPdfWidth(pdfCanvas.width);
                    setPdfHeight(pdfCanvas.height);
                  }
                });
              }}
              renderAnnotationLayer
              renderTextLayer
            />
          </Document>
        </div>

        {/* Canvas de anotações sobre o PDF */}
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            // CSS exibe no tamanho visual do PDF; atributos width/height
            // são definidos em pixels reais pelo useEffect
            width: pdfWidth > 0 ? pdfWidth : '100%',
            height: pdfHeight > 0 ? pdfHeight : '100%',
            cursor: readOnly ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair',
            touchAction: 'none',
            pointerEvents: readOnly ? 'none' : 'auto',
          }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </Box>
    </Box>
  );
}
