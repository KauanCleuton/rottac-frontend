'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Box, ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';
import { lightTheme, darkTheme, GOLD } from '@/theme';
import { useIsDark } from '@/hooks/useIsDark';
import MuiRegistry from './mui-registry';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: { queries: { staleTime: 1000 * 60 * 5, retry: 1 } },
    })
  );

  const isDark = useIsDark();

  return (
    <QueryClientProvider client={queryClient}>
      <MuiRegistry>
        <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
          <CssBaseline enableColorScheme />
          {/* Cor e fundo aplicados aqui (e não só no body): o estilo global do body gerado no
              servidor pode ficar com o tema errado quando o tema do cliente difere (modo "sistema"),
              e o texto que herda cor ficaria preto sobre fundo escuro. */}
          <Box sx={{ color: 'text.primary', bgcolor: 'background.default', minHeight: '100vh' }}>
            {children}
          </Box>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: '12px',
                background: isDark ? '#1C1C1F' : '#fff',
                color: isDark ? '#F5F5F4' : '#111113',
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e4e4e7',
                fontFamily: 'Inter, sans-serif',
              },
              success: { iconTheme: { primary: '#22C55E', secondary: '#fff' } },
              error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
              loading: { iconTheme: { primary: GOLD, secondary: isDark ? '#1C1C1F' : '#fff' } },
            }}
          />
        </ThemeProvider>
      </MuiRegistry>
    </QueryClientProvider>
  );
}
