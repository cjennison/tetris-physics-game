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
 *
 * This looks convincing because real glass fractures radially from
 * the impact point — cracks spread outward in a starburst pattern.
 *
 * The key insight: if a long glass piece lands on a point, the
 * collision point is at that tip. Fracture lines radiate FROM that
 * point, so the two halves naturally fall to either side. This is
 * exactly the behavior you described wanting.
 */
import Phaser from 'phaser';
import { CollisionCategory } from '../../types';
import { type PieceUserData } from '../../pieces/PieceFactory';
import { PieceRenderer } from '../PieceRenderer';
import type { CollisionInfo, MaterialCollisionHandler } from '../SpecialMaterialSystem';
import { TUNING } from '../../tuning';

/** Tuning for glass shatter — read from tuning.json */
function getGlassConfig() {
  const glass = TUNING.materials.glass as Record<string, unknown>;
  return {
    /** Minimum speed to trigger shatter (ignores gentle contacts) */
    shatterSpeedThreshold: (glass?.shatterSpeedThreshold as number) ?? 2.0,
    /** Number of fracture lines to cast */
    fractureCuts: (glass?.fractureCuts as number) ?? 3,
    /** How fast fragments scatter outward */
    scatterForce: (glass?.scatterForce as number) ?? 2.0,
    /** Minimum fragment area (discard tiny shards) */
    minShardArea: (glass?.minShardArea as number) ?? 150,
    /** Below this area, glass can no longer shatter further */
    unbreakableArea: (glass?.unbreakableArea as number) ?? 600,
  };
}

/**
 * The main handler — registered with SpecialMaterialSystem.
 * Returns new fragment bodies (or empty array if impact too weak).
 */
export const glassCollisionHandler: MaterialCollisionHandler = (
  info: CollisionInfo,
  scene: Phaser.Scene,
  renderer: PieceRenderer,
): MatterJS.BodyType[] => {
  const config = getGlassConfig();

  /**
   * LEARN: Shards must NOT shatter further. Without this guard, a single
   * glass piece hitting a wall creates shards that collide with each other
   * and the wall, each triggering more shatters — exponential explosion.
   * Only original whole glass pieces (not shards) should shatter.
   */
  if (info.data.name === 'Glass-shard') {
    return [];
  }

  // Global shard cap — prevent physics meltdown if something goes wrong
  const existingShards = scene.matter.world.getAllBodies()
    .filter(b => b.label === 'piece-Glass-shard').length;
  if (existingShards > 50) {
    return [];
  }

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

  /**
   * LEARN: Matter.js decomposes concave shapes (like T-Block, L-Block)
   * into multiple small convex sub-parts. If we fracture each sub-part
   * individually, the pieces are too small to produce viable fragments.
   *
   * Instead, we collect ALL vertices from ALL sub-parts and compute
   * their convex hull — this gives us the full outer boundary of the
   * piece as a single polygon. Then we fracture THAT. This works for
   * both simple bodies (I-Block, O-Block) and compound bodies (T, S, Z, L, J).
   */
  const allVerts: Array<{ x: number; y: number }> = [];
  const parts = info.body.parts.length > 1
    ? info.body.parts.slice(1)
    : [info.body];
  for (const part of parts) {
    if (!part.vertices) continue;
    for (const v of part.vertices) {
      allVerts.push({ x: v.x, y: v.y });
    }
  }

  const hullVerts = convexHull(allVerts);
  if (hullVerts.length < 3) return [];

  // Generate fragment polygons by radial cutting the full shape
  const fragments = radialFracture(
    hullVerts,
    info.contactPoint,
    config.fractureCuts,
    config.minShardArea,
  );

  const allFragments: MatterJS.BodyType[] = [];

  {

    /**
     * LEARN: The #1 cause of physics "freakouts" is overlapping bodies.
     * When fragments are created from the same polygon, they share edges
     * and vertices. Matter.js detects these overlaps and applies huge
     * separation forces — causing the jittery explosion you see.
     *
     * Three fixes work together:
     * 1. NUDGE each fragment outward from the contact point before adding
     *    it to the world. This creates tiny gaps between fragments.
     * 2. frictionAir adds drag so fragments slow down quickly instead
     *    of bouncing around forever.
     * 3. slop (overlap tolerance) tells Matter.js to ignore tiny overlaps
     *    instead of violently resolving them.
     */
    const NUDGE_DISTANCE = 2; // pixels to push fragments apart

    // Create physics bodies from fragments
    for (const fragVerts of fragments) {
      const center = polygonCentroid(fragVerts);
      const area = polygonArea(fragVerts);
      if (area < config.minShardArea) continue;

      // Nudge the center away from the contact point to prevent overlap
      const dx = center.x - info.contactPoint.x;
      const dy = center.y - info.contactPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const nudgedCenter = {
        x: center.x + (dx / dist) * NUDGE_DISTANCE,
        y: center.y + (dy / dist) * NUDGE_DISTANCE,
      };

      // Convert to local coordinates (relative to nudged centroid)
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
            frictionAir: 0.08,  // High air drag — shards settle fast
            density: info.data.material.density,
            slop: 0.1,          // Tolerate small overlaps without jitter
            collisionFilter: {
              category: CollisionCategory.PIECE,
              mask: CollisionCategory.WALL | CollisionCategory.PIECE,
            },
          },
          true,
        );

        // Attach game data so renderer can color the shard
        (fragBody as MatterJS.BodyType & { gameData: PieceUserData }).gameData = {
          ...info.data,
          name: 'Glass-shard',
          settled: false,
        };

        /**
         * LEARN: Scatter velocity is gentle and capped. The original code
         * divided by distance which could produce huge values for fragments
         * near the impact point. Now we use a soft, capped formula:
         * - Direction: outward from impact point
         * - Magnitude: scatterForce, capped at a max
         * - Inherit a fraction of the original body's velocity for realism
         */
        const scatterMag = Math.min(config.scatterForce, 3);

        scene.matter.body.setVelocity(fragBody, {
          x: (dx / dist) * scatterMag * 0.5 + info.body.velocity.x * 0.2,
          y: (dy / dist) * scatterMag * 0.5 + info.body.velocity.y * 0.2,
        });

        // Small random spin for visual flair
        scene.matter.body.setAngularVelocity(
          fragBody,
          (Math.random() - 0.5) * 0.05,
        );

        allFragments.push(fragBody);
      } catch {
        // fromVertices can fail on degenerate polygons — skip silently
      }
    }
  }

  // Only destroy original if we successfully created fragments
  if (allFragments.length > 0) {
    renderer.removeBody(info.body);
    scene.matter.world.remove(info.body);
  }

  return allFragments;
};

