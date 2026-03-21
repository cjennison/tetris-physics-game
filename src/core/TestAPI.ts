/**
 * TestAPI — Exposes game internals for automated testing and AI playtesting
 *
 * LEARN: This is the bridge between Claude (running Playwright externally)
 * and the game (running in a browser). Claude calls methods like
 * page.evaluate(() => __TRASH_TEST.drop()) to control the game, and reads
 * state back with page.evaluate(() => __TRASH_TEST.snapshot()).
 *
 * For AI playtesting, the snapshot() method returns rich board state:
 * every piece position, the height profile, shard count, etc. Claude
 * combines this data with screenshots to make design judgments.
 */
import { GameInstance } from './GameInstance';
import { GameManager } from './GameManager';
import { PIECE_DEFINITIONS } from '../pieces/PieceDefinitions';
import { getAllMaterialKeys } from '../tuning';
import { getPieceData } from '../pieces/PieceFactory';

export interface PieceInfo {
  label: string;
  material: string;
  x: number;
  y: number;
  width: number;
  height: number;
  velocity: { x: number; y: number };
  isShard: boolean;
}

export interface GameSnapshot {
  state: string;
  pieceCount: number;
  shardCount: number;
  activePiece: { shape: string; material: string } | null;
  craneX: number;
  boardWidth: number;
  boardHeight: number;
  /** Y position of the highest piece (lower = taller pile, 0 = top) */
  highestPieceY: number;
  /** Height profile — max piece Y in each of 10 columns across the board */
  heightProfile: number[];
  /** All piece positions and info */
  pieces: PieceInfo[];
  /** How full the board is (0-1, 1 = game over) */
  fillRatio: number;
}

export interface TestAPIInterface {
  getState: () => string;
  getPieceCount: () => number;
  setShape: (name: string) => void;
  setMaterial: (key: string) => void;
  clearOverrides: () => void;
  drop: () => void;
  moveCrane: (x: number) => void;
  waitForState: (state: string, timeoutMs?: number) => Promise<boolean>;
  getShapes: () => string[];
  getMaterials: () => string[];
  getActivePiece: () => { shape: string; material: string } | null;
  snapshot: () => GameSnapshot;
}

export function installTestAPI(manager: GameManager): void {
  const getBoard = (): GameInstance | undefined => {
    return manager.getAllBoards()[0];
  };

  const getPieces = (): PieceInfo[] => {
    const board = getBoard();
    if (!board) return [];
    const bodies = board.matter.world.getAllBodies();
    const pieces: PieceInfo[] = [];
    for (const b of bodies) {
      if (b.isStatic || !b.label?.startsWith('piece-')) continue;
      const data = getPieceData(b);
      pieces.push({
        label: b.label,
        material: data?.materialKey ?? 'unknown',
        x: b.position.x,
        y: b.position.y,
        width: b.bounds.max.x - b.bounds.min.x,
        height: b.bounds.max.y - b.bounds.min.y,
        velocity: { x: b.velocity.x, y: b.velocity.y },
        isShard: data?.name === 'Glass-shard',
      });
    }
    return pieces;
  };

  const api: TestAPIInterface = {
    getState() {
      return getBoard()?.getState() ?? 'unknown';
    },

    getPieceCount() {
      const board = getBoard();
      if (!board) return 0;
      return board.matter.world.getAllBodies()
        .filter(b => !b.isStatic && b.label?.startsWith('piece-')).length;
    },

    setShape(name: string) {
      getBoard()?.getFactory().setForcedShape(name);
    },

    setMaterial(key: string) {
      getBoard()?.getFactory().setForcedMaterial(key);
    },

    clearOverrides() {
      const factory = getBoard()?.getFactory();
      factory?.setForcedShape(null);
      factory?.setForcedMaterial(null);
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
      const pieces = getPieces();
      const boardW = board?.boardConfig.width ?? 480;
      const boardH = board?.boardConfig.height ?? 800;
      const railY = 40; // TUNING.crane.railY
      const floorY = boardH - 20; // boardH - WALL_THICKNESS
      const playHeight = floorY - railY;

      // Find highest piece (smallest Y = tallest pile)
      let highestY = floorY;
      for (const p of pieces) {
        const top = p.y - p.height / 2;
        if (top < highestY) highestY = top;
      }

      // Height profile — divide board into 10 columns, find highest piece in each
      const cols = 10;
      const colWidth = boardW / cols;
      const heightProfile: number[] = new Array(cols).fill(floorY);
      for (const p of pieces) {
        const col = Math.floor(Math.min(p.x / colWidth, cols - 1));
        const top = p.y - p.height / 2;
        if (top < heightProfile[col]!) {
          heightProfile[col] = top;
        }
      }
      // Normalize to 0-1 (0 = empty, 1 = at crane)
      const normalizedProfile = heightProfile.map(y =>
        1 - Math.max(0, Math.min(1, (y - railY) / playHeight)),
      );

      const fillRatio = 1 - Math.max(0, (highestY - railY) / playHeight);

      return {
        state: api.getState(),
        pieceCount: pieces.filter(p => !p.isShard).length,
        shardCount: pieces.filter(p => p.isShard).length,
        activePiece: api.getActivePiece(),
        craneX: board?.getCraneX() ?? 0,
        boardWidth: boardW,
        boardHeight: boardH,
        highestPieceY: highestY,
        heightProfile: normalizedProfile,
        fillRatio,
        pieces,
      };
    },
  };

  (window as unknown as Record<string, unknown>).__TRASH_TEST = api;
}
