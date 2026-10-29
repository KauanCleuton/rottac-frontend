'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Footer from './Footer';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, AppBar, IconButton, Typography,
  Avatar, Badge, Chip, Divider, Tooltip, useTheme, alpha, useMediaQuery,
  Menu, MenuItem, Button,
} from '@mui/material';
import {
  Dashboard, School, CalendarMonth, FlashOn, MenuBook,
  QuestionAnswer, Notes, AccountTree, PictureAsPdf,
  EmojiEvents, TrackChanges, SelfImprovement, FitnessCenter,
  Analytics, Notifications, DarkMode, LightMode, Menu as MenuIcon,
  ChevronLeft, Bolt, Person, GolfCourse, Quiz, Logout,
  Psychology, Article, SupervisorAccount, LocalFireDepartment,
  FileUpload, AutoStories, School as SchoolIcon, Group, Assignment, RateReview,
  TravelExplore, LibraryBooks, PostAdd, AdminPanelSettings, Timer, SettingsBrightness,
  PlayArrow, Check, CollectionsBookmark, EventRepeat, Insights, PointOfSale, Sell, WorkspacePremium, OutlinedFlag,
  TrendingUp, Leaderboard, Checklist, Loop, Gavel, FactCheck,
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, type ThemeMode } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { gamificationApi, notificationApi, questionBankApi, adminApi } from '@/lib/api';
import { useIsDark } from '@/hooks/useIsDark';
import Logo, { LogoMark } from '@/components/brand/Logo';

const DRAWER_WIDTH = 264;

type NavItem =
  | { divider: true; label: string }
  | { label: string; icon: React.ReactNode; href: string; highlight?: boolean; badgeKey?: 'review' | 'reports' };

const studentNavItems: NavItem[] = [
  { label: 'Hoje', icon: <Dashboard />, href: '/dashboard' },
  { divider: true, label: 'Questões' },
  { label: 'Banco de Questões', icon: <LibraryBooks />, href: '/questoes/banco', highlight: true },
  { label: 'Cadernos de Questões', icon: <CollectionsBookmark />, href: '/cadernos' },
  { label: 'Revisão de Questões', icon: <EventRepeat />, href: '/questoes/revisao', badgeKey: 'review' },
  { label: 'O que mais cai', icon: <TrendingUp />, href: '/questoes/mais-cai' },
  { label: 'Simulados com Ranking', icon: <Leaderboard />, href: '/simulados' },
  { label: 'Treino e Simulado', icon: <Timer />, href: '/questoes/praticar' },
  { label: 'Provas Anteriores', icon: <TravelExplore />, href: '/provas' },
  { label: 'Criar Questão', icon: <PostAdd />, href: '/questoes/nova' },
  { label: 'Importar de PDF', icon: <FileUpload />, href: '/questoes/importar' },
  { label: 'Simulado por Gabarito', icon: <Quiz />, href: '/simulado' },
  { label: 'Registro de Desempenho', icon: <QuestionAnswer />, href: '/questoes' },
  { divider: true, label: 'Inteligência' },
  { label: 'Central de IA', icon: <Psychology />, href: '/inteligencia' },
  { label: 'Importar Edital', icon: <Article />, href: '/edital' },
  { label: 'Mentoria', icon: <SupervisorAccount />, href: '/mentoria' },
  { divider: true, label: 'Estudo' },
  { label: 'Edital Verticalizado', icon: <Checklist />, href: '/edital-verticalizado' },
  { label: 'Ciclo de Estudos', icon: <Loop />, href: '/ciclo' },
  { label: 'Lei Seca', icon: <Gavel />, href: '/lei-seca' },
  { label: 'Meu Concurso', icon: <GolfCourse />, href: '/concurso' },
  { label: 'Disciplinas', icon: <School />, href: '/disciplinas' },
  { label: 'Plano de Estudos', icon: <CalendarMonth />, href: '/plano' },
  { label: 'Modo Foco', icon: <SelfImprovement />, href: '/foco' },
  { divider: true, label: 'Revisão' },
  { label: 'Desafio Diário', icon: <LocalFireDepartment />, href: '/desafio' },
  { label: 'Flashcards', icon: <FlashOn />, href: '/flashcards' },
  { label: 'Importar Flashcards', icon: <FileUpload />, href: '/flashcards/importar' },
  { label: 'Caderno de Erros', icon: <MenuBook />, href: '/caderno-erros' },
  { label: 'Anotações', icon: <Notes />, href: '/anotacoes' },
  { label: 'Mapas Mentais', icon: <AccountTree />, href: '/mapas-mentais' },
  { label: 'PDFs', icon: <PictureAsPdf />, href: '/pdfs' },
  { divider: true, label: 'Redação' },
  { label: 'Minhas Redações', icon: <AutoStories />, href: '/redacao' },
  { label: 'Nova Redação', icon: <PlayArrow />, href: '/redacao/nova' },
  { divider: true, label: 'Progresso' },
  { label: 'Metas', icon: <TrackChanges />, href: '/metas' },
  { label: 'Hábitos', icon: <FitnessCenter />, href: '/habitos' },
  { label: 'Analytics', icon: <Analytics />, href: '/analytics' },
  { label: 'Gamificação', icon: <EmojiEvents />, href: '/gamificacao' },
];

