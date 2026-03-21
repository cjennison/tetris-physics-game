/**
 * CraneVehicle — A driveable crane that picks up trash and delivers to columns
 *
 * LEARN: The crane vehicle is the player's avatar in the landscape.
 * It drives left/right on the ground, has a magnet arm that can grab
 * the topmost piece from the trash pile, and delivers it to a
 * processing column by driving over the column opening and releasing.
 *
 * The grabbed piece hangs from the vehicle's arm via a constraint,
 * swinging as the vehicle accelerates/brakes — similar to the column
 * crane but horizontal instead of vertical.
 *
 * Controls:
 *   Arrow Left/Right: drive
 *   Space or Up: grab from pile / deliver to column (context-sensitive)
 */
import Phaser from 'phaser';
import { CollisionCategory } from '../types';
import { type SpawnedPiece } from '../pieces/PieceFactory';
import { PieceRenderer } from '../systems/PieceRenderer';
import {
  VEHICLE_Y,
  VEHICLE_WIDTH,
  VEHICLE_HEIGHT,
  VEHICLE_SPEED,
  PILE_LEFT,
  PILE_RIGHT,
} from '../config';

type VehicleState = 'driving' | 'carrying';

export class CraneVehicle {
  private scene: Phaser.Scene;
  private renderer: PieceRenderer;
  private graphics: Phaser.GameObjects.Graphics;

  private x: number;
  private state: VehicleState = 'driving';

  /** The piece currently being carried */
  private carriedPiece: SpawnedPiece | null = null;
  private carriedBody: MatterJS.BodyType | null = null;
  /** Constraint holding the piece to the vehicle arm */
  private carryConstraint: MatterJS.ConstraintType | null = null;
  /** The arm anchor — a static body that moves with the vehicle */
  private armAnchor: MatterJS.BodyType;

  /** Keyboard input */
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private spaceJustPressed = false;

  /** Callback for grab action */
  private onGrab: (() => SpawnedPiece | null) | null = null;

  /** Column zones — regions where delivering is possible */
  private columnZones: Array<{ left: number; right: number; deliver: (piece: SpawnedPiece) => boolean }> = [];

  constructor(scene: Phaser.Scene, renderer: PieceRenderer, startX: number) {
    this.scene = scene;
    this.renderer = renderer;
    this.x = startX;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(12);

    // Create the arm anchor — invisible static body that moves with the vehicle
    this.armAnchor = scene.matter.add.rectangle(
      this.x, VEHICLE_Y - VEHICLE_HEIGHT, 4, 4,
      {
        isStatic: true,
        label: 'vehicle-arm',
        collisionFilter: { category: CollisionCategory.CRANE, mask: 0 },
      },
    );

    this.setupInput();
  }

  /** Set the grab callback (called when player presses action near the pile) */
  setGrabCallback(cb: () => SpawnedPiece | null): void {
    this.onGrab = cb;
  }

  /** Register a column zone where delivery is possible */
  addColumnZone(left: number, right: number, deliver: (piece: SpawnedPiece) => boolean): void {
    this.columnZones.push({ left, right, deliver });
  }

  update(): void {
    this.handleInput();
    this.updateArmPosition();
    this.draw();
  }

  private handleInput(): void {
    if (!this.cursors) return;

    // Drive left/right
    if (this.cursors.left.isDown) {
      this.x -= VEHICLE_SPEED;
    }
    if (this.cursors.right.isDown) {
      this.x += VEHICLE_SPEED;
    }

    // Clamp to landscape bounds
    this.x = Phaser.Math.Clamp(this.x, 30, 1170);

    // Action button (space or up)
    const actionPressed = this.spaceJustPressed;
    this.spaceJustPressed = false;

    if (actionPressed) {
      if (this.state === 'driving' && !this.carriedPiece) {
        // Try to grab from pile
        if (this.isNearPile() && this.onGrab) {
          const piece = this.onGrab();
          if (piece) this.grabPiece(piece);
        }
      } else if (this.state === 'carrying' && this.carriedPiece) {
        // Try to deliver to a column
        const zone = this.columnZones.find(z => this.x >= z.left && this.x <= z.right);
        if (zone) {
          const success = zone.deliver(this.carriedPiece);
          if (success) this.releasePiece();
        }
      }
    }
  }

