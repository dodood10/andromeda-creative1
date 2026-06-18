import { useEffect, useState } from "react";
import { MetaUploadGuide } from "@/components/meta-upload-guide";

/** Escuta evento do primeiro export e abre o guia Meta globalmente. */
export function MetaGuideGlobalListener() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
    }
    window.addEventListener("andromeda:open-meta-guide", onOpen);
    return () => window.removeEventListener("andromeda:open-meta-guide", onOpen);
  }, []);

  return <MetaUploadGuide forceOpen={open} onOpenChange={setOpen} />;
}
