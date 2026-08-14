// Partie pure du client Legifrance PISTE (portage de tools/legifrance-mcp du depot ECSR).
// Les endpoints /consult/sameNumArticle et /consult/getArticleWithIdEliOrAlias sont
// casses cote DILA (constat 2026-07-26) : on passe par /search puis /consult/getArticle.

export const CODE_NAMES = {
  route:            { id: "LEGITEXT000006074228", nom: "Code de la route" },
  penal:            { id: "LEGITEXT000006070719", nom: "Code pénal" },
  procedure_penale: { id: "LEGITEXT000006071154", nom: "Code de procédure pénale" },
  assurances:       { id: "LEGITEXT000006073984", nom: "Code des assurances" },
};

export function corpsRechercheArticle(numero, nomCode, maintenant) {
  return {
    fond: "CODE_DATE",
    recherche: {
      champs: [{
        typeChamp: "NUM_ARTICLE",
        criteres: [{ typeRecherche: "EXACTE", valeur: numero, operateur: "ET" }],
        operateur: "ET",
      }],
      filtres: [
        { facette: "NOM_CODE", valeurs: [nomCode] },
        { facette: "DATE_VERSION", singleDate: maintenant },
      ],
      pageNumber: 1,
      pageSize: 5,
      operateur: "ET",
      sort: "PERTINENCE",
      typePagination: "ARTICLE",
    },
  };
}

export function extraireIdArticle(reponseSearch, numero) {
  for (const res of reponseSearch?.results ?? []) {
    for (const s of res.sections ?? []) {
      for (const ex of s.extracts ?? []) {
        if (ex.num === numero) return ex.id ?? null;
      }
    }
  }
  return null;
}

function nettoyerHtml(texte) {
  return String(texte ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function formaterArticle(brut, numero = "") {
  const a = brut?.article ?? brut ?? {};
  const id = a.id ?? a.cid ?? "";
  return {
    num: a.num ?? numero,
    id,
    texte: nettoyerHtml(a.texte ?? a.content ?? ""),
    etat: a.etat ?? "",
    url: id ? `https://www.legifrance.gouv.fr/codes/article_lc/${id}/` : "",
  };
}
