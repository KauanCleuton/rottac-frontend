'use client';

import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, alpha, useTheme, Grid,
  Avatar, CircularProgress, Select, MenuItem, FormControl, InputLabel,
  TextField, InputAdornment, Button,
} from '@mui/material';
import { Search, Assignment } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { teacherApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { alpha as a } from '@mui/material';

const STATUS_OPTS = [
  { value: '', label: 'Todas' },
  { value: 'PENDING', label: 'Pendentes' },
  { value: 'REWRITTEN', label: 'Reescritas' },
  { value: 'CORRECTED', label: 'Corrigidas' },
];
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#F59E0B', REWRITTEN: '#D4A017', CORRECTED: '#22C55E', REWRITE_REQUESTED: '#EF4444',
};

export default function ProfessorEssaysPage() {
  const theme = useTheme();
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-essays', status],
    queryFn: () => teacherApi.listEssays({ status: status || undefined, limit: 50 }).then(r => r.data.data),
  });

  const essays: any[] = (data?.essays || []).filter((e: any) =>
    !search || e.title.toLowerCase().includes(search.toLowerCase()) ||
    e.student?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Redações dos alunos</Typography>
          <Typography color="text.secondary" variant="body2">{data?.total ?? 0} redações no total</Typography>
        </Box>
      </Box>

      {/* Filtros */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField size="small" placeholder="Buscar por título ou aluno..."
          value={search} onChange={e => setSearch(e.target.value)} sx={{ flexGrow: 1, maxWidth: 340 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Status</InputLabel>
          <Select value={status} label="Status" onChange={e => setStatus(e.target.value)}>
            {STATUS_OPTS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
      ) : essays.length === 0 ? (
        <Card><CardContent sx={{ textAlign: 'center', py: 6 }}>
          <Assignment sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
          <Typography fontWeight={600}>Nenhuma redação encontrada</Typography>
        </CardContent></Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {essays.map((essay: any) => {
            const color = STATUS_COLORS[essay.status] || '#9CA3AF';
            const label = STATUS_OPTS.find(o => o.value === essay.status)?.label || essay.status;
            return (
              <Card key={essay.id} sx={{ cursor: 'pointer', '&:hover': { boxShadow: 4 }, transition: 'box-shadow 0.2s' }}
                onClick={() => router.push(`/professor/redacoes/${essay.id}`)}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Avatar src={essay.student?.avatar} sx={{ width: 40, height: 40, flexShrink: 0 }}>
                      {essay.student?.name?.[0]}
                    </Avatar>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap>{essay.title}</Typography>
                      <Typography variant="caption" color="text.secondary">{essay.student?.name}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                      {essay.corrections?.[0]?.totalScore != null && (
                        <Chip label={`${essay.corrections[0].totalScore}/1000`} size="small"
                          sx={{ fontWeight: 700 }} />
                      )}
                      <Chip label={label} size="small"
                        sx={{ bgcolor: alpha(color, 0.1), color, fontWeight: 600 }} />
                      <Typography variant="caption" color="text.secondary">
                        {dayjs(essay.submittedAt).format('DD/MM/YY')}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
