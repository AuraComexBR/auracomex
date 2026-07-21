import { NextResponse } from 'next/server';
import { runGeneration } from '@/lib/gerarPost';

export async function POST() {
  try {
    const result = await runGeneration({ generatedBy: 'manual', skipIfAutoExists: false });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Erro ao gerar post (admin):', err);
    return NextResponse.json({ error: err.message ?? 'erro desconhecido' }, { status: 500 });
  }
}
