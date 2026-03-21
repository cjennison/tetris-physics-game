/**
 * EventBus — Cross-system communication
 *
 * LEARN: Systems shouldn't import each other directly. Instead, they emit
 * events ("piece_dropped", "laser_fired") and other systems listen.
 * This is called "loose coupling" — you can add/remove systems without
 * breaking others. Critical for the multi-board AI expansion later.
 */
import Phaser from 'phaser';

/** Singleton event bus shared across all systems within a GameInstance */
export class EventBus extends Phaser.Events.EventEmitter {
  // Event name constants — prevents typos
  static readonly PIECE_SPAWNED = 'piece_spawned';
  static readonly PIECE_DROPPED = 'piece_dropped';
  static readonly PIECE_SETTLED = 'piece_settled';
  static readonly LASER_FIRED = 'laser_fired';
  static readonly LASER_READY = 'laser_ready';
  static readonly LINE_CLEARED = 'line_cleared';
  static readonly SCORE_CHANGED = 'score_changed';
  static readonly GAME_OVER = 'game_over';
  static readonly STATE_CHANGED = 'state_changed';
}
