// Dialogs de cadastro rápido de motorista e veículo, usados dentro do select
// da ordem de coleta ("+ novo motorista" / "+ novo veículo").

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useCreateColetaMotorista, useCreateColetaVeiculo, ColetaMotorista, ColetaVeiculo } from '@/hooks/useColeta';

const motoristaSchema = z.object({
  nome: z.string().min(1, 'Obrigatório'),
  cpf: z.string().optional(),
  cnh: z.string().optional(),
  rg: z.string().optional(),
  orgao_emissor: z.string().optional(),
  cnh_emissao: z.string().optional(),
  telefone: z.string().optional(),
  nextel: z.string().optional(),
});

const veiculoSchema = z.object({
  placa_cavalo: z.string().min(1, 'Obrigatório'),
  placa_carreta: z.string().optional(),
  cor: z.string().optional(),
  modelo: z.string().optional(),
});

export function NovoMotoristaDialog({
  companyId,
  clientId,
  onCreated,
}: {
  companyId: string;
  clientId: string;
  onCreated: (motorista: ColetaMotorista) => void;
}) {
  const [open, setOpen] = useState(false);
  const createMotorista = useCreateColetaMotorista();
  const form = useForm<z.infer<typeof motoristaSchema>>({ resolver: zodResolver(motoristaSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const motorista = await createMotorista.mutateAsync({
        company_id: companyId,
        client_id: clientId,
        cpf: null,
        cnh: null,
        rg: null,
        orgao_emissor: null,
        cnh_emissao: null,
        telefone: null,
        nextel: null,
        ...values,
      } as any);
      toast.success('Motorista cadastrado');
      onCreated(motorista);
      setOpen(false);
      form.reset();
    } catch (err: any) {
      toast.error('Erro ao cadastrar motorista', { description: err.message });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">+ Novo motorista</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo motorista</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" {...form.register('nome')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cpf">CPF</Label>
              <Input id="cpf" {...form.register('cpf')} />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" {...form.register('telefone')} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="cnh">CNH</Label>
              <Input id="cnh" {...form.register('cnh')} />
            </div>
            <div>
              <Label htmlFor="rg">RG</Label>
              <Input id="rg" {...form.register('rg')} />
            </div>
            <div>
              <Label htmlFor="orgao_emissor">Órgão emissor</Label>
              <Input id="orgao_emissor" {...form.register('orgao_emissor')} />
            </div>
          </div>
          <Button type="submit" disabled={createMotorista.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NovoVeiculoDialog({
  companyId,
  clientId,
  onCreated,
}: {
  companyId: string;
  clientId: string;
  onCreated: (veiculo: ColetaVeiculo) => void;
}) {
  const [open, setOpen] = useState(false);
  const createVeiculo = useCreateColetaVeiculo();
  const form = useForm<z.infer<typeof veiculoSchema>>({ resolver: zodResolver(veiculoSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const veiculo = await createVeiculo.mutateAsync({
        company_id: companyId,
        client_id: clientId,
        placa_carreta: null,
        cor: null,
        modelo: null,
        ...values,
      } as any);
      toast.success('Veículo cadastrado');
      onCreated(veiculo);
      setOpen(false);
      form.reset();
    } catch (err: any) {
      toast.error('Erro ao cadastrar veículo', { description: err.message });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">+ Novo veículo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo veículo</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="placa_cavalo">Placa cavalo</Label>
              <Input id="placa_cavalo" {...form.register('placa_cavalo')} />
            </div>
            <div>
              <Label htmlFor="placa_carreta">Placa carreta</Label>
              <Input id="placa_carreta" {...form.register('placa_carreta')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cor">Cor</Label>
              <Input id="cor" {...form.register('cor')} />
            </div>
            <div>
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" {...form.register('modelo')} />
            </div>
          </div>
          <Button type="submit" disabled={createVeiculo.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
