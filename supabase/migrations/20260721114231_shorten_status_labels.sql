-- Encurta os rótulos de status pra uma palavra só, ajudando a coluna "Status"
-- na lista de embarques a ficar mais estreita.
UPDATE public.shipment_status_options SET label = 'Coletado' WHERE value = 'collected_at_origin' AND label = 'Coletado na Origem';
UPDATE public.shipment_status_options SET label = 'Docs' WHERE value = 'docs_at_origin' AND label = 'Docs na Origem';
UPDATE public.shipment_status_options SET label = 'Trânsito' WHERE value = 'in_transit' AND label = 'Em Trânsito';
