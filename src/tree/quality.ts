export type Tier = 'high' | 'medium' | 'low';

export const TIERS = {
  high: { dpr: 1.5, leaves: 2600, falling: 360, grass: 9000, fireflies: 180, pollen: 500, shadows: true, post: true, dof: true, godrays: true, uiLeaves: 36 },
  medium: { dpr: 1.25, leaves: 1800, falling: 220, grass: 4500, fireflies: 110, pollen: 260, shadows: true, post: true, dof: false, godrays: true, uiLeaves: 22 },
  low: { dpr: 1, leaves: 1100, falling: 90, grass: 1400, fireflies: 60, pollen: 90, shadows: false, post: false, dof: false, godrays: false, uiLeaves: 10 },
} satisfies Record<Tier, unknown>;
export type TierSettings = typeof TIERS[Tier];

/** Pick a starting tier; the scene steps down at runtime if frames run slow. `?quality=` overrides for testing. */
export function detectTier(): Tier {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced;
  const coarse = matchMedia('(pointer: coarse)').matches, small = Math.min(innerWidth, innerHeight) < 600;
  if (coarse && small) return 'low';
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (coarse || memory <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4) return 'medium';
  return 'high';
}
