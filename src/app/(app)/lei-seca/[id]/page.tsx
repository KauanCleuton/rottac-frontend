'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, TextField, InputAdornment, FormControlLabel, Switch, Skeleton,
  Alert, Drawer, IconButton, Tooltip, Paper, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  List, ListItemButton, ListItemText, Divider, alpha, useTheme,
} from '@mui/material';
import {
  Gavel, ArrowBack, Search, QuestionAnswer, Close, NoteAlt, FormatColorReset, LinkOff, AddLink,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { lawApi, questionBankApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import QuestionCard from '@/components/questions/QuestionCard';
import type { BankQuestion } from '@/components/questions/types';
import { normalize } from '@/hooks/useAssuntos';

type Mark = { start: number; end: number; color: string };
type Article = { id: string; number: string; heading: string | null; text: string; position: number; questionCount: number };
type Law = {
  id: string; title: string; shortName: string; description: string | null; isPublished: boolean;
  articles: Article[]; highlights: Record<string, { marks: Mark[]; note: string | null }>;
};

const COLORS: Record<string, string> = { amarelo: '#FACC15', verde: '#4ADE80', azul: '#60A5FA', rosa: '#F472B6' };
const COLOR_LABEL: Record<string, string> = { amarelo: 'Amarelo', verde: 'Verde', azul: 'Azul', rosa: 'Rosa' };
const PREFIX = /^Art\.?\s*[\d.]+\s*[º°o]?(?:\s*-\s*[A-Z]{1,2})?\s*[.\-–—]?/i;

// Aplica (ou apaga, color = null) uma marcação no trecho; as marcações nunca se sobrepõem
function applyMark(marks: Mark[], start: number, end: number, color: string | null): Mark[] {
  const out: Mark[] = [];
  for (const m of marks) {
    if (m.end <= start || m.start >= end) { out.push(m); continue; }
    if (m.start < start) out.push({ ...m, end: start });
    if (m.end > end) out.push({ ...m, start: end });
  }
  if (color) out.push({ start, end, color });
  out.sort((a, b) => a.start - b.start);
  // Junta vizinhas da mesma cor
  return out.reduce<Mark[]>((acc, m) => {
    const last = acc[acc.length - 1];
    if (last && last.color === m.color && last.end >= m.start) last.end = Math.max(last.end, m.end);
    else acc.push({ ...m });
    return acc;
  }, []);
}

// Texto do artigo com "Art. Nº" em negrito e as marcações; só texto puro, para os deslocamentos baterem
function ArticleText({ text, marks, dark }: { text: string; marks: Mark[]; dark: boolean }) {
  const prefixEnd = text.match(PREFIX)?.[0].length ?? 0;
  const cuts = new Set([0, text.length, prefixEnd]);
  for (const m of marks) { cuts.add(m.start); cuts.add(m.end); }
  const points = [...cuts].filter((p) => p >= 0 && p <= text.length).sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b] = [points[i], points[i + 1]];
    if (a === b) continue;
    const m = marks.find((x) => x.start <= a && x.end >= b);
    const bold = b <= prefixEnd;
    const style: React.CSSProperties = {};
    if (m) { style.backgroundColor = alpha(COLORS[m.color] || COLORS.amarelo, dark ? 0.35 : 0.5); style.borderRadius = 2; }
    if (bold) style.fontWeight = 800;
    parts.push(<span key={a} style={style}>{text.slice(a, b)}</span>);
  }
  return <>{parts}</>;
}

