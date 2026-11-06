'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Footer from './Footer';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon,
  ListItemText, Toolbar, AppBar, IconButton, Typography,
  Avatar, Badge, Chip, Divider, Tooltip, useTheme, alpha, useMediaQuery,
  Menu, MenuItem, Button, Tabs, Tab,
} from '@mui/material';
import {
  Notifications, DarkMode, LightMode, Menu as MenuIcon, ChevronLeft, Bolt, Logout,
  School as SchoolIcon, AdminPanelSettings, SettingsBrightness, Check,
} from '@mui/icons-material';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, type ThemeMode } from '@/store/auth.store';
import { useQuery } from '@tanstack/react-query';
import { gamificationApi, notificationApi, questionBankApi, adminApi, billingApi } from '@/lib/api';
import { useIsDark } from '@/hooks/useIsDark';
import Logo, { LogoMark } from '@/components/brand/Logo';
import { studentSections, adminSection, teacherSections, locate, type NavSection, type NavTab } from './navSections';

const DRAWER_WIDTH = 248;

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { mode: 'light', label: 'Claro', icon: <LightMode fontSize="small" /> },
  { mode: 'dark', label: 'Escuro', icon: <DarkMode fontSize="small" /> },
  { mode: 'system', label: 'Seguir o sistema', icon: <SettingsBrightness fontSize="small" /> },
];

// Abas e ações da seção atual, no topo do conteúdo (o que antes eram itens do menu)
function SectionTabs({ section, tab, badges }: { section: NavSection; tab: NavTab | null; badges: Record<string, number> }) {
  const theme = useTheme();
  const tabs = section.tabs || [];
  const actions = section.actions || [];
  if (tabs.length < 2 && !actions.length) return null;
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: { xs: 2, md: 3 },
      borderBottom: tabs.length > 1 ? `1px solid ${theme.palette.divider}` : 'none',
    }}>
      {tabs.length > 1 ? (
        <Tabs value={tab?.href ?? false} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile
          sx={{ flex: '1 1 320px', minWidth: 0, minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600, fontSize: 14, px: 1.75 } }}>
          {tabs.map((t) => (
            <Tab key={t.href} value={t.href} component={Link} href={t.href}
              label={t.badgeKey && badges[t.badgeKey] > 0 ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {t.label}
                  <Chip label={badges[t.badgeKey]} size="small" color="primary" sx={{ height: 18, fontSize: 10.5, fontWeight: 800 }} />
                </Box>
              ) : t.label} />
          ))}
        </Tabs>
      ) : <Box sx={{ flexGrow: 1 }} />}
      {actions.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', py: 0.75 }}>
          {actions.map((a, i) => (
            <Button key={a.href} component={Link} href={a.href} size="small" startIcon={a.icon}
              variant={i === actions.length - 1 ? 'contained' : 'outlined'} sx={{ whiteSpace: 'nowrap' }}>
              {a.label}
            </Button>
          ))}
        </Box>
      )}
    </Box>
  );
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
  const mainSections: NavSection[] = isTeacher ? teacherSections : studentSections;
  const allSections = isAdmin ? [...mainSections, adminSection] : mainSections;
  const { section: currentSection, tab: currentTab } = locate(pathname, allSections);

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

  // Plano atual (cartão no rodapé do menu)
  const { data: planName } = useQuery({
    queryKey: ['billing', 'me', 'plan-name'],
    queryFn: () => billingApi.me().then((r) => (r.data.data?.plan?.name as string) || 'Gratuito'),
    staleTime: 1000 * 60 * 5,
    enabled: !isTeacher,
  });

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
  // Seção com alguma aba pendente ganha um ponto no menu
  const sectionHasBadge = (s: NavSection) => (s.tabs || []).some((t) => t.badgeKey && badges[t.badgeKey] > 0);
  const desktopShift = open && !isMobile;
  const gold = theme.palette.primary.main;
  const activeText = isDark ? gold : theme.palette.primary.dark;

  const navButton = (s: NavSection) => {
    const isActive = currentSection?.key === s.key;
    return (
      <ListItem key={s.key} disablePadding sx={{ mb: 0.25 }}>
        <ListItemButton
          component={Link}
          href={s.href}
          selected={isActive}
          onClick={() => setMobileOpen(false)}
          sx={{
            borderRadius: 2.5,
            minHeight: 42,
            '&.Mui-selected': {
              bgcolor: alpha(gold, isDark ? 0.12 : 0.16),
              color: activeText,
              '& .MuiListItemIcon-root': { color: activeText },
              '&:hover': { bgcolor: alpha(gold, isDark ? 0.18 : 0.22) },
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 36, color: isActive ? activeText : 'text.secondary', '& svg': { fontSize: 20 } }}>
            {s.icon}
          </ListItemIcon>
          <ListItemText
            primary={s.label}
            primaryTypographyProps={{ fontSize: 14, fontWeight: isActive ? 700 : 500, noWrap: true }}
          />
          {sectionHasBadge(s) && (
            <Box component="span" aria-label="Pendências" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
          )}
        </ListItemButton>
      </ListItem>
    );
  };

  const drawerContent = (
    <>
      <Toolbar sx={{ px: 2.5, gap: 1 }}>
        <Link href={isTeacher ? '/professor' : '/dashboard'} style={{ textDecoration: 'none', minWidth: 0 }}>
          <Logo size={34} />
        </Link>
      </Toolbar>

      <List sx={{ px: 1.25, py: 1, flexGrow: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {mainSections.map(navButton)}
        {isAdmin && (
          <>
            <Divider sx={{ my: 1.25, mx: 1 }} />
            {navButton(adminSection)}
          </>
        )}
      </List>

      <Box sx={{ px: 1.5, pb: 1.5 }}>
        {!isTeacher && (
          <Box sx={{
            border: `1px solid ${alpha(gold, 0.35)}`, bgcolor: alpha(gold, isDark ? 0.06 : 0.08),
            borderRadius: 3, p: 1.5, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1,
          }}>
            <Typography variant="caption" color="text.secondary">
              Seu plano: <strong>{planName || '…'}</strong>
            </Typography>
            <Button component={Link} href="/planos" size="small" variant="contained" fullWidth onClick={() => setMobileOpen(false)}>
              Ver planos
            </Button>
          </Box>
        )}
        <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', fontSize: 10, lineHeight: 1.6, textAlign: 'center' }}>
          © {new Date().getFullYear()} Rotta Concursos · por{' '}
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
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' } }}
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
              display: 'flex',
              flexDirection: 'column',
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
          {currentSection && <SectionTabs section={currentSection} tab={currentTab} badges={badges} />}
          {children}
        </Box>

        <Footer compact />
      </Box>
    </Box>
  );
}
