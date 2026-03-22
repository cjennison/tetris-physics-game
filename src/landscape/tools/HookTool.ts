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
