// src/lib/debug.ts
export const DEBUG = process.env.NEXT_PUBLIC_PM_DEBUG === "1";

export function dlog(ns: string, ...args: unknown[]) {
  if (!DEBUG) return;
  // subtle label styling
  // biome-ignore lint/suspicious/noConsole:
  console.log(`%c[PM:%s]`, "color:#9ca3af", ns, ...args);
}

export function dgroup(ns: string, label: string) {
  if (!DEBUG) return { end: () => {} };
  // biome-ignore lint/suspicious/noConsole:
  console.groupCollapsed(`%c[PM:${ns}] ${label}`, "color:#9ca3af");
  return {
    end() {
      // biome-ignore lint/suspicious/noConsole:
      console.groupEnd();
    },
  };
}
