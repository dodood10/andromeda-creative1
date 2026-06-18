import { AsyncLocalStorage } from "node:async_hooks";

type RenderContext = {
  waitUntil: (promise: Promise<unknown>) => void;
};

const storage = new AsyncLocalStorage<RenderContext>();

export function runWithRenderContext<T>(ctx: RenderContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function scheduleBackgroundRender(task: () => Promise<void>) {
  const ctx = storage.getStore();
  const promise = task().catch((err) => {
    console.error("[background-render]", err);
  });

  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
    return;
  }

  void promise;
}
