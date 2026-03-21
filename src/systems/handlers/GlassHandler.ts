/**
 * GlassHandler — Shatters glass pieces on impact
 *
 * LEARN: This is one of the most satisfying effects in physics games.
 * When a glass piece hits something hard enough, it fractures into
 * random shards that scatter based on the collision geometry.
 *
 * The algorithm: "Radial Fracture"
 * 1. Find the collision point on the piece
 * 2. Cast N random lines through/near that point at different angles
 * 3. Each line splits the piece polygon into smaller fragments
 * 4. Remove the original body, create new bodies for each fragment
 * 5. Apply outward velocity from the impact point
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
  convexHull,
  getBodyVertices,
} from '../../utils/PolygonUtils';

function getGlassConfig() {
  const glass = TUNING.materials.glass as Record<string, unknown>;
  return {
    shatterSpeedThreshold: (glass?.shatterSpeedThreshold as number) ?? 2.0,
    fractureCuts: (glass?.fractureCuts as number) ?? 3,
    scatterForce: (glass?.scatterForce as number) ?? 2.0,
    minShardArea: (glass?.minShardArea as number) ?? 150,
    unbreakableArea: (glass?.unbreakableArea as number) ?? 600,
  };
}

export const glassCollisionHandler: MaterialCollisionHandler = (
  info: CollisionInfo,
  scene: Phaser.Scene,
  renderer: PieceRenderer,
): MatterJS.BodyType[] => {
  const config = getGlassConfig();

  // Shards don't shatter further — prevents cascade explosion
  if (info.data.name === 'Glass-shard') {
    return [];
  }

  // Global shard cap
  const existingShards = scene.matter.world.getAllBodies()
    .filter(b => b.label === 'piece-Glass-shard').length;
  if (existingShards > 50) {
    return [];
  }

  // Relative speed check
  const velA = info.body.velocity;
  const velB = info.otherBody.velocity;
  const relVx = velA.x - velB.x;
  const relVy = velA.y - velB.y;
  const relativeSpeed = Math.sqrt(relVx * relVx + relVy * relVy);
  if (relativeSpeed < config.shatterSpeedThreshold) {
    return [];
  }

  const bodyArea = estimateBodyArea(info.body);
  if (bodyArea < config.unbreakableArea) {
    return [];
  }

  // Get full shape as single polygon via convex hull
  const allVerts = getBodyVertices(info.body);
  const hullVerts = convexHull(allVerts);
  if (hullVerts.length < 3) return [];

  const fragments = radialFracture(
    hullVerts,
    info.contactPoint,
    config.fractureCuts,
    config.minShardArea,
  );

  const NUDGE_DISTANCE = 2;
  const allFragments: MatterJS.BodyType[] = [];

  for (const fragVerts of fragments) {
    const center = polygonCentroid(fragVerts);
    const area = polygonArea(fragVerts);
    if (area < config.minShardArea) continue;

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
          label: 'piece-Glass-shard',
          restitution: 0.05,
          friction: 0.8,
          frictionStatic: 1.0,
          frictionAir: 0.08,
          density: info.data.material.density,
          slop: 0.1,
          collisionFilter: {
            category: CollisionCategory.PIECE,
            mask: CollisionCategory.WALL | CollisionCategory.PIECE,
          },
        },
        true,
      );

      (fragBody as MatterJS.BodyType & { gameData: PieceUserData }).gameData = {
        ...info.data,
        name: 'Glass-shard',
        settled: false,
      };

      const scatterMag = Math.min(config.scatterForce, 3);
      scene.matter.body.setVelocity(fragBody, {
        x: (dx / dist) * scatterMag * 0.5 + info.body.velocity.x * 0.2,
        y: (dy / dist) * scatterMag * 0.5 + info.body.velocity.y * 0.2,
      });
      scene.matter.body.setAngularVelocity(fragBody, (Math.random() - 0.5) * 0.05);

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
