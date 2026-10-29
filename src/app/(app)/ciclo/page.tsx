'use client';

import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Button, IconButton, Tooltip, LinearProgress, Skeleton, Alert, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel, Menu, ListItemIcon,
  CircularProgress, ToggleButtonGroup, ToggleButton, alpha, useTheme,
} from '@mui/material';
import {
  Loop, PlayArrow, Pause, Stop, SkipNext, Add, Edit, MoreVert, DeleteOutline, RestartAlt, EditCalendar, RemoveCircleOutline,
  SwapHoriz, ArrowUpward, ArrowDownward,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { cycleApi, studyEditalApi } from '@/lib/api';
import { useAssuntos } from '@/hooks/useAssuntos';
import AssuntoPicker from '@/components/questions/AssuntoPicker';
import ConfirmDialog from '@/components/common/ConfirmDialog';

type Item = { id: string; label: string; assuntoId: number | null; minutes: number; doneMinutes: number; position: number; color: string };
type Cycle = { id: string; name: string; isActive: boolean; round: number; items: Item[]; currentItemId: string | null; targetMinutes: number; doneMinutes: number; progress: number };
type Stats = {
  days: { day: string; minutes: number; byLabel: Record<string, number> }[];
  weeks: { week: string; minutes: number; byLabel: Record<string, number> }[];
  thisWeek: { label: string; minutes: number }[];
  todayMinutes: number; weekMinutes: number;
  recent: { id: string; label: string; minutes: number; startedAt: string }[];
};

// Paleta categórica (ordem fixa) — cada matéria fica com a cor da sua posição
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const OTHER = '#9CA3AF';
const LEVELS = [{ v: 0.75, l: 'Fácil para mim' }, { v: 1, l: 'Médio' }, { v: 1.5, l: 'Difícil para mim' }];
const TIMER_KEY = 'rotta-cycle-timer';

const hm = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m}min`;
};

// ─── Roda do ciclo (SVG): cada etapa é um arco proporcional à meta; o preenchido é o estudado na volta ───
function CycleWheel({ cycle, size = 220 }: { cycle: Cycle; size?: number }) {
  const theme = useTheme();
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  const gap = cycle.items.length > 1 ? 3 : 0;
  // Início de cada arco = soma das metas anteriores
  const starts = cycle.items.map((_, i) => cycle.items.slice(0, i).reduce((s, x) => s + (x.minutes / cycle.targetMinutes) * c, 0));
  return (
    <Box sx={{ position: 'relative', width: size, height: size, mx: 'auto' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }} role="img"
        aria-label={`Ciclo ${cycle.progress}% concluído nesta volta`}>
        {cycle.items.map((it, i) => {
          const len = (it.minutes / cycle.targetMinutes) * c;
          const seg = Math.max(0, len - gap);
          const done = Math.min(1, it.doneMinutes / it.minutes) * seg;
          const start = starts[i];
          const current = it.id === cycle.currentItemId;
          return (
            <g key={it.id}>
              <title>{`${it.label}: ${hm(Math.min(it.doneMinutes, it.minutes))} de ${hm(it.minutes)}`}</title>
              <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={alpha(it.color, 0.2)} strokeWidth={current ? 22 : 16}
                strokeDasharray={`${seg} ${c - seg}`} strokeDashoffset={-start} />
              {done > 0 && (
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={it.color} strokeWidth={current ? 22 : 16}
                  strokeDasharray={`${done} ${c - done}`} strokeDashoffset={-start} />
              )}
            </g>
          );
        })}
      </svg>
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h4" fontWeight={900}>{cycle.progress}%</Typography>
        <Typography variant="caption" color="text.secondary">volta {cycle.round}</Typography>
        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>{hm(cycle.doneMinutes)} de {hm(cycle.targetMinutes)}</Typography>
      </Box>
    </Box>
  );
}

// ─── Cronômetro (horas líquidas): sobrevive a recarregar a página ───
type TimerState = { itemId: string; startedAt: number; accumulated: number; runningSince: number | null };
const readTimer = (): TimerState | null => {
  try { return JSON.parse(localStorage.getItem(TIMER_KEY) || 'null'); } catch { return null; }
};
const writeTimer = (t: TimerState | null) => {
  try { if (t) localStorage.setItem(TIMER_KEY, JSON.stringify(t)); else localStorage.removeItem(TIMER_KEY); } catch { /* sem armazenamento */ }
};

function StageTimer({ cycle, item, onLogged }: { cycle: Cycle; item: Item; onLogged: (newRound: boolean) => void }) {
  const theme = useTheme();
  const [t, setT] = useState<TimerState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);

  // Retoma o cronômetro salvo (mesmo se outra etapa ficou aberta)
  useEffect(() => { setT(readTimer()); }, []);
  useEffect(() => {
    if (!t?.runningSince) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [t?.runningSince]);

  const active = t && t.itemId === item.id ? t : null;
  const other = t && t.itemId !== item.id ? cycle.items.find((i) => i.id === t.itemId) : null;
  const elapsed = active ? active.accumulated + (active.runningSince ? now - active.runningSince : 0) : 0;
  const update = (n: TimerState | null) => { setT(n); writeTimer(n); setNow(Date.now()); };

  const startPause = () => {
    const n = Date.now();
    if (!active) update({ itemId: item.id, startedAt: n, accumulated: 0, runningSince: n });
    else if (active.runningSince) update({ ...active, accumulated: active.accumulated + n - active.runningSince, runningSince: null });
    else update({ ...active, runningSince: n });
  };
  const stop = async () => {
    if (!active) return;
    const minutes = Math.round(elapsed / 60000);
    if (minutes < 1) { update(null); toast('Menos de 1 minuto — nada registrado'); return; }
    setSaving(true);
    try {
      const r = await cycleApi.logTime({ itemId: item.id, minutes, startedAt: new Date(active.startedAt).toISOString() });
      update(null);
      toast.success(r.data.message);
      onLogged(r.data.data.newRound);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao registrar');
    } finally {
      setSaving(false);
    }
  };

  const s = Math.floor(elapsed / 1000);
  const display = `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const remaining = Math.max(0, item.minutes - item.doneMinutes - elapsed / 60000);

  return (
    <Box>
      {other && <Alert severity="info" sx={{ mb: 1.5 }}>Há um cronômetro aberto em <strong>{other.label}</strong>. Pare-o na etapa dele ou comece aqui para substituir.</Alert>}
      <Typography variant="h2" fontWeight={900} sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 1, color: active?.runningSince ? 'text.primary' : 'text.secondary' }}>
        {display}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {remaining > 0 ? `Faltam ${hm(remaining)} para fechar a etapa` : 'Meta da etapa batida — pare para registrar'}
        {active && !active.runningSince && ' · pausado (pausas não contam)'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button variant="contained" size="large" onClick={startPause} startIcon={active?.runningSince ? <Pause /> : <PlayArrow />}
          sx={{ px: 4, ...(active?.runningSince && { bgcolor: theme.palette.text.primary, color: theme.palette.background.paper, '&:hover': { bgcolor: theme.palette.text.secondary } }) }}>
          {active?.runningSince ? 'Pausar' : active ? 'Continuar' : 'Começar'}
        </Button>
        {active && (
          <Button variant="outlined" size="large" onClick={stop} disabled={saving} startIcon={saving ? <CircularProgress size={18} /> : <Stop />}>
            Parar e registrar
          </Button>
        )}
      </Box>
    </Box>
  );
}

