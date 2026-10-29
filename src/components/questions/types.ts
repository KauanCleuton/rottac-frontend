export type QuestionType = 'MULTIPLA_ESCOLHA' | 'CERTO_ERRADO';
export type Difficulty = 'FACIL' | 'MEDIO' | 'DIFICIL';

export interface BankQuestion {
  id: string;
  type: QuestionType;
  statement: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  optionE?: string | null;
  answer?: string | null;      // ausente até o aluno responder (exceto dono/admin)
  explanation?: string | null;
  hasAnswer: boolean;
  discipline?: string | null;
  topic?: string | null;
  assuntoId?: number | null;
  assuntoPath?: string[] | null; // caminho na árvore: matéria › assunto › subassunto
  banca?: string | null;
  orgao?: string | null;
  cargo?: string | null;
  year?: number | null;
  level?: string | null;
  source?: string | null;
  difficulty: Difficulty;
  isPublic: boolean;
  isAnnulled: boolean;
  isOutdated: boolean;
  isOwner: boolean;
  isFavorite: boolean;
  hasAnnotation?: boolean;
  text?: { id: string; title?: string | null; body: string; source?: string | null } | null;
  textId?: string | null;
  notebookAttempt?: { selected: string; isCorrect: boolean; createdAt: string } | null;
  commentsCount: number;
  myAttempts: number;
  lastAttempt: { selected: string; isCorrect: boolean; createdAt: string } | null;
  author?: { id: string; name: string };
  createdAt: string;
}

export interface AnswerResult {
  isCorrect: boolean;
  hasAnswer: boolean;
  correctAnswer: string | null;
  explanation: string | null;
  isAnnulled: boolean;
  // Revisão espaçada / Caderno de Erros (null se a questão não entrou na revisão)
  review?: {
    inReview: boolean;
    counted?: boolean;
    nextReviewAt?: string;
    interval?: number;
    mastered?: boolean;
    addedToErrorNotebook?: boolean;
  } | null;
  community: { totalAnswers: number; distribution: Record<string, number>; accuracy: number | null };
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

export const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLA_ESCOLHA: 'Múltipla escolha',
  CERTO_ERRADO: 'Certo ou Errado',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  FACIL: 'Fácil',
  MEDIO: 'Média',
  DIFICIL: 'Difícil',
};

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  FACIL: '#22C55E',
  MEDIO: '#F59E0B',
  DIFICIL: '#EF4444',
};

export const LEVEL_LABEL: Record<string, string> = {
  FUNDAMENTAL: 'Fundamental',
  MEDIO: 'Médio',
  SUPERIOR: 'Superior',
};

export const CE_LABEL: Record<string, string> = { C: 'Certo', E: 'Errado' };

// Alternativas disponíveis de uma questão (letras para ME, C/E para Certo/Errado)
export function choicesOf(q: Pick<BankQuestion, 'type' | 'optionA' | 'optionB' | 'optionC' | 'optionD' | 'optionE'>) {
  if (q.type === 'CERTO_ERRADO') return [{ key: 'C', text: 'Certo' }, { key: 'E', text: 'Errado' }];
  return LETTERS
    .map((l) => ({ key: l as string, text: (q as any)[`option${l}`] as string | null | undefined }))
    .filter((o): o is { key: string; text: string } => Boolean(o.text));
}

export function answerLabel(type: QuestionType, key?: string | null) {
  if (!key) return '—';
  return type === 'CERTO_ERRADO' ? CE_LABEL[key] ?? key : key;
}
