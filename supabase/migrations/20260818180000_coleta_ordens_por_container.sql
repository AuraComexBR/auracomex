-- Cada container de um embarque multi-container tem sua própria ordem de
-- coleta (motorista/cavalo/carreta/lacres/NF podem mudar de um container
-- pro outro). Antes havia no máximo uma ordem por shipment_id; agora
-- coleta_ordens_coleta guarda também qual container aquela ordem cobre.
alter table public.coleta_ordens_coleta
  add column container_number text;

create index idx_coleta_ordens_shipment_container
  on public.coleta_ordens_coleta(shipment_id, container_number);
