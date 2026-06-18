import { createFileRoute, Navigate } from "@tanstack/react-router";
import { pipelineSearchSchema } from "@/pages/pipeline-page";

/** Redireciona para o pipeline unificado com aba VSL */
export const Route = createFileRoute("/app/vsl/pipeline")({
  validateSearch: pipelineSearchSchema,
  component: VslPipelineRedirect,
});

function VslPipelineRedirect() {
  const search = Route.useSearch();
  return (
    <Navigate
      to="/app/historico"
      search={{ ...search, formato: search.formato ?? "vsl_curta" }}
      replace
    />
  );
}
