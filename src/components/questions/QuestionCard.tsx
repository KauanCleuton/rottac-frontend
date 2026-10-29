'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Box, Card, CardContent, Typography, Chip, Button, IconButton, Tooltip, Collapse, Divider,
  LinearProgress, alpha, useTheme, CircularProgress,
} from '@mui/material';
import {
  Star, StarBorder, ChatBubbleOutline, ContentCut, CheckCircle, Cancel, Edit, Lightbulb, Draw, EventRepeat,
  BarChart, History, Block, Update, OutlinedFlag,
} from '@mui/icons-material';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { questionBankApi } from '@/lib/api';
import CommentsPanel from './CommentsPanel';
import AnnotationLayer from './AnnotationLayer';
import SupportText from './SupportText';
import ReportDialog from './ReportDialog';
import RichText from '@/components/common/RichText';
import AddToNotebookButton from '@/components/notebooks/AddToNotebookButton';
import { useAuthStore } from '@/store/auth.store';
import {
  type BankQuestion, type AnswerResult, choicesOf, answerLabel,
  TYPE_LABEL, DIFFICULTY_LABEL, DIFFICULTY_COLOR,
} from './types';

// Frases sorteadas a cada resposta (acerto comemora, erro incentiva)
const PRAISE = [
  'Boaaa! 🎯', 'Mandou bem! 👏', 'Está no caminho certo! 🚀', 'Aprendeu o conteúdo muito bem! 📚',
  'Arrasou! Essa já é sua. ✨', 'Isso aí! Ritmo de aprovado. 🏆', 'Na mosca! 🎯', 'Excelente, continue assim! 💪',
  'Show! A banca não te pega. 😎', 'Perfeito! Conteúdo dominado. ✅',
];
const ENCOURAGE = [
  'Quase! Leia o comentário e fixe esse ponto. 💡', 'Errar aqui é melhor do que errar na prova. 💪',
  'Faz parte! Essa vai para a sua revisão. 📌', 'Não desanime: entenda o porquê e siga em frente. 🔁',
  'Ponto de atenção anotado. Bora entender o motivo! 🧠',
];
const pick = (list: string[]) => list[Math.floor(Math.random() * list.length)];

const OK = '#22C55E';
const BAD = '#EF4444';

type Props = {
  question: BankQuestion;
  index?: number;
  // instant: responde na hora (treino/banco) | deferred: só marca (simulado) | preview: sem interação com API
  mode?: 'instant' | 'deferred' | 'preview';
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  onAnswered?: (result: AnswerResult, selected: string) => void;
  hideActions?: boolean;
  // Resultado vindo de fora (ex.: revisão do simulado)
  reviewResult?: { selected: string | null; correctAnswer: string | null; explanation?: string | null } | null;
  // Resposta registrada dentro deste caderno
  notebookId?: string;
};

export function MetaLine({ q }: { q: Pick<BankQuestion, 'discipline' | 'topic' | 'banca' | 'orgao' | 'cargo' | 'year' | 'assuntoPath'> }) {
  const parts = [q.banca, q.year, q.orgao, q.cargo].filter(Boolean);
  const path = q.assuntoPath || [];
  return (
    <Box sx={{ minWidth: 0 }}>
      {path.length > 0 ? (
        // Caminho completo na árvore: matéria em destaque, níveis intermediários discretos
        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }} title={path.join(' › ')}>
          {path[0]}
          {path.slice(1).map((name, i) => (
            <Box key={i} component="span" sx={{ color: 'text.secondary', fontWeight: i === path.length - 2 ? 600 : 400 }}> › {name}</Box>
          ))}
        </Typography>
      ) : (q.discipline || q.topic) && (
        <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.3 }}>
          {q.discipline || 'Sem disciplina'}
          {q.topic && <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}> › {q.topic}</Box>}
        </Typography>
      )}
      {parts.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {parts.join(' · ')}
        </Typography>
      )}
    </Box>
  );
}

