import { createFileRoute, redirect } from "@tanstack/react-router";

/** VSL consolidada no gerador — rota legada redireciona com formato pré-selecionado. */
export const Route = createFileRoute("/app/vsl")({
  beforeLoad: () => {
    throw redirect({
      to: "/app/gerador",
      search: { formato: "vsl_curta" },
    });
  },
});
