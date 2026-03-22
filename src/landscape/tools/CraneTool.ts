/**
 * CraneTool — Interface for swappable crane attachments
 *
 * LEARN: The Strategy pattern lets us swap behaviors at runtime.
 * Each tool implements the same interface but handles grab/release
 * differently. The CraneVehicle doesn't care which tool is active —
 * it just calls activate/deactivate/update on whatever tool is equipped.
 */
import { type SpawnedPiece } from '../../pieces/PieceFactory';

export interface CraneTool {
  /** Unique name for UI display */
  readonly name: string;

  /** Color used for the hook/attachment visual */
  readonly color: number;

  /** Icon character for the HUD */
  readonly icon: string;

  /**
   * Called when the action button is pressed.
   * For hook: grab nearest piece or release carried piece.
   * For magnet: toggle on/off.
   */
  activate(
    scene: Phaser.Scene,
    hookBody: MatterJS.BodyType,
    allBodies: MatterJS.BodyType[],
    vehicleBodies: Set<MatterJS.BodyType>,
  ): void;

  /**
   * Called every frame to update tool-specific physics.
   * For magnet: apply attractive forces to nearby pieces.
   */
  update(
    scene: Phaser.Scene,
    hookBody: MatterJS.BodyType,
    allBodies: MatterJS.BodyType[],
    vehicleBodies: Set<MatterJS.BodyType>,
  ): void;

  /** Get the currently carried/held piece, if any */
  getCarriedPiece(): SpawnedPiece | null;

  /** Get the carried body for drawing the carry line */
  getCarriedBody(): MatterJS.BodyType | null;

  /** Whether the tool is currently "active" (magnet on, hook grabbing, etc.) */
  isActive(): boolean;

  /** Clean up any physics constraints when switching away */
  cleanup(scene: Phaser.Scene): void;
}
