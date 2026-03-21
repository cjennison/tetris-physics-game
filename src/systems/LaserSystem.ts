/**
 * LaserSystem — Horizontal laser lines that detect coverage and destroy pieces
 *
 * LEARN: This is the core Tetris mechanic adapted for physics. In classic
 * Tetris, a full row disappears. In TRASH, a laser line scans a horizontal
 * band and checks what percentage is covered by piece geometry. When
 * coverage reaches 90%+, the laser fires and destroys everything within
 * the band. Pieces above collapse down under gravity.
 *
 * Each laser has an independent 2-second cooldown after firing.
 * Coverage is computed using AABB overlap — not pixel-perfect, but fast
 * and good enough for gameplay. We check how much of each laser band's
 * width is occupied by piece bounding boxes.
 *
 * The laser system runs continuously (not just in LASER_CHECK state)
 * so lasers can fire mid-play if a piece settles and completes a line.
 */
import Phaser from 'phaser';
import { TUNING } from '../tuning';
import { WALL_THICKNESS } from '../config';
import { CollisionCategory } from '../types';
import { getPieceData, type PieceUserData } from '../pieces/PieceFactory';
import { PieceRenderer } from './PieceRenderer';
import { EventBus } from '../core/EventBus';
import {
  splitPolygon,
  polygonArea,
  polygonCentroid,
} from '../utils/PolygonUtils';

interface LaserLine {
  /** Y position of the laser center */
  y: number;
  /** Coverage ratio 0-1 */
  coverage: number;
  /** Timestamp of last fire (for cooldown) */
  lastFiredAt: number;
  /** Is this laser currently in cooldown? */
  onCooldown: boolean;
  /** Timestamp when charging started (null = not charging) */
  chargeStartedAt: number | null;
  /** Charge progress 0-1 (fills left to right) */
  chargeProgress: number;
  /** Per-laser charge duration in ms (bottom = slow, top = fast) */
  chargeMs: number;
}

export class LaserSystem {
  private scene: Phaser.Scene;
  private renderer: PieceRenderer;
  private eventBus: EventBus;
  private graphics: Phaser.GameObjects.Graphics;
  private lasers: LaserLine[] = [];

  private playLeft: number;
  private playRight: number;
  private playWidth: number;

  constructor(
    scene: Phaser.Scene,
    eventBus: EventBus,
    renderer: PieceRenderer,
    boardWidth: number,
    boardHeight: number,
    laserCount: number,
    originX = 0,
    originY = 0,
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.eventBus = eventBus;
    this.playLeft = originX + WALL_THICKNESS;
    this.playRight = originX + boardWidth - WALL_THICKNESS;
    this.playWidth = this.playRight - this.playLeft;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(3);

    // Create laser lines evenly spaced across the play area
    const railY = originY + TUNING.crane.railY;
    const floorY = originY + boardHeight - WALL_THICKNESS;
    const playHeight = floorY - railY;
    const spacing = playHeight / (laserCount + 1);

    /**
     * LEARN: Charge times scale by position — bottom lasers are slow,
     * top lasers are fast. This creates a strategic gradient: it's easy
     * to fill the bottom but hard to clear it (10s charge). The top is
     * hard to reach but clears quickly (1-2s). Players must decide
     * whether to build a solid base (slow clear) or stack high (fast
     * clear but risky).
     *
     * Charge times are read from tuning.json as an array. If the array
     * is shorter than laserCount, remaining lasers use the last value.
     */
    const chargeTimes: number[] = (TUNING.laser.chargeTimes as number[] | undefined)
      ?? [10000, 8000, 6000, 4000, 3000, 2000, 1500, 1000];

    for (let i = 1; i <= laserCount; i++) {
      // i=1 is top laser, i=laserCount is bottom laser
      // We want bottom (high i) = slow charge, top (low i) = fast charge
      // So index into chargeTimes from the bottom: bottom gets [0], top gets [last]
      const bottomIndex = laserCount - i; // 0 for bottom, laserCount-1 for top
      const chargeMs = chargeTimes[Math.min(bottomIndex, chargeTimes.length - 1)]
        ?? chargeTimes[chargeTimes.length - 1]
        ?? 3000;

      this.lasers.push({
        y: railY + spacing * i,
        coverage: 0,
        lastFiredAt: 0,
        onCooldown: false,
        chargeStartedAt: null,
        chargeProgress: 0,
        chargeMs,
      });
    }
  }

