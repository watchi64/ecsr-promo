// Signatures fictives de la promo de démonstration (et du banc d'essai).
// Déterministe : une même personne garde la même allure d'une séance à l'autre, avec une
// légère variation par séance, comme une vraie signature. Aucune donnée réelle.
//
// Usage en module : import { signatureFictive } from "./scripts/emargement-demo.mjs".
// Usage en ligne de commande : voir la fin du fichier (écrit la migration de démonstration).

import { cheminDepuisTraits, REPERE } from "../js/emargement-rules.js";

function hacher(texte) {
  let h = 2166136261;
  for (const c of String(texte)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Générateur pseudo-aléatoire reproductible (mulberry32).
function alea(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Courbe lisse passant par les points de contrôle (Catmull-Rom).
function lisser(points, pas = 8) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)], p1 = points[i], p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    for (let k = 0; k < pas; k++) {
      const t = k / pas, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function signatureFictive(graine, variation = 0, { pas = 8 } = {}) {
  const r = alea(hacher(graine));                      // allure propre à la personne
  const j = alea(hacher(graine + "#" + variation));    // variation de la séance
  const ligne = 105;
  const pente = 0.18 + r() * 0.22;                     // inclinaison de l'écriture

  // Majuscule : une boucle haute.
  const x0 = 40 + r() * 25;
  const hMaj = 70 + r() * 25, lMaj = 35 + r() * 25;
  const corps = [
    { x: x0, y: ligne - 5 },
    { x: x0 + lMaj * 0.35, y: ligne - hMaj },
    { x: x0 + lMaj, y: ligne - hMaj * 0.75 },
    { x: x0 + lMaj * 0.55, y: ligne - hMaj * 0.35 },
    { x: x0 + lMaj * 0.2, y: ligne - hMaj * 0.45 },
    { x: x0 + lMaj * 0.6, y: ligne },
  ];
  // Minuscules : des bosses, parfois une boucle haute (l, b, h).
  let x = x0 + lMaj * 0.75;
  const n = 6 + Math.floor(r() * 5);
  for (let i = 0; i < n; i++) {
    const w = 16 + r() * 12;
    const haute = r() < 0.25;
    const h = haute ? 45 + r() * 20 : 14 + r() * 14;
    corps.push({ x: x + w * 0.35, y: ligne - h });
    if (haute) corps.push({ x: x + w * 0.15, y: ligne - h * 0.7 });
    corps.push({ x: x + w * 0.7, y: ligne - 2 });
    x += w;
  }
  const fin = { x: x + 20 + r() * 20, y: ligne - 20 - r() * 15 };
  corps.push(fin);
  // Paraphe : retour vers la gauche, sous la signature.
  const paraphe = [
    fin,
    { x: fin.x + 10, y: ligne + 8 },
    { x: (x0 + fin.x) / 2, y: ligne + 18 + r() * 8 },
    { x: x0 - 5 + r() * 20, y: ligne + 12 + r() * 6 },
  ];

  // Variation de la séance : taille, position, tremblé.
  const echelle = 0.92 + j() * 0.16;
  const dx = (j() - 0.5) * 16, dy = (j() - 0.5) * 10;
  const transforme = (p) => ({
    x: (p.x + pente * (ligne - p.y)) * echelle + dx + (j() - 0.5) * 1.2,
    y: (p.y - ligne) * echelle + ligne + dy + (j() - 0.5) * 1.2,
  });
  let traits = [lisser(corps, pas).map(transforme), lisser(paraphe, pas).map(transforme)];

  // Recadrage dans le repère, avec une marge : jamais de point écrasé contre un bord.
  const tous = traits.flat();
  const minX = Math.min(...tous.map((p) => p.x)), maxX = Math.max(...tous.map((p) => p.x));
  const minY = Math.min(...tous.map((p) => p.y)), maxY = Math.max(...tous.map((p) => p.y));
  const k = Math.min(1, (REPERE.largeur - 30) / (maxX - minX), (REPERE.hauteur - 20) / (maxY - minY));
  const ox = (REPERE.largeur - (maxX - minX) * k) / 2, oy = (REPERE.hauteur - (maxY - minY) * k) / 2;
  traits = traits.map((t) => t.map((p) => ({ x: (p.x - minX) * k + ox, y: (p.y - minY) * k + oy })));
  return cheminDepuisTraits(traits, REPERE);
}

// ===================================================================== Migration
// node scripts/emargement-demo.mjs : écrit supabase/migrations/20261023_emargement_demo.sql,
// les feuilles des semaines du 12 et du 19 octobre de la promo 7 « Démonstration (données
// fictives) ». Personnes fictives de cette promo, retrouvées par nom (jamais par id).

const STAGIAIRES_DEMO = [
  ["Camille", "Martin"], ["Lucas", "Bernard"], ["Inès", "Moreau"], ["Julien", "Petit"],
  ["Sarah", "Laurent"], ["Mehdi", "Garcia"], ["Laura", "Roux"], ["Thomas", "Fournier"],
  ["Nadia", "Girard"], ["Kevin", "Mercier"],
];
const FORMATEURS_DEMO = ["Claire", "Marc"];
const VARIANTES = 2;
// Moins de points par courbe que le banc : la migration reste assez légère pour être appliquée en une fois.
const PAS_DEMO = 4;
const HORAIRES = { matin: ["09:00", "12:30"], aprem: ["13:30", "17:00"] };

// Exceptions à la présence : « jour demi prénom » → ligne particulière.
const EXCEPTIONS = {
  "2026-10-13 matin Sarah": { absent: true, origine: "formateur", observation: "Absence justifiée (certificat médical)" },
  "2026-10-13 aprem Sarah": { absent: true, origine: "formateur", observation: "Absence justifiée (certificat médical)" },
  "2026-10-15 matin Lucas": { retard: 40, observation: "Arrivé à 9h40" },
  "2026-10-15 aprem Kevin": { absent: true, origine: "non_signe" },
  "2026-10-19 matin Kevin": { absent: true, origine: "formateur", observation: "Absence non justifiée" },
  "2026-10-20 aprem Nadia": { appareil: true, observation: "Téléphone déchargé : signé sur l'appareil du formateur" },
  "2026-10-21 aprem Kevin": { absent: true, origine: "non_signe" },
  "2026-10-23 aprem Mehdi": { depart: true, observation: "Parti à 15h30 (rendez-vous médical)" },
};

const sql = (v) => (v === null || v === undefined ? "null" : typeof v === "string" ? "'" + v.replace(/'/g, "''") + "'" : String(v));

export function migrationDemo() {
  const traces = [];
  for (const [prenom, nom] of STAGIAIRES_DEMO) {
    for (let v = 0; v < VARIANTES; v++) traces.push([prenom + " " + nom, v, signatureFictive(prenom + " " + nom, v, { pas: PAS_DEMO })]);
  }
  for (const f of FORMATEURS_DEMO) for (let v = 0; v < VARIANTES; v++) traces.push([f, v, signatureFictive(f, v, { pas: PAS_DEMO })]);
  const personnes = STAGIAIRES_DEMO.map(([prenom, nom], rang) => [prenom, nom, rang]);
  const exceptions = Object.entries(EXCEPTIONS).map(([cle, e]) => {
    const [jour, demi, prenom] = cle.split(" ");
    return [jour, demi, prenom, !!e.absent, e.absent ? e.origine : null, e.observation || null, !!e.appareil, e.retard ?? null];
  });

  const valeurs = (rangs) => rangs.map((r) => "  (" + r.map(sql).join(", ") + ")").join("," + String.fromCharCode(10));
  return `-- Émargements fictifs de la promo de démonstration (id 7, « Démonstration (données fictives) »),
-- pour le rendez-vous de la semaine du 26/10/2026. Écrit par scripts/emargement-demo.mjs : ne pas
-- modifier à la main. Semaines du 12 et du 19 octobre, dix demi-journées closes chacune, signatures
-- générées (aucune donnée réelle), et l'interrupteur de l'émargement allumé pour cette seule
-- promo. Les 200 lignes sont calculées ici à partir de quelques règles (arrivées étalées, variantes
-- de signature alternées, exceptions listées). Gardée : sans la promo 7, ou si elle a déjà des
-- feuilles, rien n'est écrit. Ménage : 20261023_emargement_demo_retour.sql (ou la suppression de la promo 7).
set local lock_timeout = '3s';

do $garde$
begin
  if not exists (select 1 from public.promos where id = 7 and nom like 'Démonstration%') then
    raise exception 'Promo de démonstration (id 7) introuvable : rien n''est écrit.';
  end if;
  if exists (select 1 from public.emargement_seances where promo_id = 7) then
    raise exception 'La promo de démonstration a déjà des feuilles d''émargement : rien n''est écrit.';
  end if;
end $garde$;

create temp table demo_traces (cle text, variante integer, trace text) on commit drop;
insert into demo_traces values
${valeurs(traces)};

create temp table demo_personnes (prenom text, nom text, rang integer) on commit drop;
insert into demo_personnes values
${valeurs(personnes)};

create temp table demo_exceptions (jour date, demi text, prenom text, absent boolean, origine text,
  observation text, appareil boolean, retard integer) on commit drop;
insert into demo_exceptions values
${valeurs(exceptions)};

-- Les vingt demi-journées (lundi à vendredi des deux semaines), numérotées dans l'ordre.
create temp table demo_seances on commit drop as
select (row_number() over (order by j, d.ordre) - 1)::integer as i, j::date as jour, d.demi, d.debut, d.fin
  from generate_series(date '2026-10-12', date '2026-10-23', interval '1 day') j
  cross join (values (0, 'matin', '${HORAIRES.matin[0]}', '${HORAIRES.matin[1]}'),
                     (1, 'aprem', '${HORAIRES.aprem[0]}', '${HORAIRES.aprem[1]}')) d(ordre, demi, debut, fin)
 where extract(isodow from j) <= 5;

-- Une ligne par stagiaire et par demi-journée : arrivée 2 à 22 minutes après le début, variante
-- de signature alternée, sauf exception (absence, retard, signature sur l'appareil du formateur).
create temp table demo_lignes on commit drop as
select s.jour, s.demi, p.prenom, p.nom, (s.i + p.rang) % ${VARIANTES} as variante,
       coalesce(e.retard, 2 + ((p.rang * 7 + s.i * 3) % 21)) as minute,
       coalesce(e.appareil, false) as appareil, coalesce(e.absent, false) as absent, e.origine, e.observation
  from demo_seances s
  cross join demo_personnes p
  left join demo_exceptions e on e.jour = s.jour and e.demi = s.demi and e.prenom = p.prenom;

insert into public.emargement_seances (promo_id, jour, demi_journee, debut, fin, statut, ouverte_le, ouverte_par, close_le, close_par)
select 7, s.jour, s.demi, s.debut, s.fin, 'close',
       ((s.jour + s.debut::time) at time zone 'Europe/Paris') - interval '4 minutes', 'demonstration',
       ((s.jour + s.fin::time) at time zone 'Europe/Paris') + interval '3 minutes', 'demonstration'
  from demo_seances s;

insert into public.emargement_lignes (seance_id, promo_id, stagiaire_id, trace, signe_le, signe_par,
  sur_appareil_formateur, absent, absence_origine, observation, maj_le, maj_par)
select s.id, 7, st.id,
       case when l.absent then null else t.trace end,
       case when l.absent then null
            else ((s.jour + s.debut::time) at time zone 'Europe/Paris') + l.minute * interval '1 minute' end,
       case when l.absent then null else 'demonstration' end,
       l.appareil, l.absent, l.origine, l.observation, s.close_le, 'demonstration'
  from demo_lignes l
  join public.emargement_seances s on s.promo_id = 7 and s.jour = l.jour and s.demi_journee = l.demi
  join public.stagiaires st on st.promo_id = 7 and st.prenom = l.prenom and st.nom = l.nom
  join demo_traces t on t.cle = l.prenom || ' ' || l.nom and t.variante = l.variante;

insert into public.emargement_formateurs (seance_id, promo_id, nom, prof_id, trace, signe_le, signe_par)
select s.id, 7, f.nom, null, t.trace,
       ((s.jour + s.fin::time) at time zone 'Europe/Paris') - f.avance * interval '1 minute', 'demonstration'
  from public.emargement_seances s
  cross join (values ('Claire', 6), ('Marc', 4)) f(nom, avance)
  join demo_traces t on t.cle = f.nom
   and t.variante = (extract(day from s.jour)::integer + case when s.demi_journee = 'aprem' then 1 else 0 end) % ${VARIANTES}
 where s.promo_id = 7;

insert into public.settings (key, value, promo_id, updated_at)
values ('emargement_entete',
        '{"organisme":"ECF (centre de démonstration)","intitule":"Titre professionnel Enseignant de la conduite et de la sécurité routière (ECSR)"}',
        7, now())
on conflict (promo_id, key) do nothing;

-- L'émargement n'est allumé que pour la promo de démonstration (décision de Timy du 23/10).
insert into public.settings (key, value, promo_id, updated_at)
values ('emargement_actif', 'true', 7, now())
on conflict (promo_id, key) do update set value = 'true', updated_at = now();

do $controle$
declare n_s integer; n_l integer; n_f integer;
begin
  select count(*) into n_s from public.emargement_seances where promo_id = 7;
  select count(*) into n_l from public.emargement_lignes where promo_id = 7;
  select count(*) into n_f from public.emargement_formateurs where promo_id = 7;
  if n_s <> 20 or n_l <> 200 or n_f <> 40 then
    raise exception 'Démonstration incomplète : % feuilles, % lignes, % signatures de formateurs', n_s, n_l, n_f;
  end if;
end $controle$;
`;
}

if (typeof process !== "undefined" && process.argv?.[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) {
  const { writeFileSync } = await import("node:fs");
  const chemin = "supabase/migrations/20261023_emargement_demo.sql";
  writeFileSync(chemin, migrationDemo());
  console.log("écrit :", chemin);
}
