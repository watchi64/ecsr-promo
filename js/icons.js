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
  // Lucide graduation-cap (Notes / Évaluations)
  edu:        () => svg('<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>'),
  settings:   () => svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>'),
  refresh:    () => svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/>'),
  plus:       () => svg('<path d="M12 5v14M5 12h14"/>'),
  trash:      () => svg('<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14ZM10 11v6M14 11v6"/>'),
  check:      () => svg('<path d="M20 6 9 17l-5-5"/>'),
  x:          () => svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  star:       () => svg('<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"/>'),
  pause:      () => svg('<path d="M10 4H6v16h4V4ZM18 4h-4v16h4V4Z"/>'),
  chair:      () => svg('<path d="M6 19v3M18 19v3M5 12h14a0 0 0 0 1 0 0v3a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-3a0 0 0 0 1 0 0ZM7 12V5a3 3 0 1 1 6 0v7M17 12V5a3 3 0 1 0-6 0"/>'),
  // Lucide officiel : car
  car:        () => svg('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
  // Lucide officiel : presentation (tableau / salle de cours)
  presentation: () => svg('<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>'),
  shield:     () => svg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>'),
  palette:    () => svg('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2A10 10 0 0 0 2 12c0 5.5 4.5 10 10 10a3 3 0 0 0 3-3 1.5 1.5 0 0 0-.4-1 1.5 1.5 0 0 1-.4-1 1.5 1.5 0 0 1 1.5-1.5H17a5 5 0 0 0 5-5 10 10 0 0 0-10-10Z"/>'),
  users:      () => svg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  user:       () => svg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  mail:       () => svg('<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>'),
  info:       () => svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
  lock:       () => svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  logout:     () => svg('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>'),
  chevronLeft:() => svg('<path d="m15 18-6-6 6-6"/>'),
  chevronRight:() => svg('<path d="m9 18 6-6-6-6"/>'),
  filter:     () => svg('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3Z"/>'),
  alert:      () => svg('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0ZM12 9v4M12 17h.01"/>'),
  clock:      () => svg('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  signpost:   () => svg('<path d="M12 3v18M5 7h14l-3 4 3 4H5l3-4-3-4Z"/>'),
};
