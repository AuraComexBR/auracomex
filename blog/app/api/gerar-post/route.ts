import { NextRequest, NextResponse } from 'next/server';
import { runGeneration } from '@/lib/gerarPost';

export const dynamic = 'force-dynamic';

// Vercel injeta "Authorization: Bearer <CRON_SECRET>" automaticamente nas
// chamadas de cron quando a env var CRON_SECRET está setada no projeto.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // sem secret configurado, não bloqueia (ex: dev local)
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const result = await runGeneration({ generatedBy: 'auto', skipIfAutoExists: true });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Erro ao gerar post:', err);
    return NextResponse.json({ error: err.message ?? 'erro desconhecido' }, { status: 500 });
  }
}

// Permite disparo manual (via Cowork ou curl) com o mesmo comportamento do GET.
export const POST = GET;
