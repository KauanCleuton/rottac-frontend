import { createTheme, alpha, type ThemeOptions } from '@mui/material/styles';

// ─── Paleta Rotta ──────────────────────────────────────────────────────────
// Preto + grafite + dourado + branco. O dourado é a única cor de marca;
// verde/vermelho/âmbar ficam reservados para estados (acerto, erro, alerta).
export const GOLD        = '#F2B705';
export const GOLD_LIGHT  = '#FFD34D';
export const GOLD_DARK   = '#C99A06';
export const GOLD_DEEP   = '#8A6A00'; // dourado legível sobre fundo branco (texto)

const INK         = '#0A0A0B';
const CARBON      = '#141416';
const IRON        = '#2A2A2E';
const ASH         = '#A1A1AA';
const SMOKE       = '#5F5F66';
const PAPER       = '#FFFFFF';
const IVORY       = '#F6F6F3';

const SUCCESS = '#22C55E';
const ERROR   = '#EF4444';
const WARNING = '#F59E0B';
const INFO    = '#3B82F6';

// Gradiente da marca (dourado)
export const BRAND_GRADIENT = `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD} 45%, ${GOLD_DARK} 100%)`;
// Cards de destaque: preto com brilho dourado (texto branco legível em ambos os temas)
export const HERO_GRADIENT = 'linear-gradient(135deg, #0A0A0B 0%, #1C1C1F 55%, #3A2E08 100%)';
export const BRAND_GRADIENT_HOVER = `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`;

const typography: ThemeOptions['typography'] = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontWeight: 800, letterSpacing: '-0.03em' },
  h2: { fontWeight: 800, letterSpacing: '-0.025em' },
  h3: { fontWeight: 700, letterSpacing: '-0.02em' },
  h4: { fontWeight: 700, letterSpacing: '-0.02em' },
  h5: { fontWeight: 700, letterSpacing: '-0.01em' },
  h6: { fontWeight: 600 },
  button: { fontWeight: 600, textTransform: 'none' },
  overline: { fontWeight: 700, letterSpacing: '0.12em' },
};

function buildComponents(mode: 'light' | 'dark'): ThemeOptions['components'] {
  const dark = mode === 'dark';
  const border = dark ? alpha('#FFFFFF', 0.08) : alpha('#000000', 0.08);

  return {
    MuiCssBaseline: {
      styleOverrides: {
        body: { WebkitFontSmoothing: 'antialiased' },
        '::selection': { background: alpha(GOLD, 0.35) },
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          background: dark ? IRON : '#D4D4D8', borderRadius: 8,
          border: `2px solid ${dark ? INK : IVORY}`,
        },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, padding: '9px 18px' },
        containedPrimary: {
          background: BRAND_GRADIENT,
          color: INK,
          '&:hover': { background: BRAND_GRADIENT_HOVER },
          '&.Mui-disabled': { background: dark ? IRON : '#E4E4E7', color: dark ? SMOKE : ASH },
        },
        outlinedPrimary: dark ? {} : { color: GOLD_DEEP, borderColor: alpha(GOLD_DARK, 0.5) },
        textPrimary: dark ? {} : { color: GOLD_DEEP },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
          border: `1px solid ${border}`,
          boxShadow: dark ? 'none' : '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)',
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 8, fontWeight: 600 },
        colorPrimary: { color: INK },
      },
    },
    MuiTextField: {
      styleOverrides: { root: { '& .MuiOutlinedInput-root': { borderRadius: 10 } } },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: GOLD },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { '&.Mui-focused': { color: dark ? GOLD : GOLD_DEEP } } },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: { borderRadius: 8, backgroundColor: dark ? IRON : '#E4E4E7' },
        bar: { borderRadius: 8 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: dark ? '#FAFAFA' : INK, color: dark ? INK : '#FAFAFA', fontWeight: 500, fontSize: 12 },
      },
    },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
    MuiTabs: { styleOverrides: { indicator: { backgroundColor: GOLD, height: 3, borderRadius: 3 } } },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { '&.Mui-checked': { color: GOLD, '& + .MuiSwitch-track': { backgroundColor: GOLD } } },
      },
    },
  };
}

// ─── Light Theme ───────────────────────────────────────────────────────────
export const lightTheme = createTheme({
  shape: { borderRadius: 12 },
  typography,
  palette: {
    mode: 'light',
    primary: { main: GOLD_DARK, light: GOLD_LIGHT, dark: GOLD_DEEP, contrastText: INK },
    secondary: { main: INK, light: IRON, dark: '#000000', contrastText: '#FFFFFF' },
    success: { main: SUCCESS },
    error: { main: ERROR },
    warning: { main: WARNING },
    info: { main: INFO },
    background: { default: IVORY, paper: PAPER },
    text: { primary: '#111113', secondary: SMOKE, disabled: ASH },
    divider: alpha('#000000', 0.08),
  },
  components: buildComponents('light'),
});

// ─── Dark Theme ────────────────────────────────────────────────────────────
export const darkTheme = createTheme({
  shape: { borderRadius: 12 },
  typography,
  palette: {
    mode: 'dark',
    primary: { main: GOLD, light: GOLD_LIGHT, dark: GOLD_DARK, contrastText: INK },
    secondary: { main: '#E4E4E7', light: '#FFFFFF', dark: ASH, contrastText: INK },
    success: { main: SUCCESS },
    error: { main: ERROR },
    warning: { main: WARNING },
    info: { main: INFO },
    background: { default: INK, paper: CARBON },
    text: { primary: '#F5F5F4', secondary: ASH, disabled: SMOKE },
    divider: alpha('#FFFFFF', 0.08),
    action: { hover: alpha('#FFFFFF', 0.05), selected: alpha(GOLD, 0.12) },
  },
  components: buildComponents('dark'),
});

