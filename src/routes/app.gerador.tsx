import { createFileRoute, redirect } from "@tanstack/react-router";
import { GeradorPage, geradorSearchSchema } from "@/pages/gerador-page";

export const Route = createFileRoute("/app/gerador")({
  validateSearch: geradorSearchSchema,
  beforeLoad: ({ search }) => {
    if (search.formato === "vsl_curta") {
      throw redirect({ to: "/app/vsl/gerador" });
    }
  },
  head: () => ({
    meta: [
      { title: "Gerador de ângulos · Andromeda" },
      { name: "description", content: "5 ângulos por briefing com a metodologia Andromeda 2026." },
    ],
  }),
  component: GeradorRoute,
});

function GeradorRoute() {
  const search = Route.useSearch();
  return <GeradorPage mode="criativo" search={search} />;
}