const adminNavItems: NavItem[] = [
  { divider: true, label: 'Administração' },
  { label: 'Painel Geral', icon: <Insights />, href: '/admin' },
  { label: 'Alunos', icon: <Group />, href: '/admin/alunos' },
  { label: 'Vendas e Assinaturas', icon: <PointOfSale />, href: '/admin/vendas' },
  { label: 'Planos, Cupons e Promoções', icon: <Sell />, href: '/admin/planos' },
  { label: 'Gerenciar Questões', icon: <AdminPanelSettings />, href: '/admin/questoes' },
  { label: 'Curadoria de Questões', icon: <FactCheck />, href: '/admin/curadoria' },
  { label: 'Simulados com Ranking', icon: <Leaderboard />, href: '/admin/simulados' },
  { label: 'Leis (Lei Seca)', icon: <Gavel />, href: '/admin/lei-seca' },
  { label: 'Reportes de Questões', icon: <OutlinedFlag />, href: '/admin/reportes', badgeKey: 'reports' },
];

const accountNavItems: NavItem[] = [
  { divider: true, label: 'Conta' },
  { label: 'Planos', icon: <WorkspacePremium />, href: '/planos' },
  { label: 'Meu Perfil', icon: <Person />, href: '/perfil' },
];

const teacherNavItems: NavItem[] = [
  { label: 'Dashboard', icon: <Dashboard />, href: '/professor' },
  { divider: true, label: 'Alunos' },
  { label: 'Meus Alunos', icon: <Group />, href: '/professor/alunos' },
  { divider: true, label: 'Redações' },
  { label: 'Todas as Redações', icon: <Assignment />, href: '/professor/redacoes' },
  { divider: true, label: 'Ferramentas' },
  { label: 'Templates de Feedback', icon: <RateReview />, href: '/professor/templates' },
];

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'light', label: 'Claro', icon: <LightMode fontSize="small" /> },
  { mode: 'dark', label: 'Escuro', icon: <DarkMode fontSize="small" /> },
  { mode: 'system', label: 'Seguir o sistema', icon: <SettingsBrightness fontSize="small" /> },
];

