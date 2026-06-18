import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import {
  META_PIXEL_ID,
  initMetaPixel,
  trackMetaForPath,
} from "@/lib/meta-pixel";

export function MetaPixelTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const initialized = useRef(false);
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!META_PIXEL_ID) return;
    if (!initialized.current) {
      initMetaPixel();
      initialized.current = true;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    trackMetaForPath(pathname);
  }, [pathname]);

  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt=""
      />
    </noscript>
  );
}
