/**
 * InputSystem — Maps raw keyboard/touch input to abstract GameActions
 *
 * LEARN: In game dev, you never read keys directly in your game logic.
 * Instead, you create an "input layer" that translates raw input into
 * abstract actions like { moveLeft, drop }. This has two huge benefits:
 *
 * 1. You can swap input methods (keyboard → touch → gamepad → AI) without
 *    changing any game logic.
 * 2. You can replay actions for debugging or AI training.
 *
 * The GameActions interface is the contract — CraneSystem doesn't know
 * or care whether a human or AI is controlling it.
 */
import Phaser from 'phaser';
import { GameActions } from '../types';
import { WALL_THICKNESS } from '../config';

export class InputSystem {
  private scene: Phaser.Scene;
  private boardWidth: number;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private touchTargetX: number | null = null;
  private touchDrop = false;

  /**
   * LEARN: The crane position is tracked as a normalized value (0-1).
   * 0 = left wall, 1 = right wall. This makes it independent of board size.
   * When the board is resized, the crane stays in the same relative position.
   */
  private currentTarget = 0.5; // Start centered

  constructor(scene: Phaser.Scene, boardWidth: number) {
    this.scene = scene;
    this.boardWidth = boardWidth;
    this.setupKeyboard();
    this.setupTouch();
  }

  /** Read current frame's actions — called once per update() */
  getActions(): GameActions {
    this.pollKeyboard();
    this.pollTouch();

    const drop = this.touchDrop || (this.spaceKey?.isDown ?? false);

    // Reset one-shot flags
    this.touchDrop = false;

    return {
      horizontalTarget: this.currentTarget,
      drop,
    };
  }

  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.spaceKey = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    );
  }

  /**
   * LEARN: Touch input on mobile works differently from keyboard.
   * We use the touch X position relative to the board to set the crane target.
   * A quick tap (pointer down + up within ~200ms without much movement) triggers drop.
   *
   * For mobile: dragging moves the crane, tapping drops the piece.
   */
  private setupTouch(): void {
    const playLeft = WALL_THICKNESS;
    const playRight = this.boardWidth - WALL_THICKNESS;
    const playWidth = playRight - playLeft;

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Map touch X to normalized 0-1 within the play area
      const relX = Phaser.Math.Clamp(
        (pointer.x - playLeft) / playWidth,
        0,
        1,
      );
      this.touchTargetX = relX;
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const relX = Phaser.Math.Clamp(
        (pointer.x - playLeft) / playWidth,
        0,
        1,
      );
      this.touchTargetX = relX;
    });

    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      // Quick tap = drop (small movement, short duration)
      const dist = Phaser.Math.Distance.Between(
        pointer.downX, pointer.downY,
        pointer.upX, pointer.upY,
      );
      const duration = pointer.upTime - pointer.downTime;
      if (dist < 15 && duration < 250) {
        this.touchDrop = true;
      }
      this.touchTargetX = null;
    });
  }

  private pollKeyboard(): void {
    if (!this.cursors) return;

    /**
     * LEARN: We move the target by a small delta each frame rather than
     * jumping to 0 or 1. This gives smooth keyboard control that feels
     * similar to an analog stick. The crane's own lerp smoothing (in
     * CraneSystem) adds another layer of smoothness.
     */
    const speed = 0.02; // ~50 frames to cross the full board
    if (this.cursors.left.isDown) {
      this.currentTarget = Math.max(0, this.currentTarget - speed);
    }
    if (this.cursors.right.isDown) {
      this.currentTarget = Math.min(1, this.currentTarget + speed);
    }
  }

  private pollTouch(): void {
    if (this.touchTargetX !== null) {
      this.currentTarget = this.touchTargetX;
    }
  }
}
