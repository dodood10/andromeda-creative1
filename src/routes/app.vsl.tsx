import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/app/vsl")({
  head: () => ({
    meta: [{ title: "VSL curta · Andromeda" }],
  }),
  component: VslRedirect,
});

function VslRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({
      to: "/app/gerador",
      search: { step: "wizard", formato: "vsl_curta" },
      replace: true,
    });
  }, [navigate]);

  return (
    <div className="container py-12 text-center text-muted-foreground">
      VSL curta agora faz parte do wizard do gerador.{" "}
      <Link to="/app/gerador" search={{ step: "wizard", formato: "vsl_curta" }} className="text-primary-glow underline">
        Abrir gerador
      </Link>
    </div>
  );
}
