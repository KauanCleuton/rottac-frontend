'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Box, Typography, Button, Container, Grid, Card, CardContent, Chip, Accordion, AccordionSummary,
  AccordionDetails, Skeleton, Alert, ThemeProvider, alpha,
} from '@mui/material';
import {
  LibraryBooks, CollectionsBookmark, EventRepeat, Timer, Draw, FlashOn, Psychology, TravelExplore,
  Print, ExpandMore, ArrowForward, CheckCircle, Gavel, Replay, MenuBook,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import Logo from '@/components/brand/Logo';
import Footer from '@/components/layout/Footer';
import PlanCards, { type PublicPlan, type FeatureDef } from '@/components/billing/PlanCards';
import { billingApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { GOLD, darkTheme } from '@/theme';

const INK = '#0A0A0B';
const MUTED = alpha('#F5F5F4', 0.66);

const FEATURES = [
  { icon: <LibraryBooks />, title: 'Banco de questões', text: 'Filtre por disciplina, assunto, banca, órgão, cargo e ano. Múltipla escolha e Certo/Errado no padrão Cebraspe.' },
  { icon: <CollectionsBookmark />, title: 'Cadernos com diagnóstico', text: 'Monte cadernos por objetivo. Ao terminar, a plataforma lê seu desempenho e diz o próximo passo.' },
  { icon: <EventRepeat />, title: 'Revisão espaçada', text: 'Cada questão errada vai para o Caderno de Erros e volta no dia certo: amanhã, em 3, 7, 16 dias…' },
  { icon: <Timer />, title: 'Simulados de verdade', text: 'Cronômetro, folha de respostas, marcação para revisar e nota líquida do Cebraspe.' },
  { icon: <Draw />, title: 'Caneta e marca-texto', text: 'Grife o enunciado com a caneta do tablet ou com o mouse, como na prova impressa.' },
  { icon: <FlashOn />, title: 'Flashcards', text: 'Cards com giro 3D e revisão espaçada. Seus erros viram flashcards com um clique.' },
  { icon: <Print />, title: 'Cadernos em PDF', text: 'Imprima cadernos bem formatados, com ou sem gabarito, para estudar no papel.' },
  { icon: <TravelExplore />, title: 'Provas anteriores', text: 'Busque provas por cargo, banca ou órgão e importe as questões para praticar.' },
  { icon: <Psychology />, title: 'Plano e Central de IA', text: 'Plano de estudos, metas, hábitos e análise do seu ritmo de estudo.' },
];

const STEPS = [
  { n: '01', title: 'Resolva', text: 'Monte um caderno com as questões do seu concurso e resolva no seu ritmo, com caneta e comentários.' },
  { n: '02', title: 'Receba o diagnóstico', text: 'A plataforma identifica assuntos fracos, erros por desatenção, chute no Certo/Errado e ritmo.' },
  { n: '03', title: 'Siga a rota', text: 'Lei seca, teoria agendada, flashcards dos erros e revisão no dia certo — com um clique cada.' },
];

const FAQ = [
  { q: 'Preciso pagar para começar?', a: 'Não. O plano Free é gratuito para sempre e, no período de lançamento, todos os recursos estão liberados.' },
  { q: 'Serve para a minha banca?', a: 'Sim. O banco aceita questões de múltipla escolha e itens Certo/Errado (Cebraspe), com filtros por banca, órgão, cargo e ano.' },
  { q: 'Posso importar provas que já tenho em PDF?', a: 'Sim. O importador detecta enunciado, alternativas, gabarito e até banca e ano de cada questão. Você revisa antes de salvar.' },
  { q: 'Como funciona a revisão espaçada?', a: 'Toda questão que você erra volta para revisão amanhã. Acertando, o intervalo cresce (3, 7, 16 dias…). Após 4 acertos espaçados, ela é considerada dominada.' },
  { q: 'Posso estudar no papel?', a: 'Sim. Qualquer caderno pode ser exportado em PDF com a logo da Rotta, com ou sem gabarito ao final.' },
];

function SectionTitle({ over, title, text }: { over: string; title: string; text?: string }) {
  return (
    <Box sx={{ textAlign: 'center', maxWidth: 720, mx: 'auto', mb: 6 }}>
      <Typography variant="overline" sx={{ color: GOLD }}>{over}</Typography>
      <Typography sx={{ fontSize: { xs: 30, md: 40 }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, mt: 1 }}>{title}</Typography>
      {text && <Typography sx={{ color: MUTED, mt: 2, fontSize: 17 }}>{text}</Typography>}
    </Box>
  );
}

// Ilustração do diagnóstico (exemplo, não dados reais)
function DiagnosisPreview() {
  const actions = [
    { icon: <Gavel fontSize="small" />, t: 'Ler a letra da lei: CF/88' },
    { icon: <MenuBook fontSize="small" />, t: 'Agendar teoria de Direitos Sociais' },
    { icon: <FlashOn fontSize="small" />, t: 'Gerar 40 flashcards dos erros' },
    { icon: <Replay fontSize="small" />, t: 'Refazer as erradas em 3 dias' },
  ];
  return (
    <Card sx={{ bgcolor: alpha('#141416', 0.9), border: `1px solid ${alpha(GOLD, 0.3)}`, boxShadow: `0 40px 100px ${alpha('#000', 0.6)}` }}>
      <Box sx={{ height: 4, bgcolor: '#EF4444' }} />
      <CardContent sx={{ p: 3 }}>
        <Chip size="small" label="Exemplo de diagnóstico" sx={{ mb: 1.5, bgcolor: alpha(GOLD, 0.14), color: GOLD, fontWeight: 700 }} />
        <Typography sx={{ fontWeight: 800, fontSize: 19, lineHeight: 1.3 }}>
          Você errou 40 de 50. Pare de fazer questões de Direito Constitucional por enquanto.
        </Typography>
        <Typography sx={{ color: MUTED, fontSize: 14, mt: 1, mb: 2 }}>
          Com menos de 40% de acerto, a teoria ainda não está formada. Volte à base antes de seguir.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          {[{ l: 'Acertos', v: 10, c: '#22C55E' }, { l: 'Erros', v: 40, c: '#EF4444' }, { l: 'Aproveitamento', v: '20%', c: '#EF4444' }].map((s) => (
            <Box key={s.l} sx={{ flex: 1, p: 1.25, borderRadius: 2, border: `1px solid ${alpha('#FFF', 0.08)}` }}>
              <Typography sx={{ fontWeight: 900, fontSize: 20, color: s.c }}>{s.v}</Typography>
              <Typography sx={{ color: MUTED, fontSize: 11 }}>{s.l}</Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {actions.map((a, i) => (
            <Box key={a.t} sx={{
              display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, borderRadius: 2,
              border: `1px solid ${alpha(i < 2 ? GOLD : '#FFF', i < 2 ? 0.45 : 0.08)}`, bgcolor: i < 2 ? alpha(GOLD, 0.06) : 'transparent',
            }}>
              <Box sx={{ color: i < 2 ? GOLD : MUTED, display: 'flex' }}>{a.icon}</Box>
              <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{a.t}</Typography>
              <ArrowForward sx={{ fontSize: 16, color: MUTED }} />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const hydrated = useAuthStore((s) => s._hasHydrated);
  const loggedIn = hydrated && Boolean(token);

  const { data, isLoading, error } = useQuery({
    queryKey: ['billing', 'public-plans'],
    queryFn: () => billingApi.plans().then((r) => r.data.data as { plans: PublicPlan[]; features: FeatureDef[]; freeAccessForAll: boolean; freeAccessMessage?: string }),
  });

  const choosePlan = (p: PublicPlan) => {
    router.push(loggedIn ? `/planos?plano=${p.id}` : `/auth/register?plano=${p.id}`);
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ bgcolor: INK, color: '#F5F5F4', minHeight: '100vh', overflowX: 'hidden' }}>
        {/* Cabeçalho */}
        <Box component="header" sx={{
          position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(14px)', bgcolor: alpha(INK, 0.78),
          borderBottom: `1px solid ${alpha('#FFF', 0.06)}`,
        }}>
          <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', gap: 3, py: 1.5 }}>
            <Box component={Link} href="/" sx={{ textDecoration: 'none' }}><Logo size={34} /></Box>
            <Box component="nav" sx={{ display: { xs: 'none', md: 'flex' }, gap: 3, ml: 3 }}>
              {[['#recursos', 'Recursos'], ['#como-funciona', 'Como funciona'], ['#planos', 'Planos'], ['#faq', 'Dúvidas']].map(([href, label]) => (
                <Box key={href} component="a" href={href} sx={{ color: MUTED, textDecoration: 'none', fontSize: 14, fontWeight: 500, '&:hover': { color: GOLD } }}>{label}</Box>
              ))}
            </Box>
            <Box sx={{ flex: 1 }} />
            {loggedIn ? (
              <Button variant="contained" endIcon={<ArrowForward />} component={Link} href="/dashboard">Ir para a plataforma</Button>
            ) : (
              <>
                <Button component={Link} href="/auth/login" sx={{ color: '#F5F5F4', display: { xs: 'none', sm: 'inline-flex' } }}>Entrar</Button>
                <Button variant="contained" component={Link} href="/auth/register">Criar conta grátis</Button>
              </>
            )}
          </Container>
        </Box>

        {/* Hero */}
        <Box sx={{
          position: 'relative',
          backgroundImage: `radial-gradient(1000px 520px at 20% 0%, ${alpha(GOLD, 0.18)}, transparent 60%),
            linear-gradient(${alpha('#FFFFFF', 0.025)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha('#FFFFFF', 0.025)} 1px, transparent 1px)`,
          backgroundSize: 'auto, 48px 48px, 48px 48px',
        }}>
          <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
            <Grid container spacing={6} alignItems="center">
              <Grid size={{ xs: 12, md: 6.5 }}>
                {data?.freeAccessForAll && (
                  <Chip label={data.freeAccessMessage || 'Período de lançamento: tudo liberado'} size="small"
                    sx={{ mb: 3, bgcolor: alpha('#22C55E', 0.14), color: '#4ADE80', fontWeight: 700, height: 'auto', py: 0.5, '& .MuiChip-label': { whiteSpace: 'normal' } }} />
                )}
                <Typography component="h1" sx={{ fontSize: { xs: 40, sm: 52, md: 62 }, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.04em' }}>
                  Sua rota até a{' '}
                  <Box component="span" sx={{ background: `linear-gradient(90deg, #FFE38A, ${GOLD} 55%, #C99A06)`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    aprovação
                  </Box>
                  .
                </Typography>
                <Typography sx={{ color: MUTED, fontSize: { xs: 17, md: 19 }, mt: 3, maxWidth: 560, lineHeight: 1.6 }}>
                  Questões, cadernos, simulados e revisão espaçada numa plataforma que não só corrige:
                  ela lê seu desempenho e mostra exatamente o que estudar em seguida.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 4, flexWrap: 'wrap' }}>
                  <Button size="large" variant="contained" endIcon={<ArrowForward />} component={Link} href={loggedIn ? '/dashboard' : '/auth/register'}
                    sx={{ px: 4, py: 1.6, fontSize: 16, fontWeight: 800 }}>
                    {loggedIn ? 'Continuar estudando' : 'Começar grátis'}
                  </Button>
                  <Button size="large" variant="outlined" component="a" href="#planos" sx={{ px: 4, py: 1.6, fontSize: 16, borderColor: alpha('#FFF', 0.2), color: '#F5F5F4' }}>
                    Ver planos
                  </Button>
                </Box>
                <Box sx={{ display: 'flex', gap: 3, mt: 4, flexWrap: 'wrap' }}>
                  {['Múltipla escolha e Certo/Errado', 'Diagnóstico a cada caderno', 'Impressão em PDF'].map((t) => (
                    <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <CheckCircle sx={{ color: GOLD, fontSize: 18 }} />
                      <Typography sx={{ color: MUTED, fontSize: 14 }}>{t}</Typography>
                    </Box>
                  ))}
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 5.5 }}>
                <DiagnosisPreview />
              </Grid>
            </Grid>
          </Container>
        </Box>

        {/* Recursos */}
        <Container id="recursos" maxWidth="lg" sx={{ py: { xs: 8, md: 12 }, scrollMarginTop: 80 }}>
          <SectionTitle over="Recursos" title="Tudo o que o concurseiro precisa, num lugar só"
            text="Ferramentas pensadas para a rotina de quem estuda para concurso: menos planilha, mais questão resolvida." />
          <Grid container spacing={2.5}>
            {FEATURES.map((f) => (
              <Grid key={f.title} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ height: '100%', bgcolor: '#141416', transition: 'border-color .2s, transform .2s', '&:hover': { borderColor: alpha(GOLD, 0.5), transform: 'translateY(-3px)' } }}>
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(GOLD, 0.12), color: GOLD, mb: 2 }}>
                      {f.icon}
                    </Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 17, mb: 0.75 }}>{f.title}</Typography>
                    <Typography sx={{ color: MUTED, fontSize: 14.5, lineHeight: 1.6 }}>{f.text}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>

        {/* Como funciona */}
        <Box id="como-funciona" sx={{ bgcolor: '#0F0F11', borderTop: `1px solid ${alpha('#FFF', 0.05)}`, borderBottom: `1px solid ${alpha('#FFF', 0.05)}`, scrollMarginTop: 80 }}>
          <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
            <SectionTitle over="Como funciona" title="Não é só corrigir. É dizer o próximo passo."
              text="Errou 40 de 50 questões? A Rotta não manda você fazer mais 50: ela manda voltar à base." />
            <Grid container spacing={3}>
              {STEPS.map((s) => (
                <Grid key={s.n} size={{ xs: 12, md: 4 }}>
                  <Box sx={{ p: 3, borderRadius: 3, border: `1px solid ${alpha('#FFF', 0.08)}`, height: '100%' }}>
                    <Typography sx={{ color: GOLD, fontWeight: 900, fontSize: 32, letterSpacing: '-0.03em' }}>{s.n}</Typography>
                    <Typography sx={{ fontWeight: 800, fontSize: 20, mt: 1 }}>{s.title}</Typography>
                    <Typography sx={{ color: MUTED, mt: 1, lineHeight: 1.6 }}>{s.text}</Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ mt: 5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              {[
                { l: 'Menos de 40%', t: 'Base crítica', d: 'Lei seca, teoria e flashcards dos erros', c: '#EF4444' },
                { l: '40% a 69%', t: 'Base parcial', d: 'Teoria dos assuntos fracos e revisão', c: '#F59E0B' },
                { l: '70% a 84%', t: 'Bom', d: 'Revisão espaçada dos erros pontuais', c: '#22C55E' },
                { l: '85% ou mais', t: 'Domínio', d: 'Simulado e questões difíceis', c: GOLD },
              ].map((b) => (
                <Box key={b.t} sx={{ p: 2, borderRadius: 2, borderLeft: `4px solid ${b.c}`, bgcolor: alpha(b.c, 0.06) }}>
                  <Typography sx={{ color: b.c, fontWeight: 800, fontSize: 13 }}>{b.l}</Typography>
                  <Typography sx={{ fontWeight: 800 }}>{b.t}</Typography>
                  <Typography sx={{ color: MUTED, fontSize: 13 }}>{b.d}</Typography>
                </Box>
              ))}
            </Box>
          </Container>
        </Box>

        {/* Planos */}
        <Container id="planos" maxWidth="lg" sx={{ py: { xs: 8, md: 12 }, scrollMarginTop: 80 }}>
          <SectionTitle over="Planos" title="Escolha seu plano"
            text={data?.freeAccessForAll ? data.freeAccessMessage : 'Comece grátis e faça upgrade quando quiser.'} />
          {isLoading ? (
            <Grid container spacing={3}>{[0, 1, 2].map((i) => <Grid key={i} size={{ xs: 12, md: 4 }}><Skeleton variant="rounded" height={560} /></Grid>)}</Grid>
          ) : error || !data ? (
            <Alert severity="warning">Não foi possível carregar os planos agora.</Alert>
          ) : (
            <PlanCards plans={data.plans} features={data.features} freeAccessForAll={data.freeAccessForAll} onSelect={choosePlan} />
          )}
        </Container>

        {/* FAQ */}
        <Container id="faq" maxWidth="md" sx={{ pb: { xs: 8, md: 12 }, scrollMarginTop: 80 }}>
          <SectionTitle over="Dúvidas" title="Perguntas frequentes" />
          {FAQ.map((f) => (
            <Accordion key={f.q} disableGutters elevation={0}
              sx={{ bgcolor: 'transparent', borderBottom: `1px solid ${alpha('#FFF', 0.08)}`, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMore sx={{ color: GOLD }} />} sx={{ px: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 17 }}>{f.q}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pt: 0 }}>
                <Typography sx={{ color: MUTED, lineHeight: 1.7 }}>{f.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Container>

        {/* Chamada final */}
        <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>
          <Box sx={{
            p: { xs: 4, md: 7 }, borderRadius: 5, textAlign: 'center', border: `1px solid ${alpha(GOLD, 0.35)}`,
            background: `radial-gradient(600px 300px at 50% 0%, ${alpha(GOLD, 0.2)}, transparent 70%), #111113`,
          }}>
            <Typography sx={{ fontSize: { xs: 28, md: 40 }, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
              Sua aprovação começa na próxima questão.
            </Typography>
            <Typography sx={{ color: MUTED, mt: 2, mb: 4, fontSize: 17 }}>Crie sua conta e monte seu primeiro caderno em menos de um minuto.</Typography>
            <Button size="large" variant="contained" endIcon={<ArrowForward />} component={Link} href={loggedIn ? '/dashboard' : '/auth/register'}
              sx={{ px: 5, py: 1.6, fontSize: 16, fontWeight: 800 }}>
              {loggedIn ? 'Ir para a plataforma' : 'Criar conta grátis'}
            </Button>
          </Box>
        </Container>

        <Footer />
      </Box>
    </ThemeProvider>
  );
}

