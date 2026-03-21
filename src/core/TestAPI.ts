/**
 * TestAPI — Exposes game internals for automated testing via Playwright
 *
 * LEARN: Automated game testing needs two things:
 * 1. A way to DRIVE the game (force pieces, simulate input, trigger drops)
 * 2. A way to READ state (what state are we in, how many pieces, positions)
 *
 * We expose these as methods on window.__TRASH_TEST. Playwright can call
 * them via page.evaluate(() => window.__TRASH_TEST.drop()). This is how
 * professional game studios do automated QA — the game exposes a "test
 * harness" API that automated tools can control.
 */
import { GameInstance } from './GameInstance';
import { GameManager } from './GameManager';
import { PIECE_DEFINITIONS } from '../pieces/PieceDefinitions';
import { getAllMaterialKeys } from '../tuning';

export interface TestAPIInterface {
  /** Get the current game state (spawning, swinging, dropping, etc.) */
  getState: () => string;
  /** Get count of all piece bodies in the physics world */
  getPieceCount: () => number;
  /** Force the next piece shape */
  setShape: (name: string) => void;
  /** Force the next piece material */
  setMaterial: (key: string) => void;
  /** Simulate dropping the current piece */
  drop: () => void;
  /** Move the crane to a normalized position (0=left, 1=right) */
  moveCrane: (x: number) => void;
  /** Wait for the game to reach a specific state (returns a promise) */
  waitForState: (state: string, timeoutMs?: number) => Promise<boolean>;
  /** Get all available shape names */
  getShapes: () => string[];
  /** Get all available material keys */
  getMaterials: () => string[];
  /** Get info about the currently active piece */
  getActivePiece: () => { shape: string; material: string } | null;
  /** Take a snapshot of the full game state */
  snapshot: () => GameSnapshot;
}

export interface GameSnapshot {
  state: string;
  pieceCount: number;
  activePiece: { shape: string; material: string } | null;
  craneX: number;
  boardWidth: number;
  boardHeight: number;
}

export function installTestAPI(manager: GameManager): void {
  const getBoard = (): GameInstance | undefined => {
    return manager.getAllBoards()[0];
  };

  const api: TestAPIInterface = {
    getState() {
      return getBoard()?.getState() ?? 'unknown';
    },

    getPieceCount() {
      const board = getBoard();
      if (!board) return 0;
      // Access the matter world via the scene
      const bodies = board.matter.world.getAllBodies();
      return bodies.filter(b => !b.isStatic && b.label?.startsWith('piece-')).length;
    },

    setShape(name: string) {
      getBoard()?.getFactory().setForcedShape(name);
    },

    setMaterial(key: string) {
      getBoard()?.getFactory().setForcedMaterial(key);
    },

    drop() {
      getBoard()?.testDrop();
    },

    moveCrane(x: number) {
      getBoard()?.testMoveCrane(x);
    },

    async waitForState(state: string, timeoutMs = 5000): Promise<boolean> {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        if (api.getState() === state) return true;
        await new Promise(r => setTimeout(r, 50));
      }
      return false;
    },

    getShapes() {
      return PIECE_DEFINITIONS.map(d => d.name);
    },

    getMaterials() {
      return getAllMaterialKeys();
    },

    getActivePiece() {
      return getBoard()?.getActivePieceInfo() ?? null;
    },

    snapshot() {
      const board = getBoard();
      return {
        state: api.getState(),
        pieceCount: api.getPieceCount(),
        activePiece: api.getActivePiece(),
        craneX: board?.getCraneX() ?? 0,
        boardWidth: board?.boardConfig.width ?? 0,
        boardHeight: board?.boardConfig.height ?? 0,
      };
    },
  };

  (window as unknown as Record<string, unknown>).__TRASH_TEST = api;
}
