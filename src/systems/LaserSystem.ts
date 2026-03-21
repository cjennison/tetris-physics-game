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
import { PieceRenderer } from './PieceRenderer';
import { EventBus } from '../core/EventBus';

interface LaserLine {
  /** Y position of the laser center */
  y: number;
  /** Coverage ratio 0-1 */
  coverage: number;
  /** Whether coverage >= threshold */
  ready: boolean;
  /** Timestamp of last fire (for cooldown) */
  lastFiredAt: number;
  /** Is this laser currently in cooldown? */
  onCooldown: boolean;
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
  ) {
    this.scene = scene;
    this.renderer = renderer;
    this.eventBus = eventBus;
    this.playLeft = WALL_THICKNESS;
    this.playRight = boardWidth - WALL_THICKNESS;
    this.playWidth = this.playRight - this.playLeft;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(3); // Between walls (0) and pieces (5)

    // Create laser lines evenly spaced across the play area
    const railY = TUNING.crane.railY;
    const floorY = boardHeight - WALL_THICKNESS;
    const playHeight = floorY - railY;
    const spacing = playHeight / (laserCount + 1);

    for (let i = 1; i <= laserCount; i++) {
      this.lasers.push({
        y: railY + spacing * i,
        coverage: 0,
        ready: false,
        lastFiredAt: 0,
        onCooldown: false,
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
      laser.ready = laser.coverage >= threshold && !laser.onCooldown;

      // Fire if ready
      if (laser.ready) {
        this.fireLaser(laser, bodies, bandTop, bandBottom);
        laser.lastFiredAt = now;
        laser.onCooldown = true;
        laser.ready = false;
      }
    }

    this.draw();
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
   * Fire a laser — destroy all piece material within the band.
   *
   * LEARN: When a laser fires, we remove every piece body that overlaps
   * the band. In a future phase (Phase 6), we'll slice pieces at the
   * band boundaries so only the portion INSIDE the band is destroyed.
   * For now, any piece touching the band is fully removed — simpler
   * but still satisfying. The pieces above collapse under gravity.
   */
  private fireLaser(
    laser: LaserLine,
    bodies: MatterJS.BodyType[],
    bandTop: number,
    bandBottom: number,
  ): void {
    // Find all bodies overlapping this band
    const victims = bodies.filter(b =>
      b.bounds.max.y > bandTop && b.bounds.min.y < bandBottom,
    );

    // For each victim, check if it's substantially within the band
    // (at least 30% of its height inside the band = gets destroyed)
    for (const body of victims) {
      const bodyTop = body.bounds.min.y;
      const bodyBottom = body.bounds.max.y;
      const bodyHeight = bodyBottom - bodyTop;
      const overlapTop = Math.max(bodyTop, bandTop);
      const overlapBottom = Math.min(bodyBottom, bandBottom);
      const overlapHeight = Math.max(0, overlapBottom - overlapTop);
      const overlapRatio = overlapHeight / Math.max(bodyHeight, 1);

      if (overlapRatio > 0.3) {
        // Resolve to parent for compound bodies
        const parent = (body as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? body;
        this.renderer.removeBody(parent);
        this.scene.matter.world.remove(parent);
      }
    }

    this.eventBus.emit(EventBus.LASER_FIRED, { y: laser.y });
    this.eventBus.emit(EventBus.LINE_CLEARED, { y: laser.y });
  }

  /** Draw laser lines with coverage and state visualization */
  private draw(): void {
    this.graphics.clear();
    const bandHeight = TUNING.laser.bandHeight;

    for (const laser of this.lasers) {
      const bandTop = laser.y - bandHeight / 2;

      if (laser.onCooldown) {
        // Cooldown — dim red, thin line
        this.graphics.lineStyle(1, 0xff4444, 0.15);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playRight, laser.y);
      } else if (laser.coverage >= TUNING.laser.coverageThreshold) {
        // About to fire — bright pulse (shouldn't stay here long)
        this.graphics.fillStyle(0xff0000, 0.3);
        this.graphics.fillRect(this.playLeft, bandTop, this.playWidth, bandHeight);
      } else if (laser.coverage > 0.5) {
        // Getting close — warm glow
        const alpha = 0.05 + (laser.coverage - 0.5) * 0.4;
        this.graphics.fillStyle(0xff6600, alpha);
        this.graphics.fillRect(this.playLeft, bandTop, this.playWidth, bandHeight);
        // Coverage bar
        this.graphics.fillStyle(0xff4444, 0.3);
        this.graphics.fillRect(
          this.playLeft, bandTop,
          this.playWidth * laser.coverage, bandHeight,
        );
        this.graphics.lineStyle(1, 0xff4444, 0.3);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playRight, laser.y);
      } else if (laser.coverage > 0.1) {
        // Some coverage — faint indicator
        this.graphics.fillStyle(0xff4444, 0.08);
        this.graphics.fillRect(
          this.playLeft, bandTop,
          this.playWidth * laser.coverage, bandHeight,
        );
        this.graphics.lineStyle(1, 0xff4444, 0.15);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playRight, laser.y);
      } else {
        // No coverage — barely visible guide line
        this.graphics.lineStyle(1, 0xff4444, 0.08);
        this.graphics.lineBetween(this.playLeft, laser.y, this.playRight, laser.y);
      }
    }
  }
}
