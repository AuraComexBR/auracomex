-- Motoristas: frota é do cliente (importador que faz coleta própria), não da empresa operadora
create table public.coleta_motoristas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  client_id uuid not null references public.clients(id),
  nome text not null,
  cpf text,
  cnh text,
  rg text,
  orgao_emissor text,
  cnh_emissao date,
  telefone text,
  nextel text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coleta_veiculos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  client_id uuid not null references public.clients(id),
  placa_cavalo text not null,
  placa_carreta text,
  cor text,
  modelo text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coleta_ordens_coleta (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  shipment_id uuid not null references public.shipments(id),
  motorista_id uuid references public.coleta_motoristas(id),
  veiculo_id uuid references public.coleta_veiculos(id),
  numero_documento text,
  terminal text,
  patio text,
  data_agendada timestamptz,
  status text not null default 'agendada',
  lacre_encontrado text,
  lacre_adicional text,
  lacre_ipa text,
  termo_avaria text,
  peso_bruto_apurado numeric,
  document_id uuid references public.documents(id),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coleta_ordens_coleta_status_check check (status in ('agendada','realizada','cancelada','no_show'))
);

create table public.coleta_ordem_notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  ordem_coleta_id uuid not null references public.coleta_ordens_coleta(id) on delete cascade,
  numero text not null,
  serie text,
  emissao date,
  lote text,
  created_at timestamptz not null default now()
);

-- indices
create index idx_coleta_motoristas_company on public.coleta_motoristas(company_id);
create index idx_coleta_motoristas_client on public.coleta_motoristas(client_id);
create index idx_coleta_veiculos_company on public.coleta_veiculos(company_id);
create index idx_coleta_veiculos_client on public.coleta_veiculos(client_id);
create index idx_coleta_ordens_company on public.coleta_ordens_coleta(company_id);
create index idx_coleta_ordens_shipment on public.coleta_ordens_coleta(shipment_id);
create index idx_coleta_ordens_motorista on public.coleta_ordens_coleta(motorista_id);
create index idx_coleta_ordens_veiculo on public.coleta_ordens_coleta(veiculo_id);
create index idx_coleta_ordem_nf_ordem on public.coleta_ordem_notas_fiscais(ordem_coleta_id);

-- updated_at triggers (reaproveita a função já existente)
create trigger set_updated_at before update on public.coleta_motoristas
  for each row execute function public.update_updated_at_column();
create trigger set_updated_at before update on public.coleta_veiculos
  for each row execute function public.update_updated_at_column();
create trigger set_updated_at before update on public.coleta_ordens_coleta
  for each row execute function public.update_updated_at_column();

-- RLS (mesmo padrão tenant_all das outras tabelas)
alter table public.coleta_motoristas enable row level security;
alter table public.coleta_veiculos enable row level security;
alter table public.coleta_ordens_coleta enable row level security;
alter table public.coleta_ordem_notas_fiscais enable row level security;

create policy tenant_all on public.coleta_motoristas
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
create policy tenant_all on public.coleta_veiculos
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
create policy tenant_all on public.coleta_ordens_coleta
  for all using (company_id = my_company_id()) with check (company_id = my_company_id());
create policy tenant_all on public.coleta_ordem_notas_fiscais
  for all using (
    exists (select 1 from public.coleta_ordens_coleta oc
            where oc.id = ordem_coleta_id and oc.company_id = my_company_id())
  ) with check (
    exists (select 1 from public.coleta_ordens_coleta oc
            where oc.id = ordem_coleta_id and oc.company_id = my_company_id())
  );

-- gerador de número de documento próprio da Aura, mesmo padrão do next_dn_number
create or replace function public.next_oc_number(p_company_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_seq integer;
begin
  select count(*) + 1 into v_seq
  from coleta_ordens_coleta
  where company_id = p_company_id;

  return 'OC-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 5, '0');
end;
$$;
