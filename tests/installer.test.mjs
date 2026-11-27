// Règles de la page d'installation (js/installer-rules.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconnaitre, modeAffichage, gesteManuel, estInstallee } from "../js/installer-rules.js";

const UA = {
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1",
  iphoneChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1",
  ipadMac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
  androidChrome: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  androidSamsung: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0",
  windowsChrome: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  windowsEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  windowsFirefox: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  macSafari: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15",
};

test("reconnaître le système et le navigateur", () => {
  assert.deepEqual(reconnaitre({ ua: UA.iphoneSafari }), { systeme: "ios", navigateur: "safari" });
  assert.deepEqual(reconnaitre({ ua: UA.iphoneChrome }), { systeme: "ios", navigateur: "chrome" });
  assert.deepEqual(reconnaitre({ ua: UA.ipadMac, platform: "MacIntel", maxTouchPoints: 5 }), { systeme: "ios", navigateur: "safari" });
  assert.deepEqual(reconnaitre({ ua: UA.androidChrome }), { systeme: "android", navigateur: "chrome" });
  assert.deepEqual(reconnaitre({ ua: UA.androidSamsung }), { systeme: "android", navigateur: "samsung" });
  assert.deepEqual(reconnaitre({ ua: UA.androidFirefox }), { systeme: "android", navigateur: "firefox" });
  assert.deepEqual(reconnaitre({ ua: UA.windowsChrome }), { systeme: "ordinateur", navigateur: "chrome" });
  assert.deepEqual(reconnaitre({ ua: UA.windowsEdge }), { systeme: "ordinateur", navigateur: "edge" });
  assert.deepEqual(reconnaitre({ ua: UA.windowsFirefox }), { systeme: "ordinateur", navigateur: "firefox" });
  assert.deepEqual(reconnaitre({ ua: UA.macSafari, platform: "MacIntel", maxTouchPoints: 0 }), { systeme: "ordinateur", navigateur: "safari" });
  assert.deepEqual(reconnaitre(), { systeme: "ordinateur", navigateur: "autre" });
});

test("ce que la page montre", () => {
  const m = (ua, extra = {}, installee = false) => modeAffichage(reconnaitre({ ua, ...extra }), installee);
  assert.equal(m(UA.iphoneSafari), "ios");
  assert.equal(m(UA.iphoneChrome), "ios-autre");
  assert.equal(m(UA.androidChrome), "bouton");
  assert.equal(m(UA.androidSamsung), "bouton");
  assert.equal(m(UA.androidFirefox), "bouton");
  assert.equal(m(UA.windowsChrome), "bouton");
  assert.equal(m(UA.windowsEdge), "bouton");
  assert.equal(m(UA.windowsFirefox), "autre");
  assert.equal(m(UA.macSafari, { platform: "MacIntel" }), "autre");
  assert.equal(m(UA.iphoneSafari, {}, true), "installee");
  assert.equal(m(UA.windowsChrome, {}, true), "installee");
});

test("le geste manuel nomme le bon menu, sans tiret cadratin", () => {
  for (const ua of Object.values(UA)) {
    const g = gesteManuel(reconnaitre({ ua }));
    assert.ok(g.length > 20, ua);
    assert.ok(!g.includes(String.fromCharCode(0x2014)), ua);
  }
  assert.match(gesteManuel({ systeme: "android", navigateur: "samsung" }), /Écran d'accueil/);
  assert.match(gesteManuel({ systeme: "ordinateur", navigateur: "firefox" }), /Chrome ou Edge/);
});

test("reconnaître l'app installée", () => {
  const mm = (actif) => (q) => ({ matches: q === `(display-mode: ${actif})` });
  assert.equal(estInstallee(mm("standalone")), true);
  assert.equal(estInstallee(mm("browser")), false);
  assert.equal(estInstallee(mm("browser"), true), true);   // iOS : navigator.standalone
  assert.equal(estInstallee(undefined, undefined), false);
});
