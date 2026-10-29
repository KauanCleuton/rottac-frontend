'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Typography, TextField, Button, Link as MuiLink, InputAdornment, IconButton, alpha,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import AuthShell from '@/components/auth/AuthShell';
import { GOLD } from '@/theme';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      const { token, user } = res.data.data;
      setAuth(token, user);
      toast.success(`Bem-vindo, ${user.name}!`);
      router.push(user.role === 'TEACHER' ? '/professor' : '/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Entrar" subtitle="Continue de onde parou nos seus estudos.">
      <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          required autoComplete="email" autoFocus
        />
        <TextField
          label="Senha" type={showPass ? 'text' : 'password'} value={password}
          onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={() => setShowPass(!showPass)} aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPass ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <Button type="submit" fullWidth variant="contained" size="large" disabled={loading} sx={{ py: 1.4, fontWeight: 700, fontSize: 16 }}>
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Não tem conta?{' '}
          <MuiLink component={Link} href="/auth/register" color="primary" sx={{ fontWeight: 700 }}>
            Criar agora
          </MuiLink>
        </Typography>

        {process.env.NODE_ENV === 'development' && (
          <Box sx={{ p: 1.5, bgcolor: alpha(GOLD, 0.08), borderRadius: 2, border: `1px solid ${alpha(GOLD, 0.25)}` }}>
            <Typography variant="caption" color="text.secondary">
              Ambiente local: <strong>demo@aprovaai.com</strong> · senha <strong>demo1234</strong>
            </Typography>
          </Box>
        )}
      </Box>
    </AuthShell>
  );
}