  /**
   * Update all lasers — compute coverage, fire if ready.
   * Called every frame from GameInstance.update().
   */
  update(): void {
    const bandHeight = TUNING.laser.bandHeight;
    const threshold = TUNING.laser.coverageThreshold;
    const cooldownMs = TUNING.laser.cooldownMs;
    const now = Date.now();

    // Get all non-static piece bodies
    const bodies = this.scene.matter.world.getAllBodies()
      .filter(b => !b.isStatic && b.label?.startsWith('piece-'));

    for (const laser of this.lasers) {
      // Check cooldown
      laser.onCooldown = (now - laser.lastFiredAt) < cooldownMs;

      // Compute coverage
      const bandTop = laser.y - bandHeight / 2;
      const bandBottom = laser.y + bandHeight / 2;
      laser.coverage = this.computeCoverage(bodies, bandTop, bandBottom);

      const hasEnoughCoverage = laser.coverage >= threshold && !laser.onCooldown;

      /**
       * LEARN: The laser has 3 phases:
       * 1. IDLE — coverage below threshold, not charging
       * 2. CHARGING — coverage hit threshold, charge bar filling left→right
       * 3. FIRE — charge bar reached 100%, laser fires and enters cooldown
       *
       * If coverage drops below threshold DURING charging (pieces shift),
       * the charge resets. This adds tension — you need the line to STAY
       * covered for the full charge duration.
       */
      if (hasEnoughCoverage) {
        // Start or continue charging
        if (laser.chargeStartedAt === null) {
          laser.chargeStartedAt = now;
        }
        laser.chargeProgress = Math.min(1, (now - laser.chargeStartedAt) / laser.chargeMs);

        // Fully charged — FIRE
        if (laser.chargeProgress >= 1) {
          this.fireLaser(laser, bodies, bandTop, bandBottom);
          laser.lastFiredAt = now;
          laser.onCooldown = true;
          laser.chargeStartedAt = null;
          laser.chargeProgress = 0;
        }
      } else {
        // Coverage dropped — reset charge
        laser.chargeStartedAt = null;
        laser.chargeProgress = 0;
      }
    }

    this.draw();
  }

  /** Get the number of laser lines */
  getLaserCount(): number {
    return this.lasers.length;
  }

  /** Force-fire a laser by index (0 = bottom, N-1 = top). Ignores cooldown and coverage. */
  forceFire(index: number): void {
    // Index 0 = bottom laser (last in array), so reverse
    const reversed = [...this.lasers].reverse();
    const laser = reversed[index];
    if (!laser) return;

    const bandHeight = TUNING.laser.bandHeight;
    const bandTop = laser.y - bandHeight / 2;
    const bandBottom = laser.y + bandHeight / 2;

    const bodies = this.scene.matter.world.getAllBodies()
      .filter(b => !b.isStatic && b.label?.startsWith('piece-'));

    this.fireLaser(laser, bodies, bandTop, bandBottom);
    laser.lastFiredAt = Date.now();
  }

  /**
   * Compute what fraction of the laser band's width is covered by pieces.
   *
   * LEARN: We use a "scanline" approach — divide the band width into
   * segments and check if each segment overlaps with any piece AABB.
   * This is faster than true polygon intersection and accurate enough
   * for gameplay. We scan at 2px resolution across the play width.
   */
  private computeCoverage(
    bodies: MatterJS.BodyType[],
    bandTop: number,
    bandBottom: number,
  ): number {
    const resolution = 2; // Check every 2 pixels
    const totalSegments = Math.floor(this.playWidth / resolution);
    let coveredSegments = 0;

    // Pre-filter: only bodies whose AABB overlaps the band vertically
    const overlapping = bodies.filter(b =>
      b.bounds.max.y > bandTop && b.bounds.min.y < bandBottom,
    );

    if (overlapping.length === 0) return 0;

    for (let i = 0; i < totalSegments; i++) {
      const x = this.playLeft + i * resolution;

      // Check if any body covers this x position within the band
      for (const body of overlapping) {
        if (x >= body.bounds.min.x && x <= body.bounds.max.x) {
          coveredSegments++;
          break; // This segment is covered, move to next
        }
      }
    }

    return coveredSegments / totalSegments;
  }

