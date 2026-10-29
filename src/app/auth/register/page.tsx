'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Box, Typography, TextField, Button, Link as MuiLink, alpha, useTheme } from '@mui/material';
import { School, MenuBook } from '@mui/icons-material';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';

type Role = 'STUDENT' | 'TEACHER';

function RegisterContent() {
  const theme = useTheme();
  const router = useRouter();
  const plano = useSearchParams().get('plano'); // plano escolhido na página de apresentação
  const { setAuth } = useAuthStore();
  const [role, setRole] = useState<Role>('STUDENT');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const gold = theme.palette.primary.main;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error('A senha deve ter pelo menos 8 caracteres'); return; }
    setLoading(true);
    try {
      const res = await authApi.register({ ...form, role });
      const { token, user } = res.data.data;
      setAuth(token, user);
      toast.success('Conta criada com sucesso!');
      router.push(role === 'TEACHER' ? '/professor' : plano ? `/planos?plano=${plano}` : '/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Criar conta" subtitle="Comece grátis e monte sua rota de estudos.">
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3 }}>
        {([
          { value: 'STUDENT' as Role, label: 'Sou aluno', desc: 'Quero estudar e passar', icon: <MenuBook sx={{ fontSize: 26 }} /> },
          { value: 'TEACHER' as Role, label: 'Sou professor', desc: 'Quero corrigir redações', icon: <School sx={{ fontSize: 26 }} /> },
        ]).map((opt) => {
          const active = role === opt.value;
          return (
            <Box key={opt.value} role="button" tabIndex={0} onClick={() => setRole(opt.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setRole(opt.value); }}
              sx={{
                flex: 1, p: 2, borderRadius: 2, cursor: 'pointer', textAlign: 'center',
                border: `2px solid ${active ? gold : theme.palette.divider}`,
                bgcolor: active ? alpha(gold, 0.1) : 'transparent',
                transition: 'all 0.2s',
                '&:hover': { borderColor: alpha(gold, 0.6) },
              }}>
              <Box sx={{ color: active ? 'primary.main' : 'text.secondary', mb: 0.5 }}>{opt.icon}</Box>
              <Typography fontWeight={700} fontSize={14}>{opt.label}</Typography>
              <Typography variant="caption" color="text.secondary" display="block">{opt.desc}</Typography>
            </Box>
          );
        })}
      </Box>

      <Box component="form" onSubmit={handleRegister} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField label="Nome completo" value={form.name} required autoComplete="name"
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        <TextField label="E-mail" type="email" value={form.email} required autoComplete="email"
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        <TextField label="Senha" type="password" value={form.password} required autoComplete="new-password"
          helperText="Mínimo de 8 caracteres"
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />

        <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ py: 1.4, fontWeight: 700, fontSize: 16 }}>
          {loading ? 'Criando conta...' : `Criar conta ${role === 'TEACHER' ? 'de professor' : 'grátis'}`}
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Já tem conta?{' '}
          <MuiLink component={Link} href="/auth/login" color="primary" sx={{ fontWeight: 700 }}>Entrar</MuiLink>
        </Typography>
      </Box>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterContent />
    </Suspense>
  );
}
