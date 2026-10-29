'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Divider, Paper, alpha, useTheme } from '@mui/material';
import { Edit, BorderColor, AutoFixNormal, Undo, DeleteSweep, Close } from '@mui/icons-material';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';

type Tool = 'pen' | 'highlighter' | 'eraser';
// Pontos normalizados pelo tamanho da área (0–1) + pressão: os riscos acompanham o redimensionamento
type Stroke = { tool: 'pen' | 'highlighter'; color: string; width: number; points: [number, number, number][] };

const PEN_COLORS = ['#EF4444', '#3B82F6', '#22C55E', '#F2B705'];
const HIGHLIGHT_COLORS = ['#FDE047', '#86EFAC', '#F9A8D4'];
const ERASER_RADIUS = 14;
const SAVE_DELAY = 800;

function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
  if (!s.points.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = s.color;
  if (s.tool === 'highlighter') {
    // Marca-texto: traço largo, translúcido e uniforme
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
    if (s.points.length === 1) ctx.lineTo(s.points[0][0] * w + 0.1, s.points[0][1] * h);
    ctx.stroke();
  } else {
    // Caneta: espessura varia com a pressão (stylus); mouse usa pressão 0.5
    for (let i = 1; i < s.points.length; i++) {
      const [x0, y0, p0] = s.points[i - 1];
      const [x1, y1, p1] = s.points[i];
      ctx.lineWidth = s.width * (0.45 + (p0 + p1) / 2);
      ctx.beginPath();
      ctx.moveTo(x0 * w, y0 * h);
      ctx.lineTo(x1 * w, y1 * h);
      ctx.stroke();
    }
    if (s.points.length === 1) {
      const [x, y, p] = s.points[0];
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x * w, y * h, (s.width * (0.45 + p)) / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export default function AnnotationLayer({ questionId, active, hasAnnotation, onClose, children }: {
  questionId: string;
  active: boolean;
  hasAnnotation?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<Tool>('pen');
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [hlColor, setHlColor] = useState(HIGHLIGHT_COLORS[0]);
  const [loaded, setLoaded] = useState(false);
  const [count, setCount] = useState(0); // força re-render dos botões (desfazer/limpar)

  const redraw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    for (const s of strokesRef.current) drawStroke(ctx, s, size.w, size.h);
    if (drawingRef.current) drawStroke(ctx, drawingRef.current, size.w, size.h);
  }, [size]);

  // Acompanha o tamanho da área (texto quebra diferente em telas diferentes)
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    redraw();
  }, [size, redraw]);

  // Carrega riscos salvos (quando existem ou quando a caneta é ligada pela primeira vez)
  useEffect(() => {
    if (loaded || (!hasAnnotation && !active)) return;
    let cancelled = false;
    questionBankApi.getAnnotation(questionId)
      .then((r) => {
        if (cancelled) return;
        strokesRef.current = Array.isArray(r.data.data.strokes) ? r.data.data.strokes : [];
        setLoaded(true);
        setCount(strokesRef.current.length);
        redraw();
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [questionId, hasAnnotation, active, loaded, redraw]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      questionBankApi.saveAnnotation(questionId, strokesRef.current)
        .catch((e) => toast.error(e.response?.data?.message || 'Não foi possível salvar os riscos'));
    }, SAVE_DELAY);
  }, [questionId]);

  // Salva pendências ao sair da questão
  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      questionBankApi.saveAnnotation(questionId, strokesRef.current).catch(() => {});
    }
  }, [questionId]);

  const pointFrom = (e: React.PointerEvent): [number, number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' ? (e.pressure || 0.5) : 0.5;
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, Math.round(pressure * 100) / 100];
  };

  const eraseAt = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const before = strokesRef.current.length;
    strokesRef.current = strokesRef.current.filter((s) =>
      !s.points.some(([x, y]) => Math.hypot(x * rect.width - px, y * rect.height - py) <= ERASER_RADIUS + s.width / 2));
    if (strokesRef.current.length !== before) {
      setCount(strokesRef.current.length);
      redraw();
      scheduleSave();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    // Botão traseiro/borracha da caneta apaga
    if (tool === 'eraser' || e.button === 5 || (e.buttons & 32)) { eraseAt(e); return; }
    drawingRef.current = tool === 'highlighter'
      ? { tool: 'highlighter', color: hlColor, width: 18, points: [pointFrom(e)] }
      : { tool: 'pen', color: penColor, width: 2.5, points: [pointFrom(e)] };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!active || !e.buttons) return;
    if (tool === 'eraser' || (e.buttons & 32)) { eraseAt(e); return; }
    if (!drawingRef.current) return;
    // getCoalescedEvents dá traço mais suave com caneta/mouse rápidos
    const native = e.nativeEvent as PointerEvent;
    const events = native.getCoalescedEvents?.() ?? [native];
    const rect = canvasRef.current!.getBoundingClientRect();
    for (const ev of events) {
      const pressure = ev.pointerType === 'pen' ? (ev.pressure || 0.5) : 0.5;
      drawingRef.current.points.push([
        (ev.clientX - rect.left) / rect.width,
        (ev.clientY - rect.top) / rect.height,
        Math.round(pressure * 100) / 100,
      ]);
    }
    redraw();
  };

  const onPointerUp = () => {
    const s = drawingRef.current;
    drawingRef.current = null;
    if (!s) return;
    // Reduz pontos muito próximos para economizar espaço
    s.points = s.points.filter((p, i, arr) => i === 0 || i === arr.length - 1
      || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 0.002);
    s.points = s.points.map(([x, y, p]) => [Math.round(x * 10000) / 10000, Math.round(y * 10000) / 10000, p]);
    strokesRef.current = [...strokesRef.current, s];
    setCount(strokesRef.current.length);
    redraw();
    scheduleSave();
  };

  const undo = () => {
    strokesRef.current = strokesRef.current.slice(0, -1);
    setCount(strokesRef.current.length);
    redraw();
    scheduleSave();
  };

  const clearAll = () => {
    strokesRef.current = [];
    setCount(0);
    redraw();
    scheduleSave();
  };

  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <Tooltip title={label}>
      <IconButton size="small" onClick={() => setTool(t)} aria-label={label} aria-pressed={tool === t}
        sx={{ bgcolor: tool === t ? alpha(theme.palette.primary.main, 0.2) : 'transparent', color: tool === t ? 'primary.main' : 'text.secondary' }}>
        {icon}
      </IconButton>
    </Tooltip>
  );

  const colors = tool === 'highlighter' ? HIGHLIGHT_COLORS : PEN_COLORS;
  const currentColor = tool === 'highlighter' ? hlColor : penColor;

  return (
    <Box sx={{ position: 'relative' }}>
      {active && (
        <Paper elevation={6} sx={{
          position: 'sticky', top: 80, zIndex: 3, mb: 1.5, px: 1, py: 0.5, borderRadius: 3,
          display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', width: 'fit-content',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.4)}`,
        }}>
          {toolBtn('pen', <Edit fontSize="small" />, 'Caneta')}
          {toolBtn('highlighter', <BorderColor fontSize="small" />, 'Marca-texto')}
          {toolBtn('eraser', <AutoFixNormal fontSize="small" />, 'Borracha')}
          {tool !== 'eraser' && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              {colors.map((c) => (
                <Box key={c} role="button" tabIndex={0} aria-label={`Cor ${c}`}
                  onClick={() => (tool === 'highlighter' ? setHlColor(c) : setPenColor(c))}
                  onKeyDown={(e) => { if (e.key === 'Enter') { if (tool === 'highlighter') setHlColor(c); else setPenColor(c); } }}
                  sx={{
                    width: 20, height: 20, borderRadius: '50%', bgcolor: c, cursor: 'pointer', mx: 0.25,
                    outline: currentColor === c ? `2px solid ${theme.palette.text.primary}` : 'none', outlineOffset: 2,
                  }} />
              ))}
            </>
          )}
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="Desfazer"><span>
            <IconButton size="small" onClick={undo} disabled={!count} aria-label="Desfazer"><Undo fontSize="small" /></IconButton>
          </span></Tooltip>
          <Tooltip title="Limpar tudo"><span>
            <IconButton size="small" onClick={clearAll} disabled={!count} aria-label="Limpar tudo"><DeleteSweep fontSize="small" /></IconButton>
          </span></Tooltip>
          <Tooltip title="Fechar caneta (voltar a clicar nas alternativas)">
            <IconButton size="small" onClick={onClose} aria-label="Fechar caneta"><Close fontSize="small" /></IconButton>
          </Tooltip>
        </Paper>
      )}

      <Box ref={wrapRef} sx={{ position: 'relative' }}>
        {children}
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: 'absolute', inset: 0, width: size.w, height: size.h, zIndex: 2,
            // Desligada: os cliques passam para as alternativas; ligada: captura caneta/mouse
            pointerEvents: active ? 'auto' : 'none',
            touchAction: active ? 'none' : 'auto',
            cursor: active ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
            outline: active ? `2px dashed ${alpha(theme.palette.primary.main, 0.45)}` : 'none',
            outlineOffset: 6,
            borderRadius: 8,
          }}
        />
      </Box>
    </Box>
  );
}
