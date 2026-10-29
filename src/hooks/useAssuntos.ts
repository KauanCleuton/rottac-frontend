'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { questionBankApi } from '@/lib/api';

// Árvore de matérias e assuntos (matéria › assunto › subassunto..., até 6 níveis).
// Vem compacta do backend ([id, parentId, nome]) e é montada uma vez por sessão.
export type AssuntoNode = { id: number; parentId: number | null; name: string; depth: number; children: number[]; search: string };
export type Assuntos = {
  byId: Map<number, AssuntoNode>;
  roots: number[];
  pathOf: (id: number) => AssuntoNode[];
  descendants: (id: number) => number[];
};

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function build(rows: [number, number | null, string][]): Assuntos {
  const byId = new Map<number, AssuntoNode>();
  const roots: number[] = [];
  for (const [id, parentId, name] of rows) byId.set(id, { id, parentId, name, depth: 1, children: [], search: normalize(name) });
  // Linhas vêm na ordem da árvore (pais antes dos filhos)
  for (const n of byId.values()) {
    const p = n.parentId ? byId.get(n.parentId) : undefined;
    if (p) { p.children.push(n.id); n.depth = p.depth + 1; } else roots.push(n.id);
  }
  const pathOf = (id: number) => {
    const out: AssuntoNode[] = [];
    let n = byId.get(id);
    while (n) { out.unshift(n); n = n.parentId ? byId.get(n.parentId) : undefined; }
    return out;
  };
  const descendants = (id: number) => {
    const out: number[] = [];
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      out.push(cur);
      for (const c of byId.get(cur)?.children || []) stack.push(c);
    }
    return out;
  };
  return { byId, roots, pathOf, descendants };
}

export function useAssuntos() {
  const { data, isLoading } = useQuery({
    queryKey: ['assuntos'],
    queryFn: () => questionBankApi.assuntos().then((r) => r.data.data as [number, number | null, string][]),
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const tree = useMemo(() => (data ? build(data) : null), [data]);
  return { tree, isLoading };
}
