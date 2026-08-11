import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileDown, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useAccountability, AccountabilityItemRow, AccountabilityCategoria } from '@/hooks/useAccountability';
import { DebouncedInput } from './DebouncedInput';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AccountabilityPdfDialog } from './AccountabilityPdfDialog';

interface Props {
  quoteId: string;
  quote: any;
  companyId?: string;
}

function fmtBRL(n: number) {
  return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const categoriaLabels: Record<AccountabilityCategoria, string> = {
  origin: 'Origem',
  freight: 'Frete/Seguro',
  destination: 'Destino',
  local: 'Local',
  tax: 'Imposto',
  afrmm: 'AFRMM',
  siscomex: 'Siscomex',
  other: 'Outro',
};

export function AccountabilityTab({ quoteId, quote, companyId }: Props) {
  const { data, isLoading, updateItem, recomputeTotals, removeAccountability } = useAccountability(quoteId, companyId);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const accountability = data?.accountability || null;
  const items = data?.items || [];

  if (isLoading) return <Card className="glass"><CardContent className="py-10 text-center text-muted-foreground">Carregando…</CardContent></Card>;
  if (!accountability) {
    return (
      <Card className="glass">
        <CardContent className="py-12 text-center text-muted-foreground">
          Nenhuma Prestação de Contas gerada. Aprove o Numerário na aba Estimativa para criar.
        </CardContent>
      </Card>
    );
  }

  const handleCommitPago = async (item: AccountabilityItemRow, valor: number) => {
    try {
      await updateItem(item.id, { valor_pago_brl: valor, confirmado: true });
      await recomputeTotals(accountability.id);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar valor pago.');
    }
  };

  const handleToggleConfirmado = async (item: AccountabilityItemRow, confirmado: boolean) => {
    try {
      await updateItem(item.id, {
        confirmado,
        valor_pago_brl: item.valor_pago_brl ?? item.valor_orcado_brl,
      });
      await recomputeTotals(accountability.id);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao confirmar item.');
    }
  };

  const handleCommitObs = async (item: AccountabilityItemRow, obs: string) => {
    try {
      await updateItem(item.id, { observacao: obs });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar observação.');
    }
  };

  const totalOrcado = Number(accountability.total_orcado_brl || 0);
  const totalPago = Number(accountability.total_pago_brl || 0);
  const diferenca = Number(accountability.diferenca_brl ?? (totalPago - totalOrcado));
  const pendentes = items.filter(i => !i.confirmado).length;

  return (
    <div className="space-y-4">
      {pendentes > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <Info className="w-4 h-4 shrink-0" />
          <span><strong>{pendentes} ite{pendentes > 1 ? 'ns' : 'm'} pendente{pendentes > 1 ? 's' : ''} de confirmação:</strong> confira o valor pago real de cada linha antes de gerar o PDF final.</span>
        </div>
      )}

      <Card className="glass">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base">Prestação de Contas — Orçado x Pago Real</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => setPdfOpen(true)}>
              <FileDown className="w-3.5 h-3.5 mr-1" /> Gerar PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir Prestação (destrava Estimativa)
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Orçado (R$)</TableHead>
                <TableHead className="text-right">Pago Real (R$)</TableHead>
                <TableHead className="text-right">Diferença (R$)</TableHead>
                <TableHead className="text-center">Confirmado</TableHead>
                <TableHead>Observação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => {
                const pago = item.valor_pago_brl ?? item.valor_orcado_brl;
                const diff = Number(pago) - Number(item.valor_orcado_brl);
                return (
                  <TableRow key={item.id} className={item.confirmado ? '' : 'bg-amber-50/40'}>
                    <TableCell><Badge variant="outline" className="text-[10px]">{categoriaLabels[item.categoria] || item.categoria}</Badge></TableCell>
                    <TableCell className="text-sm">{item.descricao}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">{fmtBRL(item.valor_orcado_brl)}</TableCell>
                    <TableCell className="text-right">
                      <DebouncedInput
                        type="number"
                        step="0.01"
                        value={pago}
                        onCommit={(v) => handleCommitPago(item, Number(v))}
                        className="w-32 ml-auto text-right font-mono"
                      />
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${diff > 0 ? 'text-red-600' : diff < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {diff > 0 ? '+' : ''}{fmtBRL(diff)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Checkbox checked={item.confirmado} onCheckedChange={(c) => handleToggleConfirmado(item, !!c)} />
                    </TableCell>
                    <TableCell>
                      <DebouncedInput
                        value={item.observacao || ''}
                        onCommit={(v) => handleCommitObs(item, v)}
                        placeholder="—"
                        className="w-40 text-xs"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-sm space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total Orçado</span><span className="font-mono">R$ {fmtBRL(totalOrcado)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Total Pago Real</span><span className="font-mono">R$ {fmtBRL(totalPago)}</span></div>
              <div className={`flex justify-between font-semibold text-base pt-2 border-t ${diferenca > 0 ? 'text-red-600' : diferenca < 0 ? 'text-emerald-600' : ''}`}>
                <span>{diferenca > 0 ? 'Adicional a cobrar do cliente' : diferenca < 0 ? 'Saldo a devolver ao cliente' : 'Sem diferença'}</span>
                <span className="font-mono">R$ {fmtBRL(Math.abs(diferenca))}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AccountabilityPdfDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        quote={quote}
        accountability={accountability}
        items={items}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta Prestação de Contas?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os valores pagos confirmados serão perdidos e a Estimativa voltará a ficar editável. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                try {
                  await removeAccountability(accountability.id);
                  toast.success('Prestação de Contas excluída. Estimativa destravada.');
                  setDeleteOpen(false);
                } catch (err: any) {
                  toast.error(err.message || 'Erro ao excluir prestação de contas');
                } finally {
                  setDeleting(false);
                }
              }}
            >
              {deleting ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
