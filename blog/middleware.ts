import { NextRequest, NextResponse } from 'next/server';

/**
 * Protege /admin e /api/admin/* com HTTP Basic Auth. O navegador mostra o
 * prompt nativo de usuário/senha — sem precisar de tela de login própria.
 * Configure ADMIN_USER e ADMIN_PASSWORD nas env vars (local e na Vercel).
 */
export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASSWORD;

  if (!user || !pass) {
    return new NextResponse(
      'Área de gestão desativada: configure ADMIN_USER e ADMIN_PASSWORD nas variáveis de ambiente.',
      { status: 503 },
    );
  }

  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Basic ')) {
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8');
    const [u, p] = decoded.split(':');
    if (u === user && p === pass) {
      return NextResponse.next();
    }
  }

  return new NextResponse('Autenticação necessária', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Area de gestao Aura Comex"' },
  });
}

// basePath (/blog) não entra no matcher — o Next lida com isso internamente.
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
