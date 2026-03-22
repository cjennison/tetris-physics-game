/**
 * ShovelTool — Bulldozer blade that pushes pieces forward
 *
 * LEARN: Unlike the hook (grabs one piece) or magnet (attracts many),
 * the shovel is a passive physics body — a rectangle attached to the
 * vehicle's front. When the vehicle drives forward, the blade collides
 * with pieces and pushes them. The blade angle is adjustable (up/down
 * controls tilt it), and the action button toggles it raised/lowered.
 *
 * The shovel doesn't use the boom/rope system at all. Instead, it's
 * positioned relative to the chassis. This demonstrates that CraneTool
 * can represent very different attachment styles.
 */
import Phaser from 'phaser';
import { type CraneTool } from './CraneTool';
import { type SpawnedPiece } from '../../pieces/PieceFactory';

const BLADE_WIDTH = 50;
const BLADE_HEIGHT = 8;

export class ShovelTool implements CraneTool {
  readonly name = 'Shovel';
  readonly color = 0xddaa33;
  readonly icon = '🏗️';

  private lowered = false;

  activate(): void {
    /**
     * LEARN: The shovel toggles raised/lowered. When lowered, it
     * interacts with pieces via the vehicle's existing collision.
     * The visual changes to show the blade position.
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
   * LEARN: The shovel draws as a angled blade on the front of the vehicle.
   * When lowered, the blade tilts down to scoop position.
   * When raised, it tilts up out of the way.
   * The hook point serves as the blade's anchor position.
   */
  drawTool(
    graphics: Phaser.GameObjects.Graphics,
    hookX: number,
    hookY: number,
    active: boolean,
    _time: number,
  ): void {
    const bladeAngle = active ? 0.3 : -0.6; // lowered vs raised

    // Blade arm — connects hook point to blade
    graphics.lineStyle(3, 0x997722, 0.9);
    const armEndX = hookX + Math.cos(bladeAngle) * 15;
    const armEndY = hookY + Math.sin(bladeAngle) * 15;
    graphics.lineBetween(hookX, hookY, armEndX, armEndY);

    // Blade — wide rectangle at the end of the arm
    const bladeColor = active ? 0xddaa33 : 0x886622;
    graphics.fillStyle(bladeColor, 0.9);

    // Draw blade as a rotated rectangle
    const bw = BLADE_WIDTH / 2;
    const bh = BLADE_HEIGHT / 2;
    const cos = Math.cos(bladeAngle + Math.PI / 2);
    const sin = Math.sin(bladeAngle + Math.PI / 2);
    const cx = armEndX;
    const cy = armEndY;

    // Four corners of the rotated blade
    const points = [
      { x: cx - bw * cos - bh * sin, y: cy - bw * sin + bh * cos },
      { x: cx + bw * cos - bh * sin, y: cy + bw * sin + bh * cos },
      { x: cx + bw * cos + bh * sin, y: cy + bw * sin - bh * cos },
      { x: cx - bw * cos + bh * sin, y: cy - bw * sin - bh * cos },
    ];

    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < 4; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.fillPath();

    // Blade edge — bright line along the bottom edge
    graphics.lineStyle(2, active ? 0xffcc44 : 0xaa8833, 1);
    graphics.lineBetween(points[0].x, points[0].y, points[1].x, points[1].y);

    // Reinforcement ribs on the blade face
    graphics.lineStyle(1, 0x776611, 0.5);
    for (let i = 1; i < 3; i++) {
      const t = i / 3;
      const ribX1 = points[0].x + (points[1].x - points[0].x) * t;
      const ribY1 = points[0].y + (points[1].y - points[0].y) * t;
      const ribX2 = points[3].x + (points[2].x - points[3].x) * t;
      const ribY2 = points[3].y + (points[2].y - points[3].y) * t;
      graphics.lineBetween(ribX1, ribY1, ribX2, ribY2);
    }

    // Status indicator — small dot
    if (active) {
      graphics.fillStyle(0x44ff44, 0.8);
      graphics.fillCircle(hookX, hookY - 5, 2);
    }
  }

  cleanup(): void {
    this.lowered = false;
  }
}