/**
 * Radial fracture: split a polygon by casting lines through a point.
 *
 * LEARN: This is a simplified version of Voronoi fracture. True Voronoi
 * gives the most natural-looking breaks, but it requires a Voronoi library.
 * Radial cuts give a convincing "starburst" pattern that looks like glass
 * cracking from the impact point, and it's simple to implement.
 *
 * Algorithm:
 * 1. Pick N random angles
 * 2. For each angle, define a line through the contact point
 * 3. Split the polygon along that line using Sutherland-Hodgman clipping
 * 4. Each split produces two halves; recursively split the halves
 */
function radialFracture(
  vertices: Array<{ x: number; y: number }>,
  contactPoint: { x: number; y: number },
  numCuts: number,
  minArea: number,
): Array<Array<{ x: number; y: number }>> {
  // Generate random angles, spread across 180 degrees for variety
  const angles: number[] = [];
  const baseAngle = Math.random() * Math.PI;
  for (let i = 0; i < numCuts; i++) {
    // Spread cuts across the full circle with some randomness
    angles.push(baseAngle + (i * Math.PI) / numCuts + (Math.random() - 0.5) * 0.4);
  }

  // Start with the full polygon as the only fragment
  let fragments: Array<Array<{ x: number; y: number }>> = [vertices];

  // Each cut splits existing fragments
  for (const angle of angles) {
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);

    const newFragments: Array<Array<{ x: number; y: number }>> = [];

    for (const frag of fragments) {
      const [left, right] = splitPolygon(frag, contactPoint, nx, ny);

      if (left.length >= 3 && polygonArea(left) >= minArea) {
        newFragments.push(left);
      }
      if (right.length >= 3 && polygonArea(right) >= minArea) {
        newFragments.push(right);
      }
    }

    fragments = newFragments.length > 0 ? newFragments : fragments;
  }

  return fragments;
}

/**
 * Split a polygon by a line through a point with a given normal.
 *
 * LEARN: This uses the Sutherland-Hodgman algorithm, adapted for splitting.
 * A line divides the plane into two half-planes (left and right of the line).
 * We walk the polygon edges, putting vertices into the "left" or "right"
 * bucket. When an edge crosses the line, we compute the intersection point
 * and add it to both buckets. This gives us two clean polygons.
 */
