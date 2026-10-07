/*
 * Promo ECSR : Application propriétaire.
 * © 2026 watchi64 : Tous droits réservés. Voir LICENSE.
 *
 * Contrôles automatiques des scènes animées (spec du 03/10/2026, section 6).
 * Module pur : chaque scène du registre est échantillonnée tous les dixièmes de
 * seconde avec la géométrie même du moteur. Une scène conforme ne renvoie aucun
 * message. Les seuils de confort ne sont pas des règles du Code de la route :
 * ce sont des garde-fous de vraisemblance, consignés comme tels dans les fiches.
 *
 * Ordre des contrôles : étapes, trajectoires (contacts, limite, allure de recul,
 * accélérations, continuité de la vitesse), arrêts aux rebroussements, entrées et
 * sorties hors du monde, clignotants (assez tôt avant le départ dans l'arc, du bon
 * côté de la caisse et tout le long de l'arc), puis les attentes que la scène déclare.
 */
import { preparerScene, etatActeur, emprise, polygonesSeChevauchent, pointDansPolygone, tempsAtteint, tempsDepart, avant,
  apparitionDe, sortDuCadre, rebroussements, rectangle, KMH, DEG }
  from "./scene-geometrie.js?v=20261005f";

export const SEUILS = {
  accelerationLaterale: 3.0,        // m/s²
  accelerationLongitudinale: 3.0,   // m/s²
  vitesseMarcheArriere: 6,          // km/h : l'allure du pas, en marche arrière
  avanceClignotant: 2.0,            // s avant le début d'un changement de direction
  angleChangementDirection: 30,     // degrés : en deçà, un arc n'est pas un changement de direction
  pas: 0.1,                         // s
};

const f1 = (x) => x.toFixed(1);

export function controlerScene(def) {
  let sc;
  try { sc = preparerScene(def); } catch (e) { return [e.message]; }
  const erreurs = [];
  const note = (m) => { if (!erreurs.includes(m)) erreurs.push(m); };
  controlerEtapes(sc, note);
  controlerTrajectoires(sc, note);
  controlerRebroussements(sc, note);
  controlerEntreesSorties(sc, note);
  controlerClignotants(sc, note);
  for (const att of sc.attentes || []) controlerAttente(sc, att, note);
  return erreurs;
}

function instants(sc, f) {
  const n = Math.floor(sc.duree / SEUILS.pas + 1e-9);
  for (let k = 0; k <= n; k++) f(k * SEUILS.pas);
}

function controlerEtapes(sc, note) {
  if (sc.etapes.length < 2) note("la scène doit compter au moins deux étapes");
  sc.etapes.forEach((e, i) => {
    if (e.s < -1e-9 || e.s > sc.eleve.chemin.longueur + 1e-9) note(`étape ${i + 1} : abscisse hors du trajet`);
    if (i > 0 && !(e.t > sc.etapes[i - 1].t + 1e-9)) note(`étape ${i + 1} : commence au plus tôt avec la précédente`);
  });
}

function controlerTrajectoires(sc, note) {
  const vus = new Set();
  const une = (cle, m) => { if (!vus.has(cle)) { vus.add(cle); note(m); } };
  // Vitesse de chaque acteur à l'instant précédent ; absente s'il n'y était pas visible.
  const vitessePrecedente = new Map();
  instants(sc, (t) => {
    const presents = [];
    for (const a of sc.acteurs) {
      const e = etatActeur(a, t);
      const vPrec = vitessePrecedente.get(a);
      if (e.visible) vitessePrecedente.set(a, e.v); else vitessePrecedente.delete(a);
      if (!e.visible) continue;
      const poly = emprise(a.gabarit, e);
      presents.push({ a, poly });
      if (a.gabarit === "pieton") continue;
      for (const o of sc.decor.obstacles) {
        if (polygonesSeChevauchent(poly, o.poly)) une(`${a.id}|${o.nature}`, `${a.id} touche un ${o.nature} à t = ${f1(t)} s`);
      }
      if (e.v / KMH > sc.limite + 1e-6) une(`${a.id}|limite`, `${a.id} dépasse ${sc.limite} km/h à t = ${f1(t)} s`);
      // Allure de recul : en marche arrière (celle du segment parcouru, etatActeur), au plus l'allure du pas.
      if (e.marche === "arriere" && e.v / KMH > SEUILS.vitesseMarcheArriere + 1e-6) {
        une(`${a.id}|recul`, `${a.id} recule à ${(e.v / KMH).toFixed(1)} km/h à t = ${f1(t)} s (au plus ${SEUILS.vitesseMarcheArriere} km/h)`);
      }
      const lat = e.v * e.v * Math.abs(e.courbure);
      if (lat > SEUILS.accelerationLaterale + 1e-6) une(`${a.id}|lat`, `${a.id} : accélération latérale de ${lat.toFixed(2)} m/s² à t = ${f1(t)} s`);
      if (Math.abs(e.a) > SEUILS.accelerationLongitudinale + 1e-6) une(`${a.id}|long`, `${a.id} : accélération longitudinale de ${e.a.toFixed(2)} m/s² à t = ${f1(t)} s`);
      // Continuité de la vitesse : d'un instant au suivant, un véhicule visible aux deux instants ne change de
      // vitesse que de l'accélération de confort. Cela attrape le départ lancé d'un véhicule qui attendait à
      // l'image. Un piéton (exempté plus haut) part et s'arrête d'un coup ; un véhicule qui apparaît ou
      // disparaît n'a pas d'état visible de l'autre côté : rien à comparer.
      if (vPrec !== undefined && Math.abs(e.v - vPrec) > SEUILS.accelerationLongitudinale * SEUILS.pas + 1e-6) {
        une(`${a.id}|saut`, `${a.id} : saut de vitesse de ${(Math.abs(e.v - vPrec) / KMH).toFixed(1)} km/h à t = ${f1(t)} s`);
      }
    }
    for (let i = 0; i < presents.length; i++) {
      for (let j = i + 1; j < presents.length; j++) {
        if (polygonesSeChevauchent(presents[i].poly, presents[j].poly)) {
          une(`${presents[i].a.id}|${presents[j].a.id}`, `${presents[i].a.id} et ${presents[j].a.id} se touchent à t = ${f1(t)} s`);
        }
      }
    }
  });
}

