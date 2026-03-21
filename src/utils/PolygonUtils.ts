/**
 * PolygonUtils — Shared geometry functions for fracture systems
 *
 * LEARN: These functions are used by both GlassHandler and ConcreteHandler
 * (and future fracture materials). Extracting them avoids code duplication
 * and means a fix to polygon math fixes all materials at once.
 *
 * These will also be needed for the laser slicing system (Phase 6).
 */

export type Vec2 = { x: number; y: number };

/** Compute area of a polygon using the shoelace formula */
export function polygonArea(verts: Vec2[]): number {
  let area = 0;
  for (let i = 0; i < verts.length; i++) {
    const curr = verts[i]!;
    const next = verts[(i + 1) % verts.length]!;
    area += curr.x * next.y - next.x * curr.y;
  }
  return Math.abs(area) / 2;
}

/** Compute centroid of a polygon */
export function polygonCentroid(verts: Vec2[]): Vec2 {
  let cx = 0;
  let cy = 0;
  for (const v of verts) {
    cx += v.x;
    cy += v.y;
  }
  return { x: cx / verts.length, y: cy / verts.length };
}

/** Estimate area of a Matter.js body from its bounding box */
export function estimateBodyArea(body: MatterJS.BodyType): number {
  const bounds = body.bounds;
  return (bounds.max.x - bounds.min.x) * (bounds.max.y - bounds.min.y);
}

/** Signed distance from point to line (positive = left side) */
export function sideOfLine(point: Vec2, linePoint: Vec2, nx: number, ny: number): number {
  return (point.x - linePoint.x) * nx + (point.y - linePoint.y) * ny;
}

/** Find intersection of a line segment with an infinite line */
export function lineEdgeIntersection(a: Vec2, b: Vec2, linePoint: Vec2, nx: number, ny: number): Vec2 | null {
  const da = sideOfLine(a, linePoint, nx, ny);
  const db = sideOfLine(b, linePoint, nx, ny);
  const denom = da - db;
  if (Math.abs(denom) < 1e-10) return null;
  const t = da / denom;
  return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
}

/** Split a polygon by a line through a point with a given normal */
export function splitPolygon(verts: Vec2[], linePoint: Vec2, nx: number, ny: number): [Vec2[], Vec2[]] {
  const left: Vec2[] = [];
  const right: Vec2[] = [];
  for (let i = 0; i < verts.length; i++) {
    const curr = verts[i]!;
    const next = verts[(i + 1) % verts.length]!;
    const currSide = sideOfLine(curr, linePoint, nx, ny);
    const nextSide = sideOfLine(next, linePoint, nx, ny);
    if (currSide >= 0) left.push(curr);
    if (currSide <= 0) right.push(curr);
    if ((currSide > 0 && nextSide < 0) || (currSide < 0 && nextSide > 0)) {
      const inter = lineEdgeIntersection(curr, next, linePoint, nx, ny);
      if (inter) { left.push(inter); right.push(inter); }
    }
  }
  return [left, right];
}

/**
 * Radial fracture: split a polygon by casting N lines through a point.
 * Used by glass (3 cuts) and concrete (1 cut).
 */
export function radialFracture(verts: Vec2[], contactPoint: Vec2, numCuts: number, minArea: number): Vec2[][] {
  const angles: number[] = [];
  const baseAngle = Math.random() * Math.PI;
  for (let i = 0; i < numCuts; i++) {
    angles.push(baseAngle + (i * Math.PI) / numCuts + (Math.random() - 0.5) * 0.4);
  }
  let fragments: Vec2[][] = [verts];
  for (const angle of angles) {
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);
    const newFragments: Vec2[][] = [];
    for (const frag of fragments) {
      const [left, right] = splitPolygon(frag, contactPoint, nx, ny);
      if (left.length >= 3 && polygonArea(left) >= minArea) newFragments.push(left);
      if (right.length >= 3 && polygonArea(right) >= minArea) newFragments.push(right);
    }
    fragments = newFragments.length > 0 ? newFragments : fragments;
  }
  return fragments;
}

/**
 * Convex hull using Gift Wrapping (Jarvis March).
 * Needed for compound Matter.js bodies (concave shapes decomposed into parts).
 */
export function convexHull(points: Vec2[]): Vec2[] {
  if (points.length < 3) return points;
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i]!.x < points[start]!.x ||
        (points[i]!.x === points[start]!.x && points[i]!.y < points[start]!.y)) {
      start = i;
    }
  }
  const hull: Vec2[] = [];
  let current = start;
  do {
    hull.push(points[current]!);
    let next = 0;
    for (let i = 0; i < points.length; i++) {
      if (i === current) continue;
      if (next === current) { next = i; continue; }
      const cross =
        (points[i]!.x - points[current]!.x) * (points[next]!.y - points[current]!.y) -
        (points[i]!.y - points[current]!.y) * (points[next]!.x - points[current]!.x);
      if (cross < 0) next = i;
    }
    current = next;
  } while (current !== start && hull.length < points.length);
  return hull;
}

/** Collect all vertices from a Matter.js body (handles compound bodies) */
export function getBodyVertices(body: MatterJS.BodyType): Vec2[] {
  const allVerts: Vec2[] = [];
  const parts = body.parts.length > 1 ? body.parts.slice(1) : [body];
  for (const part of parts) {
    if (!part.vertices) continue;
    for (const v of part.vertices) {
      allVerts.push({ x: v.x, y: v.y });
    }
  }
  return allVerts;
}
