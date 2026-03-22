/**
 * VehicleManager — Handles vehicle spawning and swapping
 *
 * LEARN: Instead of swapping tools on one vehicle, we swap entire vehicles.
 * When the player presses TAB (or the vehicle swap button), the current
 * vehicle is fully destroyed (all physics bodies removed) and a new one
 * spawns at the same position. This is a clean approach because each
 * vehicle type has completely different physics bodies — you can't just
 * "morph" a crane into a bulldozer. Destruction + respawn is simpler
 * and less error-prone than trying to reconfigure bodies in place.
 *
 * The VehicleManager also re-registers column zones on the new vehicle
 * so piece delivery continues working regardless of which vehicle is active.
 */
import { type Vehicle, type VehicleType, VEHICLE_TYPES, type ColumnZone } from './Vehicle';
import { HookCraneVehicle } from './HookCraneVehicle';
import { MagnetBallVehicle } from './MagnetBallVehicle';
import { BulldozerVehicle } from './BulldozerVehicle';
import { type SpawnedPiece } from '../../pieces/PieceFactory';
import { TouchControls } from '../../ui/TouchControls';

export class VehicleManager {
  private scene: Phaser.Scene;
  private touchControls: TouchControls;
  private currentVehicle: Vehicle;
  private currentTypeIndex = 0;
  private columnZones: ColumnZone[] = [];

  /** Keyboard listener for TAB */
  private tabJustPressed = false;

  constructor(scene: Phaser.Scene, startX: number, touchControls: TouchControls) {
    this.scene = scene;
    this.touchControls = touchControls;

    // Start with the hook crane (the original vehicle)
    this.currentVehicle = this.createVehicle('hook-crane', startX);

    this.setupSwapInput();
  }

  /** Get the active vehicle */
  getVehicle(): Vehicle {
    return this.currentVehicle;
  }

  /** Register a column delivery zone (persists across vehicle swaps) */
  addColumnZone(left: number, right: number, deliver: (piece: SpawnedPiece) => boolean): void {
    this.columnZones.push({ left, right, deliver });
    this.currentVehicle.addColumnZone(left, right, deliver);
  }

  /**
   * LEARN: Per-frame update flow:
   * 1. Peek at touch state (non-destructive) to check for vehicle swap
   * 2. If swap requested, consume the state via getState() and do the swap
   * 3. Otherwise, let the vehicle's update() consume the state normally
   */
  update(): void {
    const peek = this.touchControls.peekState();
    if (this.tabJustPressed || peek.switchTool) {
      this.tabJustPressed = false;
      // Consume the touch state so the new vehicle doesn't see stale input
      this.touchControls.getState();
      this.swapToNext();
    }

    this.currentVehicle.update();
  }

  /** Get vehicle position for camera following */
  getPosition(): { x: number; y: number } {
    return this.currentVehicle.getPosition();
  }

  /**
   * LEARN: Swapping vehicles destroys the old one entirely and creates
   * a new one at the same position. This is the cleanest approach because
   * each vehicle type has completely different physics bodies.
   */
  private swapToNext(): void {
    const pos = this.currentVehicle.getPosition();
    this.currentVehicle.destroy();

    this.currentTypeIndex = (this.currentTypeIndex + 1) % VEHICLE_TYPES.length;
    const nextType = VEHICLE_TYPES[this.currentTypeIndex];
    this.currentVehicle = this.createVehicle(nextType, pos.x);

    // Re-register column zones on the new vehicle
    for (const zone of this.columnZones) {
      this.currentVehicle.addColumnZone(zone.left, zone.right, zone.deliver);
    }
  }

  private createVehicle(type: VehicleType, startX: number): Vehicle {
    switch (type) {
      case 'hook-crane':
        return new HookCraneVehicle(this.scene, startX, this.touchControls);
      case 'magnet-ball':
        return new MagnetBallVehicle(this.scene, startX, this.touchControls);
      case 'bulldozer':
        return new BulldozerVehicle(this.scene, startX, this.touchControls);
    }
  }

  private setupSwapInput(): void {
    if (!this.scene.input.keyboard) return;
    const tabKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TAB);
    tabKey.on('down', () => { this.tabJustPressed = true; });
  }
}
