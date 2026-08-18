-- Peso líquido apurado no terminal, além do peso bruto já existente —
-- necessário no texto de autorização (carta) da Ordem de Coleta.
alter table public.coleta_ordens_coleta
  add column peso_liquido_apurado numeric;
