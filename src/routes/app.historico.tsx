import { createFileRoute } from "@tanstack/react-router";
import { PipelinePage, pipelineSearchSchema } from "@/pages/pipeline-page";

export const Route = createFileRoute("/app/historico")({
  validateSearch: pipelineSearchSchema,
  head: () => ({
    meta: [
      { title: "Pipeline · Andromeda" },
      { name: "description", content: "Kanban de criativos: Gerado → Subiu → Rodando → Performando." },
    ],
  }),
  component: HistoricoRoute,
});

function HistoricoRoute() {
  const search = Route.useSearch();
  return <PipelinePage mode="criativo" routeSearch={search} />;
}
