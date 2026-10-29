'use client';

import { useQuery } from '@tanstack/react-query';
import { billingApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

export type Entitlements = {
  plan: { id: string; slug: string; name: string; color: string } | null;
  subscription: { id: string; status: string; startedAt: string; expiresAt: string | null } | null;
  features: Record<string, boolean | number | null>;
  planFeatures: Record<string, boolean | number | null>;
  freeAccessForAll: boolean;
  freeAccessMessage?: string;
  unrestricted: boolean;
  orders: any[];
};

// Plano do usuário e o que ele pode usar (enquanto carrega, não bloqueia nada)
export function useEntitlements() {
  const token = useAuthStore((s) => s.token);
  const query = useQuery({
    queryKey: ['billing', 'me'],
    queryFn: () => billingApi.me().then((r) => r.data.data as Entitlements),
    enabled: Boolean(token),
    staleTime: 60_000,
  });
  const can = (feature: string) => (query.data ? Boolean(query.data.features[feature] ?? true) : true);
  return { ...query, ent: query.data, can };
}