// Item ativo = o href mais específico que casa com a rota (evita /questoes acender em /questoes/banco)
function activeHref(pathname: string, items: NavItem[]) {
  let best = '';
  for (const item of items) {
    if ('divider' in item) continue;
    if ((pathname === item.href || pathname.startsWith(item.href + '/')) && item.href.length > best.length) best = item.href;
  }
  return best;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });
  // Estados separados: no desktop o menu fica aberto por padrão; no celular, fechado
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const open = isMobile ? mobileOpen : desktopOpen;
  const setOpen = isMobile ? setMobileOpen : setDesktopOpen;
  const [themeAnchor, setThemeAnchor] = useState<null | HTMLElement>(null);
  const pathname = usePathname();
  const { user, logout, themeMode, setThemeMode } = useAuthStore();
  const isDark = useIsDark();


  const router = useRouter();

  // Backend recusou um recurso fora do plano (402): oferece o upgrade
  useEffect(() => {
    const onPlanRequired = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      toast((t) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="body2">{detail.message || 'Recurso disponível em outro plano.'}</Typography>
          <Button size="small" variant="contained" onClick={() => { toast.dismiss(t.id); router.push('/planos'); }} sx={{ flexShrink: 0 }}>
            Ver planos
          </Button>
        </Box>
      ), { id: `plan-${detail.feature}`, duration: 7000, icon: '🔒' });
    };
    window.addEventListener('plan-required', onPlanRequired);
    return () => window.removeEventListener('plan-required', onPlanRequired);
  }, [router]);

  const isTeacher = user?.role === 'TEACHER';
  const isAdmin = user?.role === 'ADMIN';
  const navItems: NavItem[] = isTeacher
    ? [...teacherNavItems, ...accountNavItems]
    : [...studentNavItems, ...(isAdmin ? adminNavItems : []), ...accountNavItems];
  const currentHref = activeHref(pathname, navItems);

  const { data: gamiData } = useQuery({
    queryKey: ['gamification'],
    queryFn: () => gamificationApi.getProfile().then((r) => r.data.data),
    staleTime: 1000 * 60 * 2,
    enabled: !isTeacher,
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.getAll().then((r) => r.data.data),
    staleTime: 1000 * 60,
  });

  const unreadCount = notifData?.filter((n: any) => !n.isRead).length || 0;

  // Quantas questões vencem hoje na revisão espaçada (badge no menu)
  const { data: reviewDueCount = 0 } = useQuery({
    queryKey: ['question-bank', 'review-count'],
    queryFn: () => questionBankApi.reviewDue(1).then((r) => r.data.data.counts.due as number),
    staleTime: 1000 * 60 * 2,
    enabled: !isTeacher,
  });
  // Reportes pendentes (badge do admin)
  const { data: openReports = 0 } = useQuery({
    queryKey: ['admin', 'reports-count'],
    queryFn: () => adminApi.reports('pendentes').then((r) => {
      const c = r.data.data.counts || {};
      return (c.ABERTO || 0) + (c.EM_ANALISE || 0);
    }),
    staleTime: 1000 * 60 * 2,
    enabled: isAdmin,
  });
  const badges: Record<string, number> = { review: reviewDueCount, reports: openReports };
  const desktopShift = open && !isMobile;
  const gold = theme.palette.primary.main;
  const activeText = isDark ? gold : theme.palette.primary.dark;

  const drawerContent = (
    <>
      <Toolbar sx={{ px: 2.5, gap: 1 }}>
        <Link href="/dashboard" style={{ textDecoration: 'none', minWidth: 0 }}>
          <Logo size={34} />
        </Link>
      </Toolbar>
      <Divider />

      <List sx={{ px: 1.25, py: 1, flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {navItems.map((item, idx) => {
          if ('divider' in item) {
            return (
              <Typography
                key={`d-${idx}`}
                variant="overline"
                sx={{ px: 1.5, pt: 2, pb: 0.5, color: 'text.disabled', display: 'block', fontSize: 10, lineHeight: 1.6 }}
              >
                {item.label}
              </Typography>
            );
          }

          const isActive = item.href === currentHref;
          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.25 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                selected={isActive}
                onClick={() => setMobileOpen(false)}
                sx={{
                  borderRadius: 2,
                  py: 0.7,
                  position: 'relative',
                  ...(item.highlight && !isActive ? {
                    border: `1px solid ${alpha(gold, 0.35)}`,
                    background: alpha(gold, isDark ? 0.06 : 0.08),
                  } : { border: '1px solid transparent' }),
                  '&.Mui-selected': {
                    bgcolor: alpha(gold, isDark ? 0.12 : 0.16),
                    color: activeText,
                    '& .MuiListItemIcon-root': { color: activeText },
                    '&:hover': { bgcolor: alpha(gold, isDark ? 0.18 : 0.22) },
                    '&::before': {
                      content: '""', position: 'absolute', left: -10, top: 8, bottom: 8,
                      width: 4, borderRadius: 4, background: gold,
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: isActive || item.highlight ? activeText : 'text.secondary', '& svg': { fontSize: 20 } }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 14, fontWeight: isActive || item.highlight ? 600 : 500, noWrap: true }}
                />
                {item.badgeKey && badges[item.badgeKey] > 0 && (
                  <Chip label={badges[item.badgeKey]} size="small" color="primary" sx={{ height: 20, fontSize: 11, fontWeight: 800, ml: 0.5 }} />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${theme.palette.divider}`, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', fontSize: 10, lineHeight: 1.6 }}>
          © {new Date().getFullYear()} Rotta Concursos
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', fontSize: 10 }}>
          Desenvolvido por{' '}
          <Box component="a" href="https://www.instagram.com/kauan.cleuton" target="_blank" rel="noopener noreferrer"
            sx={{ color: 'text.disabled', textDecoration: 'underline', '&:hover': { color: 'primary.main' } }}>
            Kauan Cleuton
          </Box>
        </Typography>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          bgcolor: alpha(theme.palette.background.paper, 0.82),
          backdropFilter: 'saturate(180%) blur(12px)',
          borderBottom: `1px solid ${theme.palette.divider}`,
          color: 'text.primary',
          width: desktopShift ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          ml: desktopShift ? `${DRAWER_WIDTH}px` : 0,
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton onClick={() => setOpen(!open)} size="small" aria-label="Alternar menu">
            {open && !isMobile ? <ChevronLeft /> : <MenuIcon />}
          </IconButton>

          {isMobile && <LogoMark size={28} />}

          <Box sx={{ flexGrow: 1 }} />

          {isTeacher && (
            <Chip icon={<SchoolIcon sx={{ fontSize: 14 }} />} label="Professor" size="small" color="primary" sx={{ mr: 1 }} />
          )}
          {isAdmin && (
            <Chip icon={<AdminPanelSettings sx={{ fontSize: 14 }} />} label="Admin" size="small" variant="outlined"
              sx={{ mr: 1, borderColor: alpha(gold, 0.5), color: activeText, display: { xs: 'none', sm: 'flex' } }} />
          )}

          {!isTeacher && gamiData && (
            <Chip
              icon={<Bolt sx={{ fontSize: 16 }} />}
              label={`Nível ${gamiData.level} · ${gamiData.xp} XP`}
              size="small"
              color="primary"
              sx={{ mr: 1, display: { xs: 'none', sm: 'flex' } }}
            />
          )}

          {!isTeacher && gamiData?.streak > 0 && (
            <Chip
              label={`🔥 ${gamiData.streak} dias`}
              size="small"
              sx={{ bgcolor: alpha('#FF6B35', 0.15), color: '#FF6B35', fontWeight: 700, mr: 1 }}
            />
          )}

          <Tooltip title="Tema">
            <IconButton onClick={(e) => setThemeAnchor(e.currentTarget)} size="small" aria-label="Escolher tema">
              {isDark ? <DarkMode /> : <LightMode />}
            </IconButton>
          </Tooltip>
          <Menu anchorEl={themeAnchor} open={Boolean(themeAnchor)} onClose={() => setThemeAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            {THEME_OPTIONS.map((opt) => (
              <MenuItem key={opt.mode} selected={themeMode === opt.mode}
                onClick={() => { setThemeMode(opt.mode); setThemeAnchor(null); }}
                sx={{ gap: 1.5, minWidth: 200 }}>
                {opt.icon}
                <Typography variant="body2" sx={{ flexGrow: 1 }}>{opt.label}</Typography>
                {themeMode === opt.mode && <Check fontSize="small" sx={{ color: activeText }} />}
              </MenuItem>
            ))}
          </Menu>

          <Tooltip title="Notificações">
            <IconButton component={Link} href="/notificacoes" size="small">
              <Badge badgeContent={unreadCount} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Meu Perfil">
            <IconButton component={Link} href="/perfil" size="small">
              <Avatar
                sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: '#0A0A0B', fontSize: 14, fontWeight: 800 }}
                src={user?.avatar}
              >
                {user?.name?.[0]?.toUpperCase()}
              </Avatar>
            </IconButton>
          </Tooltip>

          <Tooltip title="Sair">
            <IconButton size="small" onClick={() => logout()} aria-label="Sair">
              <Logout fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={open}
          onClose={() => setOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: 'background.paper' } }}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          open={open}
          sx={{
            width: open ? DRAWER_WIDTH : 0,
            flexShrink: 0,
            transition: theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            '& .MuiDrawer-paper': {
              width: open ? DRAWER_WIDTH : 0,
              boxSizing: 'border-box',
              bgcolor: 'background.paper',
              borderRight: `1px solid ${theme.palette.divider}`,
              overflowX: 'hidden',
              transition: theme.transitions.create('width', {
                easing: theme.transitions.easing.sharp,
                duration: theme.transitions.duration.leavingScreen,
              }),
            },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: 'background.default',
          minHeight: '100vh',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 }, flexGrow: 1 }}>
          {children}
        </Box>

        <Footer compact />
      </Box>
    </Box>
  );
}