  /**
   * Fire a laser — slice pieces at band boundaries, destroy the insides.
   *
   * LEARN: This is the core Tetris-but-physics mechanic. Instead of
   * removing whole pieces, we SLICE each sub-part at the band's top
   * and bottom edges. Portions INSIDE the band are destroyed. Portions
   * ABOVE and BELOW survive as new independent bodies that fall under
   * gravity. This means a tall L-Block spanning the laser gets cut
   * into an upper and lower fragment, with the middle vaporized.
   *
   * The algorithm per sub-part:
   * 1. Split polygon at bandTop (horizontal line) → upper half, lower half
   * 2. Split the lower half at bandBottom → middle slice, bottom piece
   * 3. Keep upper + bottom pieces, destroy middle
   * 4. Create new Matter bodies for survivors
   */
  private fireLaser(
    _laser: LaserLine,
    bodies: MatterJS.BodyType[],
    bandTop: number,
    bandBottom: number,
  ): void {
    const MIN_FRAGMENT_AREA = 80;

    // Collect all parent bodies that overlap the band
    const processed = new Set<number>();
    const victims: MatterJS.BodyType[] = [];

    for (const body of bodies) {
      const parent = (body as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? body;
      if (processed.has(parent.id)) continue;
      if (parent.bounds.max.y > bandTop && parent.bounds.min.y < bandBottom) {
        victims.push(parent);
        processed.add(parent.id);
      }
    }

    for (const parent of victims) {
      const data = getPieceData(parent);
      if (!data) continue;

      // Check if fully inside band — just destroy entirely
      if (parent.bounds.min.y >= bandTop && parent.bounds.max.y <= bandBottom) {
        this.renderer.removeBody(parent);
        this.scene.matter.world.remove(parent);
        continue;
      }

      // Get sub-parts (or the body itself if simple)
      const parts = parent.parts.length > 1
        ? parent.parts.slice(1)
        : [parent];

      const survivors: Array<{ verts: Array<{ x: number; y: number }>; center: { x: number; y: number } }> = [];

      for (const part of parts) {
        if (!part.vertices || part.vertices.length < 3) continue;
        const verts = part.vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y }));

        /**
         * LEARN: splitPolygon divides a polygon by a line with a normal.
         * Normal (0, -1) points UP, so:
         *   "left"  = points where (point.y - lineY) * -1 >= 0 → y <= lineY → ABOVE
         *   "right" = points where (point.y - lineY) * -1 < 0  → y > lineY  → BELOW
         *
         * First cut at bandTop: splits into [above_band, below_bandTop]
         * Second cut at bandBottom: splits below_bandTop into [inside_band, below_band]
         */

        // Cut 1: split at bandTop — normal pointing UP
        const [above, belowTop] = splitPolygon(verts, { x: 0, y: bandTop }, 0, -1);

        // Keep the portion above the band
        if (above.length >= 3 && polygonArea(above) >= MIN_FRAGMENT_AREA) {
          survivors.push({ verts: above, center: polygonCentroid(above) });
        }

        // Cut 2: split the below-top portion at bandBottom
        if (belowTop.length >= 3) {
          const [insideBand, belowBand] = splitPolygon(belowTop, { x: 0, y: bandBottom }, 0, -1);
          // insideBand = the portion between bandTop and bandBottom = DESTROYED
          void insideBand;

          // Keep the portion below the band
          if (belowBand.length >= 3 && polygonArea(belowBand) >= MIN_FRAGMENT_AREA) {
            survivors.push({ verts: belowBand, center: polygonCentroid(belowBand) });
          }
        }
      }

      // Remove original body
      this.renderer.removeBody(parent);
      this.scene.matter.world.remove(parent);

