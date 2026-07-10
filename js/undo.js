/**
 * Système d'undo global (Ctrl+Z / Cmd+Z).
 * Stack en mémoire (perdu au reload). Max 30 actions.
 * Chaque action est { label, undoFn } : la fonction sait défaire l'opération.
 */
import { toast } from "./utils.js?v=20260710e";

const stack = [];
const MAX = 30;
let runningUndo = false;

export function recordUndo(label, undoFn) {
  if (runningUndo) return;  // ne pas re-stacker pendant un undo en cours
  stack.push({ label, undoFn, at: Date.now() });
  if (stack.length > MAX) stack.shift();
}

export async function undoLast() {
  if (stack.length === 0) {
    toast("Rien à annuler", "info", 1400);
    return false;
  }
  const action = stack.pop();
  runningUndo = true;
  try {
    await action.undoFn();
    toast("↶ " + action.label + " annulé", "success", 2000);
    // Force le rendu actuel à se rafraîchir
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    return true;
  } catch (e) {
    console.error("Undo failed", e);
    toast("Impossible d'annuler : " + (e?.message || e), "error", 3500);
    return false;
  } finally {
    runningUndo = false;
  }
}

export function clearUndoStack() { stack.length = 0; }

export function initUndoKeyboard() {
  document.addEventListener("keydown", (e) => {
    const isUndo = (e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === "z" || e.key === "Z");
    if (!isUndo) return;
    // Ne pas piéger si l'utilisateur est dans un champ texte (sauf nos inputs note matrice qui sont gérables)
    const t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
      // Exception : les inputs de type number/date n'ont pas d'undo natif utile, et nos modales
      // perdent leur valeur de toute façon si reload. On laisse le natif pour les input texte/email.
      if (t.tagName === "INPUT" && ["number"].includes(t.type)) {
        // L'undo natif d'un input number n'est pas utile, on prend la main
        e.preventDefault();
        undoLast();
      }
      return;
    }
    e.preventDefault();
    undoLast();
  });
}
