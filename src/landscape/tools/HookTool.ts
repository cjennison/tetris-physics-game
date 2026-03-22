/**
 * HookTool — The classic crane hook that grabs and carries one piece
 *
 * LEARN: This extracts the existing grab/release logic from CraneVehicle
 * into a standalone tool. The hook attaches to the nearest piece with a
 * physics constraint, letting it swing naturally on the rope.
 */
import Phaser from 'phaser';
import { type CraneTool } from './CraneTool';
import { type SpawnedPiece, getPieceData } from '../../pieces/PieceFactory';

const GRAB_RADIUS = 45;

export class HookTool implements CraneTool {
  readonly name = 'Hook';
  readonly color = 0xcccccc;
  readonly icon = '🪝';

  private carriedPiece: SpawnedPiece | null = null;
  private carriedBody: MatterJS.BodyType | null = null;
  private carryConstraint: MatterJS.ConstraintType | null = null;

  activate(
    scene: Phaser.Scene,
    hookBody: MatterJS.BodyType,
    allBodies: MatterJS.BodyType[],
    vehicleBodies: Set<MatterJS.BodyType>,
  ): void {
    if (!this.carriedPiece) {
      // Try to grab the nearest piece
      const hookPos = hookBody.position;
      let closest: MatterJS.BodyType | null = null;
      let closestDist = GRAB_RADIUS;

      for (const body of allBodies) {
        if (body.isStatic) continue;
        if (!body.label?.startsWith('piece-')) continue;
        if (vehicleBodies.has(body)) continue;
        const dx = body.position.x - hookPos.x;
        const dy = body.position.y - hookPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < closestDist) { closestDist = dist; closest = body; }
      }

      if (closest) {
        const parent = (closest as MatterJS.BodyType & { parent?: MatterJS.BodyType }).parent ?? closest;
        const data = getPieceData(parent);
        if (data) {
          this.carriedBody = parent;
          this.carriedPiece = {
            body: parent,
            definition: { name: data.name, vertices: data.originalVertices, color: data.color },
            materialKey: data.materialKey,
            material: data.material,
          };
          this.carryConstraint = scene.matter.add.constraint(
            hookBody, parent, 8, 0.8,
            { damping: 0.05, label: 'tool-hook-carry' },
          );
        }
      }
    } else {
      // Release the carried piece
      this.releaseCarried(scene);
    }
  }

  update(): void {
    // Hook doesn't need per-frame updates — physics constraints handle it
  }

  getCarriedPiece(): SpawnedPiece | null {
    return this.carriedPiece;
  }

  getCarriedBody(): MatterJS.BodyType | null {
    return this.carriedBody;
  }

  isActive(): boolean {
    return this.carriedPiece !== null;
  }

  /**
   * LEARN: The hook draws as a classic crane hook shape — a thick curved
   * line with a pointed tip. When carrying a piece, it glows green.
   * The shape is drawn relative to (hookX, hookY) using arc() for the curve.
   */
  drawTool(
    graphics: Phaser.GameObjects.Graphics,
    hookX: number,
    hookY: number,
    active: boolean,
    _time: number,
  ): void {
    const color = active ? 0x44aa44 : 0xcccccc;

    // Hook shank (vertical bar from rope attachment)
    graphics.lineStyle(3, color, 0.9);
    graphics.lineBetween(hookX, hookY - 4, hookX, hookY + 4);

    // Hook curve — a C-shaped arc opening to the right
    graphics.lineStyle(2.5, color, 0.9);
    graphics.beginPath();
    graphics.arc(hookX - 3, hookY + 4, 6, 0, Math.PI, false);
    graphics.strokePath();

    // Hook tip — small pointed end
    graphics.fillStyle(color, 1);
    graphics.fillTriangle(
      hookX - 9, hookY + 4,
      hookX - 10, hookY - 1,
      hookX - 7, hookY + 2,
    );

    // Safety latch (small bar across the opening)
    graphics.lineStyle(1.5, 0x999999, 0.6);
    graphics.lineBetween(hookX - 1, hookY + 1, hookX + 2, hookY + 6);
  }

  cleanup(scene: Phaser.Scene): void {
    this.releaseCarried(scene);
  }

  private releaseCarried(scene: Phaser.Scene): void {
    if (this.carryConstraint) {
      scene.matter.world.removeConstraint(this.carryConstraint);
      this.carryConstraint = null;
    }
    this.carriedPiece = null;
    this.carriedBody = null;
  }
}
