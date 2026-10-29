'use client';

import { useState, useMemo, useRef } from 'react';
import {
  Box, Card, CardContent, Grid, Typography, CircularProgress,
  alpha, useTheme, LinearProgress, Chip, Paper, Button, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  IconButton, MenuItem, Select, FormControl, InputLabel, List,
  ListItem, ListItemButton, ListItemText, InputAdornment,
  Collapse, Checkbox, FormControlLabel, Switch, Divider, Tab, Tabs,
  Accordion, AccordionSummary, AccordionDetails, Alert,
} from '@mui/material';
import {
  EmojiEvents, CalendarMonth, CheckCircle, Add, Delete, Edit,
  Search, Warning, ArrowForward, Star, GolfCourse, ExpandMore,
  ExpandLess, AutoAwesome, Lightbulb, Calculate, Info, Refresh,
  School, AccessTime, TrendingUp,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, gamificationApi } from '@/lib/api';
import { BRAND_GRADIENT, HERO_GRADIENT } from '@/theme';
import Link from 'next/link';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import duration from 'dayjs/plugin/duration';
dayjs.locale('pt-br');
dayjs.extend(duration);

// ─── Dados estáticos ────────────────────────────────────────────────────────

const BANCAS = ['CESPE/CEBRASPE', 'FCC', 'VUNESP', 'FGV', 'IBFC', 'CESGRANRIO', 'CONSULPLAN', 'QUADRIX', 'IDECAN', 'FUNIVERSA', 'AOCP', 'FEPESE', 'IADES', 'MOVIMENTUM'];

const BANCA_DICAS: Record<string, { perfil: string; dicas: string[]; estilo: string; pontuacao: string }> = {
  'CESPE/CEBRASPE': {
    perfil: 'Assertivas verdadeiro/falso — avalia interpretação e profundidade',
    estilo: 'Questões de C ou E (Certo/Errado). Exige raciocínio apurado, cuidado com termos absolutos como "sempre", "nunca", "somente".',
    pontuacao: 'Desde 2019 sem anulação de erros. Cada questão tem peso igual.',
    dicas: [
      'Cuidado com palavras absolutas: "sempre", "nunca", "somente", "exclusivamente" — geralmente são erradas',
      'Questões com "pode", "em regra", "em geral" costumam ser verdadeiras',
      'Leia o enunciado completo — uma palavra muda tudo',
      'CESPE gosta de testar exceções às regras',
      'Treine com provas antigas pois o estilo se repete bastante',
    ],
  },
  'FCC': {
    perfil: 'Múltipla escolha com 5 alternativas — letra de lei e literalidade',
    estilo: 'Questões mais objetivas, focadas em texto de lei. Menos interpretação, mais memorização literal.',
    pontuacao: 'Sem penalidade para erros. Vale a pena marcar todas.',
    dicas: [
      'Conheça a letra da lei — FCC cobra o texto literal da legislação',
      'Decorar artigos importantes é essencial',
      'Questões com "de acordo com a lei X" — vá direto ao texto da lei',
      'Elimine alternativas óbviamente erradas e escolha entre as restantes',
      'Atenção a jurisprudências do STF/STJ em matérias jurídicas',
    ],
  },
  'VUNESP': {
    perfil: 'Múltipla escolha — muito literal e baseado em textos',
    estilo: 'Questões de língua portuguesa com textos longos. Jurídico segue texto de lei. Cobra muita interpretação textual.',
    pontuacao: 'Sem penalidade para erros.',
    dicas: [
      'Leia todos os textos de português com atenção — respostas estão no texto',
      'VUNESP é muito literal — não "interprete demais"',
      'Questões de informática cobram Office e sistemas operacionais',
      'Em direito, a resposta está quase sempre na lei seca',
      'Gosta de cobrar pontuação e sintaxe em português',
    ],
  },
  'FGV': {
    perfil: 'Múltipla escolha — mistura técnico com interpretação e atualidades',
    estilo: 'Questões elaboradas que exigem raciocínio. Cobra muito atualidades e eventos recentes.',
    pontuacao: 'Sem penalidade para erros.',
    dicas: [
      'Leia notícias e acompanhe eventos atuais (FGV cobra muito)',
      'Questões exigem relacionar conceitos, não só decorar',
      'Inglês aparece com frequência em provas de TI e finanças',
      'Gosta de cenários hipotéticos — entenda o conceito, não só a letra',
      'Cobram muito ética profissional e casos práticos',
    ],
  },
};

const BANCA_PADRAO = {
  perfil: 'Estilo padrão de concurso público',
  estilo: 'Múltipla escolha com 5 alternativas.',
  pontuacao: 'Verifique o edital para regras de pontuação.',
  dicas: [
    'Leia o edital completo antes de começar os estudos',
    'Faça provas anteriores da mesma banca',
    'Organize seu cronograma de estudo com antecedência',
    'Revise regularmente usando repetição espaçada',
    'Mantenha consistência — estude um pouco todo dia',
  ],
};