  private grabPiece(piece: SpawnedPiece): void {
    this.carriedPiece = piece;
    this.carriedBody = piece.body;

    // Position piece at the arm
    this.scene.matter.body.setPosition(piece.body, {
      x: this.x,
      y: VEHICLE_Y - VEHICLE_HEIGHT - 30,
    });
    this.scene.matter.body.setVelocity(piece.body, { x: 0, y: 0 });

    // Create carry constraint
    this.carryConstraint = this.scene.matter.add.constraint(
      this.armAnchor,
      piece.body,
      25, // short rope
      0.8,
      { damping: 0.05, label: 'vehicle-carry' },
    );

    this.renderer.addBody(piece.body);
    this.state = 'carrying';
  }

  private releasePiece(): void {
    if (this.carryConstraint) {
      this.scene.matter.world.removeConstraint(this.carryConstraint);
      this.carryConstraint = null;
    }
    // Remove the carried body — the column's receivePiece creates a fresh one
    if (this.carriedBody) {
      this.renderer.removeBody(this.carriedBody);
      this.scene.matter.world.remove(this.carriedBody);
    }
    this.carriedPiece = null;
    this.carriedBody = null;
    this.state = 'driving';
  }

  private isNearPile(): boolean {
    return this.x >= PILE_LEFT && this.x <= PILE_RIGHT + 50;
  }

  private updateArmPosition(): void {
    this.scene.matter.body.setPosition(this.armAnchor, {
      x: this.x,
      y: VEHICLE_Y - VEHICLE_HEIGHT,
    });
    this.scene.matter.body.setVelocity(this.armAnchor, { x: 0, y: 0 });
  }

  private setupInput(): void {
    if (!this.scene.input.keyboard) return;
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.spaceKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.spaceKey.on('down', () => {
      this.spaceJustPressed = true;
    });
  }

  private draw(): void {
    this.graphics.clear();

    // Vehicle body
    this.graphics.fillStyle(0xaa8833);
    this.graphics.fillRect(
      this.x - VEHICLE_WIDTH / 2,
      VEHICLE_Y - VEHICLE_HEIGHT,
      VEHICLE_WIDTH,
      VEHICLE_HEIGHT,
    );

    // Wheels
    this.graphics.fillStyle(0x333333);
    this.graphics.fillCircle(this.x - VEHICLE_WIDTH / 3, VEHICLE_Y - 3, 8);
    this.graphics.fillCircle(this.x + VEHICLE_WIDTH / 3, VEHICLE_Y - 3, 8);

    // Crane arm (vertical line from vehicle)
    const armTopY = VEHICLE_Y - VEHICLE_HEIGHT - 40;
    this.graphics.lineStyle(3, 0xaa8833, 0.8);
    this.graphics.lineBetween(this.x, VEHICLE_Y - VEHICLE_HEIGHT, this.x, armTopY);

    // Arm head
    this.graphics.fillStyle(0xccaa44);
    this.graphics.fillRect(this.x - 8, armTopY - 4, 16, 8);

    // Carry line to piece
    if (this.carriedBody) {
      this.graphics.lineStyle(2, 0xcccccc, 0.5);
      this.graphics.lineBetween(
        this.x, armTopY,
        this.carriedBody.position.x, this.carriedBody.position.y,
      );
    }

    // Action hint
    if (this.state === 'driving' && this.isNearPile()) {
      this.graphics.fillStyle(0x44aa44, 0.15);
      this.graphics.fillRect(this.x - 30, VEHICLE_Y - VEHICLE_HEIGHT - 50, 60, 20);
    }

    // State label
    const label = this.state === 'carrying' ? 'CARRYING' : '';
    if (label) {
      // This redraws every frame but it's simple enough
      this.scene.add.text(this.x, VEHICLE_Y - VEHICLE_HEIGHT - 55, label, {
        fontSize: '9px', color: '#ccaa44', fontFamily: 'monospace',
      }).setOrigin(0.5).setDepth(13).setName('vehicle-label');

      // Clean up previous labels
      this.scene.children.list
        .filter(c => c.name === 'vehicle-label' && c !== this.scene.children.list[this.scene.children.list.length - 1])
        .forEach(c => c.destroy());
    }
  }
}
