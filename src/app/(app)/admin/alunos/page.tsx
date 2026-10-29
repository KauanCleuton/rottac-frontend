'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, TextField, MenuItem, Table, TableBody, TableCell, TableHead, TableRow,
  Chip, Pagination, Skeleton, InputAdornment, Alert, Avatar, alpha,
} from '@mui/material';
import { Group, Search } from '@mui/icons-material';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/pt-br';
import { adminApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

dayjs.extend(relativeTime);

const ROLE_LABEL: Record<string, string> = { STUDENT: 'Aluno', TEACHER: 'Professor', ADMIN: 'Admin' };

export default function AdminAlunosPage() {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [search, setSearch] = useState('');
  const [applied, setApplied] = useState('');
  const [planId, setPlanId] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  const params = { page, ...(applied && { search: applied }), ...(planId && { planId }), ...(role && { role }) };
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => adminApi.users(params).then((r) => r.data.data),
    placeholderData: keepPreviousData,
    enabled: isAdmin,
  });
  const { data: plans = [] } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => adminApi.plans().then((r) => r.data.data.plans as any[]),
    enabled: isAdmin,
  });

  if (!isAdmin) return <Alert severity="warning">Área exclusiva para administradores.</Alert>;

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Group sx={{ color: 'primary.main', fontSize: 32 }} /> Alunos
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>Quem está estudando, em qual plano e quanto está resolvendo.</Typography>

      <Card>
        <CardContent sx={{ pb: 1 }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
            <TextField size="small" placeholder="Buscar por nome ou e-mail" value={search} sx={{ flex: 1, minWidth: 240 }}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setApplied(search); setPage(1); } }}
              onBlur={() => { if (search !== applied) { setApplied(search); setPage(1); } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
            <TextField select size="small" label="Plano" value={planId} onChange={(e) => { setPlanId(e.target.value); setPage(1); }} sx={{ minWidth: 170 }}>
              <MenuItem value="">Todos</MenuItem>
              {plans.map((p) => <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>)}
            </TextField>
            <TextField select size="small" label="Perfil" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} sx={{ minWidth: 150 }}>
              <MenuItem value="">Todos</MenuItem>
              {Object.entries(ROLE_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
            </TextField>
          </Box>

          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Aluno</TableCell>
                  <TableCell>Plano</TableCell>
                  <TableCell align="right">Questões</TableCell>
                  <TableCell align="right">Últimos 7 dias</TableCell>
                  <TableCell align="right">Acerto</TableCell>
                  <TableCell align="right">Cadernos</TableCell>
                  <TableCell align="right">Flashcards</TableCell>
                  <TableCell>Última atividade</TableCell>
                  <TableCell>Cadastro</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [0, 1, 2, 3, 4].map((i) => <TableRow key={i}><TableCell colSpan={9}><Skeleton height={32} /></TableCell></TableRow>)
                ) : data?.users.length === 0 ? (
                  <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>Nenhum usuário encontrado.</TableCell></TableRow>
                ) : data?.users.map((u: any) => {
                  const acc = u.accuracy;
                  return (
                    <TableRow key={u.id} hover component={Link} href={`/admin/alunos/${u.id}`} sx={{ textDecoration: 'none', cursor: 'pointer' }}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: 'primary.main', color: '#0A0A0B', fontWeight: 800 }}>{u.name?.[0]?.toUpperCase()}</Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={700} noWrap>
                              {u.name}
                              {u.role !== 'STUDENT' && <Chip label={ROLE_LABEL[u.role]} size="small" sx={{ ml: 0.75, height: 18, fontSize: 10 }} />}
                              {!u.isActive && <Chip label="Desativado" size="small" color="error" variant="outlined" sx={{ ml: 0.75, height: 18, fontSize: 10 }} />}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>{u.email}</Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {u.plan && <Chip size="small" label={u.plan.name} variant="outlined" sx={{ borderColor: alpha(u.plan.color === '#0A0A0B' ? '#9CA3AF' : u.plan.color, 0.7), fontWeight: 700 }} />}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700 }}>{u.questions}</TableCell>
                      <TableCell align="right">{u.questionsLast7}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, color: acc === null ? 'text.secondary' : acc >= 70 ? '#22C55E' : acc >= 40 ? '#F59E0B' : '#EF4444' }}>
                        {acc === null ? '—' : `${acc}%`}
                      </TableCell>
                      <TableCell align="right">{u.notebooks}</TableCell>
                      <TableCell align="right">{u.flashcards}</TableCell>
                      <TableCell>{u.lastActivity ? dayjs(u.lastActivity).locale('pt-br').fromNow() : '—'}</TableCell>
                      <TableCell>{dayjs(u.createdAt).format('DD/MM/YYYY')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">{data?.total ?? 0} usuários</Typography>
            {(data?.pages ?? 1) > 1 && <Pagination count={data.pages} page={page} shape="rounded" color="primary" onChange={(_, p) => setPage(p)} />}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
