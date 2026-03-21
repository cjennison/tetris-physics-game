/**
 * AI Playtest Script — Claude plays TRASH and writes a report
 *
 * This script launches the game in a real browser, plays multiple rounds
 * with different strategies, takes screenshots, and outputs a structured
 * JSON report that Claude can analyze to make design decisions.
 *
 * Usage: npx tsx scripts/playtest.ts [--rounds 10] [--strategy all]
 *
 * Strategies:
 *   center  — drop everything in the center
 *   sweep   — sweep left to right across the board
 *   random  — random positions
 *   swing   — swing hard then drop at peak momentum
 *   glass   — force all glass pieces to test shatter behavior
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const GAME_URL = process.env.GAME_URL || 'http://localhost:5173';
const ROUNDS = parseInt(process.env.ROUNDS || '8', 10);
const STRATEGY = process.env.STRATEGY || 'all';
const OUTPUT_DIR = path.join(process.cwd(), 'playtest-results');

interface DropResult {
  round: number;
  strategy: string;
  piece: { shape: string; material: string } | null;
  craneX: number;
  pieceCountBefore: number;
  pieceCountAfter: number;
  shardCountAfter: number;
  settleTimeMs: number;
  shattered: boolean;
  screenshot: string;
}

interface PlaytestReport {
  timestamp: string;
  gameUrl: string;
  totalRounds: number;
  strategies: string[];
  drops: DropResult[];
  finalSnapshot: Record<string, unknown>;
  finalScreenshot: string;
  observations: string[];
}

async function waitForReady(page: any) {
  await page.waitForFunction(
    () => (window as any).__TRASH_TEST?.getState() === 'swinging',
    { timeout: 10000 },
  );
}

async function api(page: any, method: string, ...args: unknown[]) {
  return page.evaluate(
    ({ m, a }: { m: string; a: unknown[] }) => (window as any).__TRASH_TEST[m](...a),
    { m: method, a: args },
  );
}

async function waitForSwinging(page: any, timeout = 10000): Promise<boolean> {
  return page.evaluate(
    (t: number) => (window as any).__TRASH_TEST.waitForState('swinging', t),
    timeout,
  );
}

/** Play one round: position crane, drop, wait, screenshot */
async function playRound(
  page: any,
  round: number,
  strategy: string,
  screenshotDir: string,
): Promise<DropResult> {
  const piece = await api(page, 'getActivePiece');
  const pieceCountBefore = await api(page, 'getPieceCount') as number;

  // Position crane based on strategy
  let targetX: number;
  switch (strategy) {
    case 'center':
      targetX = 0.5;
      break;
    case 'sweep':
      targetX = (round % 5) / 4; // 0, 0.25, 0.5, 0.75, 1.0
      break;
    case 'random':
      targetX = 0.1 + Math.random() * 0.8;
      break;
    case 'swing': {
      // Swing hard to one side, then drop at peak
      const side = round % 2 === 0 ? 0.9 : 0.1;
      await api(page, 'moveCrane', side);
      await page.waitForTimeout(400);
      // Now swing to the other side and drop mid-swing
      const other = round % 2 === 0 ? 0.1 : 0.9;
      await api(page, 'moveCrane', other);
      await page.waitForTimeout(200);
      targetX = other;
      break;
    }
    case 'glass':
      await api(page, 'setMaterial', 'glass');
      targetX = 0.3 + Math.random() * 0.4;
      break;
    default:
      targetX = 0.5;
  }

  await api(page, 'moveCrane', targetX);
  await page.waitForTimeout(600); // Let crane reach position

  // Drop
  const dropTime = Date.now();
  await api(page, 'drop');

  // Wait for settling and next piece
  const reached = await waitForSwinging(page);
  const settleTimeMs = Date.now() - dropTime;

  // Snapshot after settling
  const pieceCountAfter = await api(page, 'getPieceCount') as number;
  const snap = await api(page, 'snapshot') as Record<string, unknown>;
  const shardCountAfter = (snap.shardCount as number) || 0;
  const shattered = shardCountAfter > 0 && piece?.material === 'glass';

  // Screenshot
  const screenshotPath = path.join(screenshotDir, `round-${round.toString().padStart(2, '0')}-${strategy}.png`);
  await page.screenshot({ path: screenshotPath });

  // Clear overrides
  await api(page, 'clearOverrides');
  // Clear crane override
  await api(page, 'moveCrane', -1);

  return {
    round,
    strategy,
    piece: piece as { shape: string; material: string } | null,
    craneX: targetX,
    pieceCountBefore,
    pieceCountAfter,
    shardCountAfter,
    settleTimeMs,
    shattered,
    screenshot: path.basename(screenshotPath),
  };
}

async function runPlaytest() {
  // Determine strategies to run
  const strategies = STRATEGY === 'all'
    ? ['center', 'sweep', 'random', 'swing', 'glass']
    : [STRATEGY];

  // Setup output dir
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 520, height: 860 } });

  console.log(`Starting playtest: ${ROUNDS} rounds, strategies: ${strategies.join(', ')}`);
  console.log(`Game URL: ${GAME_URL}`);

  await page.goto(GAME_URL);
  await waitForReady(page);

  const drops: DropResult[] = [];
  const observations: string[] = [];

  for (let round = 0; round < ROUNDS; round++) {
    const strategy = strategies[round % strategies.length]!;

    // Check if game over
    const state = await api(page, 'getState');
    if (state === 'game_over') {
      observations.push(`Game over at round ${round}`);
      break;
    }

    try {
      const result = await playRound(page, round, strategy, OUTPUT_DIR);
      drops.push(result);

      // Log progress
      const p = result.piece;
      console.log(
        `  Round ${round}: ${strategy} | ${p?.material} ${p?.shape} → ` +
        `${result.pieceCountAfter} pieces, ${result.settleTimeMs}ms settle` +
        (result.shattered ? ' [SHATTERED]' : ''),
      );

      // Detect anomalies
      if (result.settleTimeMs > 6000) {
        observations.push(`Round ${round}: Piece took ${result.settleTimeMs}ms to settle — may indicate physics issue`);
      }
      if (result.pieceCountAfter > 50) {
        observations.push(`Round ${round}: ${result.pieceCountAfter} pieces on board — performance may degrade`);
      }
    } catch (err) {
      observations.push(`Round ${round}: Error during ${strategy} — ${err}`);
      // Try to recover
      await page.reload();
      await waitForReady(page);
    }
  }

  // Final state
  const finalSnap = await api(page, 'snapshot');
  const finalScreenshotPath = path.join(OUTPUT_DIR, 'final-board.png');
  await page.screenshot({ path: finalScreenshotPath });

  // Build report
  const report: PlaytestReport = {
    timestamp: new Date().toISOString(),
    gameUrl: GAME_URL,
    totalRounds: drops.length,
    strategies,
    drops,
    finalSnapshot: finalSnap as Record<string, unknown>,
    finalScreenshot: 'final-board.png',
    observations,
  };

  // Write report
  const reportPath = path.join(OUTPUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nPlaytest complete. Report: ${reportPath}`);
  console.log(`Screenshots: ${OUTPUT_DIR}/`);

  if (observations.length > 0) {
    console.log(`\nObservations:`);
    observations.forEach(o => console.log(`  - ${o}`));
  }

  await browser.close();
}

runPlaytest().catch(err => {
  console.error('Playtest failed:', err);
  process.exit(1);
});
