/**
 * Vehicle — Base interface for all vehicle types in TRASH
 *
 * LEARN: This is the Strategy pattern at the vehicle level. Instead of one
 * CraneVehicle with swappable tools, we have completely different vehicle
 * types — each with its own body shape, physics, controls, and rendering.
 * A hook crane looks nothing like a bulldozer, so they shouldn't share
 * a base class with forced inheritance. An interface defines "what can
 * a vehicle do" without dictating "how it's built".
 *
 * When the player swaps vehicles, the old one is fully destroyed and a
 * new one spawns at the same position. This is simpler and more flexible
 * than trying to morph one vehicle into another.
 */
import { type SpawnedPiece } from '../../pieces/PieceFactory';

export interface ColumnZone {
  left: number;
  right: number;
  deliver: (piece: SpawnedPiece) => boolean;
}

export interface Vehicle {
  /** Unique type identifier */
  readonly type: string;

  /** Display name for the HUD */
  readonly displayName: string;

  /** Icon for the vehicle swap button */
  readonly icon: string;

  /** Get chassis position for camera following */
  getPosition(): { x: number; y: number };

  /** Register a column delivery zone */
  addColumnZone(left: number, right: number, deliver: (piece: SpawnedPiece) => boolean): void;

  /** Per-frame update — handle input, physics, rendering */
  update(): void;

  /** Remove all physics bodies and graphics from the scene */
  destroy(): void;
}

/**
 * LEARN: The vehicle type enum is used by the VehicleManager to know
 * which class to instantiate. Adding a new vehicle type means:
 * 1. Add an entry here
 * 2. Create the vehicle class implementing Vehicle
 * 3. Add a case in VehicleManager.createVehicle()
 */
export type VehicleType = 'hook-crane' | 'magnet-ball' | 'bulldozer';

export const VEHICLE_TYPES: VehicleType[] = ['hook-crane', 'magnet-ball', 'bulldozer'];
