-- O status do embarque (shipments.status) era um ENUM fixo do Postgres
-- (shipment_status), mas a empresa pode cadastrar status personalizados na
-- aba Logistica ("Gerenciar Status"), que ficam salvos em
-- shipment_status_options como texto livre. Como o ENUM so aceita os
-- valores fixos com os quais foi criado, ao selecionar um status
-- personalizado o banco rejeitava com "invalid input value for enum
-- shipment_status". Convertendo a coluna para texto livre, qualquer status
-- cadastrado pela empresa passa a poder ser salvo normalmente.
ALTER TABLE public.shipments ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.shipments ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.shipments ALTER COLUMN status SET DEFAULT 'draft';
