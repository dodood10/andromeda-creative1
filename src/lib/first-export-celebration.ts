import { toast } from "sonner";

const FIRST_EXPORT_KEY = "andromeda_first_export_celebrated";

export function celebrateFirstExport() {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(FIRST_EXPORT_KEY)) return;
  localStorage.setItem(FIRST_EXPORT_KEY, "1");
  toast.success("Primeiro export concluído!", {
    description: "Baixe o MP4 → suba no Meta Ads → marque como Subiu no histórico.",
    duration: 10000,
    action: {
      label: "Ver guia",
      onClick: () => {
        window.dispatchEvent(new CustomEvent("andromeda:open-meta-guide"));
      },
    },
  });
}
