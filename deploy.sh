#!/usr/bin/env bash
# Script de deploy pra produção (Vercel via push no main).
# Rode a partir da raiz do projeto: ./deploy.sh
set -e

echo "==> Checando tipos (tsc)..."
npx tsc --noEmit -p .

echo "==> Build de produção..."
npm run build

echo "==> Status do git:"
git status --short

echo ""
read -p "Confirma o commit e push pra produção? (s/N) " CONFIRM
if [[ "$CONFIRM" != "s" && "$CONFIRM" != "S" ]]; then
  echo "Cancelado."
  exit 0
fi

read -p "Mensagem do commit: " MSG
git add -A
git commit -m "${MSG:-Deploy}"
git push origin main

echo ""
echo "==> Push feito. O Vercel vai buildar e publicar automaticamente."
echo "==> IMPORTANTE: confira se há migrations novas em supabase/migrations/"
echo "    que precisam ser rodadas manualmente no SQL Editor do Supabase."
ls -1 supabase/migrations/*.sql 2>/dev/null | tail -10
