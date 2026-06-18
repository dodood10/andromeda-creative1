import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

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
    <div className="flex items-center justify-center h-[40vh]">
      <Loader2 className="size-8 animate-spin text-primary-glow" />
    </div>
  );
}