// Avisa o que aconteceu com a revisão espaçada / Caderno de Erros após responder
function ReviewNote({ review }: { review: NonNullable<AnswerResult['review']> }) {
  const when = (days?: number) => (days === 1 ? 'amanhã' : `em ${days} dias`);
  let text: string;
  if (review.mastered) text = 'Questão dominada: saiu da revisão espaçada e o erro foi marcado como resolvido.';
  else if (review.addedToErrorNotebook) text = `Adicionada ao Caderno de Erros. Ela volta para revisão ${when(review.interval)}.`;
  else if (review.counted === false) text = 'Acerto registrado. A revisão desta questão ainda não venceu, então a agenda não mudou.';
  else text = `Próxima revisão desta questão ${when(review.interval)}.`;
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, mt: -1 }}>
      <EventRepeat sx={{ fontSize: 18, color: 'text.secondary' }} />
      <Typography variant="body2" color="text.secondary">
        {text}{' '}
        {review.addedToErrorNotebook && <Link href="/caderno-erros" style={{ color: 'inherit', fontWeight: 700 }}>Ver caderno</Link>}
      </Typography>
    </Box>
  );
}

export default function QuestionCard({
  question, index, mode = 'instant', selected: controlledSelected, onSelect, onAnswered, hideActions, reviewResult, notebookId,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const gold = theme.palette.primary.main;
  const goldText = isDark ? gold : theme.palette.primary.dark;
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [q, setQ] = useState(question);
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const [struck, setStruck] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [feedback, setFeedback] = useState('');
  const [sending, setSending] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showExplanation, setShowExplanation] = useState(true);
  const startedAt = useRef(Date.now());
  const [penActive, setPenActive] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const canAnnotate = mode !== 'preview';

  useEffect(() => { setQ(question); }, [question]);

  const selected = mode === 'deferred' ? controlledSelected ?? null : localSelected;
  const choices = choicesOf(q);
  const isCE = q.type === 'CERTO_ERRADO';
  const revealed = result
    ? { selected: localSelected, correctAnswer: result.correctAnswer, explanation: result.explanation }
    : reviewResult ?? null;

  const choose = (key: string) => {
    if (revealed || mode === 'preview') return;
    if (struck.has(key)) return;
    const next = selected === key ? null : key;
    if (mode === 'deferred') onSelect?.(next);
    else setLocalSelected(next);
  };

  const toggleStrike = (key: string) => {
    if (revealed) return;
    setStruck((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
    if (selected === key) {
      if (mode === 'deferred') onSelect?.(null); else setLocalSelected(null);
    }
  };

  const submit = async () => {
    if (!localSelected) return;
    setSending(true);
    try {
      const timeSpent = Math.round((Date.now() - startedAt.current) / 1000);
      const res = await questionBankApi.answer(q.id, { selected: localSelected, timeSpent, ...(notebookId && { notebookId }) });
      const data: AnswerResult = res.data.data;
      setResult(data);
      setFeedback(data.hasAnswer ? pick(data.isCorrect ? PRAISE : ENCOURAGE) : '');
      setQ((prev) => ({
        ...prev,
        answer: data.correctAnswer,
        explanation: data.explanation,
        myAttempts: prev.myAttempts + 1,
        lastAttempt: { selected: localSelected, isCorrect: data.isCorrect, createdAt: new Date().toISOString() },
      }));
      onAnswered?.(data, localSelected);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Erro ao registrar resposta');
    } finally {
      setSending(false);
    }
  };

  const retry = () => {
    setResult(null);
    setFeedback('');
    setLocalSelected(null);
    setStruck(new Set());
    startedAt.current = Date.now();
  };

  const toggleFavorite = async () => {
    try {
      const r = await questionBankApi.toggleFavorite(q.id);
      setQ((prev) => ({ ...prev, isFavorite: r.data.data.isFavorite }));
    } catch {
      toast.error('Não foi possível favoritar');
    }
  };

  const optionStyle = (key: string) => {
    const isSel = selected === key || revealed?.selected === key;
    const isRight = revealed && revealed.correctAnswer === key;
    const isWrongPick = revealed && revealed.selected === key && revealed.correctAnswer !== key;
    const color = isRight ? OK : isWrongPick ? BAD : isSel ? gold : null;
    return {
      color,
      border: `1.5px solid ${color ?? theme.palette.divider}`,
      bg: color ? alpha(color, isDark ? 0.1 : 0.08) : 'transparent',
      isSel, isRight, isWrongPick,
    };
  };

  const correct = result ? result.isCorrect : null;
  const distribution = result?.community.distribution ?? {};
  const totalAnswers = result?.community.totalAnswers ?? 0;
  // Alternativa errada mais marcada pela comunidade ("pegadinha"), só com amostra mínima
  const trap = (() => {
    if (!result?.correctAnswer || totalAnswers < 5) return null;
    const [letter, n] = Object.entries(distribution)
      .filter(([l]) => l !== result.correctAnswer)
      .sort((a, b) => b[1] - a[1])[0] || [];
    const pct = letter ? Math.round((n / totalAnswers) * 100) : 0;
    return pct >= 20 ? { letter, pct } : null;
  })();

  return (
    <Card sx={{ overflow: 'visible' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 }, '&:last-child': { pb: { xs: 2, sm: 3 } } }}>
        {/* Cabeçalho */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', mb: 2 }}>
          {index !== undefined && (
            <Box sx={{
              minWidth: 36, height: 36, px: 1, borderRadius: 2, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: alpha(gold, 0.12), color: isDark ? gold : theme.palette.primary.dark, fontWeight: 800, fontSize: 14,
            }}>
              {index}
            </Box>
          )}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <MetaLine q={q} />
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
              <Chip size="small" label={TYPE_LABEL[q.type]} variant="outlined" sx={{ height: 22, fontSize: 11 }} />
              <Chip size="small" label={DIFFICULTY_LABEL[q.difficulty]}
                sx={{ height: 22, fontSize: 11, bgcolor: alpha(DIFFICULTY_COLOR[q.difficulty], 0.12), color: DIFFICULTY_COLOR[q.difficulty] }} />
              {!q.isPublic && <Chip size="small" label="Minha questão" sx={{ height: 22, fontSize: 11 }} />}
              {q.isAnnulled && <Chip size="small" icon={<Block sx={{ fontSize: 13 }} />} label="Anulada" color="error" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
              {q.isOutdated && <Chip size="small" icon={<Update sx={{ fontSize: 13 }} />} label="Desatualizada" color="warning" variant="outlined" sx={{ height: 22, fontSize: 11 }} />}
              {q.lastAttempt && !result && mode !== 'deferred' && (
                <Chip size="small" icon={<History sx={{ fontSize: 13 }} />}
                  label={q.lastAttempt.isCorrect ? 'Você acertou' : 'Você errou'}
                  sx={{ height: 22, fontSize: 11, bgcolor: alpha(q.lastAttempt.isCorrect ? OK : BAD, 0.12), color: q.lastAttempt.isCorrect ? OK : BAD }} />
              )}
            </Box>
          </Box>
          {canAnnotate && (
            <Box sx={{ display: 'flex', flexShrink: 0 }}>
              <Tooltip title={penActive ? 'Fechar caneta' : 'Caneta e marca-texto'}>
                <IconButton size="small" onClick={() => setPenActive((v) => !v)} aria-label="Caneta" aria-pressed={penActive}
                  sx={penActive ? { bgcolor: alpha(gold, 0.2), color: goldText } : undefined}>
                  <Draw fontSize="small" />
                </IconButton>
              </Tooltip>
              {!hideActions && (
              <Tooltip title={q.isFavorite ? 'Remover dos favoritos' : 'Favoritar'}>
                <IconButton size="small" onClick={toggleFavorite} aria-label="Favoritar">
                  {q.isFavorite ? <Star sx={{ color: gold }} /> : <StarBorder />}
                </IconButton>
              </Tooltip>
              )}
              {!hideActions && (q.isOwner || isAdmin) && (
                <Tooltip title="Editar questão">
                  <IconButton size="small" component={Link} href={`/questoes/${q.id}/editar`} aria-label="Editar">
                    <Edit fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          )}
        </Box>

        <AnnotationLayer questionId={q.id} active={penActive} hasAnnotation={canAnnotate && q.hasAnnotation}
          onClose={() => setPenActive(false)}>
        {/* Texto de apoio (ex.: "Texto I" de Português) */}
        {q.text && <SupportText text={q.text} />}

        {/* Enunciado */}
        <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, mb: 2.5, fontSize: 15.5 }}>
          <RichText text={q.statement} />
        </Typography>

        {/* Alternativas */}
        {isCE ? (
          <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
            {choices.map((c) => {
              const st = optionStyle(c.key);
              return (
                <Button key={c.key} fullWidth onClick={() => choose(c.key)} disabled={mode === 'preview'}
                  startIcon={c.key === 'C' ? <CheckCircle /> : <Cancel />}
                  sx={{
                    py: 1.25, fontWeight: 700, fontSize: 15, borderRadius: 2,
                    border: st.border, bgcolor: st.bg, color: st.color === gold ? goldText : st.color ?? 'text.primary',
                    '&:hover': { bgcolor: alpha(st.color ?? gold, 0.1), borderColor: st.color ?? gold },
                  }}>
                  {c.text}
                </Button>
              );
            })}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
            {choices.map((c) => {
              const st = optionStyle(c.key);
              const isStruck = struck.has(c.key);
              const pct = totalAnswers ? Math.round(((distribution[c.key] || 0) / totalAnswers) * 100) : null;
              return (
                <Box key={c.key} sx={{ display: 'flex', alignItems: 'stretch', gap: 0.75 }}>
                  <Tooltip title={isStruck ? 'Desfazer' : 'Riscar alternativa'}>
                    <span>
                      <IconButton size="small" onClick={() => toggleStrike(c.key)} disabled={Boolean(revealed) || mode === 'preview'}
                        sx={{ mt: 0.75, color: isStruck ? gold : 'text.disabled' }} aria-label="Riscar alternativa">
                        <ContentCut sx={{ fontSize: 16 }} />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Box
                    role="button" tabIndex={0}
                    onClick={() => choose(c.key)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(c.key); } }}
                    sx={{
                      flexGrow: 1, display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.25, borderRadius: 2,
                      cursor: revealed || mode === 'preview' ? 'default' : 'pointer',
                      border: st.border, bgcolor: st.bg, position: 'relative', overflow: 'hidden',
                      opacity: isStruck ? 0.45 : 1, transition: 'all .15s',
                      '&:hover': revealed || mode === 'preview' ? {} : { borderColor: gold, bgcolor: alpha(gold, 0.05) },
                      '&:focus-visible': { outline: `2px solid ${gold}`, outlineOffset: 2 },
                    }}
                  >
                    {pct !== null && (
                      <Box sx={{ position: 'absolute', inset: 0, width: `${pct}%`, bgcolor: alpha(st.color ?? theme.palette.text.secondary, 0.07), pointerEvents: 'none' }} />
                    )}
                    <Box sx={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0, position: 'relative',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13,
                      bgcolor: st.color ?? alpha(theme.palette.text.primary, 0.08),
                      color: st.color ? '#0A0A0B' : 'text.primary',
                    }}>
                      {c.key}
                    </Box>
                    <Typography variant="body2" sx={{ flexGrow: 1, mt: 0.4, lineHeight: 1.6, position: 'relative', textDecoration: isStruck ? 'line-through' : 'none' }}>
                      <RichText text={c.text} />
                    </Typography>
                    {pct !== null && (
                      <Typography variant="caption" sx={{ position: 'relative', fontWeight: 700, color: 'text.secondary', mt: 0.5 }}>{pct}%</Typography>
                    )}
                    {st.isRight && <CheckCircle sx={{ color: OK, fontSize: 20, position: 'relative', mt: 0.4 }} />}
                    {st.isWrongPick && <Cancel sx={{ color: BAD, fontSize: 20, position: 'relative', mt: 0.4 }} />}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}

        </AnnotationLayer>

        {/* Resultado */}
        {result && (
          <Box sx={{
            p: 1.5, mb: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
            bgcolor: alpha(correct ? OK : BAD, 0.1), border: `1px solid ${alpha(correct ? OK : BAD, 0.4)}`,
            // Acerto "pula" de leve; erro só aparece
            animation: correct ? 'answerPop .45s cubic-bezier(.2,.9,.3,1.4)' : 'answerIn .3s ease-out',
            '@keyframes answerPop': { '0%': { transform: 'scale(.94)', opacity: 0 }, '60%': { transform: 'scale(1.02)', opacity: 1 }, '100%': { transform: 'scale(1)' } },
            '@keyframes answerIn': { from: { transform: 'translateY(-4px)', opacity: 0 }, to: { transform: 'none', opacity: 1 } },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}>
            {correct ? <CheckCircle sx={{ color: OK }} /> : <Cancel sx={{ color: BAD }} />}
            <Box sx={{ flexGrow: 1 }}>
              <Typography fontWeight={800} sx={{ color: correct ? OK : BAD }}>
                {!result.hasAnswer ? 'Resposta registrada (questão sem gabarito)' : feedback || (correct ? 'Você acertou!' : 'Você errou.')}
              </Typography>
              {result.hasAnswer && (
                <Typography variant="body2" color="text.secondary">
                  Gabarito: <strong>{answerLabel(q.type, result.correctAnswer)}</strong>
                  {result.isAnnulled && ' · questão anulada (conta como acerto)'}
                </Typography>
              )}
              {trap && (
                <Typography variant="body2" color="text.secondary">
                  Pegadinha: <strong>{trap.pct}%</strong> marcaram <strong>{answerLabel(q.type, trap.letter)}</strong>
                  {selected === trap.letter ? ' — você caiu junto com muita gente.' : '.'}
                </Typography>
              )}
            </Box>
            {result.community.accuracy !== null && (
              <Chip size="small" icon={<BarChart sx={{ fontSize: 15 }} />}
                label={`${result.community.accuracy}% acertam · ${totalAnswers} resp.`} variant="outlined" />
            )}
            <Button size="small" onClick={retry}>Refazer</Button>
          </Box>
        )}

        {result?.review && <ReviewNote review={result.review} />}

        {revealed?.explanation && (
          <Box sx={{ mb: 2 }}>
            <Button size="small" startIcon={<Lightbulb />} onClick={() => setShowExplanation((v) => !v)} sx={{ mb: 1 }}>
              {showExplanation ? 'Ocultar comentário do professor' : 'Ver comentário do professor'}
            </Button>
            <Collapse in={showExplanation}>
              <Box sx={{ p: 2, borderRadius: 2, bgcolor: alpha(gold, isDark ? 0.06 : 0.08), borderLeft: `3px solid ${gold}` }}>
                <RichText text={revealed.explanation} component="div" sx={{ fontSize: 14, lineHeight: 1.7 }} />
              </Box>
            </Collapse>
          </Box>
        )}

        {reviewResult && !result && mode !== 'preview' && (
          <Typography variant="body2" sx={{ mb: 1.5, color: 'text.secondary' }}>
            Sua resposta: <strong>{reviewResult.selected ? answerLabel(q.type, reviewResult.selected) : 'em branco'}</strong>
            {' · '}Gabarito: <strong>{answerLabel(q.type, reviewResult.correctAnswer)}</strong>
          </Typography>
        )}

        {/* Ações */}
        {mode === 'instant' && !result && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={submit} disabled={!localSelected || sending} sx={{ px: 4 }}>
              {sending ? <CircularProgress size={20} color="inherit" /> : 'Responder'}
            </Button>
            {!localSelected && <Typography variant="caption" color="text.secondary">Selecione uma alternativa</Typography>}
          </Box>
        )}

        {!hideActions && mode !== 'preview' && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Button size="small" color="inherit" startIcon={<ChatBubbleOutline fontSize="small" />} onClick={() => setShowComments((v) => !v)}
                sx={{ color: 'text.secondary' }}>
                Comentários ({q.commentsCount})
              </Button>
              <AddToNotebookButton questionId={q.id} />
              <Button size="small" color="inherit" startIcon={<OutlinedFlag fontSize="small" />} onClick={() => setReportOpen(true)} sx={{ color: 'text.secondary' }}>
                Reportar
              </Button>
              {q.myAttempts > 0 && (
                <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto' }}>
                  Respondida {q.myAttempts}x
                </Typography>
              )}
            </Box>
            <Collapse in={showComments} unmountOnExit>
              <Box sx={{ pt: 2 }}>
                <CommentsPanel questionId={q.id} onCountChange={(n) => setQ((p) => ({ ...p, commentsCount: n }))} />
              </Box>
            </Collapse>
          </>
        )}

        {sending && <LinearProgress sx={{ mt: 1 }} />}
        {reportOpen && <ReportDialog questionId={q.id} open onClose={() => setReportOpen(false)} />}
      </CardContent>
    </Card>
  );
}
