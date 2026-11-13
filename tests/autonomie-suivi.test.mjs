import { test } from "node:test";
import assert from "node:assert/strict";
import { suivreEcran } from "../js/autonomie-suivi.js";

// Cible d'événements factice : garde les écouteurs pour vérifier que arreter() les retire tous.
class Cible {
  constructor() { this.ecouteurs = new Map(); this.options = []; }
  addEventListener(type, rappel, options) {
    if (!this.ecouteurs.has(type)) this.ecouteurs.set(type, new Set());
    this.ecouteurs.get(type).add(rappel);
    this.options.push([type, options]);
  }
  removeEventListener(type, rappel) { this.ecouteurs.get(type)?.delete(rappel); }
  emettre(type) { for (const r of [...(this.ecouteurs.get(type) || [])]) r({ type }); }
  restants() { return [...this.ecouteurs.values()].reduce((n, s) => n + s.size, 0); }
}

const attendre = () => new Promise((r) => setImmediate(r));

// Banc : horloge, minuterie, document et fenêtre factices, journal des écritures.
// `ecrire(appel, rang)` du test : sa promesse (ou son échec) est celle de l'écriture.
function banc({ ecrire, visible = true } = {}) {
  const b = { t: 0, appels: [], enVol: 0, maxEnVol: 0, minuteries: new Map(), prochain: 1 };
  b.zone = new Cible();
  b.fenetre = new Cible();
  b.doc = new Cible();
  b.doc.visibilityState = visible ? "visible" : "hidden";
  b.doc.defaultView = b.fenetre;
  const enregistrer = async (a) => {
    b.appels.push({ ...a });
    b.enVol++; b.maxEnVol = Math.max(b.maxEnVol, b.enVol);
    try { return await (ecrire ? ecrire(a, b.appels.length) : undefined); } finally { b.enVol--; }
  };
  b.options = {
    zone: b.zone, ecrire: enregistrer, horloge: () => b.t, document: b.doc,
    setIntervalFn: (fn, ms) => { const id = b.prochain++; b.minuteries.set(id, { fn, ms, prochaine: b.t + ms }); return id; },
    clearIntervalFn: (id) => { b.minuteries.delete(id); },
  };
  // Fait avancer l'horloge ; `agir` : un geste de l'utilisateur toutes les 10 s.
  b.avancer = (ms, agir = true) => {
    const fin = b.t + ms;
    while (b.t < fin) {
      if (agir) b.zone.emettre("scroll");
      const cible = b.t + Math.min(10000, fin - b.t);
      for (const m of b.minuteries.values()) {
        if (m.prochaine <= cible) { b.t = m.prochaine; m.prochaine += m.ms; m.fn(); }
      }
      b.t = cible;
    }
  };
  return b;
}

const secondes = (b) => b.appels.map((a) => a.secondes);

test("45 s d'activité : un appel à 30 s (30 s) puis 15 s à arreter()", async () => {
  const b = banc();
  const s = suivreEcran(b.options);
  b.avancer(45000);
  await attendre();
  assert.deepEqual(secondes(b), [30]);
  s.arreter();
  await attendre();
  assert.deepEqual(secondes(b), [30, 15]);
});

test("écriture qui échoue puis réussit : le total est conservé", async () => {
  let n = 0;
  const b = banc({ ecrire: async () => { n++; if (n === 1) throw new Error("réseau"); } });
  const s = suivreEcran(b.options);
  b.avancer(30000); await attendre();
  b.avancer(30000); await attendre();
  s.arreter(); await attendre();
  assert.equal(b.appels.length, 2);
  assert.deepEqual(secondes(b), [30, 60]);
});

test("deux échecs puis succès : rien de perdu, jamais plus de 60 s par appel", async () => {
  let n = 0;
  const b = banc({ ecrire: async () => { n++; if (n <= 2) throw new Error("réseau"); } });
  const s = suivreEcran(b.options);
  for (let i = 0; i < 3; i++) { b.avancer(30000); await attendre(); }
  s.arreter(); await attendre();
  const reussis = b.appels.slice(2);
  assert.ok(b.appels.every((a) => Number.isInteger(a.secondes) && a.secondes >= 0 && a.secondes <= 60));
  assert.equal(reussis.reduce((t, a) => t + a.secondes, 0), 90);
});