// Un véhicule ne change de sens de marche qu'à l'arrêt : à chaque rebroussement, lu sur les segments par rebroussements()
// (qui fait foi, et non le champ chemin.rebroussements), sa vitesse est nulle. L'arrêt se lit sur les échantillons de la
// chronologie : elle en place un à chaque point du profil, à la vitesse exacte du point, et entre deux points
// l'accélération est constante, la vitesse ne s'annulant qu'à un bout où le profil la met à 0 km/h (deux points de suite
// à 0 km/h sont refusés). Un échantillon de vitesse nulle à l'abscisse du rebroussement, au micron près (les arrondis
// flottants), prouve donc l'arrêt sans interpolation ni seuil de vitesse. Un arrêt d'un instant, sans pause, suffit. Les
// piétons en sont exemptés, comme des autres règles de vitesse : ils partent et s'arrêtent d'un coup.
function controlerRebroussements(sc, note) {
  for (const a of sc.acteurs) {
    if (!a.chrono || a.gabarit === "pieton") continue;
    for (const s of rebroussements(a.chemin)) {
      const arret = a.chrono.echantillons.some((e) => Math.abs(e.s - s) <= 1e-6 && e.v === 0);
      if (!arret) note(`${a.id} change de sens de marche sans s'arrêter (s = ${f1(s)} m)`);
    }
  }
}

// Un véhicule ne surgit ni ne s'évanouit dans l'image : il entre et sort par les bords du monde (le rectangle
// dessiné). Un contact avec le bord compte comme être dans le cadre.
function controlerEntreesSorties(sc, note) {
  const monde = rectangle(0, 0, sc.monde.largeur, sc.monde.hauteur);
  const dansLeCadre = (a, t) => polygonesSeChevauchent(emprise(a.gabarit, etatActeur(a, t)), monde);
  for (const a of sc.acteurs) {
    if (!a.chrono) continue;
    const depart = a.depart || 0;
    if (apparitionDe(a) === "depart" && depart > 0 && dansLeCadre(a, depart)) {
      note(`${a.id} apparaît dans le cadre à t = ${f1(depart)} s : son trajet doit commencer hors du monde`);
    }
    if (sortDuCadre(a) && dansLeCadre(a, a.chrono.duree)) {
      note(`${a.id} disparaît dans le cadre à t = ${f1(a.chrono.duree)} s : son trajet doit finir hors du monde`);
    }
  }
  // L'élève qui finit en mouvement garde son image jusqu'à la fin de la scène : aucun autre acteur mobile
  // ne doit encore bouger après lui.
  const chronoEleve = sc.eleve.chrono;
  if (chronoEleve.echantillons[chronoEleve.echantillons.length - 1].v > 0) {
    for (const a of sc.acteurs) {
      if (a === sc.eleve || !a.chrono || a.chrono.duree <= chronoEleve.duree + 1e-9) continue;
      note(`l'élève finit en mouvement à t = ${f1(chronoEleve.duree)} s alors que ${a.id} bouge jusqu'à t = ${f1(a.chrono.duree)} s : son image resterait figée`);
    }
  }
}

