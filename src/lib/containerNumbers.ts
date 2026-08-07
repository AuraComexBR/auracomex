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
