/*
 * Réduction d'image côté client avant téléversement : une photo de téléphone
 * fait 4 à 8 Mo, inutile en pleine résolution dans un cours. Le plus grand
 * côté est ramené à coteMax, export JPEG.
 */
export async function reduireImage(file, coteMax = 1600, qualite = 0.85) {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, coteMax / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * ratio));
  const h = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", qualite));
  return blob || file;
}
