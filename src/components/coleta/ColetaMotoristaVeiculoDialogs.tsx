// Dialogs de cadastro rápido de motorista, cavalo e carreta, usados dentro
// dos selects da ordem de coleta ("+ novo motorista" / "+ novo cavalo" /
// "+ nova carreta"). Cavalo e carreta são cadastros independentes — a
// combinação muda no dia a dia.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  useCreateColetaMotorista,
  useCreateColetaCavalo,
  useCreateColetaCarreta,
  ColetaMotorista,
  ColetaCavalo,
  ColetaCarreta,
} from '@/hooks/useColeta';

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

const cavaloSchema = z.object({
  placa: z.string().min(1, 'Obrigatório'),
  cor: z.string().optional(),
  modelo: z.string().optional(),
});

const carretaSchema = z.object({
  placa: z.string().min(1, 'Obrigatório'),
  tipo: z.string().optional(),
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

export function NovoCavaloDialog({
  companyId,
  clientId,
  onCreated,
}: {
  companyId: string;
  clientId: string;
  onCreated: (cavalo: ColetaCavalo) => void;
}) {
  const [open, setOpen] = useState(false);
  const createCavalo = useCreateColetaCavalo();
  const form = useForm<z.infer<typeof cavaloSchema>>({ resolver: zodResolver(cavaloSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const cavalo = await createCavalo.mutateAsync({
        company_id: companyId,
        client_id: clientId,
        cor: null,
        modelo: null,
        ...values,
      } as any);
      toast.success('Cavalo cadastrado');
      onCreated(cavalo);
      setOpen(false);
      form.reset();
    } catch (err: any) {
      toast.error('Erro ao cadastrar cavalo', { description: err.message });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">+ Novo cavalo</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo cavalo (trator)</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="placa">Placa</Label>
            <Input id="placa" {...form.register('placa')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cor">Cor</Label>
              <Input id="cor" {...form.register('cor')} />
            </div>
            <div>
              <Label htmlFor="modelo">Modelo</Label>
              <Input id="modelo" placeholder="Ex.: FH 500 6X2T" {...form.register('modelo')} />
            </div>
          </div>
          <Button type="submit" disabled={createCavalo.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NovaCarretaDialog({
  companyId,
  clientId,
  onCreated,
}: {
  companyId: string;
  clientId: string;
  onCreated: (carreta: ColetaCarreta) => void;
}) {
  const [open, setOpen] = useState(false);
  const createCarreta = useCreateColetaCarreta();
  const form = useForm<z.infer<typeof carretaSchema>>({ resolver: zodResolver(carretaSchema) });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const carreta = await createCarreta.mutateAsync({
        company_id: companyId,
        client_id: clientId,
        tipo: null,
        ...values,
      } as any);
      toast.success('Carreta cadastrada');
      onCreated(carreta);
      setOpen(false);
      form.reset();
    } catch (err: any) {
      toast.error('Erro ao cadastrar carreta', { description: err.message });
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">+ Nova carreta</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova carreta</DialogTitle></DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="placa">Placa</Label>
            <Input id="placa" {...form.register('placa')} />
          </div>
          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <Input id="tipo" placeholder="Ex.: Baú, Graneleiro, Prancha" {...form.register('tipo')} />
          </div>
          <Button type="submit" disabled={createCarreta.isPending}>Salvar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