      // Create new bodies for surviving fragments
      for (const frag of survivors) {
        const localVerts = frag.verts.map(v => ({
          x: v.x - frag.center.x,
          y: v.y - frag.center.y,
        }));

        try {
          const fragBody = this.scene.matter.add.fromVertices(
            frag.center.x,
            frag.center.y,
            [localVerts],
            {
              label: `piece-${data.name}-sliced`,
              restitution: data.material.restitution,
              friction: data.material.friction,
              frictionStatic: data.material.frictionStatic,
              frictionAir: data.material.frictionAir ?? 0.01,
              density: data.material.density,
              collisionFilter: {
                category: CollisionCategory.PIECE,
                mask: CollisionCategory.WALL | CollisionCategory.PIECE | 0x0008,
              },
            },
            true,
          );

          // Copy game data to fragment
          (fragBody as MatterJS.BodyType & { gameData: PieceUserData }).gameData = {
            ...data,
            name: `${data.name}-sliced`,
            settled: false,
            createdAt: Date.now(),
          };

          // Inherit parent velocity
          this.scene.matter.body.setVelocity(fragBody, {
            x: parent.velocity.x * 0.3,
            y: parent.velocity.y * 0.3,
          });

          this.renderer.addBody(fragBody);
        } catch {
          // Skip degenerate fragments
        }
      }
    }

    this.eventBus.emit(EventBus.LASER_FIRED, { y: _laser.y });
    this.eventBus.emit(EventBus.LINE_CLEARED, { y: _laser.y });
  }

  /** Draw laser lines with coverage, charge bar, and state visualization */
  private draw(): void {
    this.graphics.clear();
    const bandHeight = TUNING.laser.bandHeight;

    for (const laser of this.lasers) {
      const bandTop = laser.y - bandHeight / 2;

      if (laser.onCooldown) {
        // Cooldown — dim, recharging
        this.graphics.lineStyle(1, 0xff4444, 0.1);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playRight, laser.y);

      } else if (laser.chargeProgress > 0) {
        /**
         * CHARGING — the exciting part. A bright bar sweeps left to right
         * across the band. The band behind the bar glows intensely.
         * When it reaches the right edge, the laser fires.
         */
        // Full band background glow (intensifies as charge progresses)
        this.graphics.fillStyle(0xff2200, 0.1 + laser.chargeProgress * 0.15);
        this.graphics.fillRect(this.playLeft, bandTop, this.playWidth, bandHeight);

        // Charge bar — sweeps left to right
        const chargeWidth = this.playWidth * laser.chargeProgress;
        this.graphics.fillStyle(0xff4400, 0.5 + laser.chargeProgress * 0.3);
        this.graphics.fillRect(this.playLeft, bandTop, chargeWidth, bandHeight);

        // Leading edge glow (bright white line at the charge front)
        const frontX = this.playLeft + chargeWidth;
        this.graphics.lineStyle(2, 0xffaa44, 0.8);
        this.graphics.lineBetween(frontX, bandTop, frontX, bandTop + bandHeight);

        // Center line
        this.graphics.lineStyle(1, 0xff6644, 0.6);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playLeft + chargeWidth, laser.y);

      } else if (laser.coverage > 0.5) {
        // Getting close to threshold — warm glow
        const alpha = 0.05 + (laser.coverage - 0.5) * 0.3;
        this.graphics.fillStyle(0xff6600, alpha);
        this.graphics.fillRect(this.playLeft, bandTop, this.playWidth, bandHeight);
        // Coverage indicator bar
        this.graphics.fillStyle(0xff4444, 0.2);
        this.graphics.fillRect(this.playLeft, bandTop, this.playWidth * laser.coverage, bandHeight);
        this.graphics.lineStyle(1, 0xff4444, 0.3);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playRight, laser.y);

      } else if (laser.coverage > 0.1) {
        // Some coverage — faint
        this.graphics.fillStyle(0xff4444, 0.06);
        this.graphics.fillRect(this.playLeft, bandTop, this.playWidth * laser.coverage, bandHeight);
        this.graphics.lineStyle(1, 0xff4444, 0.12);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playRight, laser.y);

      } else {
        // No coverage — barely visible guide
        this.graphics.lineStyle(1, 0xff4444, 0.06);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playRight, laser.y);
      }
    }
  }
}
