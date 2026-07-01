-- Migration : qcm_examen_lot2
-- Appliquée sur le projet Supabase crpduennbqaemhfaywrz le 2026-07-01 via le MCP apply_migration.
-- Copie versionnée pour traçabilité (le projet applique ses migrations via MCP, pas de dossier supabase/migrations).
-- Spec : docs/specs/2026-07-01-qcm-examen-lot2-design.md
--
-- Vérifié après application : colonnes en place, miroir evaluations OK (thème #48),
-- unicité examen (duplicate key refusé), cascade de réinitialisation OK.

-- Le tirage figé partagé : liste ordonnée d'ids de questions, gelée au publish.
alter table qcm add column if not exists exam_question_ids jsonb;
alter table qcm add column if not exists exam_draw_mode text
  check (exam_draw_mode in ('random','manual'));
alter table qcm add column if not exists exam_seconds_per_question integer not null default 30;

-- Lien miroir attempt -> evaluations (null pour les notes manuelles).
alter table evaluations add column if not exists qcm_attempt_id bigint
  references qcm_attempts(id) on delete cascade;

-- Un seul examen officiel par stagiaire (la réinit supprime la ligne).
create unique index if not exists qcm_attempts_one_exam
  on qcm_attempts (qcm_id, stagiaire_id) where mode = 'examen';

-- Miroir automatique de l'examen vers la matrice Notes (thèmes numérotés).
create or replace function mirror_exam_to_evaluations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero    integer;
  v_titre     text;
  v_qcm_titre text;
begin
  if NEW.mode <> 'examen' then
    return NEW;
  end if;
  select t.numero, t.titre, q.titre
    into v_numero, v_titre, v_qcm_titre
  from qcm q
  join themes t on t.id = q.theme_id
  where q.id = NEW.qcm_id;

  if v_numero is not null then
    insert into evaluations
      (stagiaire_id, type, theme_numero, theme_titre,
       note, note_max, observation, date_eval, controle_libelle, qcm_attempt_id)
    values
      (NEW.stagiaire_id, 'Thème', v_numero, v_titre,
       NEW.note_20, 20, 'QCM examen', current_date, v_qcm_titre, NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_mirror_exam on qcm_attempts;
create trigger trg_mirror_exam
  after insert on qcm_attempts
  for each row execute function mirror_exam_to_evaluations();
