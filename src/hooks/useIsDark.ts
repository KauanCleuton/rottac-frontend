'use client';

import { useSyncExternalStore } from 'react';
import { useMediaQuery } from '@mui/material';
import { useAuthStore } from '@/store/auth.store';

const noopSubscribe = () => () => {};

// true só depois da hidratação (no servidor e no primeiro render do cliente é false)
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

// Resolve o modo efetivo (claro/escuro), seguindo o sistema quando themeMode = 'system'.
// Até hidratar, usa sempre o escuro: servidor e cliente precisam renderizar o mesmo tema,
// senão o HTML não bate (hydration mismatch) e estilos globais ficam com o tema errado.
export function useIsDark() {
  const hydrated = useHydrated();
  const themeMode = useAuthStore((s) => s.themeMode);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  if (!hydrated) return true;
  return themeMode === 'system' ? prefersDark : themeMode === 'dark';
}
