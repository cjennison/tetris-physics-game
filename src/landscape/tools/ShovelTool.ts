/**
 * ShovelTool — Bulldozer blade that pushes pieces forward
 *
 * LEARN: A real bulldozer has a large C-shaped (concave) blade mounted
 * on TWO short hydraulic arms that connect to the vehicle chassis.
 * The blade is wider than the vehicle and cups forward to push material.
 * The arms are SHORT — nothing like a crane boom. The blade pivots at
 * its midpoint so it can tilt to scoop or lift.
 *
 * The shovel doesn't use the boom/rope system at all. Instead, it's
 * positioned relative to the chassis via the hook point. This shows
 * that CraneTool can represent very different attachment styles.
 */
import Phaser from 'phaser';
import { type CraneTool } from './CraneTool';
import { type SpawnedPiece } from '../../pieces/PieceFactory';

/**
 * LEARN: Real bulldozer proportions — the blade is much wider than
 * the arms are long. A CAT D6 blade is ~3.5m wide but the push arms
 * are only ~1.2m long. We keep similar ratios here.
 */
const BLADE_WIDTH = 60;
const BLADE_CURVE_DEPTH = 18;
const ARM_LENGTH = 20;
const BLADE_THICKNESS = 4;
const PISTON_OFFSET = 6;

export class ShovelTool implements CraneTool {
  readonly name = 'Shovel';
  readonly color = 0xddaa33;
  readonly icon = '🏗️';

  private lowered = false;

  activate(): void {
    /**
     * LEARN: The shovel toggles raised/lowered. When lowered, the
     * blade drops to ground level for scooping. When raised, the
     * hydraulic arms lift the blade up and the blade tilts back.
     */
    this.lowered = !this.lowered;
  }

  update(): void {
    /**
     * LEARN: The shovel doesn't need per-frame force application
     * like the magnet. Physics collisions handle pushing automatically —
     * when the vehicle drives into pieces with the blade lowered,
     * Matter.js collision response pushes them. We just need to
     * render the blade position correctly.
     */
  }

  getCarriedPiece(): SpawnedPiece | null {
    return null;
  }

  getCarriedBody(): MatterJS.BodyType | null {
    return null;
  }

  isActive(): boolean {
    return this.lowered;
  }

  /**
   * LEARN: Drawing a bulldozer blade from the hook point. The hook
   * point is at the end of the boom/rope — we treat it as the
   * attachment point where the arms connect to the vehicle.
   *
   * Anatomy of what we draw:
   * 1. Two short parallel push arms from hook point forward
   * 2. Two hydraulic pistons (angled) from hook point to blade
   * 3. A large C-shaped curved blade at the end of the arms
   * 4. The C pivots at its midpoint — tilts for scoop vs raised
   * 5. Reinforcement ribs on the back of the blade
   * 6. A cutting edge along the bottom of the blade
   */
  drawTool(
    graphics: Phaser.GameObjects.Graphics,
    hookX: number,
    hookY: number,
    active: boolean,
    _time: number,
  ): void {
    /**
     * LEARN: The pivot angle determines blade tilt. When lowered (active),
     * the blade tilts forward to cup and scoop. When raised, it tilts
     * back so material slides off. The C-shape pivots at its midpoint.
     */
    const pivotAngle = active ? 0.25 : -0.45;

    // Blade center — at the end of the short arms, in front of the hook point
    const bladeCenterX = hookX + ARM_LENGTH;
    const bladeCenterY = hookY;

    // === TWO SHORT PUSH ARMS ===
    // LEARN: Bulldozers have two arms (left and right of center)
    // that connect the chassis to the blade. They're thick and short.
    const armSpacing = 12;
    const armColor = 0x887733;

    // Upper arm
    graphics.lineStyle(4, armColor, 0.95);
    graphics.lineBetween(
      hookX, hookY - armSpacing / 2,
      bladeCenterX, bladeCenterY - armSpacing / 2,
    );

    // Lower arm
    graphics.lineBetween(
      hookX, hookY + armSpacing / 2,
      bladeCenterX, bladeCenterY + armSpacing / 2,
    );

    // Arm pivot bolts (circles at each end)
    graphics.fillStyle(0x555555, 1);
    graphics.fillCircle(hookX, hookY - armSpacing / 2, 2);
    graphics.fillCircle(hookX, hookY + armSpacing / 2, 2);
    graphics.fillCircle(bladeCenterX, bladeCenterY - armSpacing / 2, 2);
    graphics.fillCircle(bladeCenterX, bladeCenterY + armSpacing / 2, 2);

    // === HYDRAULIC PISTONS ===
    // LEARN: Hydraulic pistons run at an angle from the chassis to the
    // blade, providing the force to raise/lower. They're thinner than
    // the arms and have a chrome/silver look.
    const pistonBaseY1 = hookY - armSpacing / 2 - PISTON_OFFSET;
    const pistonBaseY2 = hookY + armSpacing / 2 + PISTON_OFFSET;
    const pistonTipX = bladeCenterX - 4;

    // Piston cylinder (outer) — darker
    graphics.lineStyle(3, 0x666666, 0.9);
    graphics.lineBetween(hookX + 2, pistonBaseY1, pistonTipX, bladeCenterY - 3);
    graphics.lineBetween(hookX + 2, pistonBaseY2, pistonTipX, bladeCenterY + 3);

    // Piston rod (inner) — chrome highlight
    graphics.lineStyle(1.5, 0xaaaaaa, 0.8);
    graphics.lineBetween(hookX + 2, pistonBaseY1, pistonTipX, bladeCenterY - 3);
    graphics.lineBetween(hookX + 2, pistonBaseY2, pistonTipX, bladeCenterY + 3);

    // === C-SHAPED BULLDOZER BLADE ===
    // LEARN: The blade is a large concave curve (C-shape) that cups
    // forward. We draw it as a thick curved path. The C pivots at
    // bladeCenterX/Y (its midpoint). The curve opens toward the push
    // direction (right/forward).
    const halfW = BLADE_WIDTH / 2;
    const bladeColor = active ? 0xddaa33 : 0x997722;

    // Generate C-curve points. The curve goes from top to bottom,
    // bowing outward (to the right) to form the scoop shape.
    const curvePoints: Array<{ x: number; y: number }> = [];
    const innerPoints: Array<{ x: number; y: number }> = [];
    const segments = 16;

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      // Parametric position along the blade height (top to bottom)
      const localY = -halfW + t * BLADE_WIDTH;

      // C-curve depth: deepest at center, zero at edges (parabolic)
      const curveFactor = 1 - Math.pow(2 * t - 1, 2);
      const curveX = BLADE_CURVE_DEPTH * curveFactor;

      // Apply pivot rotation around blade center
      const cos = Math.cos(pivotAngle);
      const sin = Math.sin(pivotAngle);

      // Outer edge of blade (the scooping face)
      const outerLocalX = curveX;
      const outerLocalY = localY;
      curvePoints.push({
        x: bladeCenterX + outerLocalX * cos - outerLocalY * sin,
        y: bladeCenterY + outerLocalX * sin + outerLocalY * cos,
      });

      // Inner edge of blade (back face, offset inward by thickness)
      const innerLocalX = curveX - BLADE_THICKNESS;
      innerPoints.push({
        x: bladeCenterX + innerLocalX * cos - outerLocalY * sin,
        y: bladeCenterY + innerLocalX * sin + outerLocalY * cos,
      });
    }

