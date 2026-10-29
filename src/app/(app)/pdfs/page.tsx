'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, Button, Chip,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  alpha, useTheme, CircularProgress, LinearProgress, Tooltip,
  FormControl, InputLabel, Select, MenuItem, TextField, ToggleButtonGroup,
  ToggleButton, Paper, Divider, List, ListItem, ListItemButton,
  ListItemIcon, ListItemText, InputAdornment,
} from '@mui/material';
import {
  Add, Delete, PictureAsPdf, OpenInFull, Close, Create,
  AutoFixNormal, Undo, DeleteSweep, FitScreen, Highlight,
  Folder, FolderOpen, CreateNewFolder, ArrowBack, Search,
  DriveFileMove, FolderSpecial,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pdfApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
dayjs.locale('pt-br');

const PEN_COLORS = ['#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#F2B705', '#EC4899', '#000000'];
const HIGHLIGHTER_COLORS = ['rgba(255,235,59,0.5)', 'rgba(76,175,80,0.4)', 'rgba(33,150,243,0.4)', 'rgba(244,67,54,0.4)'];
const FOLDERS_KEY = 'aprova-ai-pdf-folders';

type Tool = 'pen' | 'highlighter' | 'eraser' | 'select';
type Stroke = { points: {x: number; y: number}[]; color: string; width: number; tool: Tool };
type PdfFolder = { id: string; name: string; pdfIds: string[] };

// ─── Folder helpers ──────────────────────────────────────────────────────────

function getFolders(): PdfFolder[] {
  try { return JSON.parse(localStorage.getItem(FOLDERS_KEY) || '[]'); } catch { return []; }
}
function saveFolders(folders: PdfFolder[]) {
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
}

export default function PdfsPage() {
  const theme = useTheme();
  const qc = useQueryClient();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ title: '', subjectId: '', folderId: '' });

  // Folder state
  const [folders, setFolders] = useState<PdfFolder[]>(getFolders);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [moveDialogPdf, setMoveDialogPdf] = useState<any>(null);
  const [search, setSearch] = useState('');

  // Study mode
  const [studyPdf, setStudyPdf] = useState<any>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  // Drawing
  const [tool, setTool] = useState<Tool>('select');
  const [penColor, setPenColor] = useState('#EF4444');
  const [penWidth, setPenWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [undoStack, setUndoStack] = useState<Stroke[][]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getAnnotationKey = (id: string) => `pdf_annotations_${id}`;
  const loadAnnotations = (id: string): Stroke[] => {
    try { return JSON.parse(localStorage.getItem(getAnnotationKey(id)) || '[]'); } catch { return []; }
  };
  const saveAnnotations = (id: string, s: Stroke[]) => {
    localStorage.setItem(getAnnotationKey(id), JSON.stringify(s));
  };

  const { data: pdfs = [], isLoading } = useQuery({
    queryKey: ['pdfs'],
    queryFn: () => pdfApi.getAll().then(r => r.data.data || []),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-simple'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Nenhum arquivo');
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', uploadForm.title || file.name);
      if (uploadForm.subjectId) fd.append('subjectId', uploadForm.subjectId);
      return pdfApi.upload(fd);
    },
    onSuccess: (res) => {
      const newPdf = res.data.data;
      if (uploadForm.folderId && newPdf?.id) {
        const updated = folders.map(f =>
          f.id === uploadForm.folderId ? { ...f, pdfIds: [...f.pdfIds, newPdf.id] } : f
        );
        setFolders(updated);
        saveFolders(updated);
      }
      qc.invalidateQueries({ queryKey: ['pdfs'] });
      setUploadOpen(false);
      setFile(null);
      setUploadForm({ title: '', subjectId: '', folderId: '' });
      toast.success('PDF enviado com sucesso!');
    },
    onError: () => toast.error('Erro ao enviar PDF'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pdfApi.delete(id),
    onSuccess: (_, id) => {
      // Remove from all folders
      const updated = folders.map(f => ({ ...f, pdfIds: f.pdfIds.filter(pid => pid !== id) }));
      setFolders(updated);
      saveFolders(updated);
      qc.invalidateQueries({ queryKey: ['pdfs'] });
      toast.success('PDF removido');
    },
  });

  // Open study mode — fetch PDF as blob (avoids CORS/iframe issues)
  const openStudy = async (pdf: any) => {
    setStudyPdf(pdf);
    setPdfLoading(true);
    setPdfBlobUrl(null);
    const saved = loadAnnotations(pdf.id);
    setStrokes(saved);
    setUndoStack([]);
    try {
      const res = await pdfApi.getFileBlob(pdf.id);
      const url = URL.createObjectURL(res.data);
      setPdfBlobUrl(url);
    } catch {
      toast.error('Não foi possível carregar o PDF. Verifique se o backend está rodando.');
    } finally {
      setPdfLoading(false);
    }
  };

  const closeStudy = () => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
    setPdfBlobUrl(null);
    setStudyPdf(null);
  };

  // Folder management
  const createFolder = () => {
    if (!newFolderName.trim()) return;
    const folder: PdfFolder = { id: crypto.randomUUID(), name: newFolderName.trim(), pdfIds: [] };
    const updated = [...folders, folder];
    setFolders(updated);
    saveFolders(updated);
    setNewFolderName('');
    setNewFolderOpen(false);
    toast.success(`Pasta "${folder.name}" criada!`);
  };

  const deleteFolder = (folderId: string) => {
    const updated = folders.filter(f => f.id !== folderId);
    setFolders(updated);
    saveFolders(updated);
    if (activeFolderId === folderId) setActiveFolderId(null);
  };

  const movePdfToFolder = (pdfId: string, targetFolderId: string | null) => {
    const updated = folders.map(f => ({
      ...f,
      pdfIds: f.id === targetFolderId
        ? f.pdfIds.includes(pdfId) ? f.pdfIds : [...f.pdfIds, pdfId]
        : f.pdfIds.filter(id => id !== pdfId),
    }));
    setFolders(updated);
    saveFolders(updated);
    setMoveDialogPdf(null);
    toast.success('PDF movido!');
  };

  // Filtered PDFs
  const displayedPdfs = useMemo(() => {
    let list = pdfs as any[];
    if (activeFolderId) {
      const folder = folders.find(f => f.id === activeFolderId);
      list = list.filter(p => folder?.pdfIds.includes(p.id));
    } else if (folders.length > 0) {
      // "Sem pasta" view — all PDFs not in any folder
      const allFolderPdfIds = folders.flatMap(f => f.pdfIds);
      // When no folder selected, show ALL (not filtered) — user can navigate into folders
    }
    if (search.trim()) {
      list = list.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
    }
    return list;
  }, [pdfs, activeFolderId, folders, search]);

  // ─── Canvas Drawing ────────────────────────────────────────────────────────

  const getCanvasPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const redrawCanvas = useCallback((strokeList: Stroke[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokeList.forEach(stroke => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = stroke.tool === 'highlighter' ? 0.45 : 1;
      if (stroke.tool === 'highlighter') ctx.lineWidth = stroke.width * 4;
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }, []);

  useEffect(() => { redrawCanvas(strokes); }, [strokes, redrawCanvas]);

  const onMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (tool === 'select') return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    setIsDrawing(true);
    setCurrentStroke({ points: [point], color: penColor, width: penWidth, tool });
  }, [tool, penColor, penWidth, getCanvasPoint]);

  const onMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    const updated = { ...currentStroke, points: [...currentStroke.points, point] };
    setCurrentStroke(updated);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    redrawCanvas(strokes);
    if (updated.points.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = updated.color;
      ctx.lineWidth = updated.tool === 'highlighter' ? updated.width * 4 : updated.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = updated.tool === 'highlighter' ? 0.45 : 1;
      if (updated.tool === 'eraser') { ctx.globalCompositeOperation = 'destination-out'; ctx.lineWidth = penWidth * 6; }
      ctx.moveTo(updated.points[0].x, updated.points[0].y);
      updated.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  }, [isDrawing, currentStroke, strokes, penWidth, getCanvasPoint, redrawCanvas]);

  const onMouseUp = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    setIsDrawing(false);
    if (currentStroke.tool === 'eraser') {
      const eraserPoints = currentStroke.points;
      const filtered = strokes.filter(s =>
        !s.points.some(p => eraserPoints.some(ep => Math.hypot(ep.x - p.x, ep.y - p.y) < penWidth * 6))
      );
      setUndoStack(prev => [...prev, strokes]);
      setStrokes(filtered);
      if (studyPdf) saveAnnotations(studyPdf.id, filtered);
    } else {
      const newStrokes = [...strokes, currentStroke];
      setUndoStack(prev => [...prev, strokes]);
      setStrokes(newStrokes);
      if (studyPdf) saveAnnotations(studyPdf.id, newStrokes);
    }
    setCurrentStroke(null);
  }, [isDrawing, currentStroke, strokes, penWidth, studyPdf]);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setStrokes(prev);
    if (studyPdf) saveAnnotations(studyPdf.id, prev);
    redrawCanvas(prev);
  }, [undoStack, studyPdf, redrawCanvas]);

  const clearAll = useCallback(() => {
    setUndoStack(prev => [...prev, strokes]);
    setStrokes([]);
    if (studyPdf) saveAnnotations(studyPdf.id, []);
    redrawCanvas([]);
  }, [strokes, studyPdf, redrawCanvas]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>;

  // ─── STUDY MODE ─────────────────────────────────────────────────────────────
  if (studyPdf) {
    return (
      <Box sx={{ height: 'calc(100vh - 64px - 48px)', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <Paper elevation={0} sx={{
          p: 1, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`, borderRadius: 3,
        }}>
          <Tooltip title="Voltar à biblioteca">
            <IconButton size="small" onClick={closeStudy}><ArrowBack /></IconButton>
          </Tooltip>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: 200 }}>
            {studyPdf.title}
          </Typography>
          {studyPdf.subject && (
            <Chip label={studyPdf.subject.name} size="small"
              sx={{ bgcolor: alpha(studyPdf.subject.color || '#888', 0.1), color: studyPdf.subject.color, height: 20, fontSize: 10 }} />
          )}
          <Box sx={{ flexGrow: 1 }} />

          <ToggleButtonGroup value={tool} exclusive size="small" onChange={(_, v) => v && setTool(v)}>
            <Tooltip title="Mover/Rolar">
              <ToggleButton value="select" sx={{ px: 1.5 }}><FitScreen fontSize="small" /></ToggleButton>
            </Tooltip>
            <Tooltip title="Caneta">
              <ToggleButton value="pen" sx={{ px: 1.5 }}><Create fontSize="small" /></ToggleButton>
            </Tooltip>
            <Tooltip title="Marcador">
              <ToggleButton value="highlighter" sx={{ px: 1.5 }}><Highlight fontSize="small" /></ToggleButton>
            </Tooltip>
            <Tooltip title="Borracha">
              <ToggleButton value="eraser" sx={{ px: 1.5 }}><AutoFixNormal fontSize="small" /></ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

          {(tool === 'pen' || tool === 'highlighter') && (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {(tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS).map(c => (
                <Box key={c} onClick={() => setPenColor(c)} sx={{
                  width: 20, height: 20, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                  border: penColor === c ? `3px solid ${theme.palette.primary.main}` : '2px solid transparent',
                  flexShrink: 0, '&:hover': { transform: 'scale(1.2)' }, transition: 'transform 0.1s',
                }} />
              ))}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5 }}>
                <Typography variant="caption" color="text.secondary">Esp:</Typography>
                {[1, 3, 5, 8].map(w => (
                  <Box key={w} onClick={() => setPenWidth(w)} sx={{
                    width: w + 8, height: w + 8, borderRadius: '50%',
                    bgcolor: penWidth === w ? theme.palette.primary.main : theme.palette.divider,
                    cursor: 'pointer',
                  }} />
                ))}
              </Box>
            </Box>
          )}

          <Tooltip title="Desfazer (Ctrl+Z)">
            <span><IconButton size="small" onClick={undo} disabled={undoStack.length === 0}><Undo /></IconButton></span>
          </Tooltip>
          <Tooltip title="Limpar todas as anotações">
            <IconButton size="small" color="error" onClick={clearAll}><DeleteSweep /></IconButton>
          </Tooltip>

          {strokes.length > 0 && (
            <Chip label={`✏️ ${strokes.length}`} size="small" color="primary" variant="outlined"
              sx={{ height: 20, fontSize: 10 }} />
          )}
        </Paper>

        {/* PDF + Canvas overlay */}
        <Box ref={containerRef} sx={{
          flexGrow: 1, position: 'relative', borderRadius: 2, overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          bgcolor: '#f5f5f5',
        }}>
          {pdfLoading && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2, zIndex: 10 }}>
              <CircularProgress size={40} />
              <Typography variant="body2" color="text.secondary">Carregando PDF...</Typography>
            </Box>
          )}

          {pdfBlobUrl && (
            <Box
              component="embed"
              src={pdfBlobUrl}
              type="application/pdf"
              sx={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                border: 'none',
                pointerEvents: tool === 'select' ? 'auto' : 'none',
              }}
            />
          )}

          {!pdfLoading && !pdfBlobUrl && (
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <PictureAsPdf sx={{ fontSize: 64, color: 'text.disabled' }} />
              <Typography color="text.secondary">Não foi possível carregar o PDF.</Typography>
              <Typography variant="caption" color="text.disabled">
                Verifique se o servidor backend está rodando na porta 3001.
              </Typography>
              <Button variant="outlined" onClick={() => openStudy(studyPdf)}>Tentar novamente</Button>
            </Box>
          )}

          {/* Canvas de anotação */}
          <canvas
            ref={canvasRef}
            width={1600}
            height={2200}
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              pointerEvents: tool === 'select' ? 'none' : 'auto',
              cursor: tool === 'pen' ? 'crosshair' :
                      tool === 'highlighter' ? 'cell' :
                      tool === 'eraser' ? 'not-allowed' : 'default',
              touchAction: 'none',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onMouseDown}
            onTouchMove={onMouseMove}
            onTouchEnd={onMouseUp}
          />

          {tool !== 'select' && (
            <Paper sx={{
              position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
              px: 2, py: 0.75, borderRadius: 3, opacity: 0.9, pointerEvents: 'none',
            }}>
              <Typography variant="caption" color="text.secondary">
                {tool === 'pen' ? '✏️ Caneta ativa' :
                 tool === 'highlighter' ? '🖊️ Marcador ativo' :
                 '🗑️ Borracha ativa'}
                &nbsp;·&nbsp;Clique em <strong>Mover</strong> para rolar o PDF
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>
    );
  }

  // ─── LIBRARY VIEW ────────────────────────────────────────────────────────────
  const activeFolder = folders.find(f => f.id === activeFolderId);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>PDFs de Estudo</Typography>
          <Typography color="text.secondary" variant="body2">
            {(pdfs as any[]).length} documentos · {folders.length} pastas
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<CreateNewFolder />} onClick={() => setNewFolderOpen(true)}>
            Nova Pasta
          </Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setUploadOpen(true)}>
            Enviar PDF
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2}>
        {/* ─── Sidebar: Pastas ─── */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ p: '12px !important' }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1 }}>
                Pastas
              </Typography>
              <List dense disablePadding>
                <ListItem disablePadding>
                  <ListItemButton selected={activeFolderId === null}
                    onClick={() => setActiveFolderId(null)}
                    sx={{ borderRadius: 1.5, mb: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <FolderSpecial fontSize="small" sx={{ color: theme.palette.primary.main }} />
                    </ListItemIcon>
                    <ListItemText primary="Todos os PDFs"
                      primaryTypographyProps={{ fontSize: 13, fontWeight: activeFolderId === null ? 700 : 400 }} />
                    <Chip label={(pdfs as any[]).length} size="small"
                      sx={{ height: 18, fontSize: 10, minWidth: 28 }} />
                  </ListItemButton>
                </ListItem>

                {folders.map(folder => {
                  const count = (pdfs as any[]).filter(p => folder.pdfIds.includes(p.id)).length;
                  return (
                    <ListItem key={folder.id} disablePadding
                      secondaryAction={
                        <IconButton edge="end" size="small" color="error"
                          onClick={() => deleteFolder(folder.id)}>
                          <Delete sx={{ fontSize: 14 }} />
                        </IconButton>
                      }>
                      <ListItemButton selected={activeFolderId === folder.id}
                        onClick={() => setActiveFolderId(folder.id)}
                        sx={{ borderRadius: 1.5, mb: 0.25, pr: 4 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          {activeFolderId === folder.id
                            ? <FolderOpen fontSize="small" sx={{ color: '#F59E0B' }} />
                            : <Folder fontSize="small" sx={{ color: '#F59E0B' }} />}
                        </ListItemIcon>
                        <ListItemText primary={folder.name}
                          primaryTypographyProps={{ fontSize: 13, fontWeight: activeFolderId === folder.id ? 700 : 400 }} />
                        <Chip label={count} size="small"
                          sx={{ height: 18, fontSize: 10, minWidth: 24 }} />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* ─── Main: PDFs ─── */}
        <Grid size={{ xs: 12, md: 9 }}>
          {/* Breadcrumb + Search */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            {activeFolderId && (
              <>
                <IconButton size="small" onClick={() => setActiveFolderId(null)}>
                  <ArrowBack fontSize="small" />
                </IconButton>
                <Chip icon={<Folder fontSize="small" />} label={activeFolder?.name}
                  sx={{ bgcolor: alpha('#F59E0B', 0.15), color: '#F59E0B', fontWeight: 700 }} />
                <Box sx={{ flexGrow: 1 }} />
              </>
            )}
            <TextField size="small" placeholder="Buscar PDF..." value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ ml: activeFolderId ? 0 : 'auto', width: 240 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
          </Box>

          {displayedPdfs.length === 0 ? (
            <Card><CardContent sx={{ textAlign: 'center', py: 8 }}>
              <PictureAsPdf sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6">
                {activeFolderId ? 'Pasta vazia' : search ? 'Nenhum PDF encontrado' : 'Nenhum PDF ainda'}
              </Typography>
              <Typography color="text.secondary" mb={2}>
                {activeFolderId
                  ? 'Envie um PDF e mova-o para esta pasta'
                  : 'Envie apostilas, editais e materiais para estudar com caneta digital'}
              </Typography>
              <Button variant="contained" startIcon={<Add />} onClick={() => setUploadOpen(true)}>
                Enviar PDF
              </Button>
            </CardContent></Card>
          ) : (
            <Grid container spacing={2}>
              {displayedPdfs.map((pdf: any) => {
                const annotationCount = loadAnnotations(pdf.id).length;
                const inFolders = folders.filter(f => f.pdfIds.includes(pdf.id));
                return (
                  <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={pdf.id}>
                    <Card sx={{
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: `0 8px 24px ${alpha('#EF4444', 0.15)}` },
                    }}>
                      <Box sx={{
                        height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: `linear-gradient(135deg, ${alpha('#EF4444', 0.08)}, ${alpha('#F59E0B', 0.08)})`,
                        borderRadius: '16px 16px 0 0', position: 'relative',
                      }}>
                        <PictureAsPdf sx={{ fontSize: 52, color: '#EF4444', opacity: 0.7 }} />
                        <Box sx={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 0.5 }}>
                          {annotationCount > 0 && (
                            <Chip label={`✏️ ${annotationCount}`} size="small"
                              sx={{ bgcolor: alpha('#000', 0.5), color: '#fff', height: 18, fontSize: 9 }} />
                          )}
                        </Box>
                        {inFolders.length > 0 && (
                          <Box sx={{ position: 'absolute', bottom: 6, left: 8, display: 'flex', gap: 0.5 }}>
                            {inFolders.map(f => (
                              <Chip key={f.id} icon={<Folder sx={{ fontSize: '10px !important' }} />}
                                label={f.name} size="small"
                                sx={{ bgcolor: alpha('#F59E0B', 0.85), color: '#000', height: 16, fontSize: 9,
                                  '& .MuiChip-icon': { ml: '4px' } }} />
                            ))}
                          </Box>
                        )}
                      </Box>

                      <CardContent sx={{ pb: '8px !important' }}>
                        <Typography fontWeight={700} noWrap fontSize={14}>{pdf.title}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {(pdf.size / 1024 / 1024).toFixed(1)} MB · {dayjs(pdf.createdAt).format('DD/MM/YYYY')}
                        </Typography>
                        {pdf.subject && (
                          <Box sx={{ mt: 0.5 }}>
                            <Chip label={pdf.subject.name} size="small"
                              sx={{ height: 16, fontSize: 9, bgcolor: alpha(pdf.subject.color || '#888', 0.1), color: pdf.subject.color }} />
                          </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                          <Button fullWidth variant="outlined" startIcon={<OpenInFull />}
                            onClick={() => openStudy(pdf)} size="small" sx={{ fontSize: 12 }}>
                            Estudar
                          </Button>
                          <Tooltip title="Mover para pasta">
                            <IconButton size="small" onClick={() => setMoveDialogPdf(pdf)}>
                              <DriveFileMove fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remover">
                            <IconButton size="small" color="error"
                              onClick={() => deleteMutation.mutate(pdf.id)}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Grid>
      </Grid>

      {/* Dialog: Upload */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Enviar PDF</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <Button component="label" variant="outlined" fullWidth
            sx={{ py: 3, border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': { border: `2px dashed ${theme.palette.primary.main}` } }}>
            <Box sx={{ textAlign: 'center' }}>
              <PictureAsPdf sx={{ fontSize: 36, color: '#EF4444', mb: 0.5 }} />
              <Typography variant="body2">
                {file ? `✅ ${file.name}` : 'Clique para selecionar PDF'}
              </Typography>
              {file && <Typography variant="caption" color="text.secondary">{(file.size / 1024 / 1024).toFixed(1)} MB</Typography>}
            </Box>
            <input hidden type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} />
          </Button>

          <TextField label="Título (opcional)" value={uploadForm.title}
            onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Deixe em branco para usar nome do arquivo" size="small" />

          <FormControl size="small">
            <InputLabel>Disciplina (opcional)</InputLabel>
            <Select value={uploadForm.subjectId} label="Disciplina (opcional)"
              onChange={e => setUploadForm(f => ({ ...f, subjectId: e.target.value }))}>
              <MenuItem value="">Nenhuma</MenuItem>
              {(subjects as any[]).map((s: any) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>

          {folders.length > 0 && (
            <FormControl size="small">
              <InputLabel>Salvar na pasta (opcional)</InputLabel>
              <Select value={uploadForm.folderId} label="Salvar na pasta (opcional)"
                onChange={e => setUploadForm(f => ({ ...f, folderId: e.target.value }))}>
                <MenuItem value="">Sem pasta</MenuItem>
                {folders.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setUploadOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => uploadMutation.mutate()}
            disabled={!file || uploadMutation.isPending}>
            {uploadMutation.isPending ? 'Enviando...' : 'Enviar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Nova Pasta */}
      <Dialog open={newFolderOpen} onClose={() => setNewFolderOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Nova Pasta</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth label="Nome da pasta" value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createFolder()}
            autoFocus placeholder="Ex: Direito Constitucional, Editais..." />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNewFolderOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={createFolder} disabled={!newFolderName.trim()}>Criar</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Mover PDF */}
      <Dialog open={Boolean(moveDialogPdf)} onClose={() => setMoveDialogPdf(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={700}>Mover PDF para Pasta</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {moveDialogPdf && (
            <Typography variant="body2" color="text.secondary" mb={1}>{moveDialogPdf.title}</Typography>
          )}
          <List dense>
            <ListItem disablePadding>
              <ListItemButton onClick={() => moveDialogPdf && movePdfToFolder(moveDialogPdf.id, null)}>
                <ListItemIcon><FolderSpecial fontSize="small" color="primary" /></ListItemIcon>
                <ListItemText primary="Sem pasta (raiz)" />
              </ListItemButton>
            </ListItem>
            {folders.map(f => (
              <ListItem key={f.id} disablePadding>
                <ListItemButton onClick={() => moveDialogPdf && movePdfToFolder(moveDialogPdf.id, f.id)}>
                  <ListItemIcon><Folder fontSize="small" sx={{ color: '#F59E0B' }} /></ListItemIcon>
                  <ListItemText primary={f.name} />
                  {moveDialogPdf && f.pdfIds.includes(moveDialogPdf.id) && (
                    <Chip label="atual" size="small" sx={{ height: 16, fontSize: 9 }} />
                  )}
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          {folders.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" py={2}>
              Nenhuma pasta criada ainda. Crie uma pasta primeiro.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMoveDialogPdf(null)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