function splitPolygon(
  vertices: Array<{ x: number; y: number }>,
  linePoint: { x: number; y: number },
  normalX: number,
  normalY: number,
): [Array<{ x: number; y: number }>, Array<{ x: number; y: number }>] {
  const left: Array<{ x: number; y: number }> = [];
  const right: Array<{ x: number; y: number }> = [];

  for (let i = 0; i < vertices.length; i++) {
    const curr = vertices[i]!;
    const next = vertices[(i + 1) % vertices.length]!;

    // Which side of the line is this vertex on?
    const currSide = sideOfLine(curr, linePoint, normalX, normalY);
    const nextSide = sideOfLine(next, linePoint, normalX, normalY);

    if (currSide >= 0) left.push(curr);
    if (currSide <= 0) right.push(curr);

    // If the edge crosses the line, add the intersection to both sides
    if ((currSide > 0 && nextSide < 0) || (currSide < 0 && nextSide > 0)) {
      const intersection = lineEdgeIntersection(curr, next, linePoint, normalX, normalY);
      if (intersection) {
        left.push(intersection);
        right.push(intersection);
      }
    }
  }

  return [left, right];
}

/** Signed distance from point to line (positive = left side, negative = right) */
function sideOfLine(
  point: { x: number; y: number },
  linePoint: { x: number; y: number },
  nx: number,
  ny: number,
): number {
  return (point.x - linePoint.x) * nx + (point.y - linePoint.y) * ny;
}

/** Find intersection of a line segment with an infinite line */
function lineEdgeIntersection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  linePoint: { x: number; y: number },
  nx: number,
  ny: number,
): { x: number; y: number } | null {
  const da = sideOfLine(a, linePoint, nx, ny);
  const db = sideOfLine(b, linePoint, nx, ny);
  const denom = da - db;
  if (Math.abs(denom) < 1e-10) return null;
  const t = da / denom;
  return {
    x: a.x + t * (b.x - a.x),
    y: a.y + t * (b.y - a.y),
  };
}

/** Compute area of a polygon using the shoelace formula */
function polygonArea(verts: Array<{ x: number; y: number }>): number {
  let area = 0;
  for (let i = 0; i < verts.length; i++) {
    const curr = verts[i]!;
    const next = verts[(i + 1) % verts.length]!;
    area += curr.x * next.y - next.x * curr.y;
  }
  return Math.abs(area) / 2;
}

/** Compute centroid of a polygon */
function polygonCentroid(verts: Array<{ x: number; y: number }>): { x: number; y: number } {
  let cx = 0;
  let cy = 0;
  for (const v of verts) {
    cx += v.x;
    cy += v.y;
  }
  return { x: cx / verts.length, y: cy / verts.length };
}

/** Estimate area of a Matter.js body from its bounding box */
function estimateBodyArea(body: MatterJS.BodyType): number {
  const bounds = body.bounds;
  return (bounds.max.x - bounds.min.x) * (bounds.max.y - bounds.min.y);
}

/**
 * Convex hull using the Gift Wrapping (Jarvis March) algorithm.
 *
 * LEARN: A convex hull is the smallest convex polygon that contains
 * all given points — like stretching a rubber band around pushpins.
 * We need this because compound Matter.js bodies (concave shapes like
 * T-Block) are split into multiple convex parts. To fracture the whole
 * shape, we need its outer boundary as a single polygon.
 */
function convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  if (points.length < 3) return points;

  // Find the leftmost point (guaranteed to be on the hull)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.x < points[start]!.x ||
        (points[i]!.x === points[start]!.x && points[i]!.y < points[start]!.y)) {
      start = i;
    }
  }

  const hull: Array<{ x: number; y: number }> = [];
  let current = start;

  do {
    hull.push(points[current]!);
    let next = 0;

    for (let i = 0; i < points.length; i++) {
      if (i === current) continue;
      if (next === current) {
        next = i;
        continue;
      }

      // Cross product to determine turn direction
      const cross =
        (points[i]!.x - points[current]!.x) * (points[next]!.y - points[current]!.y) -
        (points[i]!.y - points[current]!.y) * (points[next]!.x - points[current]!.x);

      if (cross < 0) {
        next = i;
      }
    }

    current = next;
  } while (current !== start && hull.length < points.length);

  return hull;
}
