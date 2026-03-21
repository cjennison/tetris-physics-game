/**
 * ConcreteHandler — Cracks concrete pieces in half on hard impact
 *
 * LEARN: Concrete behaves differently from glass:
 * - Glass SHATTERS into many small fragments (3+ cuts)
 * - Concrete CRACKS into 2 large halves (1 cut through impact point)
 * - Concrete needs a harder hit to break (higher threshold)
 * - The halves are heavy and don't scatter — they just fall apart
 * - Concrete halves CAN crack again if hit hard enough (unlike glass
 *   shards which are inert), but only if they're still big enough
 *
 * This gives concrete a distinct gameplay feel: it's a reliable
 * building material, but drop it wrong and it splits in two, leaving
 * a gap. Strategic players will place concrete carefully.
 */
import Phaser from 'phaser';
import { CollisionCategory } from '../../types';
import { type PieceUserData } from '../../pieces/PieceFactory';
import { PieceRenderer } from '../PieceRenderer';
import type { CollisionInfo, MaterialCollisionHandler } from '../SpecialMaterialSystem';
import { TUNING } from '../../tuning';
import {
  polygonArea,
  polygonCentroid,
  estimateBodyArea,
  radialFracture,
} from '../../utils/PolygonUtils';

function getConcreteConfig() {
  const mat = TUNING.materials.concrete as Record<string, unknown>;
  return {
    /** Minimum relative speed to crack */
    crackSpeedThreshold: (mat?.crackSpeedThreshold as number) ?? 4.0,
    /** Below this area, concrete can't crack further */
    uncrackableArea: (mat?.uncrackableArea as number) ?? 800,
    /** Minimum fragment area */
    minFragmentArea: (mat?.minFragmentArea as number) ?? 300,
  };
}

export const concreteCollisionHandler: MaterialCollisionHandler = (
  info: CollisionInfo,
  scene: Phaser.Scene,
  renderer: PieceRenderer,
): MatterJS.BodyType[] => {
  const config = getConcreteConfig();

  // Too small to crack further
  const bodyArea = estimateBodyArea(info.body);
  if (bodyArea < config.uncrackableArea) {
    return [];
  }

  // Smaller fragments need harder hits — same scaling as glass
  const fullPieceArea = 2500;
  const sizeRatio = Math.max(1, fullPieceArea / bodyArea);
  const adjustedThreshold = config.crackSpeedThreshold * sizeRatio;

  const velA = info.body.velocity;
  const velB = info.otherBody.velocity;
  const relVx = velA.x - velB.x;
  const relVy = velA.y - velB.y;
  const relativeSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
  if (relativeSpeed < adjustedThreshold) {
    return [];
  }

  // Fracture each sub-part individually to preserve concave shape
  const parts = info.body.parts.length > 1
    ? info.body.parts.slice(1)
    : [info.body];

  const allFragVerts: Array<Array<{ x: number; y: number }>> = [];
  for (const part of parts) {
    if (!part.vertices || part.vertices.length < 3) continue;
    const partVerts = part.vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y }));
    const partFragments = radialFracture(
      partVerts,
      info.contactPoint,
      1, // Single cut = 2 halves per sub-part
      config.minFragmentArea,
    );
    allFragVerts.push(...partFragments);
  }

  // Need at least 2 fragments for a crack
  if (allFragVerts.length < 2) return [];

  const NUDGE_DISTANCE = 1.5;
  const allFragments: MatterJS.BodyType[] = [];

  for (const fragVerts of allFragVerts) {
    const center = polygonCentroid(fragVerts);
    const area = polygonArea(fragVerts);
    if (area < config.minFragmentArea) continue;

    // Nudge halves apart slightly
    const dx = center.x - info.contactPoint.x;
    const dy = center.y - info.contactPoint.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const nudgedCenter = {
      x: center.x + (dx / dist) * NUDGE_DISTANCE,
      y: center.y + (dy / dist) * NUDGE_DISTANCE,
    };

    const localVerts = fragVerts.map(v => ({
      x: v.x - nudgedCenter.x,
      y: v.y - nudgedCenter.y,
    }));

    try {
      const fragBody = scene.matter.add.fromVertices(
        nudgedCenter.x,
        nudgedCenter.y,
        [localVerts],
        {
          label: 'piece-Concrete-half',
          restitution: 0.03,
          friction: 0.7,
          frictionStatic: 0.9,
          frictionAir: 0.02,
          density: info.data.material.density,
          slop: 0.1,
          collisionFilter: {
            category: CollisionCategory.PIECE,
            mask: CollisionCategory.WALL | CollisionCategory.PIECE,
          },
        },
        true,
      );

      // Keep concrete material so halves can crack again
      (fragBody as MatterJS.BodyType & { gameData: PieceUserData }).gameData = {
        ...info.data,
        name: 'Concrete-half',
        settled: false,
        createdAt: Date.now(),
      };

      /**
       * LEARN: Concrete halves barely scatter — they're heavy.
       * Just a tiny nudge outward so they separate visually,
       * plus inherit most of the original velocity (they're
       * heavy chunks, not light shards).
       */
      scene.matter.body.setVelocity(fragBody, {
        x: (dx / dist) * 0.3 + info.body.velocity.x * 0.5,
        y: (dy / dist) * 0.3 + info.body.velocity.y * 0.5,
      });

      scene.matter.body.setAngularVelocity(fragBody, (Math.random() - 0.5) * 0.02);

      allFragments.push(fragBody);
    } catch {
      // Skip degenerate polygons
    }
  }

  if (allFragments.length > 0) {
    renderer.removeBody(info.body);
    scene.matter.world.remove(info.body);
  }

  return allFragments;
};
