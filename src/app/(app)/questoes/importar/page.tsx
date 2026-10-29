'use client';

import { Suspense, useState, useRef } from 'react';
import {
  Box, Card, CardContent, Typography, Button, Stepper, Step, StepLabel,
  CircularProgress, Alert, Chip, alpha, useTheme, TextField, Paper,
  Grid, MenuItem, Divider, Accordion, AccordionSummary, AccordionDetails,
  ToggleButton, ToggleButtonGroup, FormControlLabel, Switch, Autocomplete, Link,
} from '@mui/material';
import { CloudUpload, CheckCircle, ExpandMore, Delete, AutoAwesome, ArrowBack, LibraryBooks } from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { questionExtractApi, questionBankApi, subjectApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { LEVEL_LABEL } from '@/components/questions/types';
import RichTextField from '@/components/common/RichTextField';
import AssuntoPicker from '@/components/questions/AssuntoPicker';

type ImportText = { key: string; title: string; body: string; source: string };

const STEPS = ['Upload do PDF', 'Revisar questões', 'Concluído'];
const FORMAT_LABELS: Record<string, string> = {
  simple: 'Gabarito simples no final',
  commented: 'Gabarito comentado separado',
  inline: 'Resposta inline por questão',
  certo_errado: 'Itens Certo/Errado (Cebraspe)',
  unknown: 'Formato não identificado',
};
const FORMAT_COLORS: Record<string, string> = {
  simple: '#F59E0B', commented: '#10B981', inline: '#3B82F6', certo_errado: '#F2B705', unknown: '#9CA3AF',
};
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const OK = '#10B981';
const PENDING = '#F59E0B';

type Meta = {
  subjectId: string; assuntoId: number | null; discipline: string; topic: string; banca: string; orgao: string;
  cargo: string; year: string; level: string; source: string; isPublic: boolean;
};

function ImportarContent() {
  const theme = useTheme();
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const gold = theme.palette.primary.main;

  const [step, setStep] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [format, setFormat] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [texts, setTexts] = useState<ImportText[]>([]);
  const [rejected, setRejected] = useState<{ number: number; error: string }[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  // Vindo do catálogo de provas, os metadados chegam pela URL
  const [meta, setMeta] = useState<Meta>(() => ({
    subjectId: '', assuntoId: null, discipline: '', topic: '',
    banca: sp.get('banca') || '', orgao: sp.get('orgao') || '', cargo: sp.get('cargo') || '',
    year: sp.get('year') || '', level: '', source: sp.get('source') || '', isPublic: isAdmin,
  }));
  const fromCatalog = Boolean(sp.get('source'));
  const [manualAssunto, setManualAssunto] = useState(false);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects-simple'],
    queryFn: () => subjectApi.getAll().then(r => r.data.data),
  });
  const { data: filterOpts } = useQuery({
    queryKey: ['question-bank-filters'],
    queryFn: () => questionBankApi.filters().then((r) => r.data.data),
    staleTime: 60_000,
  });
  const opts = (k: string): string[] => (filterOpts?.[k] || []).map((x: any) => String(x.value));

  const previewMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('pdf', file);
      return questionExtractApi.preview(fd);
    },
    onSuccess: (res) => {
      const d = res.data.data;
      setQuestions(d.questions);
      setTexts((d.texts || []).map((t: any) => ({ key: t.key, title: t.title || '', body: t.body || '', source: t.source || '' })));
      setFormat(d.format);
      setStep(1);
      toast.success(`${d.total} questões detectadas! Formato: ${FORMAT_LABELS[d.format] || d.format}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Erro ao extrair questões.');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      // Disciplina escolhida da lista do aluno também vira o nome da disciplina no banco
      const subjectName = (subjects as any[]).find((s) => s.id === meta.subjectId)?.name;
      return questionExtractApi.confirm({
        questions,
        subjectId: meta.subjectId || null,
        // Sem nó escolhido, o backend reconhece o assunto pelo texto da disciplina
        assuntoId: meta.assuntoId ?? undefined,
        discipline: meta.discipline || subjectName || null,
        topic: meta.topic || null,
        banca: meta.banca || null,
        orgao: meta.orgao || null,
        cargo: meta.cargo || null,
        level: meta.level || null,
        year: meta.year ? parseInt(meta.year) : null,
        source: meta.source || null,
        isPublic: isAdmin && meta.isPublic,
        texts,
      });
    },
    onSuccess: (res) => {
      const d = res.data.data;
      setRejected(d.errors || []);
      setSavedCount(d.created);
      if (!d.created) {
        toast.error('Nenhuma questão salva. Corrija os itens destacados.');
        return;
      }
      qc.invalidateQueries({ queryKey: ['question-bank'] });
      qc.invalidateQueries({ queryKey: ['question-bank-filters'] });
      setStep(2);
      toast.success(`${d.created} questões salvas!`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.response?.data?.error || 'Erro ao salvar questões.');
    },
  });

  const handleFile = (file: File) => {
    if (!file || file.type !== 'application/pdf') { toast.error('Envie um arquivo PDF.'); return; }
    previewMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const removeQuestion = (idx: number) => setQuestions(qs => qs.filter((_, i) => i !== idx));
  const updateQuestion = (idx: number, field: string, value: any) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };
  const updateOption = (idx: number, letter: string, value: string) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, options: { ...q.options, [letter]: value } } : q));
  };
  const setType = (idx: number, type: string) => {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, type, answer: '' } : q));
  };

  const updateText = (key: string, field: keyof ImportText, value: string) =>
    setTexts((ts) => ts.map((t) => (t.key === key ? { ...t, [field]: value } : t)));
  const removeText = (key: string) => {
    setTexts((ts) => ts.filter((t) => t.key !== key));
    setQuestions((qs) => qs.map((q) => (q.textKey === key ? { ...q, textKey: null } : q)));
  };
  const addText = () => {
    const key = `m${Date.now()}`;
    setTexts((ts) => [...ts, { key, title: `Texto ${ts.length + 1}`, body: '', source: '' }]);
  };
  const textTitle = (key?: string | null) => texts.find((t) => t.key === key)?.title || 'Texto';

  const withAnswer = questions.filter(q => q.answer).length;
  const withExplanation = questions.filter(q => q.explanation).length;
  const ceCount = questions.filter(q => q.type === 'CERTO_ERRADO').length;
  const withMeta = questions.filter(q => q.banca || q.year).length;
  const setM = <K extends keyof Meta>(k: K, v: Meta[K]) => setMeta(m => ({ ...m, [k]: v }));

  // ── Etapa 0: upload
  if (step === 0) {
    return (
      <Box sx={{ maxWidth: 760, mx: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          <Button startIcon={<ArrowBack />} onClick={() => router.back()} size="small">Voltar</Button>
          <Typography variant="h4" sx={{ mt: 1 }}>Importar questões de PDF</Typography>
          <Typography color="text.secondary">
            Detecta o formato automaticamente e extrai enunciado, alternativas, gabarito e comentários — inclusive itens Certo/Errado.
          </Typography>
        </Box>

        {fromCatalog && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Prova selecionada: <strong>{meta.source}</strong>. Envie o PDF da prova (com o gabarito no final, se tiver).
          </Alert>
        )}

        <Stepper activeStep={step} sx={{ mb: 4 }}>
          {STEPS.map(s => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
        </Stepper>

        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          {[
            { fmt: 'simple', ex: 'GABARITO\n1-C  2-A  3-D  4-B' },
            { fmt: 'commented', ex: 'GABARITO COMENTADO\n1. Resposta: C\nA alternativa C...' },
            { fmt: 'inline', ex: '1. Questão?\nA) ... B) ...\nResposta: C' },
            { fmt: 'certo_errado', ex: 'Julgue os itens.\n1 O ato é nulo...\nGABARITO 1 C 2 E' },
          ].map(({ fmt, ex }) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={fmt}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: alpha(FORMAT_COLORS[fmt], 0.35), height: '100%' }}>
                <Chip label={FORMAT_LABELS[fmt]} size="small"
                  sx={{ bgcolor: alpha(FORMAT_COLORS[fmt], 0.12), color: FORMAT_COLORS[fmt], fontWeight: 700, mb: 1, fontSize: 10, height: 20 }} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontFamily: 'monospace', whiteSpace: 'pre', fontSize: 10 }}>
                  {ex}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box
          role="button" tabIndex={0}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
          sx={{
            border: `2px dashed ${dragging ? gold : theme.palette.divider}`,
            borderRadius: 3, p: 6, textAlign: 'center', cursor: 'pointer',
            bgcolor: dragging ? alpha(gold, 0.06) : 'transparent',
            transition: 'all 0.2s',
            '&:hover': { bgcolor: alpha(gold, 0.04), borderColor: gold },
          }}
        >
          {previewMutation.isPending ? (
            <Box>
              <CircularProgress size={48} sx={{ mb: 2 }} />
              <Typography variant="h6">Detectando formato e extraindo questões...</Typography>
              <Typography color="text.secondary" variant="body2">Isso pode levar alguns segundos</Typography>
            </Box>
          ) : (
            <Box>
              <CloudUpload sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" fontWeight={600}>Arraste o PDF aqui ou clique para selecionar</Typography>
              <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>
                Cebraspe, FGV, FCC, Vunesp, Cesgranrio e outras bancas
              </Typography>
            </Box>
          )}
        </Box>
        <input ref={fileRef} type="file" accept=".pdf" hidden onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />

        {previewMutation.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(previewMutation.error as any)?.response?.data?.error || 'Erro ao processar PDF.'}
            {(previewMutation.error as any)?.response?.data?.hint && <><br />{(previewMutation.error as any).response.data.hint}</>}
          </Alert>
        )}
      </Box>
    );
  }

  // ── Etapa 1: revisão
  if (step === 1) {
    return (
      <Box sx={{ maxWidth: 980, mx: 'auto' }}>
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map(s => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
        </Stepper>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Chip icon={<AutoAwesome />} label={`Formato: ${FORMAT_LABELS[format] || format}`}
                sx={{ bgcolor: alpha(FORMAT_COLORS[format] || gold, 0.12), color: FORMAT_COLORS[format] || gold, fontWeight: 700 }} />
              <Chip label={`${questions.length} questões`} color="primary" />
              {ceCount > 0 && <Chip label={`${ceCount} Certo/Errado`} variant="outlined" />}
              <Chip label={`${withAnswer} com gabarito`} sx={{ bgcolor: alpha(OK, 0.12), color: OK }} />
              {withExplanation > 0 && <Chip label={`${withExplanation} com comentário`} sx={{ bgcolor: alpha('#3B82F6', 0.12), color: '#3B82F6' }} />}
            </Box>

            <Divider sx={{ my: 2 }} />
            <Typography variant="overline" color="text.secondary">Dados da prova (aplicados a todas as questões)</Typography>
            {withMeta > 0 && (
              <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
                Banca, ano, órgão e cargo foram lidos do cabeçalho de {withMeta} questão(ões) e têm prioridade sobre os campos abaixo.
                Escolha a <strong>matéria ou assunto</strong> para as questões aparecerem na árvore dos cadernos.
              </Alert>
            )}
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid size={{ xs: 12, md: 8 }}>
                <AssuntoPicker value={meta.assuntoId}
                  onChange={(id, path) => setMeta((m) => ({ ...m, assuntoId: id, discipline: path[0] || '', topic: path.length > 1 ? path[path.length - 1] : '' }))}
                  helperText={
                    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                      <span>Matéria ou assunto da árvore aplicado a todas as questões deste PDF.</span>
                      <Link component="button" type="button" variant="caption" onClick={() => setManualAssunto((v) => !v)}>
                        {manualAssunto ? 'Esconder campos manuais' : 'Não achou? Digitar manualmente'}
                      </Link>
                    </Box>
                  } />
              </Grid>
              {manualAssunto && (
                <>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Autocomplete freeSolo size="small" options={opts('discipline')} value={meta.discipline}
                      onInputChange={(_, v) => setMeta((m) => ({ ...m, discipline: v, assuntoId: null }))}
                      renderInput={(p) => <TextField {...p} label="Disciplina (texto)" placeholder="Direito Administrativo" />} />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Autocomplete freeSolo size="small" options={opts('topic')} value={meta.topic}
                      onInputChange={(_, v) => setMeta((m) => ({ ...m, topic: v, assuntoId: null }))}
                      renderInput={(p) => <TextField {...p} label="Assunto (texto, opcional)" />} />
                  </Grid>
                </>
              )}
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField select fullWidth size="small" label="Vincular à minha disciplina" value={meta.subjectId}
                  onChange={e => setM('subjectId', e.target.value)} helperText="Alimenta seu analytics e plano">
                  <MenuItem value="">Nenhuma</MenuItem>
                  {(subjects as any[]).map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Autocomplete freeSolo size="small" options={opts('banca')} value={meta.banca}
                  onInputChange={(_, v) => setM('banca', v)} renderInput={(p) => <TextField {...p} label="Banca" />} />
              </Grid>
              <Grid size={{ xs: 6, md: 3 }}>
                <Autocomplete freeSolo size="small" options={opts('orgao')} value={meta.orgao}
                  onInputChange={(_, v) => setM('orgao', v)} renderInput={(p) => <TextField {...p} label="Órgão" />} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Autocomplete freeSolo size="small" options={opts('cargo')} value={meta.cargo}
                  onInputChange={(_, v) => setM('cargo', v)} renderInput={(p) => <TextField {...p} label="Cargo" />} />
              </Grid>
              <Grid size={{ xs: 4, md: 2 }}>
                <TextField size="small" fullWidth label="Ano" type="number" value={meta.year} onChange={e => setM('year', e.target.value)} />
              </Grid>
              <Grid size={{ xs: 8, md: 3 }}>
                <TextField select fullWidth size="small" label="Escolaridade" value={meta.level} onChange={e => setM('level', e.target.value)}>
                  <MenuItem value="">—</MenuItem>
                  {Object.entries(LEVEL_LABEL).map(([k, l]) => <MenuItem key={k} value={k}>{l}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                <TextField size="small" fullWidth label="Fonte / Prova" value={meta.source} onChange={e => setM('source', e.target.value)} />
              </Grid>
            </Grid>
            {isAdmin && (
              <FormControlLabel sx={{ mt: 1.5 }} control={<Switch checked={meta.isPublic} onChange={e => setM('isPublic', e.target.checked)} />}
                label={<Typography variant="body2"><strong>Publicar no banco</strong> para todos os alunos</Typography>} />
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="h6" sx={{ flex: 1 }}>Textos de apoio {texts.length > 0 && `(${texts.length})`}</Typography>
              <Button size="small" variant="outlined" onClick={addText}>Adicionar texto</Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: texts.length ? 2 : 0 }}>
              {texts.length
                ? 'Detectados no PDF e ligados às questões. Confira o vínculo em cada questão e destaque as palavras que estavam em negrito na prova.'
                : 'Nenhum texto detectado. Se a prova tem textos (ex.: Português), adicione aqui e ligue às questões.'}
            </Typography>
            {texts.map((t) => {
              const used = questions.filter((q) => q.textKey === t.key).map((q) => q.number);
              return (
                <Accordion key={t.key} disableGutters elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: '12px !important', mb: 1, '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography fontWeight={700}>{t.title || 'Sem título'}</Typography>
                      <Chip size="small" label={used.length ? `Questões ${used.join(', ')}` : 'Nenhuma questão ligada'} color={used.length ? 'primary' : 'default'} variant="outlined" />
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <TextField size="small" label="Título" value={t.title} onChange={(e) => updateText(t.key, 'title', e.target.value)} />
                    <RichTextField fullWidth multiline minRows={5} maxRows={20} label="Texto" value={t.body} onChange={(v) => updateText(t.key, 'body', v)} />
                    <TextField size="small" label="Fonte" value={t.source} onChange={(e) => updateText(t.key, 'source', e.target.value)} />
                    <Box><Button size="small" color="error" onClick={() => removeText(t.key)}>Remover texto</Button></Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </CardContent>
        </Card>

        {rejected.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {rejected.length} questão(ões) não puderam ser salvas:
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {rejected.slice(0, 8).map((r) => <li key={r.number}>Q{r.number}: {r.error}</li>)}
            </Box>
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
          {questions.map((q, idx) => {
            const isCE = q.type === 'CERTO_ERRADO';
            const letters = OPTION_LETTERS.filter(l => isCE ? false : (l !== 'E' || q.options?.E !== null));
            return (
              <Accordion key={idx} disableGutters elevation={0}
                sx={{ border: `1px solid ${q.answer ? alpha(OK, 0.35) : alpha(PENDING, 0.45)}`, borderRadius: '12px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMore />} sx={{ px: 2, minHeight: 56 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', pr: 1, overflow: 'hidden' }}>
                    <Chip label={`Q${q.number}`} size="small" sx={{ minWidth: 40, flexShrink: 0, fontWeight: 700, bgcolor: alpha(gold, 0.14) }} />
                    {isCE && <Chip label="C/E" size="small" variant="outlined" sx={{ flexShrink: 0, height: 22 }} />}
                    {q.textKey && <Chip label={textTitle(q.textKey)} size="small" color="primary" variant="outlined" sx={{ flexShrink: 0, height: 22 }} />}
                    {(q.banca || q.year) && (
                      <Chip label={[q.banca, q.year].filter(Boolean).join(' · ')} size="small" variant="outlined"
                        sx={{ flexShrink: 0, height: 22, display: { xs: 'none', sm: 'flex' } }} />
                    )}
                    <Typography variant="body2" sx={{ flexGrow: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {q.statement}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <Chip label={q.answer || '?'} size="small"
                        sx={{ bgcolor: alpha(q.answer ? OK : PENDING, 0.12), color: q.answer ? OK : PENDING, fontWeight: 700, minWidth: 28 }} />
                      <Box component="span" role="button" tabIndex={0} aria-label="Remover questão"
                        onClick={(e) => { e.stopPropagation(); removeQuestion(idx); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); removeQuestion(idx); } }}
                        sx={{ display: 'inline-flex', p: 0.75, borderRadius: '50%', cursor: 'pointer', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'error.main' } }}>
                        <Delete sx={{ fontSize: 16 }} />
                      </Box>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2, pb: 2 }}>
                  <ToggleButtonGroup exclusive size="small" value={q.type || 'MULTIPLA_ESCOLHA'} onChange={(_, t) => t && setType(idx, t)} sx={{ mb: 2 }}>
                    <ToggleButton value="MULTIPLA_ESCOLHA">Múltipla escolha</ToggleButton>
                    <ToggleButton value="CERTO_ERRADO">Certo ou Errado</ToggleButton>
                  </ToggleButtonGroup>

                  {texts.length > 0 && (
                    <TextField select size="small" label="Texto de apoio" value={q.textKey || ''} sx={{ mb: 2, minWidth: 240 }}
                      onChange={(e) => updateQuestion(idx, 'textKey', e.target.value || null)}>
                      <MenuItem value="">Nenhum</MenuItem>
                      {texts.map((t) => <MenuItem key={t.key} value={t.key}>{t.title || 'Sem título'}</MenuItem>)}
                    </TextField>
                  )}
                  <Box sx={{ mb: 2 }}>
                    <RichTextField compact fullWidth multiline minRows={3} label="Enunciado" size="small"
                      value={q.statement} onChange={(v) => updateQuestion(idx, 'statement', v)} />
                  </Box>

                  {!isCE && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                      {letters.map(letter => (
                        <RichTextField key={letter} compact fullWidth size="small" label={`Alternativa ${letter}`}
                          value={q.options?.[letter] || ''} onChange={(v) => updateOption(idx, letter, v)} />
                      ))}
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="caption" color="text.secondary">Gabarito:</Typography>
                    {(isCE ? ['C', 'E'] : OPTION_LETTERS.filter(l => q.options?.[l])).map(letter => {
                      const active = q.answer === letter;
                      return (
                        <Button key={letter} size="small" variant={active ? 'contained' : 'outlined'}
                          onClick={() => updateQuestion(idx, 'answer', active ? '' : letter)}
                          sx={{ minWidth: isCE ? 88 : 36, px: 1, ...(active ? { background: OK, color: '#fff', '&:hover': { background: OK } } : {}) }}>
                          {isCE ? (letter === 'C' ? 'Certo' : 'Errado') : letter}
                        </Button>
                      );
                    })}
                  </Box>

                  <RichTextField compact fullWidth multiline minRows={2} label="Comentário (opcional)" size="small"
                    value={q.explanation || ''} onChange={(v) => updateQuestion(idx, 'explanation', v)} />
                </AccordionDetails>
              </Accordion>
            );
          })}
        </Box>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={() => setStep(0)} sx={{ flex: { xs: '1 1 100%', sm: 'none' } }}>Voltar</Button>
          <Button variant="contained" sx={{ px: 4, flex: { xs: '1 1 100%', sm: 'none' } }}
            onClick={() => confirmMutation.mutate()}
            disabled={confirmMutation.isPending || questions.length === 0}>
            {confirmMutation.isPending ? <CircularProgress size={20} color="inherit" /> : isAdmin && meta.isPublic ? `Publicar ${questions.length} questões` : `Salvar ${questions.length} questões`}
          </Button>
        </Box>
      </Box>
    );
  }

  // ── Etapa 2: concluído
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', textAlign: 'center', mt: 6 }}>
      <Stepper activeStep={2} sx={{ mb: 4 }}>
        {STEPS.map(s => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
      </Stepper>
      <Card>
        <CardContent sx={{ py: 5 }}>
          <CheckCircle sx={{ fontSize: 72, color: OK, mb: 2 }} />
          <Typography variant="h5" fontWeight={800}>Questões importadas!</Typography>
          <Typography color="text.secondary" sx={{ mt: 1, mb: rejected.length ? 1 : 3 }}>
            {savedCount} questões salvas {isAdmin && meta.isPublic ? 'e publicadas no banco' : 'e prontas para praticar'}
          </Typography>
          {rejected.length > 0 && (
            <Typography variant="body2" color="warning.main" sx={{ mb: 3 }}>{rejected.length} ignorada(s) por dados incompletos.</Typography>
          )}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" startIcon={<LibraryBooks />}
              onClick={() => router.push(`/questoes/banco?${new URLSearchParams({ ...(meta.banca && { banca: meta.banca }), ...(meta.year && { year: meta.year }) }).toString()}`)}>
              Ver no banco
            </Button>
            <Button variant="outlined" onClick={() => { setStep(0); setQuestions([]); setTexts([]); setFormat(''); setRejected([]); }}>
              Importar outro PDF
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default function ImportarQuestoesPage() {
  return (
    <Suspense fallback={null}>
      <ImportarContent />
    </Suspense>
  );
}