// ─── Montar / editar ciclo ───
type Draft = { id?: string; label: string; assuntoId: number | null; minutes: number; weight: number; level: number; color: string };

function CycleBuilder({ initial, onClose, onSaved }: { initial?: Cycle; onClose: () => void; onSaved: () => void }) {
  const { tree } = useAssuntos();
  const [name, setName] = useState(initial?.name || 'Meu ciclo');
  const [weekly, setWeekly] = useState(20);
  const [items, setItems] = useState<Draft[]>(() => initial?.items.map((i) => ({ ...i, weight: 2, level: 1 })) || []);
  const [busy, setBusy] = useState(false);
  const { data: editais = [] } = useQuery({ queryKey: ['study-editais'], queryFn: () => studyEditalApi.list().then((r) => r.data.data as { id: string; name: string }[]) });

  const add = (d: Partial<Draft>) => setItems((list) => [...list, {
    label: '', assuntoId: null, minutes: 60, weight: 2, level: 1, color: PALETTE[list.length % PALETTE.length], ...d,
  }]);
  const patch = (i: number, p: Partial<Draft>) => setItems((list) => list.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, dir: -1 | 1) => setItems((list) => {
    const n = [...list];
    const j = i + dir;
    if (j < 0 || j >= n.length) return list;
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });

  // Distribui as horas semanais pelo peso na prova × dificuldade (múltiplos de 5 min)
  const distribute = () => {
    const score = items.map((i) => i.weight * i.level);
    const sum = score.reduce((a, b) => a + b, 0) || 1;
    setItems((list) => list.map((x, i) => ({ ...x, minutes: Math.min(600, Math.max(15, Math.round(((weekly * 60 * score[i]) / sum) / 5) * 5)) })));
  };

  const fromEdital = async (id: string) => {
    try {
      const e = (await studyEditalApi.get(id)).data.data;
      const seen = new Set(items.map((i) => i.label.toLowerCase()));
      const byDisc = new Map<string, number | null>();
      for (const it of e.items) {
        if (byDisc.has(it.discipline)) continue;
        const root = it.assuntoId && tree ? tree.pathOf(it.assuntoId)[0] : null;
        byDisc.set(it.discipline, root?.id ?? null);
      }
      const add: Draft[] = [];
      for (const [disc, rootId] of byDisc) {
        const label = rootId && tree ? tree.byId.get(rootId)!.name : disc;
        if (seen.has(label.toLowerCase())) continue;
        seen.add(label.toLowerCase());
        add.push({ label, assuntoId: rootId, minutes: 60, weight: 2, level: 1, color: PALETTE[(items.length + add.length) % PALETTE.length] });
      }
      setItems((list) => [...list, ...add]);
      if (!name || name === 'Meu ciclo') setName(`Ciclo — ${e.name}`);
      toast.success(`${add.length} matéria(s) adicionada(s)`);
    } catch {
      toast.error('Erro ao ler o edital');
    }
  };

  const save = async () => {
    setBusy(true);
    const body = { name, items: items.map(({ id, label, assuntoId, minutes, color }) => ({ id, label, assuntoId, minutes, color })) };
    try {
      if (initial) await cycleApi.update(initial.id, body); else await cycleApi.create(body);
      toast.success(initial ? 'Ciclo atualizado' : 'Ciclo criado — bons estudos!');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar');
      setBusy(false);
    }
  };

  const total = items.reduce((s, i) => s + (Number(i.minutes) || 0), 0);
  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{initial ? 'Editar ciclo' : 'Montar ciclo de estudos'}</DialogTitle>
      <DialogContent dividers sx={{ display: 'grid', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          O ciclo não tem dia fixo: você estuda as matérias nesta ordem, cada uma pelo tempo da meta, e ao terminar a última começa uma nova volta.
          Perdeu um dia? Continua de onde parou.
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr' }, gap: 2 }}>
          <TextField label="Nome do ciclo" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Horas por semana" type="number" value={weekly} onChange={(e) => setWeekly(Math.max(1, Number(e.target.value)))}
            helperText="Usado para sugerir as metas" />
        </Box>
        {editais.length > 0 && (
          <FormControl size="small" sx={{ maxWidth: 360 }}>
            <InputLabel>Trazer matérias de um edital</InputLabel>
            <Select label="Trazer matérias de um edital" value="" onChange={(e) => fromEdital(String(e.target.value))}>
              {editais.map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
            </Select>
          </FormControl>
        )}

        {items.map((it, i) => (
          <Box key={i} sx={{ display: 'grid', gap: 1, p: 1.5, borderRadius: 2, border: 1, borderColor: 'divider', borderLeft: `4px solid ${it.color}` }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1 }}>
              <AssuntoPicker value={it.assuntoId} label={`${i + 1}. Matéria`}
                onChange={(id, path) => patch(i, { assuntoId: id, label: path.length ? path[path.length - 1] : it.label })} />
              <TextField size="small" label="Nome no ciclo" value={it.label} onChange={(e) => patch(i, { label: e.target.value })} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 130 }}>
                <InputLabel>Peso na prova</InputLabel>
                <Select label="Peso na prova" value={it.weight} onChange={(e) => patch(i, { weight: Number(e.target.value) })}>
                  <MenuItem value={1}>Baixo</MenuItem><MenuItem value={2}>Médio</MenuItem><MenuItem value={3}>Alto</MenuItem>
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Dificuldade</InputLabel>
                <Select label="Dificuldade" value={it.level} onChange={(e) => patch(i, { level: Number(e.target.value) })}>
                  {LEVELS.map((l) => <MenuItem key={l.v} value={l.v}>{l.l}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" type="number" label="Meta (min)" value={it.minutes} sx={{ width: 110 }}
                onChange={(e) => patch(i, { minutes: Number(e.target.value) })} />
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {PALETTE.map((c) => (
                  <Box key={c} component="button" type="button" onClick={() => patch(i, { color: c })} aria-label="Cor"
                    sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: c, border: 0, cursor: 'pointer', outline: it.color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }} />
                ))}
              </Box>
              <Box sx={{ ml: 'auto', display: 'flex' }}>
                <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUpward fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Descer"><ArrowDownward fontSize="small" /></IconButton>
                <IconButton size="small" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label="Remover"><RemoveCircleOutline fontSize="small" /></IconButton>
              </Box>
            </Box>
          </Box>
        ))}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button startIcon={<Add />} onClick={() => add({})}>Adicionar matéria</Button>
          <Button startIcon={<EditCalendar />} onClick={distribute} disabled={!items.length}>Sugerir metas pelas {weekly}h semanais</Button>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>Uma volta: <strong>{hm(total)}</strong></Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="contained" onClick={save} disabled={busy || !items.length || items.some((i) => !i.label.trim() || !(i.minutes >= 5))}>
          {busy ? <CircularProgress size={18} color="inherit" /> : 'Salvar ciclo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ManualLog({ cycle, onClose, onSaved }: { cycle: Cycle | null; onClose: () => void; onSaved: () => void }) {
  const [itemId, setItemId] = useState(cycle?.currentItemId || '');
  const [label, setLabel] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [day, setDay] = useState(dayjs().format('YYYY-MM-DD'));
  const save = async () => {
    try {
      const end = dayjs(day).isSame(dayjs(), 'day') ? dayjs() : dayjs(day).hour(20);
      await cycleApi.logTime({
        minutes, ...(itemId ? { itemId } : { label }),
        startedAt: end.subtract(minutes, 'minute').toISOString(),
      });
      toast.success('Tempo registrado');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro');
    }
  };
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Registrar tempo estudado</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '8px !important' }}>
        {cycle && (
          <FormControl size="small">
            <InputLabel>Etapa do ciclo</InputLabel>
            <Select label="Etapa do ciclo" value={itemId} onChange={(e) => setItemId(String(e.target.value))}>
              {cycle.items.map((i) => <MenuItem key={i.id} value={i.id}>{i.label}</MenuItem>)}
              <MenuItem value="">Outro (fora do ciclo)</MenuItem>
            </Select>
          </FormControl>
        )}
        {!itemId && <TextField size="small" label="O que você estudou" value={label} onChange={(e) => setLabel(e.target.value)} />}
        <TextField size="small" type="number" label="Minutos líquidos" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
        <TextField size="small" type="date" label="Dia" value={day} onChange={(e) => setDay(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={save} disabled={!(minutes >= 1) || (!itemId && !label.trim())}>Registrar</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function CicloPage() {
  const theme = useTheme();
  const qc = useQueryClient();
  const [builder, setBuilder] = useState<'new' | Cycle | null>(null);
  const [manual, setManual] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [toDelete, setToDelete] = useState(false);
  const [range, setRange] = useState<'dias' | 'semanas'>('dias');

  const { data: cycles = [], isLoading } = useQuery({ queryKey: ['cycles'], queryFn: () => cycleApi.list().then((r) => r.data.data as Cycle[]) });
  const { data: stats } = useQuery({ queryKey: ['cycle-stats'], queryFn: () => cycleApi.stats().then((r) => r.data.data as Stats) });
  const cycle = cycles.find((c) => c.isActive) || cycles[0] || null;
  const current = cycle?.items.find((i) => i.id === cycle.currentItemId) || null;
  const refresh = () => { qc.invalidateQueries({ queryKey: ['cycles'] }); qc.invalidateQueries({ queryKey: ['cycle-stats'] }); };

  // Cor de cada matéria nos gráficos = cor da etapa; o que não está no ciclo fica cinza
  const colors = new Map<string, string>();
  for (const c of cycles) for (const i of c.items) if (!colors.has(i.label)) colors.set(i.label, i.color);
  const colorOf = (label: string) => colors.get(label) || OTHER;

  const chart = (() => {
    if (!stats) return { rows: [], labels: [] as string[] };
    const src = range === 'dias' ? stats.days : stats.weeks;
    const labels = [...new Set(src.flatMap((d) => Object.keys(d.byLabel)))];
    const rows = src.map((d) => ({
      x: 'day' in d ? dayjs(d.day).format('ddd DD') : `sem ${dayjs((d as { week: string }).week).format('DD/MM')}`,
      total: d.minutes,
      ...Object.fromEntries(labels.map((l) => [l, Math.round(((d.byLabel[l] || 0) / 60) * 10) / 10])),
    }));
    return { rows, labels };
  })();

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast.success(msg); refresh(); } catch (e: any) { toast.error(e.response?.data?.message || 'Erro'); }
  };

  if (isLoading) return <Box sx={{ maxWidth: 1200, mx: 'auto' }}><Skeleton variant="rounded" height={360} /></Box>;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Loop sx={{ color: 'primary.main', fontSize: 32 }} /> Ciclo de estudos
          </Typography>
          <Typography color="text.secondary">Estude em sequência, com cronômetro de horas líquidas. Sem dia fixo: o ciclo continua de onde você parou.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<Add />} onClick={() => setManual(true)}>Registrar tempo</Button>
        {cycle && <IconButton onClick={(e) => setMenu(e.currentTarget)} aria-label="Opções do ciclo"><MoreVert /></IconButton>}
      </Box>

      {!cycle ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Loop sx={{ fontSize: 48, color: 'text.disabled' }} />
            <Typography variant="h6" sx={{ mt: 1 }}>Monte seu primeiro ciclo</Typography>
            <Typography color="text.secondary" sx={{ mb: 2, maxWidth: 560, mx: 'auto' }}>
              Escolha as matérias, o peso de cada uma na prova e sua dificuldade. O sistema sugere quanto tempo dedicar a cada etapa.
            </Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => setBuilder('new')}>Montar ciclo</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' }, gap: 2, mb: 2 }}>
            <Card sx={{ borderTop: `4px solid ${current?.color || theme.palette.primary.main}` }}>
              <CardContent sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                <Typography variant="overline" color="text.secondary">{cycle.name} · etapa atual</Typography>
                {current ? (
                  <>
                    <Typography variant="h4" fontWeight={900} sx={{ mb: 0.5 }}>{current.label}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <LinearProgress variant="determinate" value={Math.min(100, (current.doneMinutes / current.minutes) * 100)}
                        sx={{ flexGrow: 1, height: 8, borderRadius: 4, bgcolor: alpha(current.color, 0.15), '& .MuiLinearProgress-bar': { bgcolor: current.color } }} />
                      <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{hm(current.doneMinutes)} / {hm(current.minutes)}</Typography>
                    </Box>
                    <StageTimer cycle={cycle} item={current} onLogged={(nr) => { if (nr) toast.success(`Volta ${cycle.round} completa! 🎉`); refresh(); }} />
                    <Button size="small" color="inherit" startIcon={<SkipNext />} sx={{ mt: 2, color: 'text.secondary' }}
                      onClick={() => act(() => cycleApi.skip(cycle.id, current.id), 'Etapa pulada')}>
                      Pular esta etapa nesta volta
                    </Button>
                  </>
                ) : <Typography>Carregando…</Typography>}
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <CycleWheel cycle={cycle} />
                <Box sx={{ mt: 2, display: 'grid', gap: 0.75 }}>
                  {cycle.items.map((it, i) => (
                    <Box key={it.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, opacity: it.doneMinutes >= it.minutes ? 0.55 : 1 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: it.color, flexShrink: 0 }} />
                      <Typography variant="body2" fontWeight={it.id === cycle.currentItemId ? 800 : 500} noWrap sx={{ flexGrow: 1 }}>
                        {i + 1}. {it.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {it.doneMinutes >= it.minutes ? '✓ ' : ''}{hm(Math.min(it.doneMinutes, it.minutes))}/{hm(it.minutes)}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </>
      )}

      {stats && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography fontWeight={800}>Horas líquidas</Typography>
                  <Typography variant="body2" color="text.secondary">Hoje {hm(stats.todayMinutes)} · nesta semana {hm(stats.weekMinutes)}</Typography>
                </Box>
                <ToggleButtonGroup size="small" exclusive value={range} onChange={(_, v) => v && setRange(v)}>
                  <ToggleButton value="dias">7 dias</ToggleButton>
                  <ToggleButton value="semanas">8 semanas</ToggleButton>
                </ToggleButtonGroup>
              </Box>
              {chart.labels.length ? (
                <>
                  <Box sx={{ height: 240 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart.rows} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                        <XAxis dataKey="x" tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} unit="h" />
                        <RTooltip cursor={{ fill: theme.palette.action.hover }}
                          contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8, color: theme.palette.text.primary }}
                          formatter={(v, n) => [Number(v) ? hm(Number(v) * 60) : '—', String(n)]} />
                        {chart.labels.map((l, i) => (
                          <Bar key={l} dataKey={l} stackId="h" fill={colorOf(l)} maxBarSize={28} stroke={theme.palette.background.paper} strokeWidth={1}
                            radius={i === chart.labels.length - 1 ? [4, 4, 0, 0] : 0} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
                    {chart.labels.map((l) => (
                      <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colorOf(l) }} />
                        <Typography variant="caption" color="text.secondary">{l}</Typography>
                      </Box>
                    ))}
                  </Box>
                </>
              ) : <Alert severity="info">Use o cronômetro ou registre um tempo para ver seus gráficos.</Alert>}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography fontWeight={800} sx={{ mb: 1 }}>Esta semana por matéria</Typography>
              {!stats.thisWeek.length && <Typography variant="body2" color="text.secondary">Nada registrado ainda nesta semana.</Typography>}
              {stats.thisWeek.map((t) => (
                <Box key={t.label} sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant="body2" noWrap>{t.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{hm(t.minutes)}</Typography>
                  </Box>
                  <Box sx={{ height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${(t.minutes / stats.thisWeek[0].minutes) * 100}%`, bgcolor: colorOf(t.label), borderRadius: 3 }} />
                  </Box>
                </Box>
              ))}
              <Typography fontWeight={800} sx={{ mt: 2, mb: 0.5 }}>Últimos registros</Typography>
              {stats.recent.slice(0, 8).map((l) => (
                <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ width: 70, flexShrink: 0 }}>{dayjs(l.startedAt).format('DD/MM HH:mm')}</Typography>
                  <Typography variant="body2" noWrap sx={{ flexGrow: 1 }}>{l.label}</Typography>
                  <Typography variant="body2" fontWeight={700}>{hm(l.minutes)}</Typography>
                  <Tooltip title="Apagar registro">
                    <IconButton size="small" onClick={() => act(() => cycleApi.removeTime(l.id), 'Registro apagado')} aria-label="Apagar registro">
                      <DeleteOutline sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>
      )}

      <Menu anchorEl={menu} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { setBuilder(cycle!); setMenu(null); }}><ListItemIcon><Edit fontSize="small" /></ListItemIcon>Editar ciclo</MenuItem>
        <MenuItem onClick={() => { setMenu(null); act(() => cycleApi.restart(cycle!.id), 'Volta reiniciada'); }}><ListItemIcon><RestartAlt fontSize="small" /></ListItemIcon>Reiniciar volta atual</MenuItem>
        <MenuItem onClick={() => { setBuilder('new'); setMenu(null); }}><ListItemIcon><Add fontSize="small" /></ListItemIcon>Novo ciclo</MenuItem>
        {cycles.filter((c) => c.id !== cycle?.id).map((c) => (
          <MenuItem key={c.id} onClick={() => { setMenu(null); act(() => cycleApi.update(c.id, { isActive: true }), `"${c.name}" ativado`); }}>
            <ListItemIcon><SwapHoriz fontSize="small" /></ListItemIcon>Usar &quot;{c.name}&quot;
          </MenuItem>
        ))}
        <MenuItem onClick={() => { setToDelete(true); setMenu(null); }} sx={{ color: 'error.main' }}><ListItemIcon><DeleteOutline fontSize="small" color="error" /></ListItemIcon>Excluir ciclo</MenuItem>
      </Menu>

      {builder && <CycleBuilder initial={builder === 'new' ? undefined : builder} onClose={() => setBuilder(null)} onSaved={() => { setBuilder(null); refresh(); }} />}
      {manual && <ManualLog cycle={cycle} onClose={() => setManual(false)} onSaved={() => { setManual(false); refresh(); }} />}
      <ConfirmDialog open={toDelete} title="Excluir ciclo?" danger message={`"${cycle?.name}" será excluído. As horas já registradas continuam nos gráficos.`}
        confirmLabel="Excluir" onClose={() => setToDelete(false)}
        onConfirm={() => { setToDelete(false); act(() => cycleApi.remove(cycle!.id), 'Ciclo excluído'); }} />
    </Box>
  );
}
