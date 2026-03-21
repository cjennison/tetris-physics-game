/**
 * Tuning System — Loads game parameters from tuning.json
 *
 * LEARN: Professional games separate "data" from "code". Game designers
 * tweak numbers in data files while programmers write logic in code.
 * This file bridges the two: it imports tuning.json (the data) and
 * exports typed, validated values that the code can use safely.
 *
 * Why a JSON file instead of TypeScript constants?
 * - Non-programmers can edit JSON (future designers, or you from your phone)
 * - Vite hot-reloads JSON changes instantly during dev
 * - It's a single place to see ALL tunable values at a glance
 * - It could eventually be loaded from a server for live-tuning
 */
import { MaterialDefinition } from './types';
import data from './tuning.json';

// Re-export all tuning sections as typed objects
export const TUNING = data;

/** Get a material definition by key */
export function getMaterial(key: string): MaterialDefinition {
  const mat = data.materials[key as keyof typeof data.materials];
  if (!mat || typeof mat === 'string') {
    // Fallback to steel if key not found (or if we hit the _doc field)
    return data.materials.steel as MaterialDefinition;
  }
  return mat as MaterialDefinition;
}

/**
 * Pick a random material using the weighted probability table.
 *
 * LEARN: Weighted random selection is used everywhere in games — loot drops,
 * enemy spawns, piece materials. The algorithm:
 * 1. Sum all weights (e.g., aluminum:3 + steel:5 + lead:1 + rubber:2 + concrete:2 = 13)
 * 2. Pick a random number 0-13
 * 3. Walk through the weights, subtracting each one
 * 4. When the random number goes below 0, that's our pick
 *
 * Higher weight = more likely. Steel (weight 5) appears ~38% of the time.
 * Lead (weight 1) appears ~8% of the time — rare and impactful.
 */
export function rollMaterial(): { key: string; material: MaterialDefinition } {
  const weights = data.materialWeights;
  const entries = Object.entries(weights).filter(([k]) => k !== '_doc');

  let totalWeight = 0;
  for (const [, w] of entries) {
    totalWeight += w as number;
  }

  let roll = Math.random() * totalWeight;
  for (const [key, w] of entries) {
    roll -= w as number;
    if (roll <= 0) {
      return { key, material: getMaterial(key) };
    }
  }

  // Fallback (shouldn't reach here)
  return { key: 'steel', material: getMaterial('steel') };
}

/** All material keys (excluding _doc) */
export function getAllMaterialKeys(): string[] {
  return Object.keys(data.materials).filter(k => k !== '_doc');
}
