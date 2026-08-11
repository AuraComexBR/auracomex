/** Container_number é salvo como um array JSON (ou, em dados antigos, texto separado por vírgula). */
export function parseContainerNumbers(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // não era JSON — cai no formato antigo abaixo
  }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Array de datas (ISO) de prazo de demurrage por container — paralelo ao
 * array de container_number, então preserva posições vazias (não filtra
 * como parseContainerNumbers), pra não desalinhar container #2 com a data
 * do #1 quando só o #2 tem prazo preenchido. */
export function parseContainerDates(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((v) => v || '');
  } catch {
    // não era JSON válido — sem formato legado pra datas, retorna vazio
  }
  return [];
}