const CONCURSO_DB = [
  { nome: 'Polícia Federal (PF)', orgao: 'Departamento de Polícia Federal', area: 'Segurança', banca: 'CESPE/CEBRASPE', cargos: ['Agente de Polícia Federal', 'Escrivão de Polícia Federal', 'Delegado', 'Perito Criminal Federal'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito Penal', 'Direito Processual Penal', 'Direito Civil', 'Raciocínio Lógico', 'Língua Portuguesa', 'Informática', 'Criminologia'] },
  { nome: 'Polícia Rodoviária Federal (PRF)', orgao: 'Polícia Rodoviária Federal', area: 'Segurança', banca: 'CESPE/CEBRASPE', cargos: ['Policial Rodoviário Federal'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito Penal', 'Direito Processual Penal', 'Legislação de Trânsito', 'Raciocínio Lógico', 'Língua Portuguesa', 'Informática'] },
  { nome: 'INSS', orgao: 'Instituto Nacional do Seguro Social', area: 'Previdência', banca: 'CESPE/CEBRASPE', cargos: ['Técnico do Seguro Social', 'Analista do Seguro Social'], disciplinas: ['Direito Previdenciário', 'Direito Constitucional', 'Direito Administrativo', 'Raciocínio Lógico', 'Língua Portuguesa', 'Informática', 'Atualidades'] },
  { nome: 'Receita Federal (AFRFB)', orgao: 'Receita Federal do Brasil', area: 'Fiscal', banca: 'CESPE/CEBRASPE', cargos: ['Auditor Fiscal da Receita Federal', 'Analista Tributário'], disciplinas: ['Direito Tributário', 'Direito Constitucional', 'Direito Administrativo', 'Contabilidade Geral', 'Legislação Tributária Federal', 'Raciocínio Lógico', 'Língua Portuguesa', 'Matemática Financeira'] },
  { nome: 'Banco do Brasil (BB)', orgao: 'Banco do Brasil S.A.', area: 'Bancário', banca: 'CESGRANRIO', cargos: ['Escriturário', 'Analista'], disciplinas: ['Matemática', 'Língua Portuguesa', 'Raciocínio Lógico', 'Conhecimentos Bancários', 'Atualidades', 'Informática', 'Direito Constitucional'] },
  { nome: 'Caixa Econômica Federal (CEF)', orgao: 'Caixa Econômica Federal', area: 'Bancário', banca: 'CESGRANRIO', cargos: ['Técnico Bancário', 'Analista'], disciplinas: ['Matemática', 'Língua Portuguesa', 'Raciocínio Lógico', 'Conhecimentos Bancários', 'Contabilidade', 'Informática', 'Atualidades'] },
  { nome: 'Correios (ECT)', orgao: 'Empresa Brasileira de Correios e Telégrafos', area: 'Estatal', banca: 'IBFC', cargos: ['Carteiro', 'Operador de Triagem', 'Analista de Correios'], disciplinas: ['Língua Portuguesa', 'Matemática', 'Raciocínio Lógico', 'Informática', 'Atualidades', 'Conhecimentos Específicos'] },
  { nome: 'TCU', orgao: 'Tribunal de Contas da União', area: 'Controle', banca: 'CESPE/CEBRASPE', cargos: ['Analista de Controle Externo', 'Técnico de Controle Externo', 'Auditor Federal de Controle Externo'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Controle Externo', 'Contabilidade Pública', 'Administração Pública', 'Raciocínio Lógico', 'Língua Portuguesa'] },
  { nome: 'STF', orgao: 'Supremo Tribunal Federal', area: 'Judiciário', banca: 'FCC', cargos: ['Analista Judiciário', 'Técnico Judiciário'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito Processual Civil', 'Raciocínio Lógico', 'Língua Portuguesa', 'Informática'] },
  { nome: 'STJ', orgao: 'Superior Tribunal de Justiça', area: 'Judiciário', banca: 'FCC', cargos: ['Analista Judiciário', 'Técnico Judiciário'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito Civil', 'Direito Processual Civil', 'Raciocínio Lógico', 'Língua Portuguesa'] },
  { nome: 'TRT (Tribunal Regional do Trabalho)', orgao: 'Tribunais Regionais do Trabalho', area: 'Judiciário', banca: 'FCC', cargos: ['Analista Judiciário', 'Técnico Judiciário'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito do Trabalho', 'Direito Processual do Trabalho', 'Raciocínio Lógico', 'Língua Portuguesa', 'Informática'] },
  { nome: 'TRF', orgao: 'Tribunais Regionais Federais', area: 'Judiciário', banca: 'FCC', cargos: ['Analista Judiciário', 'Técnico Judiciário'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito Civil', 'Direito Processual Civil', 'Direito Processual Penal', 'Raciocínio Lógico', 'Língua Portuguesa'] },
  { nome: 'TJSP', orgao: 'Tribunal de Justiça de São Paulo', area: 'Judiciário', banca: 'VUNESP', cargos: ['Escrevente Técnico Judiciário', 'Analista Judiciário'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito Civil', 'Direito Processual Civil', 'Direito Penal', 'Língua Portuguesa', 'Informática'] },
  { nome: 'MPF', orgao: 'Ministério Público Federal', area: 'MP', banca: 'CESPE/CEBRASPE', cargos: ['Analista', 'Técnico', 'Procurador'], disciplinas: ['Direito Constitucional', 'Direito Administrativo', 'Direito Penal', 'Direito Processual Penal', 'Direito Civil', 'Direito Processual Civil', 'Raciocínio Lógico', 'Língua Portuguesa'] },
  { nome: 'PC-SP', orgao: 'Polícia Civil de São Paulo', area: 'Segurança Estadual', banca: 'VUNESP', cargos: ['Investigador', 'Escrivão', 'Delegado'], disciplinas: ['Direito Penal', 'Direito Processual Penal', 'Direito Constitucional', 'Direito Administrativo', 'Criminologia', 'Medicina Legal', 'Língua Portuguesa', 'Raciocínio Lógico'] },
  { nome: 'SEFAZ-SP', orgao: 'Secretaria da Fazenda de SP', area: 'Fiscal Estadual', banca: 'FCC', cargos: ['Agente Fiscal de Rendas', 'Analista'], disciplinas: ['Direito Tributário', 'Direito Constitucional', 'Direito Administrativo', 'Contabilidade Geral', 'Economia', 'Administração Financeira', 'Matemática', 'Língua Portuguesa'] },
  { nome: 'IBGE', orgao: 'Instituto Brasileiro de Geografia e Estatística', area: 'Pesquisa', banca: 'CESPE/CEBRASPE', cargos: ['Analista', 'Agente de Pesquisas e Mapeamento'], disciplinas: ['Língua Portuguesa', 'Raciocínio Lógico', 'Matemática', 'Estatística', 'Informática', 'Direito Administrativo'] },
  { nome: 'SERPRO', orgao: 'Serviço Federal de Processamento de Dados', area: 'TI', banca: 'CESGRANRIO', cargos: ['Analista de Tecnologia', 'Técnico de Suporte'], disciplinas: ['Língua Portuguesa', 'Raciocínio Lógico', 'Informática', 'Programação', 'Banco de Dados', 'Redes de Computadores'] },
  { nome: 'Prefeitura de São Paulo', orgao: 'PMSP', area: 'Municipal', banca: 'FCC', cargos: ['Agente Administrativo', 'Analista', 'Professor'], disciplinas: ['Língua Portuguesa', 'Matemática', 'Raciocínio Lógico', 'Direito Administrativo', 'Direito Constitucional', 'Atualidades', 'Informática'] },
  { nome: 'Prefeitura do Rio de Janeiro', orgao: 'PCRJ', area: 'Municipal', banca: 'FGV', cargos: ['Agente Administrativo', 'Analista', 'Fiscal'], disciplinas: ['Língua Portuguesa', 'Matemática', 'Raciocínio Lógico', 'Direito Constitucional', 'Direito Administrativo', 'Atualidades'] },
];

const AREAS = ['Todos', ...Array.from(new Set(CONCURSO_DB.map(c => c.area)))];
const CONCURSOS_KEY = 'aprova-ai-concursos';
const ACTIVE_KEY = 'aprova-ai-active-concurso';

type MyConcurso = {
  id: string; nome: string; orgao: string; cargo: string; banca: string;
  examDate: string | null; preEdital: boolean; disciplinas: string[];
};

function getList(): MyConcurso[] {
  try { return JSON.parse(localStorage.getItem(CONCURSOS_KEY) || '[]'); } catch { return []; }
}
function saveList(l: MyConcurso[]) { localStorage.setItem(CONCURSOS_KEY, JSON.stringify(l)); }
function getActiveId(): string | null { return localStorage.getItem(ACTIVE_KEY); }
function setActiveId(id: string | null) { id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY); }

// ─── Calculadora de aprovação ──────────────────────────────────────────────

function CalcAprovacao({ banca }: { banca: string }) {
  const [total, setTotal] = useState('100');
  const [taxa, setTaxa] = useState('60');
  const [acertos, setAcertos] = useState('');

  const necessario = Math.ceil(Number(total) * Number(taxa) / 100);
  const pct = acertos ? Math.round((Number(acertos) / Number(total)) * 100) : null;
  const aprovado = acertos ? Number(acertos) >= necessario : null;

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} gutterBottom>Calculadora de Aprovação</Typography>
      <Grid container spacing={1.5} alignItems="center">
        <Grid size={{ xs: 4 }}>
          <TextField size="small" label="Total de questões" type="number" value={total}
            onChange={e => setTotal(e.target.value)} fullWidth />
        </Grid>
        <Grid size={{ xs: 4 }}>
          <TextField size="small" label="Nota mínima (%)" type="number" value={taxa}
            onChange={e => setTaxa(e.target.value)} fullWidth />
        </Grid>
        <Grid size={{ xs: 4 }}>
          <TextField size="small" label="Acertos simulados" type="number" value={acertos}
            onChange={e => setAcertos(e.target.value)} fullWidth />
        </Grid>
      </Grid>
      <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 2, bgcolor: aprovado === true ? alpha('#22C55E', 0.08) : aprovado === false ? alpha('#EF4444', 0.08) : alpha('#F2B705', 0.06) }}>
        <Typography variant="body2">
          Você precisa de <strong>{necessario} acertos</strong> de {total} questões ({taxa}%)
          {acertos && (
            <>
              {' · '}
              <strong style={{ color: aprovado ? '#22C55E' : '#EF4444' }}>
                {aprovado ? `✅ Aprovado! (${pct}%)` : `❌ Reprovado (${pct}%) — faltam ${necessario - Number(acertos)} acertos`}
              </strong>
            </>
          )}
        </Typography>
      </Box>
    </Box>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────

export default function ConcursoPage() {
  const theme = useTheme();

  const [list, setList] = useState<MyConcurso[]>(getList);
  const [activeId, setActiveIdState] = useState<string | null>(() => {
    const saved = getActiveId();
    const l = getList();
    return (saved && l.find(c => c.id === saved)) ? saved : l[0]?.id || null;
  });

  // Dialog de adicionar concurso
  const [addOpen, setAddOpen] = useState(false);
  const [step, setStep] = useState<'buscar' | 'configurar'>('buscar');
  const [dbSearch, setDbSearch] = useState('');
  const [dbArea, setDbArea] = useState('Todos');
  const [selectedDb, setSelectedDb] = useState<typeof CONCURSO_DB[0] | null>(null);
  const [addForm, setAddForm] = useState({
    cargo: '', banca: '', examDate: '', preEdital: false, disciplinas: '',
  });

  // Busca automática de disciplinas
  const [buscando, setBuscando] = useState(false);
  const [disciplinasBuscadas, setDisciplinasBuscadas] = useState<Array<{ nome: string; confianca: number }>>([]);
  const [disciplinasSelecionadas, setDisciplinasSelecionadas] = useState<Set<string>>(new Set());
  const [buscaRealizada, setBuscaRealizada] = useState(false);
  const [buscaOffline, setBuscaOffline] = useState(false);

  // UI
  const [showDisciplines, setShowDisciplines] = useState(false);
  const [tabDica, setTabDica] = useState(0);

  const active = list.find(c => c.id === activeId) || null;

  const switchConcurso = (id: string) => { setActiveId(id); setActiveIdState(id); };

  const remove = (id: string) => {
    const updated = list.filter(c => c.id !== id);
    setList(updated);
    saveList(updated);
    if (activeId === id) {
      const n = updated[0]?.id || null;
      setActiveIdState(n);
      setActiveId(n);
    }
  };

  // Busca automática via Python service
  const buscarDisciplinas = async () => {
    const nomeBusca = selectedDb?.nome || dbSearch;
    const bancaBusca = addForm.banca || selectedDb?.banca || '';
    if (!nomeBusca) { toast.error('Selecione ou digite um concurso primeiro'); return; }

    setBuscando(true);
    setBuscaRealizada(false);
    setBuscaOffline(false);
    setDisciplinasBuscadas([]);

    try {
      const res = await fetch('/api/buscar-disciplinas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concurso: nomeBusca, banca: bancaBusca }),
      });

      if (!res.ok) throw new Error('offline');
      const data = await res.json();

      if (data.error) throw new Error('offline');

      setDisciplinasBuscadas(data.disciplinas || []);
      const autoSelect = new Set<string>((data.disciplinas || []).map((d: any) => d.nome));
      setDisciplinasSelecionadas(autoSelect);
      setBuscaRealizada(true);
      toast.success(`${data.disciplinas?.length || 0} disciplinas encontradas!`);
    } catch {
      setBuscaOffline(true);
      // Fallback: usar disciplinas do banco estático se disponível
      if (selectedDb?.disciplinas) {
        const fallback = selectedDb.disciplinas.map(d => ({ nome: d, confianca: 80 }));
        setDisciplinasBuscadas(fallback);
        setDisciplinasSelecionadas(new Set(selectedDb.disciplinas));
        setBuscaRealizada(true);
        toast('Serviço de busca offline. Usando disciplinas padrão do banco local.', { icon: '⚠️' });
      } else {
        toast.error('Serviço de busca offline. Inicie o search-service (porta 3003) ou adicione manualmente.');
      }
    } finally {
      setBuscando(false);
    }
  };

  const aplicarDisciplinasBuscadas = () => {
    const selecionadas = disciplinasBuscadas
      .filter(d => disciplinasSelecionadas.has(d.nome))
      .map(d => d.nome);
    setAddForm(f => ({ ...f, disciplinas: selecionadas.join('\n') }));
    toast.success(`${selecionadas.length} disciplinas aplicadas!`);
  };

  const toggleDisciplina = (nome: string) => {
    setDisciplinasSelecionadas(prev => {
      const next = new Set(prev);
      next.has(nome) ? next.delete(nome) : next.add(nome);
      return next;
    });
  };

  const addConcurso = () => {
    const novo: MyConcurso = {
      id: crypto.randomUUID(),
      nome: selectedDb?.nome || dbSearch,
      orgao: selectedDb?.orgao || '',
      cargo: addForm.cargo || selectedDb?.cargos[0] || '',
      banca: addForm.banca || selectedDb?.banca || '',
      examDate: addForm.preEdital ? null : (addForm.examDate || null),
      preEdital: addForm.preEdital,
      disciplinas: addForm.disciplinas
        ? addForm.disciplinas.split('\n').map(d => d.trim()).filter(Boolean)
        : (selectedDb?.disciplinas || []),
    };
    const updated = [...list, novo];
    setList(updated);
    saveList(updated);
    setActiveIdState(novo.id);
    setActiveId(novo.id);
    setAddOpen(false);
    resetAdd();
    toast.success(`${novo.nome} adicionado!`);
  };

  const resetAdd = () => {
    setStep('buscar');
    setSelectedDb(null);
    setDbSearch('');
    setDbArea('Todos');
    setAddForm({ cargo: '', banca: '', examDate: '', preEdital: false, disciplinas: '' });
    setDisciplinasBuscadas([]);
    setDisciplinasSelecionadas(new Set());
    setBuscaRealizada(false);
    setBuscaOffline(false);
  };

  const filteredDb = useMemo(() => CONCURSO_DB.filter(c => {
    const matchArea = dbArea === 'Todos' || c.area === dbArea;
    const matchSearch = !dbSearch.trim() ||
      c.nome.toLowerCase().includes(dbSearch.toLowerCase()) ||
      c.orgao.toLowerCase().includes(dbSearch.toLowerCase());
    return matchArea && matchSearch;
  }), [dbSearch, dbArea]);

  // Analytics
  const { data: performance = [] } = useQuery({
    queryKey: ['subject-performance'],
    queryFn: () => analyticsApi.getSubjectPerformance().then(r => r.data.data || []),
  });
  const { data: dashboard } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsApi.getDashboard().then(r => r.data.data),
  });
  const { data: gami } = useQuery({
    queryKey: ['gamification'],
    queryFn: () => gamificationApi.getProfile().then(r => r.data.data),
    staleTime: 60000,
  });
  const { data: historyData = [] } = useQuery({
    queryKey: ['study-history', 30],
    queryFn: () => analyticsApi.getStudyHistory(30).then(r => r.data.data || []),
  });

  const examDate = active?.examDate ? dayjs(active.examDate) : null;
  const daysLeft = examDate ? examDate.diff(dayjs(), 'day') : null;
  const isExamPast = daysLeft !== null && daysLeft < 0;
  const weeksLeft = daysLeft !== null ? Math.floor(Math.max(0, daysLeft) / 7) : null;

  const avgCoverage = performance.length > 0
    ? Math.round(performance.reduce((acc: number, s: any) => acc + (s.progressPercent || 0), 0) / performance.length) : 0;
  const perfWithAcc = performance.filter((s: any) => s.questionAccuracy !== null);
  const avgAccuracy = perfWithAcc.length > 0
    ? Math.round(perfWithAcc.reduce((acc: number, s: any) => acc + s.questionAccuracy, 0) / perfWithAcc.length) : null;
  const streakScore = Math.min(100, (gami?.streak || 0) * 3.33);
  const readiness = Math.round((avgCoverage * 0.4) + ((avgAccuracy || 0) * 0.4) + (streakScore * 0.2));
  const readinessColor = readiness >= 70 ? '#22C55E' : readiness >= 50 ? '#F59E0B' : '#EF4444';
  const readinessLabel = readiness >= 80 ? 'Muito preparado' : readiness >= 60 ? 'Bem preparado' : readiness >= 40 ? 'Em progresso' : readiness >= 20 ? 'Precisa de foco' : 'Iniciando';

  const totalHours30 = (historyData as any[]).reduce((acc: number, d: any) => acc + d.minutes, 0) / 60;
  const daysStudied30 = (historyData as any[]).filter((d: any) => d.minutes > 0).length;
  const topicsNotDone = performance.reduce((acc: number, s: any) => acc + (s.totalTopics - s.completedTopics), 0);
  const hoursPerDay = daysLeft && daysLeft > 0 && topicsNotDone > 0
    ? Math.ceil((topicsNotDone * 2) / daysLeft * 10) / 10 : null;
  const criticals = performance.filter((s: any) => s.progressPercent < 50 || s.unresolvedErrors > 3)
    .sort((a: any, b: any) => a.progressPercent - b.progressPercent).slice(0, 5);

  const bancaInfo = active?.banca ? (BANCA_DICAS[active.banca] || BANCA_PADRAO) : BANCA_PADRAO;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Meu Concurso</Typography>
          <Typography color="text.secondary" variant="body2">
            {list.length === 0 ? 'Adicione o concurso para começar a acompanhar seu progresso' : `${list.length} concurso${list.length > 1 ? 's' : ''} cadastrado${list.length > 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => { resetAdd(); setAddOpen(true); }}>
          Adicionar Concurso
        </Button>
      </Box>

      {/* Switcher de concursos */}
      {list.length > 0 && (
        <Box sx={{ mb: 2.5, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {list.map(c => (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
              <Chip
                label={`${c.nome}${c.preEdital ? ' (pré-edital)' : ''}`}
                icon={c.id === activeId ? <Star sx={{ fontSize: '14px !important' }} /> : undefined}
                onClick={() => switchConcurso(c.id)}
                color={c.id === activeId ? 'primary' : 'default'}
                sx={{ fontWeight: c.id === activeId ? 700 : 400, cursor: 'pointer' }}
              />
              <IconButton size="small" onClick={() => remove(c.id)}
                sx={{ opacity: 0.35, '&:hover': { opacity: 1, color: 'error.main' } }}>
                <Delete sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
        </Box>
      )}

      {/* Empty state */}
      {list.length === 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <GolfCourse sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" mb={1}>Nenhum concurso adicionado</Typography>
            <Typography color="text.secondary" mb={3}>
              Adicione o concurso para acompanhar seu progresso, ver disciplinas e receber dicas personalizadas
            </Typography>
            <Button variant="contained" size="large" startIcon={<Add />} onClick={() => { resetAdd(); setAddOpen(true); }}>
              Adicionar meu concurso
            </Button>
          </CardContent>
        </Card>
      )}

      {active && (
        <>
          {/* Hero */}
          <Card sx={{ mb: 3, background: HERO_GRADIENT, color: '#fff', border: '1px solid rgba(242,183,5,0.25)', overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ position: 'absolute', right: -30, top: -30, width: 250, height: 250, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.05)' }} />
            <CardContent sx={{ py: 3, position: 'relative' }}>
              <Grid container spacing={3} alignItems="center">
                <Grid size={{ xs: 12, md: 7 }}>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {active.preEdital && (
                      <Chip label="📚 Pré-edital" size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.25)', color: '#fff', fontWeight: 700 }} />
                    )}
                    {active.banca && (
                      <Chip label={active.banca} size="small"
                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }} />
                    )}
                  </Box>
                  <Typography variant="h4" fontWeight={900} sx={{ color: '#fff', mb: 0.5 }}>{active.nome}</Typography>
                  <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.85)', mb: 1.5 }}>
                    {active.cargo}{active.orgao ? ` · ${active.orgao}` : ''}
                  </Typography>
                  {active.examDate && (
                    <Chip icon={<CalendarMonth sx={{ fontSize: 14 }} />}
                      label={`Prova: ${dayjs(active.examDate).format('DD/MM/YYYY')}`}
                      sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                      variant="outlined" size="small" />
                  )}
                  {active.disciplinas.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer', userSelect: 'none' }}
                        onClick={() => setShowDisciplines(v => !v)}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          {active.disciplinas.length} disciplinas do edital
                        </Typography>
                        {showDisciplines ? <ExpandLess sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />
                          : <ExpandMore sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />}
                      </Box>
                      <Collapse in={showDisciplines}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                          {active.disciplinas.map(d => (
                            <Chip key={d} label={d} size="small"
                              sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', height: 20, fontSize: 10 }} />
                          ))}
                        </Box>
                      </Collapse>
                    </Box>
                  )}
                </Grid>

                <Grid size={{ xs: 12, md: 5 }}>
                  <Box sx={{ textAlign: 'center' }}>
                    {active.preEdital ? (
                      <>
                        <School sx={{ fontSize: 56, color: 'rgba(255,255,255,0.9)', mb: 1 }} />
                        <Typography variant="h5" fontWeight={700} sx={{ color: '#fff' }}>Estudando Pré-edital</Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                          Construindo base sólida antes do edital sair
                        </Typography>
                      </>
                    ) : examDate ? (
                      isExamPast ? (
                        <>
                          <EmojiEvents sx={{ fontSize: 64, color: '#FFD700' }} />
                          <Typography variant="h5" fontWeight={700} sx={{ color: '#fff', mt: 1 }}>Prova realizada!</Typography>
                        </>
                      ) : (
                        <>
                          <Typography variant="h1" fontWeight={900}
                            sx={{ color: '#fff', fontSize: '5rem', lineHeight: 1 }}>{daysLeft}</Typography>
                          <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.8)' }}>dias para a prova</Typography>
                          {weeksLeft !== null && (
                            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                              {weeksLeft}sem e {daysLeft! % 7}d
                            </Typography>
                          )}
                        </>
                      )
                    ) : (
                      <>
                        <CalendarMonth sx={{ fontSize: 48, color: 'rgba(255,255,255,0.6)', mb: 1 }} />
                        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)' }}>Data da prova não definida</Typography>
                      </>
                    )}
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Modo pré-edital alert */}
          {active.preEdital && (
            <Alert severity="info" sx={{ mb: 3 }} icon={<Lightbulb />}>
              <Typography variant="body2" fontWeight={600}>Modo Pré-edital ativo</Typography>
              <Typography variant="caption">
                Foco em construir base sólida nas matérias core do seu concurso. Quando o edital sair, atualize com as disciplinas exatas e adicione a data da prova.
              </Typography>
            </Alert>
          )}

          {/* Índice de prontidão */}
          <Card sx={{ mb: 3, borderTop: `4px solid ${readinessColor}` }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Índice de Prontidão</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Cobertura (40%) + Acerto em questões (40%) + Consistência (20%)
                  </Typography>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography variant="h3" fontWeight={900} color={readinessColor}>{readiness}</Typography>
                  <Typography variant="caption" color="text.secondary">/100 — {readinessLabel}</Typography>
                </Box>
              </Box>
              <LinearProgress variant="determinate" value={readiness}
                sx={{ height: 14, borderRadius: 7, bgcolor: alpha(readinessColor, 0.1),
                  '& .MuiLinearProgress-bar': { bgcolor: readinessColor, borderRadius: 7 } }} />
              <Grid container spacing={2} sx={{ mt: 1.5 }}>
                {[
                  { label: 'Cobertura', value: `${avgCoverage}%`, pct: avgCoverage, color: '#F2B705', weight: 40 },
                  { label: 'Acerto Questões', value: avgAccuracy !== null ? `${avgAccuracy}%` : 'Sem dados', pct: avgAccuracy || 0, color: '#3B82F6', weight: 40 },
                  { label: 'Consistência', value: `${Math.round(streakScore)}%`, pct: streakScore, color: '#FF6B35', weight: 20 },
                ].map(s => (
                  <Grid size={4} key={s.label}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      {s.label} <span style={{ opacity: 0.6 }}>({s.weight}%)</span>
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={s.pct}
                        sx={{ flexGrow: 1, height: 6, borderRadius: 3, bgcolor: alpha(s.color, 0.1),
                          '& .MuiLinearProgress-bar': { bgcolor: s.color, borderRadius: 3 } }} />
                      <Typography variant="caption" fontWeight={700} color={s.color} sx={{ minWidth: 36 }}>{s.value}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* KPIs */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { label: 'Horas (30d)', value: `${totalHours30.toFixed(1)}h`, icon: '⏱️', color: '#F2B705' },
              { label: 'Dias ativos', value: daysStudied30, icon: '📅', color: '#3B82F6' },
              { label: 'Erros pendentes', value: dashboard?.pendingErrors || 0, icon: '❌', color: '#EF4444' },
              { label: 'Flashcards p/ rev.', value: dashboard?.flashcardsDue || 0, icon: '⚡', color: '#F59E0B' },
              { label: 'Streak', value: `${gami?.streak || 0}d`, icon: '🔥', color: '#FF6B35' },
              { label: 'Tópicos pendentes', value: topicsNotDone, icon: '📚', color: '#22C55E' },
            ].map(s => (
              <Grid size={{ xs: 6, sm: 4, md: 2 }} key={s.label}>
                <Card sx={{ textAlign: 'center', borderTop: `3px solid ${s.color}` }}>
                  <CardContent sx={{ py: '12px !important' }}>
                    <Typography fontSize={22}>{s.icon}</Typography>
                    <Typography variant="h6" fontWeight={800} color={s.color}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{s.label}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Planejamento */}
          {hoursPerDay !== null && daysLeft !== null && daysLeft > 0 && (
            <Card sx={{ mb: 3, borderLeft: `4px solid ${hoursPerDay <= 4 ? '#22C55E' : hoursPerDay <= 8 ? '#F59E0B' : '#EF4444'}` }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>Planejamento até a Prova</Typography>
                <Grid container spacing={2}>
                  {[
                    { label: 'horas/dia necessário', value: `${hoursPerDay}h`, color: theme.palette.primary.main },
                    { label: 'tópicos restantes', value: topicsNotDone, color: '#3B82F6' },
                    { label: 'dias disponíveis', value: daysLeft, color: '#22C55E' },
                    { label: 'semanas restantes', value: weeksLeft, color: '#F59E0B' },
                  ].map(s => (
                    <Grid size={{ xs: 6, sm: 3 }} key={s.label}>
                      <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: alpha(s.color, 0.06) }}>
                        <Typography variant="h4" fontWeight={900} sx={{ color: s.color }}>{s.value}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          )}

          <Grid container spacing={2} sx={{ mb: 2 }}>
            {/* Cobertura por disciplina */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>Cobertura por Disciplina</Typography>
                  {performance.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">
                      Cadastre disciplinas em{' '}
                      <Link href="/disciplinas" style={{ color: theme.palette.primary.main }}>Disciplinas</Link>
                    </Typography>
                  ) : performance.slice(0, 8).map((s: any) => (
                    <Box key={s.id} sx={{ mb: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color || '#888', flexShrink: 0 }} />
                          <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>{s.name}</Typography>
                          {s.unresolvedErrors > 3 && (
                            <Chip label={`${s.unresolvedErrors} erros`} size="small" color="error" sx={{ height: 16, fontSize: 9 }} />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          {s.questionAccuracy !== null && (
                            <Typography variant="caption" color="text.secondary">{s.questionAccuracy}%</Typography>
                          )}
                          <Typography variant="caption" fontWeight={700}
                            color={s.progressPercent >= 70 ? 'success.main' : 'text.secondary'}>
                            {s.progressPercent}%
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress variant="determinate" value={s.progressPercent}
                        sx={{ height: 6, borderRadius: 3, bgcolor: alpha(s.color || '#888', 0.12),
                          '& .MuiLinearProgress-bar': { bgcolor: s.progressPercent >= 70 ? '#22C55E' : s.color || '#F2B705', borderRadius: 3 } }} />
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </Grid>

            {/* Prioridades */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>Prioridades de Estudo</Typography>
                  {criticals.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 3 }}>
                      <CheckCircle sx={{ fontSize: 48, color: 'success.main', mb: 1 }} />
                      <Typography color="success.main" fontWeight={600}>Tudo sob controle!</Typography>
                    </Box>
                  ) : criticals.map((s: any, i: number) => (
                    <Paper key={s.id} elevation={0} sx={{ p: 1.5, mb: 1, borderRadius: 2,
                      border: `1px solid ${alpha(s.color || '#888', 0.2)}`,
                      bgcolor: alpha(s.color || '#888', 0.04) }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: alpha(s.color || '#888', 0.2),
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Typography variant="caption" fontWeight={900} color={s.color}>{i + 1}</Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Chip label={`${s.progressPercent}%`} size="small"
                            color={s.progressPercent < 30 ? 'error' : s.progressPercent < 60 ? 'warning' : 'success'} />
                          {s.unresolvedErrors > 0 && (
                            <Chip label={`${s.unresolvedErrors} erros`} size="small" color="error" variant="outlined" />
                          )}
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Calculadora de Aprovação + Dicas da Banca */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2 }}>
                    <Calculate sx={{ color: theme.palette.primary.main }} />
                    <Typography variant="subtitle1" fontWeight={700}>Calculadora de Aprovação</Typography>
                  </Box>
                  <CalcAprovacao banca={active.banca} />
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                    <Lightbulb sx={{ color: '#F59E0B' }} />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Dicas — {active.banca || 'Banca'}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    {bancaInfo.perfil}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block"
                    sx={{ p: 1, borderRadius: 1, bgcolor: alpha(theme.palette.primary.main, 0.05), mb: 1.5, fontSize: 11 }}>
                    {bancaInfo.pontuacao}
                  </Typography>
                  <Box component="ul" sx={{ m: 0, pl: 2 }}>
                    {bancaInfo.dicas.slice(0, 4).map((d, i) => (
                      <Typography key={i} component="li" variant="caption" color="text.secondary"
                        sx={{ mb: 0.5, display: 'list-item' }}>
                        {d}
                      </Typography>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Curva de Ebbinghaus */}
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>Retenção de Conteúdo — Curva de Ebbinghaus</Typography>
              <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                Sem revisão, você perde ~70% do conteúdo em 1 semana. Revisões espaçadas são a chave para aprovação.
              </Typography>
              <Grid container spacing={1}>
                {[
                  { label: 'Logo após', retention: 100 }, { label: '1 dia', retention: 74 },
                  { label: '1 semana', retention: 40 }, { label: '2 semanas', retention: 24 },
                  { label: '1 mês', retention: 14 }, { label: '2 meses', retention: 8 },
                ].map(item => (
                  <Grid size={{ xs: 4, sm: 2 }} key={item.label}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Box sx={{ height: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', mb: 0.5 }}>
                        <Box sx={{ width: '70%', height: `${item.retention}%`, borderRadius: '4px 4px 0 0',
                          bgcolor: item.retention >= 70 ? '#22C55E' : item.retention >= 40 ? '#F59E0B' : '#EF4444' }} />
                      </Box>
                      <Typography variant="caption" fontWeight={700}
                        color={item.retention >= 70 ? 'success.main' : item.retention >= 40 ? 'warning.main' : 'error.main'}>
                        {item.retention}%
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 9 }}>{item.label}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Paper elevation={0} sx={{ mt: 2, p: 1.5, borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}` }}>
                <Typography variant="caption" fontWeight={600}>Protocolo recomendado: </Typography>
                <Typography variant="caption" color="text.secondary">
                  Revise após 1 dia → 3 dias → 7 dias → 14 dias → 30 dias → 60 dias → 90 dias
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Dialog: Adicionar Concurso ─── */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); resetAdd(); }} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={700}>
          {step === 'buscar' ? 'Buscar Concurso' : `Configurar: ${selectedDb?.nome || dbSearch}`}
        </DialogTitle>
        <DialogContent sx={{ pt: 2, minHeight: 420 }}>

          {step === 'buscar' && (
            <>
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                <TextField size="small" placeholder="Nome do concurso..." value={dbSearch}
                  onChange={e => setDbSearch(e.target.value)} sx={{ flexGrow: 1, minWidth: 200 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <InputLabel>Área</InputLabel>
                  <Select value={dbArea} label="Área" onChange={e => setDbArea(e.target.value)}>
                    {AREAS.map(a => <MenuItem key={a} value={a}>{a}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ maxHeight: 340, overflow: 'auto' }}>
                <Grid container spacing={1}>
                  {filteredDb.map(c => (
                    <Grid size={{ xs: 12, sm: 6 }} key={c.nome}>
                      <Paper elevation={0} sx={{
                        p: 1.5, borderRadius: 2, cursor: 'pointer',
                        border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.06), borderColor: theme.palette.primary.main },
                        transition: 'all 0.15s',
                      }} onClick={() => {
                        setSelectedDb(c);
                        setAddForm(f => ({ ...f, cargo: c.cargos[0] || '', banca: c.banca || '', disciplinas: c.disciplinas.join('\n') }));
                        setStep('configurar');
                      }}>
                        <Typography variant="body2" fontWeight={700}>{c.nome}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block">{c.orgao}</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                          <Chip label={c.area} size="small" sx={{ height: 16, fontSize: 9 }} />
                          {c.banca && <Chip label={c.banca} size="small" color="primary" sx={{ height: 16, fontSize: 9 }} />}
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
                {filteredDb.length === 0 && dbSearch && (
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <Typography color="text.secondary" mb={1}>Concurso não encontrado no banco local.</Typography>
                    <Button variant="outlined" onClick={() => {
                      setSelectedDb(null);
                      setStep('configurar');
                      setAddForm(f => ({ ...f, disciplinas: '' }));
                    }}>
                      Usar "{dbSearch}" como nome personalizado
                    </Button>
                  </Box>
                )}
              </Box>

              <Divider sx={{ my: 2 }} />
              <Button fullWidth variant="outlined" onClick={() => {
                setSelectedDb(null);
                setStep('configurar');
                setAddForm({ cargo: '', banca: '', examDate: '', preEdital: false, disciplinas: '' });
              }}>
                + Concurso não listado — adicionar personalizado
              </Button>
            </>
          )}

          {step === 'configurar' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {selectedDb && (
                <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <Typography variant="body2" fontWeight={700}>{selectedDb.nome}</Typography>
                  <Typography variant="caption" color="text.secondary">{selectedDb.orgao}</Typography>
                </Paper>
              )}

              {!selectedDb && (
                <TextField size="small" label="Nome do concurso *" value={dbSearch}
                  onChange={e => setDbSearch(e.target.value)} />
              )}

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  {selectedDb && selectedDb.cargos.length > 1 ? (
                    <FormControl size="small" fullWidth>
                      <InputLabel>Cargo</InputLabel>
                      <Select value={addForm.cargo} label="Cargo"
                        onChange={e => setAddForm(f => ({ ...f, cargo: e.target.value }))}>
                        {selectedDb.cargos.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                      </Select>
                    </FormControl>
                  ) : (
                    <TextField size="small" fullWidth label="Cargo" value={addForm.cargo}
                      onChange={e => setAddForm(f => ({ ...f, cargo: e.target.value }))} />
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Banca examinadora</InputLabel>
                    <Select value={addForm.banca} label="Banca examinadora"
                      onChange={e => setAddForm(f => ({ ...f, banca: e.target.value }))}>
                      {BANCAS.map(b => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                      <MenuItem value="">Não sei / Outra</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Modo pré-edital */}
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2,
                border: `1px solid ${alpha(addForm.preEdital ? theme.palette.info.main : theme.palette.divider, 0.5)}`,
                bgcolor: addForm.preEdital ? alpha(theme.palette.info.main, 0.04) : 'transparent' }}>
                <FormControlLabel
                  control={<Switch checked={addForm.preEdital}
                    onChange={e => setAddForm(f => ({ ...f, preEdital: e.target.checked }))} />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={600}>Estudando pré-edital</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Ative se o edital ainda não saiu — sem necessidade de data da prova
                      </Typography>
                    </Box>
                  }
                />
              </Paper>

              {!addForm.preEdital && (
                <TextField size="small" label="Data da prova (opcional)" type="date" value={addForm.examDate}
                  onChange={e => setAddForm(f => ({ ...f, examDate: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  helperText="Deixe em branco se ainda não souber" />
              )}

              {/* Busca automática de disciplinas */}
              <Divider>
                <Chip label="Disciplinas" size="small" />
              </Divider>

              <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Box>
                    <Typography variant="body2" fontWeight={600}>Busca automática de disciplinas</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Busca na web as matérias do edital · Requer search-service (porta 3003) rodando
                    </Typography>
                  </Box>
                  <Button
                    variant="contained" size="small" startIcon={buscando ? <CircularProgress size={14} color="inherit" /> : <AutoAwesome />}
                    onClick={buscarDisciplinas} disabled={buscando}
                    sx={{ background: BRAND_GRADIENT, flexShrink: 0 }}>
                    {buscando ? 'Buscando...' : 'Buscar na Web'}
                  </Button>
                </Box>

                {buscaOffline && (
                  <Alert severity="warning" sx={{ mb: 1, py: 0.5 }}>
                    <Typography variant="caption">
                      Search service offline. Inicie com: <code>cd search-service && python main.py</code>
                    </Typography>
                  </Alert>
                )}

                {buscaRealizada && disciplinasBuscadas.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      Encontradas {disciplinasBuscadas.length} disciplinas — marque as que deseja incluir:
                    </Typography>
                    <Box sx={{ maxHeight: 200, overflow: 'auto', display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {disciplinasBuscadas.map(d => (
                        <Chip
                          key={d.nome} label={d.nome}
                          size="small"
                          onClick={() => toggleDisciplina(d.nome)}
                          color={disciplinasSelecionadas.has(d.nome) ? 'primary' : 'default'}
                          variant={disciplinasSelecionadas.has(d.nome) ? 'filled' : 'outlined'}
                          sx={{ cursor: 'pointer', fontSize: 11,
                            opacity: d.confianca < 40 ? 0.7 : 1,
                          }}
                        />
                      ))}
                    </Box>
                    <Button size="small" variant="outlined" onClick={aplicarDisciplinasBuscadas}>
                      Aplicar {disciplinasSelecionadas.size} selecionadas
                    </Button>
                  </Box>
                )}
              </Box>

              <TextField
                label={`Disciplinas (${addForm.disciplinas.split('\n').filter(Boolean).length})`}
                multiline rows={5} value={addForm.disciplinas} size="small"
                onChange={e => setAddForm(f => ({ ...f, disciplinas: e.target.value }))}
                helperText="Uma disciplina por linha. Edite conforme o edital." />

              <Button variant="text" size="small" onClick={() => setStep('buscar')} sx={{ alignSelf: 'flex-start' }}>
                ← Voltar e escolher outro concurso
              </Button>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setAddOpen(false); resetAdd(); }}>Cancelar</Button>
          {step === 'configurar' && (
            <Button variant="contained" onClick={addConcurso}
              disabled={!(selectedDb?.nome || dbSearch)}>
              Adicionar Concurso
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
