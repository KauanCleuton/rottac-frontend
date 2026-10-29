'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Typography, ToggleButtonGroup, ToggleButton, Button, Alert, Skeleton, Chip,
  LinearProgress, CircularProgress, alpha, useTheme,
} from '@mui/material';
import { FactCheck, SkipNext, Save, OpenInNew, CheckCircle } from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import RichText from '@/components/common/RichText';
import RichTextField from '@/components/common/RichTextField';
import AssuntoPicker from '@/components/questions/AssuntoPicker';
import SupportText from '@/components/questions/SupportText';
import { choicesOf, type BankQuestion } from '@/components/questions/types';

type Missing = 'assunto' | 'answer' | 'explanation';
const TABS: { key: Missing; label: string; count: string; hint: string }[] = [
  { key: 'assunto', label: 'Sem classificação', count: 'withoutAssunto', hint: 'Escolha o assunto na árvore. Disciplina e assunto em texto são atualizados juntos.' },
  { key: 'answer', label: 'Sem gabarito', count: 'withoutAnswer', hint: 'Sem gabarito a questão não conta acerto/erro nem entra em simulados.' },
  { key: 'explanation', label: 'Sem comentário', count: 'withoutExplanation', hint: 'O comentário do professor aparece depois que o aluno responde.' },
];

