import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const sessionId = params.get("session_id");

  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["subscription"] });
  }, [qc]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center glass rounded-xl p-8 border border-border">
        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Pagamento recebido!</h1>
        <p className="text-muted-foreground mb-6">
          Sua assinatura será ativada em instantes.
        </p>
        {sessionId && (
          <p className="text-xs text-muted-foreground mb-6 font-mono break-all">Ref: {sessionId}</p>
        )}
        <div className="flex gap-3 justify-center">
          <Button onClick={() => navigate("/settings#assinatura")}>Ver assinatura</Button>
          <Button variant="outline" onClick={() => navigate("/dashboard")}>Ir para o Dashboard</Button>
        </div>
      </div>
    </div>
  );
}