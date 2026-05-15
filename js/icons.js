// SVG icons inline (Phosphor-style, 1.5 stroke).
// Returns an HTMLElement (cloned each call).

function svg(d, viewBox = "0 0 24 24") {
  const ns = "http://www.w3.org/2000/svg";
  const node = document.createElementNS(ns, "svg");
  node.setAttribute("xmlns", ns);
  node.setAttribute("viewBox", viewBox);
  node.setAttribute("fill", "none");
  node.setAttribute("stroke", "currentColor");
  node.setAttribute("stroke-width", "1.6");
  node.setAttribute("stroke-linecap", "round");
  node.setAttribute("stroke-linejoin", "round");
  node.classList.add("icon");
  if (Array.isArray(d)) {
    d.forEach((path) => {
      const p = document.createElementNS(ns, "path");
      p.setAttribute("d", path);
      node.appendChild(p);
    });
  } else if (typeof d === "string") {
    node.innerHTML = d;
  }
  return node;
}

export const icon = {
  dashboard:  () => svg('<path d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"/>'),
  calendar:   () => svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>'),
  list:       () => svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  settings:   () => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>'),
  refresh:    () => svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>'),
  plus:       () => svg('<path d="M12 5v14M5 12h14"/>'),
  trash:      () => svg('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6"/>'),
  check:      () => svg('<path d="M20 6 9 17l-5-5"/>'),
  x:          () => svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  star:       () => svg('<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/>'),
  pause:      () => svg('<path d="M10 4H6v16h4V4ZM18 4h-4v16h4V4Z"/>'),
  chair:      () => svg('<path d="M6 19v3M18 19v3M5 12h14a0 0 0 0 1 0 0v3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-3a0 0 0 0 1 0 0ZM7 12V5a3 3 0 1 1 6 0v7M17 12V5a3 3 0 1 0-6 0"/>'),
  car:        () => svg('<path d="M5 17H3v-5l2-5h14l2 5v5h-2M5 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0Zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM7 12h10M9 7l-1 5M15 7l1 5"/>'),
  chevronLeft:() => svg('<path d="m15 18-6-6 6-6"/>'),
  chevronRight:() => svg('<path d="m9 18 6-6-6-6"/>'),
  filter:     () => svg('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z"/>'),
  alert:      () => svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01"/>'),
  clock:      () => svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  signpost:   () => svg('<path d="M12 3v18M5 7h14l-3 4 3 4H5l3-4-3-4Z"/>'),
};
