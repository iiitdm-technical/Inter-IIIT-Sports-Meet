/**
 * Suggestions for filling a knockout bracket from pool standings. These only
 * pre-fill the admin form: the Sports SAC can change every position before
 * (and after) building the bracket. Safe to use in the browser.
 */

/** Standard seeding order for a bracket: 1 v 8, 4 v 5, 2 v 7, 3 v 6 for 8. */
export function seedPositions(size) {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, next - seed]);
  }
  return order;
}

/**
 * Positions (2 per first-round match) from pool standings. With an even
 * number of pools and two through from each, pools are paired and crossed
 * (A1 v B2, C1 v D2 … then B1 v A2, D1 v C2 …) so teams from the same pool
 * can only meet again in the final. Otherwise qualifiers are seeded by
 * finishing position then pool, and the best seeds get any byes.
 * `pools` is [{ pool, rows: [{ iiitCode }] }].
 */
export function suggestSlots(pools, perPool, size) {
  const sorted = pools.slice().sort((a, b) => a.pool.localeCompare(b.pool));
  const slots = Array(size).fill(null);
  const at = (pool, rank) => pool.rows[rank - 1]?.iiitCode || null;

  if (perPool === 2 && sorted.length % 2 === 0 && sorted.length * 2 === size) {
    const top = [];
    const bottom = [];
    for (let i = 0; i < sorted.length; i += 2) {
      const [x, y] = [sorted[i], sorted[i + 1]];
      top.push(at(x, 1), at(y, 2));
      bottom.push(at(y, 1), at(x, 2));
    }
    return [...top, ...bottom];
  }

  const seeds = [];
  for (let rank = 1; rank <= perPool; rank += 1) {
    for (const pool of sorted) {
      const code = at(pool, rank);
      if (code) seeds.push(code);
    }
  }
  seedPositions(size).forEach((seed, position) => {
    slots[position] = seeds[seed - 1] || null;
  });
  return slots;
}

/** The smallest bracket size that holds `count` teams. */
export function bracketSizeFor(count, sizes = [2, 4, 8, 16, 32]) {
  return sizes.find((size) => size >= count) || sizes.at(-1);
}
