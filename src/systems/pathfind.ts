import { Hex, key, neighbors, distance, eq } from './hex';

// A* over hex grid. `passable` decides walkability; goal is allowed even if occupied when allowGoalBlocked.
export function findPath(
  start: Hex, goal: Hex, passable: (h: Hex) => boolean,
  opts: { maxNodes?: number; allowGoalBlocked?: boolean } = {},
): Hex[] | null {
  const maxNodes = opts.maxNodes ?? 4000;
  if (eq(start, goal)) return [];
  if (!opts.allowGoalBlocked && !passable(goal)) return null;
  const open: { h: Hex; f: number }[] = [{ h: start, f: distance(start, goal) }];
  const came = new Map<string, Hex>();
  const g = new Map<string, number>([[key(start), 0]]);
  let visited = 0;
  while (open.length && visited++ < maxNodes) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!.h;
    if (eq(cur, goal)) {
      const path: Hex[] = [cur];
      let k = key(cur);
      while (came.has(k)) { const p = came.get(k)!; k = key(p); if (!eq(p, start)) path.unshift(p); }
      return path;
    }
    for (const n of neighbors(cur)) {
      const isGoal = eq(n, goal);
      if (!passable(n) && !(isGoal && opts.allowGoalBlocked)) continue;
      const ng = g.get(key(cur))! + 1;
      if (ng < (g.get(key(n)) ?? Infinity)) {
        g.set(key(n), ng);
        came.set(key(n), cur);
        open.push({ h: n, f: ng + distance(n, goal) });
      }
    }
  }
  return null;
}
