-- A linha do tempo do tracking do cliente ganhou um 6º marco: além de
-- Reservado / Origem / Trânsito / Desembaraço / Entregue, agora existe
-- "Atracado" (separado de "Desembaraço"), com o marco de Trânsito rotulado
-- por modal (Navegando/Voando). O status "arrived" (Atracou), que antes
-- caía na categoria 'customs', passa a ter sua própria categoria 'arrived'.
UPDATE public.shipment_status_options SET category = 'arrived' WHERE value = 'arrived';
