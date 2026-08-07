/**
 * O Supabase Storage rejeita (HTTP 400) chaves de objeto com certas letras
 * Unicode acentuadas (ç, ã, õ, á, é, í, ó, ú...), mesmo que sejam comuns em
 * nomes de arquivo em português — ex.: "Procuração Armadores.pdf" falhava
 * silenciosamente (o upload nunca chegava a existir, nem no storage nem na
 * tabela documents).
 *
 * Usar esta função só no nome que vira parte do PATH salvo no storage.
 * O nome exibido pro usuário (coluna documents.name) continua sendo o nome
 * original do arquivo, com acentuação normal.
 */
export function sanitizeStorageFileName(fileName: string): string {
  const withoutDiacritics = fileName.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return withoutDiacritics.replace(/[^a-zA-Z0-9.\-_ ()&]/g, '_');
}
