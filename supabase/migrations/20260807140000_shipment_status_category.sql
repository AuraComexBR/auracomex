-- O tracking do cliente vai ganhar uma linha do tempo genérica (5 marcos:
-- Reservado / Origem / Trânsito / Desembaraço / Entregue) que precisa
-- funcionar com QUALQUER status, inclusive os personalizados que cada
-- empresa cadastra em Logística > Gerenciar Status (ex.: "financeiro",
-- "lançar_di", "dta", "aguard._nacionalização"). Sem uma categoria fixa por
-- status, não dá pra saber em qual marco da linha do tempo cada status
-- personalizado cai.
ALTER TABLE public.shipment_status_options
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'transit';

-- Backfill dos status conhecidos hoje em produção (fixos do padrão antigo +
-- os personalizados já cadastrados pela Atlas). Qualquer status novo que já
-- não bata com esses valores fica no padrão 'transit' (definido acima) até
-- o usuário ajustar em Gerenciar Status.
UPDATE public.shipment_status_options SET category = 'booking' WHERE value IN ('approved', 'booked');
UPDATE public.shipment_status_options SET category = 'origin' WHERE value IN ('collected_at_origin', 'docs_at_origin', 'docs._origem', 'aguardando_embarque', 'agu._prontidão');
UPDATE public.shipment_status_options SET category = 'transit' WHERE value IN ('in_transit');
UPDATE public.shipment_status_options SET category = 'customs' WHERE value IN ('arrived', 'dta', 'lançar_di', 'aguardando_li', 'aguard._nacionalização', 'numerário', 'financeiro');
UPDATE public.shipment_status_options SET category = 'delivered' WHERE value IN ('delivered', 'finalizado');
UPDATE public.shipment_status_options SET category = 'cancelled' WHERE value IN ('cancelled');
UPDATE public.shipment_status_options SET category = 'customs' WHERE value IN ('aguardando_nf', 'inspeção_mapa');