test("un long vide après échecs part en appels successifs de 60 s au plus", async () => {
  let echec = true;
  const b = banc({ ecrire: async () => { if (echec) throw new Error("hors ligne"); } });
  const s = suivreEcran(b.options);
  for (let i = 0; i < 5; i++) { b.avancer(30000); await attendre(); }   // 5 ticks échoués
  echec = false;
  b.appels.length = 0;
  b.avancer(30000); await attendre(); await attendre();
  assert.ok(b.appels.length >= 3);
  assert.ok(b.appels.every((a) => a.secondes <= 60));
  assert.equal(b.appels.reduce((t, a) => t + a.secondes, 0), 180);
  s.arreter();
});

test("une écriture lente ne laisse pas partir une seconde en parallèle", async () => {
  let liberer;
  const b = banc({ ecrire: (a, rang) => (rang === 1 ? new Promise((r) => { liberer = r; }) : undefined) });
  const s = suivreEcran(b.options);
  b.avancer(30000); await attendre();
  b.avancer(30000); await attendre();           // un second tick pendant la première écriture
  assert.equal(b.appels.length, 1);
  liberer(); await attendre(); await attendre();
  assert.equal(b.maxEnVol, 1);
  assert.deepEqual(secondes(b), [30]);          // le second tick n'a rien lancé en parallèle
  s.arreter(); await attendre();
  assert.deepEqual(secondes(b), [30, 30]);      // les secondes du second tick partent une fois, à l'arrêt
});

test("passage en arrière-plan : écriture immédiate", async () => {
  const b = banc();
  suivreEcran(b.options);
  b.avancer(20000);
  b.doc.visibilityState = "hidden";
  b.doc.emettre("visibilitychange");
  assert.deepEqual(secondes(b), [20]);
  await attendre();
});

test("pagehide : écriture immédiate (fenêtre)", async () => {
  const b = banc();
  suivreEcran(b.options);
  b.avancer(20000);
  b.fenetre.emettre("pagehide");
  assert.deepEqual(secondes(b), [20]);
  await attendre();
});

test("page masquée : rien ne compte, rien n'est écrit", async () => {
  const b = banc({ visible: false });
  const s = suivreEcran(b.options);
  b.avancer(90000);
  await attendre();
  s.arreter(); await attendre();
  assert.equal(b.appels.length, 0);
});

test("fin atteinte et section portées par l'appel suivant", async () => {
  const b = banc();
  const s = suivreEcran(b.options);
  s.finAtteinte();
  s.section("s3");
  b.avancer(30000); await attendre();
  assert.deepEqual(b.appels[0], { secondes: 30, fin: true, section: "s3" });
  s.arreter();
});

test("un changement sans seconde déclenche un appel, puis plus rien", async () => {
  const b = banc({ visible: false });
  const s = suivreEcran(b.options);
  s.section("s2");
  b.avancer(30000, false); await attendre();
  assert.deepEqual(b.appels, [{ secondes: 0, fin: false, section: "s2" }]);
  b.avancer(60000, false); await attendre();
  assert.equal(b.appels.length, 1);
  s.arreter();
});

test("une section identique n'est pas renvoyée", async () => {
  const b = banc({ visible: false });
  const s = suivreEcran(b.options);
  s.section("s2"); s.section("s2");
  b.avancer(30000, false); await attendre();
  s.section("s2");
  b.avancer(30000, false); await attendre();
  assert.equal(b.appels.length, 1);
  s.arreter();
});

test("un échec d'écriture ne fait perdre ni la section ni la fin", async () => {
  let n = 0;
  const b = banc({ ecrire: async () => { n++; if (n === 1) throw new Error("x"); } });
  const s = suivreEcran(b.options);
  s.finAtteinte(); s.section("s4");
  b.avancer(30000, false); await attendre();
  b.avancer(30000, false); await attendre();
  assert.equal(b.appels[1].fin, true);
  assert.equal(b.appels[1].section, "s4");
  s.arreter();
});

