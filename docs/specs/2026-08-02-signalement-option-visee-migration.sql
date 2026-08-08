-- L'option que l'élève conteste, portée par le signalement lui-même.
--
-- Pourquoi : les options sont mélangées à l'affichage depuis le 2026-07-18. Un élève qui
-- écrit « la réponse D » ou « la première proposition » désigne un rang qui n'existe plus
-- une fois le signalement en base — deux griefs du 01/08 (ids 14 et 15) sont devenus
-- indécidables pour cette seule raison.
--
-- Deux colonnes, parce qu'elles répondent à deux questions différentes :
--   option_id     : DE QUELLE option il s'agit. Permet de retrouver l'option même si son
--                   texte est corrigé ensuite, et de savoir si l'élève conteste en fait
--                   la bonne réponse (jointure sur is_correct).
--   option_texte  : CE QUE L'ÉLÈVE A VU au moment du signalement. Un instantané : si
--                   l'option est corrigée ou supprimée après coup, le grief reste lisible.
--
-- Les deux sont facultatives : un signalement peut porter sur l'énoncé, sur l'explication
-- ou sur la question entière, sans viser d'option en particulier.

alter table public.qcm_signalements
  add column if not exists option_id bigint
    references public.qcm_options(id) on delete set null,
  add column if not exists option_texte text;

comment on column public.qcm_signalements.option_id is
  'Option contestée, facultative. ON DELETE SET NULL : supprimer une option ne doit pas '
  'faire disparaître le signalement qui la visait.';
comment on column public.qcm_signalements.option_texte is
  'Texte de l''option tel que l''élève l''a vu au moment du signalement. Instantané '
  'délibéré : il survit à la correction ou à la suppression de l''option.';
