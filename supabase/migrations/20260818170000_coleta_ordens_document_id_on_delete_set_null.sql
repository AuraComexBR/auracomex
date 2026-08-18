-- Sem ON DELETE SET NULL, excluir um documento gerado pela ordem de coleta
-- (via DocumentsTab) falhava com violação de FK, porque
-- coleta_ordens_coleta.document_id ainda apontava pra ele.
alter table public.coleta_ordens_coleta
  drop constraint coleta_ordens_coleta_document_id_fkey,
  add constraint coleta_ordens_coleta_document_id_fkey
    foreign key (document_id) references public.documents(id) on delete set null;