function QuestionsDrawer({ law, article, onClose, onChanged }: { law: Law; article: Article; onClose: () => void; onChanged: () => void }) {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const qc = useQueryClient();
  const key = ['law-article-questions', article.id];
  const [search, setSearch] = useState('');
  const { data = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => lawApi.articleQuestions(law.id, article.id).then((r) => r.data.data as (BankQuestion & { linkAuto: boolean })[]),
  });
  const { data: found = [], isFetching: searching } = useQuery({
    queryKey: ['law-link-search', search],
    queryFn: () => questionBankApi.list({ search, limit: 8, scope: 'public' }).then((r) => (r.data.data.questions || r.data.data.items) as BankQuestion[]),
    enabled: isAdmin && search.trim().length >= 3,
  });
  const linked = new Set(data.map((q) => q.id));

  const link = async (questionId: string, add: boolean) => {
    try {
      if (add) await lawApi.linkQuestion(law.id, article.id, questionId);
      else await lawApi.unlinkQuestion(law.id, article.id, questionId);
      qc.invalidateQueries({ queryKey: key });
      onChanged();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro');
    }
  };

  return (
    <Drawer anchor="right" open onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 760 }, p: { xs: 1.5, sm: 2.5 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight={800}>Art. {article.number} · {law.shortName}</Typography>
          <Typography variant="body2" color="text.secondary">{isLoading ? 'Carregando…' : `${data.length} questão(ões) cobraram este artigo`}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Fechar"><Close /></IconButton>
      </Box>
      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, maxHeight: 160, overflowY: 'auto', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6 }}>
        {article.text}
      </Paper>

      {isAdmin && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Typography variant="overline" color="text.secondary">Vincular questão a este artigo</Typography>
            <TextField fullWidth size="small" placeholder="Buscar no enunciado (mín. 3 letras)" value={search} onChange={(e) => setSearch(e.target.value)}
              InputProps={{ endAdornment: searching ? <CircularProgress size={16} /> : null }} />
            {search.trim().length >= 3 && (
              <List dense disablePadding sx={{ mt: 1 }}>
                {found.map((q) => (
                  <ListItemButton key={q.id} disabled={linked.has(q.id)} onClick={() => link(q.id, true)} sx={{ borderRadius: 1 }}>
                    <AddLink fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
                    <ListItemText primary={q.statement.replace(/[*_=[\]]/g, '').slice(0, 140)} secondary={[q.banca, q.year].filter(Boolean).join(' ')}
                      primaryTypographyProps={{ fontSize: 13 }} />
                  </ListItemButton>
                ))}
                {!found.length && !searching && <Typography variant="caption" color="text.secondary">Nada encontrado.</Typography>}
              </List>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? <Skeleton variant="rounded" height={240} /> : !data.length ? (
        <Alert severity="info">Ainda não há questões ligadas a este artigo.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.map((q, i) => (
            <Box key={q.id}>
              {isAdmin && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{q.linkAuto ? 'vinculada automaticamente' : 'vinculada manualmente'}</Typography>
                  <Button size="small" color="inherit" startIcon={<LinkOff fontSize="small" />} onClick={() => link(q.id, false)}>Desvincular</Button>
                </Box>
              )}
              <QuestionCard question={q} index={i + 1} />
            </Box>
          ))}
        </Box>
      )}
    </Drawer>
  );
}

