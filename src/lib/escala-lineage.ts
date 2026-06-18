export type EscalaVariacaoLineage = {
  id: string;
  angulo: string;
  variacaoId: string;
  variacaoNome?: string;
  status: string;
  exportStatus: string;
  diff?: string;
};

export type EscalaCampeaoLineage = {
  campeaoId: string;
  campeaoAngulo: string;
  campeaoStatus: string;
  campeaoExportStatus: string;
  variacoes: EscalaVariacaoLineage[];
};

type CriativoRow = {
  id: string;
  angulo: string;
  status: string | null;
  export_status: string | null;
  angulo_json: unknown;
};

export function buildEscalaLineage(criativos: CriativoRow[]): EscalaCampeaoLineage[] {
  const byId = new Map(criativos.map((c) => [c.id, c]));
  const variacoesByCampeao = new Map<string, EscalaVariacaoLineage[]>();

  for (const c of criativos) {
    const aj = c.angulo_json as {
      escala_variacao_de?: string;
      escala_variacao_id?: string;
      escala_variacao_nome?: string;
      escala_diff_vs_original?: string;
    } | null;
    const campeaoId = aj?.escala_variacao_de;
    if (!campeaoId || !aj?.escala_variacao_id) continue;

    const list = variacoesByCampeao.get(campeaoId) ?? [];
    list.push({
      id: c.id,
      angulo: c.angulo,
      variacaoId: aj.escala_variacao_id,
      variacaoNome: aj.escala_variacao_nome,
      status: c.status ?? "Gerado",
      exportStatus: c.export_status ?? "rascunho",
      diff: aj.escala_diff_vs_original,
    });
    variacoesByCampeao.set(campeaoId, list);
  }

  const lineage: EscalaCampeaoLineage[] = [];
  for (const [campeaoId, variacoes] of variacoesByCampeao) {
    const campeao = byId.get(campeaoId);
    lineage.push({
      campeaoId,
      campeaoAngulo: campeao?.angulo ?? "Campeão removido",
      campeaoStatus: campeao?.status ?? "—",
      campeaoExportStatus: campeao?.export_status ?? "—",
      variacoes: variacoes.sort((a, b) => a.variacaoId.localeCompare(b.variacaoId)),
    });
  }

  return lineage.sort((a, b) => b.variacoes.length - a.variacoes.length);
}