    // Fill the blade as a closed polygon (outer curve + inner curve reversed)
    graphics.fillStyle(bladeColor, 0.95);
    graphics.beginPath();
    graphics.moveTo(curvePoints[0].x, curvePoints[0].y);
    for (let i = 1; i < curvePoints.length; i++) {
      graphics.lineTo(curvePoints[i].x, curvePoints[i].y);
    }
    // Close across the bottom edge
    graphics.lineTo(innerPoints[innerPoints.length - 1].x, innerPoints[innerPoints.length - 1].y);
    for (let i = innerPoints.length - 2; i >= 0; i--) {
      graphics.lineTo(innerPoints[i].x, innerPoints[i].y);
    }
    graphics.closePath();
    graphics.fillPath();

    // Blade outer edge highlight — the cutting/scooping edge
    graphics.lineStyle(2.5, active ? 0xffdd55 : 0xbb9933, 1);
    graphics.beginPath();
    graphics.moveTo(curvePoints[0].x, curvePoints[0].y);
    for (let i = 1; i < curvePoints.length; i++) {
      graphics.lineTo(curvePoints[i].x, curvePoints[i].y);
    }
    graphics.strokePath();

    // Inner edge (back of blade) — darker shadow
    graphics.lineStyle(1.5, 0x665511, 0.7);
    graphics.beginPath();
    graphics.moveTo(innerPoints[0].x, innerPoints[0].y);
    for (let i = 1; i < innerPoints.length; i++) {
      graphics.lineTo(innerPoints[i].x, innerPoints[i].y);
    }
    graphics.strokePath();

    // === REINFORCEMENT RIBS ===
    // LEARN: Real blades have vertical ribs welded to the back for
    // structural strength. We draw 3 ribs across the blade.
    graphics.lineStyle(1.5, 0x776611, 0.6);
    for (let r = 1; r <= 3; r++) {
      const ribIdx = Math.floor((r / 4) * segments);
      const outerPt = curvePoints[ribIdx];
      const innerPt = innerPoints[ribIdx];
      // Extend rib slightly past inner edge for visual weight
      const ribExtendX = innerPt.x - (outerPt.x - innerPt.x) * 0.6;
      const ribExtendY = innerPt.y - (outerPt.y - innerPt.y) * 0.6;
      graphics.lineBetween(innerPt.x, innerPt.y, ribExtendX, ribExtendY);
    }

    // === CUTTING EDGE ===
    // LEARN: The bottom edge of a bulldozer blade has a hardened
    // steel cutting edge (replaceable wear part). We highlight
    // the bottom tip of the C with a brighter, thicker line.
    const bottomOuter = curvePoints[curvePoints.length - 1];
    const bottomInner = innerPoints[innerPoints.length - 1];
    const topOuter = curvePoints[0];
    const topInner = innerPoints[0];

    graphics.lineStyle(2, 0xeecc44, 0.9);
    graphics.lineBetween(bottomOuter.x, bottomOuter.y, bottomInner.x, bottomInner.y);
    graphics.lineBetween(topOuter.x, topOuter.y, topInner.x, topInner.y);

    // === STATUS INDICATOR ===
    if (active) {
      graphics.fillStyle(0x44ff44, 0.8);
      graphics.fillCircle(hookX, hookY - armSpacing, 2.5);
    }
  }

  cleanup(): void {
    this.lowered = false;
  }
}
