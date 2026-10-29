export const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const PERIOD_LABEL: Record<string, string> = {
  FREE: 'para sempre',
  MONTHLY: '/mês',
  QUARTERLY: '/trimestre',
  SEMIANNUAL: '/semestre',
  YEARLY: '/ano',
  LIFETIME: 'pagamento único',
};

export const PERIOD_NAME: Record<string, string> = {
  FREE: 'Gratuito',
  MONTHLY: 'Mensal',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  YEARLY: 'Anual',
  LIFETIME: 'Vitalício',
};

// Valor de um recurso para exibição ("Ilimitado", "30 por dia", ✓/✗)
export function featureValue(type: 'bool' | 'limit', v: boolean | number | null | undefined) {
  if (type === 'bool') return Boolean(v);
  return v === null || v === undefined ? 'Ilimitado' : String(v);
}
