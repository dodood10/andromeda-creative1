const DEFAULT_PIXEL_ID = "4269485799969770";

export const META_PIXEL_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_META_PIXEL_ID) ||
  DEFAULT_PIXEL_ID;

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[][];
  loaded?: boolean;
  version?: string;
  push?: Fbq;
};

function getFbq(): Fbq | undefined {
  if (typeof window === "undefined") return undefined;
  return window.fbq;
}

export function isMetaPixelEnabled(): boolean {
  return Boolean(META_PIXEL_ID) && typeof window !== "undefined";
}

export function initMetaPixel(): void {
  if (typeof window === "undefined" || !META_PIXEL_ID || window.fbq) return;

  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
    } else {
      fbq.queue?.push(args);
    }
  };
  if (!window._fbq) window._fbq = fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  const first = document.getElementsByTagName("script")[0];
  first?.parentNode?.insertBefore(script, first);

  fbq("init", META_PIXEL_ID);
  fbq("track", "PageView");
}

export function trackMetaPageView(path?: string) {
  const fbq = getFbq();
  if (!fbq) return;
  fbq("track", "PageView", path ? { page_path: path } : undefined);
}

export function trackMetaStandard(
  event: string,
  params?: Record<string, unknown>,
) {
  const fbq = getFbq();
  if (!fbq) return;
  fbq("track", event, params);
}

export function trackMetaCustom(
  event: string,
  params?: Record<string, unknown>,
) {
  const fbq = getFbq();
  if (!fbq) return;
  fbq("trackCustom", event, params);
}

export type MetaPageEvent = {
  viewContent?: { content_name: string; content_category?: string };
  alsoInitiateCheckout?: boolean;
};

export function trackMetaForPath(pathname: string) {
  if (pathname.startsWith("/admin")) return;

  trackMetaPageView(pathname);

  const map = META_ROUTE_EVENTS[pathname];
  if (!map) {
    const prefix = Object.keys(META_ROUTE_EVENTS).find(
      (p) => p !== "/" && pathname.startsWith(p + "/"),
    );
    if (prefix) {
      const nested = META_ROUTE_EVENTS[prefix];
      if (nested?.viewContent) {
        trackMetaStandard("ViewContent", {
          content_name: nested.viewContent.content_name,
          content_category: nested.viewContent.content_category ?? "app",
        });
      }
    }
    return;
  }

  if (map.viewContent) {
    trackMetaStandard("ViewContent", {
      content_name: map.viewContent.content_name,
      content_category: map.viewContent.content_category ?? "andromeda",
    });
  }
  if (map.alsoInitiateCheckout) {
    trackMetaStandard("InitiateCheckout", {
      content_name: map.viewContent?.content_name ?? "Planos",
      content_category: "subscription",
    });
  }
}

/** Eventos padrão Meta + custom por rota principal */
export const META_ROUTE_EVENTS: Record<string, MetaPageEvent> = {
  "/": {
    viewContent: { content_name: "Landing", content_category: "acquisition" },
  },
  "/login": {
    viewContent: { content_name: "Login", content_category: "acquisition" },
  },
  "/planos": {
    viewContent: { content_name: "Planos", content_category: "monetization" },
    alsoInitiateCheckout: true,
  },
  "/accept-invite": {
    viewContent: { content_name: "Accept Invite", content_category: "acquisition" },
  },
  "/app": {
    viewContent: { content_name: "Dashboard", content_category: "app" },
  },
  "/app/onboarding": {
    viewContent: { content_name: "Onboarding", content_category: "activation" },
  },
  "/app/gerador": {
    viewContent: { content_name: "Gerador", content_category: "activation" },
  },
  "/app/editor": {
    viewContent: { content_name: "Editor", content_category: "activation" },
  },
  "/app/historico": {
    viewContent: { content_name: "Historico", content_category: "retention" },
  },
  "/app/inteligencia": {
    viewContent: { content_name: "Inteligencia", content_category: "retention" },
  },
  "/app/escala": {
    viewContent: { content_name: "Escala", content_category: "expansion" },
  },
  "/app/projetos": {
    viewContent: { content_name: "Projetos", content_category: "app" },
  },
  "/app/configuracoes": {
    viewContent: { content_name: "Configuracoes", content_category: "app" },
  },
};

export function trackMetaLead(source: string) {
  trackMetaStandard("Lead", { content_name: source, content_category: "acquisition" });
}

export function trackMetaCompleteRegistration(method?: string) {
  trackMetaStandard("CompleteRegistration", {
    content_name: "Andromeda",
    status: true,
    ...(method ? { registration_method: method } : {}),
  });
}

export function trackMetaInitiateCheckout(plan: string) {
  trackMetaStandard("InitiateCheckout", {
    content_name: plan,
    content_category: "subscription",
    num_items: 1,
  });
}

export function trackMetaAngulosGerados(count = 5) {
  trackMetaCustom("AngulosGerados", { content_category: "activation", value: count });
}

export function trackMetaRascunhoCriado(count = 1) {
  trackMetaCustom("RascunhoCriado", { content_category: "activation", value: count });
}

export function trackMetaExportConcluido() {
  trackMetaCustom("ExportConcluido", { content_category: "activation" });
  trackMetaStandard("Subscribe", {
    content_name: "Primeiro Export",
    content_category: "activation",
  });
}

export function trackMetaMarcarSubiu() {
  trackMetaCustom("MarcarSubiu", { content_category: "retention" });
}

export function trackMetaPerformando() {
  trackMetaCustom("MarcarPerformando", { content_category: "expansion" });
}

export function trackMetaAddToCart(anguloName: string) {
  trackMetaStandard("AddToCart", {
    content_name: anguloName,
    content_category: "angulo",
    content_type: "product",
  });
}

export function trackMetaOnboardingStep(step: string) {
  trackMetaCustom("OnboardingStep", { step, content_category: "activation" });
}
