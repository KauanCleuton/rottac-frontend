import {
  Dashboard, FactCheck, Timer, MenuBook, Loop, Gavel, Folder, Edit, AutoAwesome, Insights, AdminPanelSettings,
  PostAdd, FileUpload, SelfImprovement, Article, Group, Assignment, RateReview,
} from '@mui/icons-material';

// Menu enxuto: cada seção é UM item da barra lateral; as páginas dela viram abas
// (e as ações viram botões) no topo do conteúdo — ver SectionTabs no AppShell.

export type BadgeKey = 'review' | 'reports';

export type NavTab = { label: string; href: string; badgeKey?: BadgeKey; exact?: boolean };
export type NavAction = { label: string; href: string; icon: React.ReactNode };
export type NavSection = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  tabs?: NavTab[];
  actions?: NavAction[];
  // Rotas da seção que não são abas nem ações (ex.: detalhe de um caderno)
  also?: string[];
};

export const studentSections: NavSection[] = [
  { key: 'hoje', label: 'Hoje', icon: <Dashboard />, href: '/dashboard' },
  {
    key: 'questoes', label: 'Questões', icon: <FactCheck />, href: '/questoes/banco',
    tabs: [
      { label: 'Banco', href: '/questoes/banco' },
      { label: 'Cadernos', href: '/cadernos' },
      { label: 'Revisão', href: '/questoes/revisao', badgeKey: 'review' },
      { label: 'O que mais cai', href: '/questoes/mais-cai' },
      { label: 'Provas anteriores', href: '/provas' },
      { label: 'Meu desempenho', href: '/questoes', exact: true },
    ],
    actions: [
      { label: 'Importar PDF', href: '/questoes/importar', icon: <FileUpload /> },
      { label: 'Criar questão', href: '/questoes/nova', icon: <PostAdd /> },
    ],
    also: ['/questoes'],
  },
  {
    key: 'simulados', label: 'Simulados', icon: <Timer />, href: '/simulados',
    tabs: [
      { label: 'Com ranking', href: '/simulados' },
      { label: 'Treino e simulado', href: '/questoes/praticar' },
      { label: 'Por gabarito', href: '/simulado' },
    ],
  },
  {
    key: 'estudo', label: 'Estudo', icon: <MenuBook />, href: '/plano',
    tabs: [
      { label: 'Plano de estudos', href: '/plano' },
      { label: 'Ciclo', href: '/ciclo' },
      { label: 'Edital verticalizado', href: '/edital-verticalizado' },
      { label: 'Disciplinas', href: '/disciplinas' },
      { label: 'Meu concurso', href: '/concurso' },
    ],
    actions: [
      { label: 'Importar edital', href: '/edital', icon: <Article /> },
      { label: 'Modo foco', href: '/foco', icon: <SelfImprovement /> },
    ],
  },
  {
    key: 'revisao', label: 'Revisão', icon: <Loop />, href: '/flashcards',
    tabs: [
      { label: 'Flashcards', href: '/flashcards' },
      { label: 'Desafio diário', href: '/desafio' },
      { label: 'Caderno de erros', href: '/caderno-erros' },
    ],
    actions: [{ label: 'Importar flashcards', href: '/flashcards/importar', icon: <FileUpload /> }],
  },
  { key: 'lei-seca', label: 'Lei Seca', icon: <Gavel />, href: '/lei-seca' },
  {
    key: 'materiais', label: 'Materiais', icon: <Folder />, href: '/anotacoes',
    tabs: [
      { label: 'Anotações', href: '/anotacoes' },
      { label: 'Mapas mentais', href: '/mapas-mentais' },
      { label: 'PDFs', href: '/pdfs' },
    ],
  },
  {
    key: 'redacao', label: 'Redação', icon: <Edit />, href: '/redacao',
    tabs: [{ label: 'Minhas redações', href: '/redacao' }],
    actions: [{ label: 'Nova redação', href: '/redacao/nova', icon: <PostAdd /> }],
  },
  {
    key: 'inteligencia', label: 'Inteligência', icon: <AutoAwesome />, href: '/inteligencia',
    tabs: [
      { label: 'Central de IA', href: '/inteligencia' },
      { label: 'Mentoria', href: '/mentoria' },
    ],
  },
  {
    key: 'progresso', label: 'Progresso', icon: <Insights />, href: '/analytics',
    tabs: [
      { label: 'Desempenho', href: '/analytics' },
      { label: 'Metas', href: '/metas' },
      { label: 'Hábitos', href: '/habitos' },
      { label: 'Conquistas', href: '/gamificacao' },
    ],
  },
];

export const adminSection: NavSection = {
  key: 'admin', label: 'Administração', icon: <AdminPanelSettings />, href: '/admin',
  tabs: [
    { label: 'Painel', href: '/admin', exact: true },
    { label: 'Alunos', href: '/admin/alunos' },
    { label: 'Vendas', href: '/admin/vendas' },
    { label: 'Planos e cupons', href: '/admin/planos' },
    { label: 'Questões', href: '/admin/questoes' },
    { label: 'Curadoria', href: '/admin/curadoria' },
    { label: 'Simulados', href: '/admin/simulados' },
    { label: 'Leis', href: '/admin/lei-seca' },
    { label: 'Reportes', href: '/admin/reportes', badgeKey: 'reports' },
  ],
  also: ['/admin'],
};

export const teacherSections: NavSection[] = [
  { key: 'prof', label: 'Dashboard', icon: <Dashboard />, href: '/professor' },
  { key: 'prof-alunos', label: 'Meus Alunos', icon: <Group />, href: '/professor/alunos' },
  { key: 'prof-redacoes', label: 'Redações', icon: <Assignment />, href: '/professor/redacoes' },
  { key: 'prof-templates', label: 'Templates de Feedback', icon: <RateReview />, href: '/professor/templates' },
];

const matches = (pathname: string, href: string, exact?: boolean) =>
  pathname === href || (!exact && pathname.startsWith(href + '/'));

// Seção e aba da rota atual: vence o href mais específico entre todas as seções
export function locate(pathname: string, sections: NavSection[]) {
  let best: { section: NavSection; tab?: NavTab; len: number } | null = null;
  const consider = (section: NavSection, href: string, exact: boolean | undefined, tab?: NavTab) => {
    if (matches(pathname, href, exact) && (!best || href.length > best.len)) best = { section, tab, len: href.length };
  };
  for (const s of sections) {
    // abas primeiro: num empate de tamanho a aba fica marcada
    for (const t of s.tabs || []) consider(s, t.href, t.exact, t);
    for (const a of s.actions || []) consider(s, a.href, false);
    for (const h of s.also || []) consider(s, h, false);
    consider(s, s.href, s.tabs?.some((t) => t.href === s.href && t.exact));
  }
  const found = best as { section: NavSection; tab?: NavTab } | null;
  return { section: found?.section ?? null, tab: found?.tab ?? null };
}
