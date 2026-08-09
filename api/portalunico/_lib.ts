// Não usado mais — a lógica de autenticação mTLS foi duplicada direto em
// test-connection.ts e subscribe-webhook.ts depois que este módulo
// compartilhado (prefixado com "_") pareceu ser excluído do bundle da
// função pela Vercel, quebrando os dois endpoints em produção (500 sem
// mensagem custom, sinal de módulo não encontrado em runtime).
//
// O arquivo não pôde ser removido pelo ambiente (permissão negada no
// filesystem montado via FUSE) — mantido como no-op inofensivo, com
// export default válido caso a Vercel insista em tratá-lo como rota.
export default function handler(_req: unknown, res: any) {
  res.status(404).json({ error: 'not found' });
}
