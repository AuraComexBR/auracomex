const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    return (
      <div className="w-full bg-red-500/10 border-b border-red-500/30 px-4 py-2 text-center text-sm text-red-400">
        Pagamentos ainda não estão configurados nesta build. Complete o go-live para aceitar cobranças reais.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 text-center text-sm text-amber-400">
        Ambiente de teste — nenhuma cobrança real é feita. Use o cartão 4242 4242 4242 4242 com qualquer validade futura e CVC.
      </div>
    );
  }
  return null;
}