// Côté du changement de direction que représente un segment, ou null. C'est le côté de la caisse : le trajet se lit dans
// le repère de marche (scene-geometrie.js), et en marche arrière la gauche de la marche est la droite de la caisse. Un
// virage de la tortue à gauche en reculant (volant tourné à droite, l'arrière part vers la droite) est donc un
// changement de direction vers la droite : sur un segment parcouru en marche arrière, le côté s'inverse. Le reste de la
// règle ne dépend pas de la marche.
function changementDeDirection(seg) {
  if (seg.type !== "arc" || seg.suitLaRoute) return null;
  const coteMarche = seg.angle > 0 ? "droite" : "gauche";
  const cote = seg.arriere === true ? (coteMarche === "droite" ? "gauche" : "droite") : coteMarche;
  if (seg.decalage) return seg.premier && seg.changementDeVoie ? cote : null;
  return Math.abs(seg.angle) >= SEUILS.angleChangementDirection * DEG - 1e-9 ? cote : null;
}

function controlerClignotants(sc, note) {
  for (const a of sc.acteurs) {
    if (!a.chrono || a.gabarit === "pieton") continue;
    for (const seg of a.chemin.segments) {
      const cote = changementDeDirection(seg);
      if (!cote) continue;
      // Le changement de direction commence quand l'acteur quitte le début de l'arc (tempsDepart) : à la fin de l'arrêt
      // s'il s'y arrête, et non à son arrivée. Le clignotant doit être allumé depuis au moins 2 s à ce départ, puis
      // jusqu'à la fin de l'arc (première arrivée à son bout).
      const tDebut = tempsDepart(a.chrono, seg.debut);
      const tFin = tempsAtteint(a.chrono, seg.debut + seg.longueur);
      const n = Math.round(SEUILS.avanceClignotant / SEUILS.pas);
      for (let k = n; k >= 0; k--) {
        const t = tDebut - k * SEUILS.pas;
        if (t < 0) continue;
        if (etatActeur(a, t).clignotant !== cote) {
          note(`${a.id} : clignotant ${cote} attendu ${SEUILS.avanceClignotant} s avant le changement de direction de s = ${f1(seg.debut)} m (absent à t = ${f1(t)} s)`);
          break;
        }
      }
      // Pendant tout l'arc (les dixièmes de seconde depuis son début, puis sa fin, un arrêt dans l'arc compris) :
      // jamais le clignotant de l'autre côté, et celui du bon côté toujours allumé (« clignotant tôt et tout le
      // long », fiche ECF C2-E). Une extinction datée (delaiFin) n'y échappe pas : pile à la fin de l'arc, elle passe
      // (l'instant d'arrivée est encore allumé) ; plus tôt, non.
      const instantsArc = [];
      for (let t = tDebut; t <= tFin + 1e-9; t += SEUILS.pas) instantsArc.push(t);
      instantsArc.push(tFin);
      let autreCote = false, eteint = false;
      for (const t of instantsArc) {
        const c = etatActeur(a, t).clignotant;
        if (!autreCote && c && c !== cote) {
          autreCote = true;
          note(`${a.id} : clignotant ${c} pendant un virage à ${cote} (t = ${f1(t)} s)`);
        }
        if (!eteint && c !== cote) {
          eteint = true;
          note(`${a.id} : clignotant ${cote} éteint pendant le changement de direction (t = ${f1(t)} s)`);
        }
      }
    }
  }
}