function Editor({ q, missing, onSaved, onSkip, position, total }: {
  q: BankQuestion; missing: Missing; onSaved: () => void; onSkip: () => void; position: number; total: number;
}) {
  const theme = useTheme();
  const [assuntoId, setAssuntoId] = useState<number | null>(q.assuntoId ?? null);
  const [answer, setAnswer] = useState<string | null>(q.answer ?? null);
  const [explanation, setExplanation] = useState(q.explanation || '');
  const [saving, setSaving] = useState(false);
  const choices = choicesOf(q);

  const required = missing === 'assunto' ? assuntoId : missing === 'answer' ? answer : explanation.trim();
  const save = async () => {
    if (!required) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {};
      if (assuntoId !== (q.assuntoId ?? null)) data.assuntoId = assuntoId;
      if (answer !== (q.answer ?? null)) data.answer = answer;
      if (explanation.trim() !== (q.explanation || '').trim()) data.explanation = explanation.trim() || null;
      await questionBankApi.update(q.id, data);
      toast.success('Salvo');
      onSaved();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+Enter salva e vai para a próxima
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const meta = [q.banca, q.orgao, q.cargo, q.year, q.source].filter(Boolean).join(' · ');
  return (
    <Card>
      <LinearProgress variant="determinate" value={(position / Math.max(1, total)) * 100} sx={{ height: 3 }} />
      <CardContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1fr' }, gap: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`${position} de ${total}`} />
            {meta && <Typography variant="caption" color="text.secondary">{meta}</Typography>}
            <Button size="small" component={Link} href={`/questoes/${q.id}`} target="_blank" endIcon={<OpenInNew sx={{ fontSize: 14 }} />} sx={{ ml: 'auto' }}>
              Abrir
            </Button>
          </Box>
          {(q.discipline || q.topic) && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Texto original: <strong>{[q.discipline, q.topic].filter(Boolean).join(' › ')}</strong>
            </Typography>
          )}
          {q.text && <SupportText text={q.text} />}
          <Box sx={{ maxHeight: 420, overflowY: 'auto', pr: 1 }}>
            <RichText text={q.statement} component="div" sx={{ fontSize: 15, lineHeight: 1.7, mb: 1.5 }} />
            {choices.map((c) => (
              <Box key={c.key} onClick={missing === 'answer' ? () => setAnswer(c.key) : undefined}
                sx={{
                  display: 'flex', gap: 1, p: 1, mb: 0.5, borderRadius: 1.5,
                  cursor: missing === 'answer' ? 'pointer' : 'default',
                  border: `1px solid ${answer === c.key ? theme.palette.success.main : theme.palette.divider}`,
                  bgcolor: answer === c.key ? alpha(theme.palette.success.main, 0.08) : 'transparent',
                }}>
                <Typography fontWeight={800} sx={{ minWidth: 18 }}>{q.type === 'CERTO_ERRADO' ? '' : c.key}</Typography>
                <RichText text={c.text} sx={{ fontSize: 14, flexGrow: 1 }} />
                {answer === c.key && <CheckCircle fontSize="small" color="success" />}
              </Box>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <AssuntoPicker value={assuntoId} onChange={(id) => setAssuntoId(id)} label="Matéria / assunto"
            helperText={missing === 'assunto' ? 'Obrigatório nesta fila' : undefined} />
          <Box>
            <Typography variant="overline" color="text.secondary">Gabarito {missing === 'answer' && '(clique na alternativa)'}</Typography>
            <ToggleButtonGroup size="small" exclusive value={answer} onChange={(_, v) => setAnswer(v)} sx={{ display: 'flex', flexWrap: 'wrap' }}>
              {choices.map((c) => <ToggleButton key={c.key} value={c.key} sx={{ px: 2 }}>{q.type === 'CERTO_ERRADO' ? c.text : c.key}</ToggleButton>)}
            </ToggleButtonGroup>
          </Box>
          <RichTextField compact fullWidth multiline minRows={missing === 'explanation' ? 6 : 3} maxRows={14}
            label="Comentário do professor" value={explanation} onChange={setExplanation}
            placeholder="Explique o gabarito. Ex.: Correta, conforme o art. 37 da CF..." />
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 'auto', flexWrap: 'wrap' }}>
            <Button color="inherit" startIcon={<SkipNext />} onClick={onSkip} disabled={saving}>Pular</Button>
            <Button variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />} onClick={save} disabled={!required || saving}>
              Salvar e próxima
            </Button>
          </Box>
          <Typography variant="caption" color="text.disabled" sx={{ textAlign: 'right', mt: -1 }}>Atalho: Ctrl + Enter</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function CuradoriaPage() {
  const qc = useQueryClient();
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [missing, setMissing] = useState<Missing>('assunto');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(0);

  const { data: overview } = useQuery({
    queryKey: ['admin', 'qb-overview'],
    queryFn: () => questionBankApi.adminOverview().then((r) => r.data.data),
    enabled: isAdmin,
  });
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin', 'curadoria', missing],
    queryFn: () => questionBankApi.list({ missing, scope: 'public', limit: 50 }).then((r) => r.data.data),
    enabled: isAdmin,
  });
  const list: BankQuestion[] = useMemo(() => (data?.questions || data?.items || []).filter((q: BankQuestion) => !skipped.has(q.id)), [data, skipped]);
  const current = list[0];
  const tab = TABS.find((t) => t.key === missing)!;
  const total = overview?.[tab.count] ?? list.length;

  if (!isAdmin) return <Alert severity="warning">Área exclusiva para administradores.</Alert>;

  const changeTab = (m: Missing) => { setMissing(m); setSkipped(new Set()); setDone(0); };
  const afterSave = () => {
    setDone((d) => d + 1);
    qc.invalidateQueries({ queryKey: ['admin', 'curadoria'] });
    qc.invalidateQueries({ queryKey: ['admin', 'qb-overview'] });
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <FactCheck sx={{ color: 'primary.main', fontSize: 32 }} /> Curadoria de questões
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Resolva as pendências do banco público uma a uma: classificar na árvore, informar gabarito e escrever comentário.
      </Typography>

      <ToggleButtonGroup exclusive size="small" value={missing} onChange={(_, v) => v && changeTab(v)} sx={{ mb: 1, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <ToggleButton key={t.key} value={t.key}>{t.label} ({overview?.[t.count] ?? '…'})</ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tab.hint}{done > 0 && <> · <strong>{done}</strong> resolvida(s) nesta sessão</>}
      </Typography>

      {isLoading ? (
        <Skeleton variant="rounded" height={420} />
      ) : !current ? (
        <Alert severity="success" icon={<CheckCircle />}>
          {skipped.size ? `Fila percorrida. ${skipped.size} questão(ões) pulada(s) — troque de aba e volte para revê-las.` : 'Nenhuma pendência nesta fila. 🎉'}
        </Alert>
      ) : (
        <Box sx={{ opacity: isFetching ? 0.7 : 1, transition: 'opacity .2s' }}>
          <Editor key={current.id} q={current} missing={missing} position={done + skipped.size + 1} total={total + done}
            onSaved={afterSave} onSkip={() => setSkipped((s) => new Set(s).add(current.id))} />
        </Box>
      )}
    </Box>
  );
}
