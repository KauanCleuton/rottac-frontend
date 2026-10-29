'use client';

import { useState, useEffect, Suspense } from 'react';
import {
  Box, Card, CardContent, Typography, Button, CircularProgress,
  Avatar, Paper, alpha,
} from '@mui/material';
import { School, CheckCircle, Error } from '@mui/icons-material';
import { essayApi } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

function ConviteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const router = useRouter();

  const [inviteInfo, setInviteInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) { setError('Token inválido.'); setLoading(false); return; }
    essayApi.getInviteInfo(token)
      .then(r => setInviteInfo(r.data.data))
      .catch(() => setError('Convite inválido ou expirado.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    try {
      await essayApi.acceptInvite(token!);
      toast.success('Vínculo criado! Bem-vindo como professor.');
      router.push('/professor');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || 'Erro ao aceitar convite.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress />
    </Box>
  );

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: '#F5F7FA', p: 2 }}>
      <Card sx={{ maxWidth: 440, width: '100%' }}>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <Box sx={{ width: 64, height: 64, borderRadius: 3, bgcolor: '#F2B705',
            display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <School sx={{ color: '#fff', fontSize: 32 }} />
          </Box>

          {error ? (
            <>
              <Error sx={{ fontSize: 48, color: '#EF4444', mb: 1 }} />
              <Typography variant="h6" fontWeight={700} mb={1}>Convite inválido</Typography>
              <Typography color="text.secondary">{error}</Typography>
              <Button variant="contained" sx={{ mt: 3 }} onClick={() => router.push('/')}>Ir para o início</Button>
            </>
          ) : inviteInfo?.used ? (
            <>
              <CheckCircle sx={{ fontSize: 48, color: '#22C55E', mb: 1 }} />
              <Typography variant="h6" fontWeight={700}>Convite já utilizado</Typography>
              <Typography color="text.secondary" mt={1}>Este convite já foi aceito.</Typography>
            </>
          ) : (
            <>
              <Typography variant="h6" fontWeight={700} mb={1}>Convite de professor</Typography>
              <Typography color="text.secondary" mb={3}>
                Você foi convidado por
              </Typography>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: alpha('#F2B705', 0.06),
                border: `1px solid ${alpha('#F2B705', 0.2)}`, mb: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar src={inviteInfo?.studentAvatar} sx={{ width: 44, height: 44 }}>
                  {inviteInfo?.studentName?.[0]}
                </Avatar>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography fontWeight={700}>{inviteInfo?.studentName}</Typography>
                  <Typography variant="caption" color="text.secondary">quer que você seja o professor de redação</Typography>
                </Box>
              </Paper>

              <Typography variant="body2" color="text.secondary" mb={3}>
                Ao aceitar, você terá acesso às redações deste aluno para corrigir e fornecer feedback.
              </Typography>

              <Button fullWidth variant="contained" size="large"
                sx={{ background: 'linear-gradient(135deg,#F2B705,#FFD34D)', fontWeight: 700, py: 1.5 }}
                onClick={handleAccept} disabled={accepting}>
                {accepting ? <CircularProgress size={20} color="inherit" /> : 'Aceitar convite'}
              </Button>
              <Button fullWidth variant="text" sx={{ mt: 1 }} onClick={() => router.push('/login')}>
                Fazer login primeiro
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default function ConvitePage() {
  return (
    <Suspense fallback={
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    }>
      <ConviteContent />
    </Suspense>
  );
}
