import { createFileRoute } from "@tanstack/react-router";
import { GeradorPage, geradorSearchSchema } from "@/pages/gerador-page";

export const Route = createFileRoute("/app/vsl/gerador")({
  validateSearch: geradorSearchSchema,
  head: () => ({
    meta: [{ title: "Gerar VSL · Andromeda" }],
  }),
  component: VslGeradorRoute,
});

function VslGeradorRoute() {
  const search = Route.useSearch();
  return <GeradorPage mode="vsl" search={search} />;
}
