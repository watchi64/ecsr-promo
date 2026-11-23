-- Retour de 20261123_epcf_ccp2 : la colonne trame ne reprend que « salle » et « vehicule ». S'arrête sans rien changer
-- si une évaluation CCP2 existe déjà : la supprimer d'abord est une décision, pas un retour automatique.

set local lock_timeout = '3s';

do $retour$
begin
  if exists (select 1 from public.epcf_evaluations where trame = 'ccp2') then
    raise exception 'Retour refusé : % évaluation(s) CCP2 en base', (select count(*) from public.epcf_evaluations where trame = 'ccp2');
  end if;
end
$retour$;

alter table public.epcf_evaluations drop constraint if exists epcf_evaluations_trame_check;
alter table public.epcf_evaluations add constraint epcf_evaluations_trame_check
  check (trame = any (array['salle'::text, 'vehicule'::text]));
