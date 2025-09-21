// src/lib/sameSet.ts
export function sameSet(a: Set<string>, b: Set<string>) {
    if (a === b) return true;
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }
  