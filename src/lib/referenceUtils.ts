import { supabase } from '@/integrations/supabase/client';

/**
 * Verifica se já existe uma cotação com esse número de referência na empresa.
 * Usado para impedir referências duplicadas, tanto geradas automaticamente
 * quanto digitadas manualmente pelo usuário.
 */
export async function quoteNumberExists(companyId: string, quoteNumber: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('quotes')
    .select('id')
    .eq('company_id', companyId)
    .ilike('quote_number', quoteNumber.trim())
    .limit(1);
  if (error) throw error;
  return !!(data && data.length > 0);
}

/**
 * Dado um número-base já ocupado, encontra a próxima variação livre
 * anexando "-2", "-3", etc., até achar uma que não exista ainda.
 * Usado nos fluxos de duplicação, que geram o número automaticamente
 * e não devem travar o usuário nem criar duplicidade silenciosa.
 */
export async function findFreeQuoteNumber(companyId: string, desiredNumber: string): Promise<string> {
  let candidate = desiredNumber;
  let attempt = 1;
  while (await quoteNumberExists(companyId, candidate)) {
    attempt += 1;
    candidate = `${desiredNumber}-${attempt}`;
  }
  return candidate;
}