test("arreter() retire tous les écouteurs et la minuterie : plus aucun appel ensuite", async () => {
  const b = banc();
  const s = suivreEcran(b.options);
  assert.ok(b.zone.restants() > 0 && b.doc.restants() > 0 && b.fenetre.restants() > 0);
  b.avancer(10000);
  s.arreter(); await attendre();
  const avant = b.appels.length;
  assert.equal(b.zone.restants(), 0);
  assert.equal(b.doc.restants(), 0);
  assert.equal(b.fenetre.restants(), 0);
  assert.equal(b.minuteries.size, 0);
  b.zone.emettre("scroll"); b.doc.emettre("visibilitychange"); b.fenetre.emettre("pagehide");
  s.section("s9"); s.finAtteinte(); s.arreter();
  b.avancer(120000); await attendre();
  assert.equal(b.appels.length, avant);
});

test("les écouteurs de la zone sont passifs", () => {
  const b = banc();
  suivreEcran(b.options);
  for (const type of ["scroll", "click", "touchstart"]) {
    assert.ok(b.zone.options.some(([t, o]) => t === type && o && o.passive === true), type);
  }
  assert.ok(b.zone.options.some(([t]) => t === "keydown"));
});

test("ecrire qui lève de façon synchrone ne remonte rien", async () => {
  const b = banc({ ecrire: () => { throw new Error("sync"); } });
  const s = suivreEcran(b.options);
  b.avancer(30000); await attendre();
  s.arreter(); await attendre();
  assert.ok(b.appels.length >= 1);
});

test("arreter() pendant une écriture lente : le dernier temps part quand même, sans parallèle", async () => {
  let liberer;
  const b = banc({ ecrire: (a, rang) => (rang === 1 ? new Promise((r) => { liberer = r; }) : undefined) });
  const s = suivreEcran(b.options);
  b.avancer(30000); await attendre();           // écriture de 30 s en vol
  b.avancer(15000);
  s.arreter();                                  // 15 s de plus à envoyer
  assert.equal(b.appels.length, 1);
  liberer(); await attendre(); await attendre();
  assert.deepEqual(secondes(b), [30, 15]);
  assert.equal(b.maxEnVol, 1);
});

const somme = (b) => b.appels.reduce((t, a) => t + a.secondes, 0);

test("arreter() clôt la fenêtre d'activité : le temps écoulé pendant une écriture lente n'est jamais envoyé", async () => {
  let liberer;
  const b = banc({ ecrire: (a, rang) => (rang === 1 ? new Promise((r) => { liberer = r; }) : undefined) });
  const s = suivreEcran(b.options);
  b.avancer(30000); await attendre();           // écriture de 30 s en vol
  b.avancer(15000);                             // gestes jusqu'à 45 s
  s.arreter();
  b.avancer(20000, false);                      // l'horloge continue pendant l'attente de l'écriture
  liberer(); await attendre(); await attendre();
  assert.deepEqual(secondes(b), [30, 15]);
});

test("un défilement automatique n'est pas un geste", async () => {
  const b = banc();
  b.zone.scrollTop = 0;
  const s = suivreEcran(b.options);
  b.avancer(50000, false);
  s.defilementAutomatique(() => { b.zone.scrollTop = 500; });
  b.zone.emettre("scroll");                     // l'événement du défilement automatique
  b.avancer(70000, false);
  s.arreter(); await attendre();
  assert.equal(somme(b), 60);                   // 60 s après l'ouverture, pas 110
});

test("un défilement automatique sans déplacement n'avale pas un vrai défilement", async () => {
  const b = banc();
  b.zone.scrollTop = 0;
  const s = suivreEcran(b.options);
  b.avancer(50000, false);
  s.defilementAutomatique(() => { b.zone.scrollTop = 0; });
  b.zone.emettre("scroll");                     // un vrai geste de l'élève
  b.avancer(70000, false);
  s.arreter(); await attendre();
  assert.equal(somme(b), 110);
});

test("seul le premier défilement suivant un défilement automatique est ignoré", async () => {
  const b = banc();
  b.zone.scrollTop = 0;
  const s = suivreEcran(b.options);
  b.avancer(50000, false);
  s.defilementAutomatique(() => { b.zone.scrollTop = 500; });
  b.zone.emettre("scroll");
  b.zone.emettre("scroll");                     // le second est un vrai geste
  b.avancer(70000, false);
  s.arreter(); await attendre();
  assert.equal(somme(b), 110);
});

test("geste() compte comme une action, une fois", async () => {
  const b = banc();
  const s = suivreEcran(b.options);
  b.avancer(50000, false);
  s.geste();
  b.avancer(70000, false);
  s.arreter(); await attendre();
  assert.equal(somme(b), 110);
});
