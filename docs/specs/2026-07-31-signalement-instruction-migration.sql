-- Instruction automatique des signalements de QCM.
-- Table SÉPARÉE de qcm_signalements, et non deux colonnes : la politique de lecture des
-- signalements laisse un élève relire les siens
-- (is_admin() OR is_prof() OR lower(email) = lower(auth.email())).
-- Sur la même table, un élève pourrait donc lire « signalement fondé, la question est
-- fausse » AVANT que le formateur ait tranché. Ici, c'est structurellement impossible.

create table if not exists public.qcm_signalement_instruction (
  signalement_id bigint primary key
    references public.qcm_signalements(id) on delete cascade,
  verdict_auto  text not null
    check (verdict_auto in ('fonde','confirme','ambigu','non_concluant')),
  analyse_auto  text not null,
  instruit_at   timestamptz not null default now()
);

comment on table public.qcm_signalement_instruction is
  'Avis d''un agent d''instruction sur un signalement. AVIS, PAS DÉCISION : le classement '
  'du signalement (qcm_signalements.statut) reste le geste du formateur.';

alter table public.qcm_signalement_instruction enable row level security;

-- Lecture formateur seule. AUCUNE politique insert/update/delete pour `authenticated` :
-- le navigateur ne peut pas fabriquer ni modifier un verdict, quel que soit le rôle.
-- Seul l'agent local écrit, hors RLS, via le MCP Supabase.
drop policy if exists qcm_signalement_instruction_select on public.qcm_signalement_instruction;
create policy qcm_signalement_instruction_select on public.qcm_signalement_instruction
  for select to authenticated
  using (is_admin() or is_prof());

grant select on public.qcm_signalement_instruction to authenticated;