function controlerAttente(sc, att, note) {
  const a = sc.acteurs.find((x) => x.id === att.acteur);
  if (!a) { note(`attente ${att.type} : acteur « ${att.acteur} » inconnu`); return; }
  // Appelle f(e, t) pour chaque instant où l'acteur visible est entre les abscisses de et a.
  const fenetre = (de, aS, f) => instants(sc, (t) => {
    const e = etatActeur(a, t);
    if (e.visible && e.s >= de - 1e-9 && e.s <= aS + 1e-9) f(e, t);
  });
  switch (att.type) {
    case "dans": {
      let ko = null;
      fenetre(att.de, att.a, (e, t) => {
        const points = att.emprise ? emprise(a.gabarit, e) : [[e.x, e.y]];
        if (ko === null && !points.every((p) => pointDansPolygone(p, att.zone))) ko = t;
      });
      if (ko !== null) note(`${a.id} sort de « ${att.nom} » à t = ${f1(ko)} s`);
      break;
    }
    case "vitesseMax": {
      let ko = null;
      fenetre(att.de, att.a, (e, t) => { if (ko === null && e.v / KMH > att.kmh + 1e-6) ko = t; });
      if (ko !== null) note(`${a.id} dépasse ${att.kmh} km/h entre s = ${att.de} et s = ${att.a} (t = ${f1(ko)} s)`);
      break;
    }
    case "arretAvant": {
      const d = (e) => {
        const f = avant(a.gabarit, e);
        return (f.x - att.point[0]) * att.normale[0] + (f.y - att.point[1]) * att.normale[1];
      };
      let arret = null, franchi = null;
      instants(sc, (t) => {
        if (arret || franchi !== null) return;
        const e = etatActeur(a, t);
        if (!e.visible) return;
        if (d(e) < -1e-6) franchi = t;
        else if (t > 0 && e.v < 0.01) arret = { t, d: d(e) };
      });
      if (franchi !== null) note(`${a.id} franchit « ${att.nom} » sans s'être arrêté (t = ${f1(franchi)} s)`);
      else if (!arret) note(`${a.id} ne s'arrête pas avant « ${att.nom} »`);
      else if (arret.d > att.tolerance + 1e-6) note(`${a.id} s'arrête à ${arret.d.toFixed(2)} m de « ${att.nom} » (tolérance ${att.tolerance} m)`);
      break;
    }
    case "rotation": {
      let prec = null, ko = null;
      fenetre(att.de, att.a, (e, t) => {
        const ang = Math.atan2(e.y - att.centre[1], e.x - att.centre[0]);
        if (prec !== null && ko === null) {
          let dAng = ang - prec;
          while (dAng > Math.PI) dAng -= 2 * Math.PI;
          while (dAng < -Math.PI) dAng += 2 * Math.PI;
          if ((att.sens === "anti-horaire" && dAng > 1e-9) || (att.sens === "horaire" && dAng < -1e-9)) ko = t;
        }
        prec = ang;
      });
      if (ko !== null) note(`${a.id} tourne dans le mauvais sens autour de « ${att.nom} » (t = ${f1(ko)} s)`);
      break;
    }
    case "cede": {
      const b = sc.acteurs.find((x) => x.id === att.autre);
      if (!b) { note(`attente cede : acteur « ${att.autre} » inconnu`); break; }
      let entree = null, sortieAutre = null;
      instants(sc, (t) => {
        const ea = etatActeur(a, t), eb = etatActeur(b, t);
        if (entree === null && ea.visible && polygonesSeChevauchent(emprise(a.gabarit, ea), att.zone)) entree = t;
        if (eb.visible && polygonesSeChevauchent(emprise(b.gabarit, eb), att.zone)) sortieAutre = t;
      });
      if (sortieAutre === null) note(`${b.id} ne traverse pas « ${att.nom} » : la scène ne montre aucune priorité`);
      else if (entree === null) note(`${a.id} n'entre jamais dans « ${att.nom} »`);
      else if (entree <= sortieAutre + 1e-9) {
        note(`${a.id} entre dans « ${att.nom} » (t = ${f1(entree)} s) avant que ${b.id} en soit sorti (t = ${f1(sortieAutre)} s)`);
      }
      break;
    }
    case "pasDeClignotantAvant": {
      let ko = null;
      fenetre(0, att.s - 1e-6, (e, t) => { if (ko === null && e.clignotant === att.cote) ko = t; });
      if (ko !== null) note(`${a.id} : clignotant ${att.cote} allumé avant s = ${f1(att.s)} m (t = ${f1(ko)} s)`);
      break;
    }
    case "pasDeDeceleration": {
      // { acteur, nom, de, a } : entre les abscisses de et a, l'allure de l'acteur ne baisse jamais. Elle peut y être
      // tenue ou reprise, jamais réduite : un freinage s'achève avant `de` (par exemple avant l'entrée d'un virage, que
      // le freinage précède en ligne droite) et ne commence qu'à `a` ou après. Lu sur les échantillons de la
      // chronologie, comme l'arrêt aux rebroussements : la vitesse y est exacte et, entre deux échantillons consécutifs,
      // varie dans un seul sens. Toute paire d'échantillons qui empiète sur ]de ; a[ et dont la vitesse baisse est un
      // ralentissement, si bref soit-il ; un freinage qui finit pile en `de` n'en est pas un. Le message donne le premier
      // ralentissement, de la paire où il commence jusqu'à ce que la vitesse cesse de baisser ou que la fenêtre s'achève.
      const ech = a.chrono ? a.chrono.echantillons : [];
      const k = ech.findIndex((q, i) => i > 0 && q.s > att.de + 1e-9 && ech[i - 1].s < att.a - 1e-9 && q.v < ech[i - 1].v - 1e-9);
      if (k > 0) {
        let fin = k;
        while (fin + 1 < ech.length && ech[fin].s < att.a - 1e-9 && ech[fin + 1].v < ech[fin].v - 1e-9) fin++;
        const p = ech[k - 1], q = ech[fin];
        note(`${a.id} ralentit dans « ${att.nom} » : de ${(p.v / KMH).toFixed(1)} à ${(q.v / KMH).toFixed(1)} km/h,`
          + ` de s = ${f1(p.s)} à s = ${f1(q.s)} m (t = ${f1(p.t)} s)`);
      }
      break;
    }
    default:
      note(`attente de type inconnu : ${att.type}`);
  }
}
