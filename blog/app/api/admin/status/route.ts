import { NextRequest, NextResponse } from 'next/server';
import { setPostStatus } from '@/lib/posts';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const slug = body?.slug;
  const status = body?.status;

  if (!slug || (status !== 'published' && status !== 'draft')) {
    return NextResponse.json({ error: 'parâmetros inválidos' }, { status: 400 });
  }

  try {
    setPostStatus(slug, status);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'erro desconhecido' }, { status: 404 });
  }
}