export default function LawReaderPage() {
  const { id } = useParams<{ id: string }>();
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const qc = useQueryClient();
  const key = ['law', id];
  const [query, setQuery] = useState('');
  const [onlyWithQuestions, setOnlyWithQuestions] = useState(false);
  const [onlyMarked, setOnlyMarked] = useState(false);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [noteFor, setNoteFor] = useState<{ article: Article; value: string } | null>(null);
  const [sel, setSel] = useState<{ articleId: string; start: number; end: number; x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: law, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => lawApi.get(id).then((r) => r.data.data as Law),
  });

  // Seleção de texto dentro de um artigo -> barra de cores flutuante
  useEffect(() => {
    const read = () => {
      const s = window.getSelection();
      if (!s || s.isCollapsed || !s.rangeCount) { setSel(null); return; }
      const range = s.getRangeAt(0);
      const host = (n: Node) => (n.nodeType === 3 ? n.parentElement : (n as Element))?.closest('[data-art-text]');
      const a = host(range.startContainer);
      if (!a || a !== host(range.endContainer)) { setSel(null); return; }
      const pre = document.createRange();
      pre.selectNodeContents(a);
      pre.setEnd(range.startContainer, range.startOffset);
      const start = pre.toString().length;
      const end = start + range.toString().length;
      if (end <= start) { setSel(null); return; }
      const rect = range.getBoundingClientRect();
      setSel({ articleId: a.getAttribute('data-art-text')!, start, end, x: rect.left + rect.width / 2, y: rect.top });
    };
    const onChange = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(read, 120); };
    const onScroll = () => setSel(null);
    document.addEventListener('selectionchange', onChange);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('selectionchange', onChange);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  const save = async (articleId: string, marks: Mark[], note: string | null) => {
    const prev = qc.getQueryData<Law>(key);
    qc.setQueryData<Law>(key, (d) => d && ({ ...d, highlights: { ...d.highlights, [articleId]: { marks, note } } }));
    try {
      await lawApi.saveHighlight(id, articleId, { marks, note });
    } catch (e: any) {
      if (prev) qc.setQueryData(key, prev);
      toast.error(e.response?.data?.message || 'Erro ao salvar marcação');
    }
  };

  const paint = (color: string | null) => {
    if (!sel || !law) return;
    const h = law.highlights[sel.articleId];
    save(sel.articleId, applyMark(h?.marks || [], sel.start, sel.end, color), h?.note ?? null);
    window.getSelection()?.removeAllRanges();
    setSel(null);
  };

  const articles = useMemo(() => {
    if (!law) return [];
    const q = normalize(query.trim());
    const isNumber = /^\d/.test(q);
    return law.articles.filter((a) => {
      if (onlyWithQuestions && !a.questionCount) return false;
      if (onlyMarked && !law.highlights[a.id]) return false;
      if (!q) return true;
      if (isNumber) return a.number === q.replace(/[^\da-z-]/g, '').toUpperCase(); // "37", "121-a"
      return q.length < 3 || normalize(a.text).includes(q);
    });
  }, [law, query, onlyWithQuestions, onlyMarked]);

  // Sumário: cada título/capítulo com o primeiro artigo dele
  const toc = useMemo(() => {
    const out: { heading: string; articleId: string; count: number }[] = [];
    for (const a of law?.articles || []) {
      const h = a.heading || 'Disposições iniciais';
      const last = out[out.length - 1];
      if (last?.heading === h) last.count += a.questionCount;
      else out.push({ heading: h, articleId: a.id, count: a.questionCount });
    }
    return out;
  }, [law]);

  const goTo = (articleId: string) => {
    setQuery(''); setOnlyWithQuestions(false); setOnlyMarked(false);
    requestAnimationFrame(() => document.getElementById(`art-${articleId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  if (isLoading) return <Box sx={{ maxWidth: 1200, mx: 'auto' }}><Skeleton height={60} /><Skeleton variant="rounded" height={500} /></Box>;
  if (error || !law) return <Alert severity="error">Lei não encontrada ou indisponível no seu plano.</Alert>;

  const totalQuestions = law.articles.reduce((s, a) => s + a.questionCount, 0);
  const marked = Object.keys(law.highlights).length;

  return (
    <Box sx={{ maxWidth: 1250, mx: 'auto' }}>
      <Button component={Link} href="/lei-seca" startIcon={<ArrowBack />} color="inherit" sx={{ mb: 1 }}>Todas as leis</Button>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Gavel sx={{ color: 'primary.main', fontSize: 32 }} /> {law.shortName}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {law.title} · {law.articles.length} artigos · {totalQuestions} questões vinculadas{marked ? ` · ${marked} artigo(s) marcados por você` : ''}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px minmax(0, 1fr)' }, gap: 3, alignItems: 'start' }}>
        {/* Barra lateral: busca, filtros e sumário */}
        <Box sx={{ position: { md: 'sticky' }, top: { md: 80 } }}>
          <Card>
            <CardContent sx={{ display: 'grid', gap: 1 }}>
              <TextField size="small" placeholder="Buscar ou nº do artigo" value={query} onChange={(e) => setQuery(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
              <FormControlLabel control={<Switch size="small" checked={onlyWithQuestions} onChange={(e) => setOnlyWithQuestions(e.target.checked)} />}
                label={<Typography variant="body2">Só artigos com questões</Typography>} />
              <FormControlLabel control={<Switch size="small" checked={onlyMarked} onChange={(e) => setOnlyMarked(e.target.checked)} />}
                label={<Typography variant="body2">Só o que eu marquei</Typography>} />
              <Typography variant="caption" color="text.secondary">Selecione um trecho do artigo para marcar com cor.</Typography>
            </CardContent>
            <Divider />
            <Box sx={{ maxHeight: { md: 'calc(100vh - 380px)' }, overflowY: 'auto', display: { xs: 'none', md: 'block' } }}>
              <List dense disablePadding>
                {toc.map((t) => (
                  <ListItemButton key={t.articleId} onClick={() => goTo(t.articleId)} sx={{ py: 0.5 }}>
                    <ListItemText primary={t.heading.split(' › ').at(-1)} secondary={t.count ? `${t.count} questões` : undefined}
                      primaryTypographyProps={{ fontSize: 12.5, lineHeight: 1.35 }} secondaryTypographyProps={{ fontSize: 11 }} />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          </Card>
        </Box>

        {/* Texto da lei */}
        <Card>
          <CardContent sx={{ p: { xs: 2, sm: 3.5 } }}>
            {!articles.length && <Alert severity="info">Nenhum artigo encontrado com esse filtro.</Alert>}
            {articles.map((a, i) => {
              const h = law.highlights[a.id];
              const newHeading = a.heading && a.heading !== articles[i - 1]?.heading;
              return (
                <Box key={a.id}>
                  {newHeading && (
                    <Box sx={{ textAlign: 'center', my: 3 }}>
                      {a.heading!.split(' › ').map((part, k, all) => (
                        <Typography key={k} variant={k === all.length - 1 ? 'subtitle1' : 'caption'} fontWeight={k === all.length - 1 ? 800 : 600}
                          color={k === all.length - 1 ? 'text.primary' : 'text.secondary'} sx={{ display: 'block', letterSpacing: 0.3 }}>
                          {part}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  <Box id={`art-${a.id}`} sx={{ scrollMarginTop: 90, py: 1.5, borderBottom: `1px dashed ${theme.palette.divider}` }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                      <Box data-art-text={a.id} sx={{ flexGrow: 1, minWidth: 0, whiteSpace: 'pre-wrap', fontSize: 15.5, lineHeight: 1.75, fontFamily: 'Georgia, "Times New Roman", serif' }}>
                        <ArticleText text={a.text} marks={h?.marks || []} dark={dark} />
                      </Box>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5, flexShrink: 0 }}>
                        {a.questionCount > 0 && (
                          <Button size="small" variant="contained" startIcon={<QuestionAnswer sx={{ fontSize: '16px !important' }} />}
                            onClick={() => setOpenArticle(a)} sx={{ px: 1.25, py: 0.25, fontSize: 12, whiteSpace: 'nowrap' }}>
                            {a.questionCount}
                          </Button>
                        )}
                        <Tooltip title={h?.note ? 'Editar anotação' : 'Anotar'}>
                          <IconButton size="small" onClick={() => setNoteFor({ article: a, value: h?.note || '' })} aria-label="Anotação do artigo"
                            sx={{ color: h?.note ? 'primary.main' : 'text.disabled' }}>
                            <NoteAlt fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                    {h?.note && (
                      <Box sx={{ mt: 1, p: 1.25, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.08), borderLeft: `3px solid ${theme.palette.primary.main}` }}>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{h.note}</Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      </Box>

      {/* Barra de cores sobre a seleção */}
      {sel && (
        <Paper elevation={8} onMouseDown={(e) => e.preventDefault()}
          sx={{
            position: 'fixed', zIndex: 1400, display: 'flex', gap: 0.5, p: 0.75, borderRadius: 5,
            top: Math.max(8, sel.y - 52), left: `clamp(8px, ${sel.x - 100}px, calc(100vw - 210px))`,
          }}>
          {Object.entries(COLORS).map(([name, c]) => (
            <Tooltip key={name} title={COLOR_LABEL[name]}>
              <IconButton size="small" onClick={() => paint(name)} aria-label={`Marcar em ${COLOR_LABEL[name]}`}>
                <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: c, border: `2px solid ${theme.palette.background.paper}`, boxShadow: `0 0 0 1px ${alpha(c, 0.8)}` }} />
              </IconButton>
            </Tooltip>
          ))}
          <Tooltip title="Apagar marcação">
            <IconButton size="small" onClick={() => paint(null)} aria-label="Apagar marcação"><FormatColorReset fontSize="small" /></IconButton>
          </Tooltip>
        </Paper>
      )}

      {openArticle && (
        <QuestionsDrawer law={law} article={openArticle} onClose={() => setOpenArticle(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: key })} />
      )}

      <Dialog open={Boolean(noteFor)} onClose={() => setNoteFor(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Anotação — Art. {noteFor?.article.number}</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth multiline minRows={4} sx={{ mt: 1 }} value={noteFor?.value || ''}
            onChange={(e) => setNoteFor((n) => n && { ...n, value: e.target.value })}
            placeholder="Ex.: a banca troca 'poderá' por 'deverá' neste inciso" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setNoteFor(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => {
            if (!noteFor) return;
            save(noteFor.article.id, law.highlights[noteFor.article.id]?.marks || [], noteFor.value.trim() || null);
            setNoteFor(null);
          }}>Salvar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
