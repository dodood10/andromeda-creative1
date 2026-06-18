import { toast } from "sonner";

const FIRST_EXPORT_KEY = "andromeda_first_export_celebrated";

export function celebrateFirstExport() {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(FIRST_EXPORT_KEY)) return;
  localStorage.setItem(FIRST_EXPORT_KEY, "1");
  toast.success("Primeiro export concluído! Marque como Subiu no histórico quando subir no Meta.", {
    duration: 8000,
  });
}
