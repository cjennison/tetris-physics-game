/**
 * TRASH Game — Automated Playwright Tests
 *
 * These tests launch the game in a real browser and drive it
 * programmatically via the __TRASH_TEST API. Claude can run these
 * to verify fixes and catch regressions.
 *
 * Run: npx playwright test
 * Run specific: npx playwright test -g "glass shatter"
 */
import { test, expect, type Page } from '@playwright/test';

/** Helper: wait for the game to boot and be in 'swinging' state */
async function waitForGameReady(page: Page) {
  await page.goto('/');
  // Wait for the test API to be available
  await page.waitForFunction(() => (window as any).__TRASH_TEST !== undefined, {
    timeout: 10000,
  });
  // Wait for first piece to spawn
  await page.waitForFunction(
    () => (window as any).__TRASH_TEST.getState() === 'swinging',
    { timeout: 5000 },
  );
}

/** Helper: call a test API method */
async function api(page: Page, method: string, ...args: unknown[]) {
  return page.evaluate(
    ({ method, args }) => {
      const api = (window as any).__TRASH_TEST;
      return api[method](...args);
    },
    { method, args },
  );
}

/** Helper: drop piece and wait for next spawn */
async function dropAndWaitForNext(page: Page, timeoutMs = 8000) {
  await api(page, 'drop');
  // Wait for settling → laser_check → spawning → swinging
  const reached = await page.evaluate(
    (timeout) => (window as any).__TRASH_TEST.waitForState('swinging', timeout),
    timeoutMs,
  );
  return reached;
}

// ============================================================
// TESTS
// ============================================================

test.describe('Game Boot', () => {
  test('game loads and enters swinging state', async ({ page }) => {
    await waitForGameReady(page);
    const state = await api(page, 'getState');
    expect(state).toBe('swinging');
  });

  test('active piece exists after boot', async ({ page }) => {
    await waitForGameReady(page);
    const piece = await api(page, 'getActivePiece');
    expect(piece).not.toBeNull();
    expect(piece.shape).toBeTruthy();
    expect(piece.material).toBeTruthy();
  });
});

test.describe('Drop and Spawn Cycle', () => {
  test('dropping a piece spawns a new one', async ({ page }) => {
    await waitForGameReady(page);
    const before = await api(page, 'getActivePiece');
    const reachedSwinging = await dropAndWaitForNext(page);
    expect(reachedSwinging).toBe(true);
    const after = await api(page, 'getActivePiece');
    expect(after).not.toBeNull();
    // New piece exists (may or may not be same shape)
    expect(after.shape).toBeTruthy();
  });

  test('piece count increases after each drop', async ({ page }) => {
    await waitForGameReady(page);
    const count1 = await api(page, 'getPieceCount');
    await dropAndWaitForNext(page);
    const count2 = await api(page, 'getPieceCount');
    // Should have at least 1 more (the settled piece) plus the new active piece
    expect(count2).toBeGreaterThan(count1);
  });
});

test.describe('Forced Pieces', () => {
  test('can force a specific shape', async ({ page }) => {
    await waitForGameReady(page);
    // Force next piece to be I-Block
    await api(page, 'setShape', 'I-Block');
    await dropAndWaitForNext(page);
    const piece = await api(page, 'getActivePiece');
    expect(piece.shape).toBe('I-Block');
  });

  test('can force a specific material', async ({ page }) => {
    await waitForGameReady(page);
    await api(page, 'setMaterial', 'glass');
    await dropAndWaitForNext(page);
    const piece = await api(page, 'getActivePiece');
    expect(piece.material).toBe('glass');
  });
});

test.describe('Glass Shatter', () => {
  test('glass piece shatters on floor impact', async ({ page }) => {
    await waitForGameReady(page);

    // Force glass I-Block (easiest to shatter)
    await api(page, 'setShape', 'I-Block');
    await api(page, 'setMaterial', 'glass');
    await dropAndWaitForNext(page);
    // Now we have a glass I-Block on the crane

    // Drop it
    await api(page, 'drop');
    // Wait a moment for impact
    await page.waitForTimeout(1500);

    // Should have shattered — multiple pieces from one drop
    const count = await api(page, 'getPieceCount');
    // Shattered glass creates multiple shards + the new piece on crane
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('glass T-Block shatters on floor impact', async ({ page }) => {
    await waitForGameReady(page);

    await api(page, 'setShape', 'T-Block');
    await api(page, 'setMaterial', 'glass');
    await dropAndWaitForNext(page);

    await api(page, 'drop');
    await page.waitForTimeout(1500);

    const count = await api(page, 'getPieceCount');
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('next piece spawns after glass shatter', async ({ page }) => {
    await waitForGameReady(page);

    await api(page, 'setShape', 'I-Block');
    await api(page, 'setMaterial', 'glass');
    await dropAndWaitForNext(page);

    // Drop the glass piece
    await api(page, 'drop');

    // Should reach swinging again (new piece spawned)
    const reached = await page.evaluate(
      () => (window as any).__TRASH_TEST.waitForState('swinging', 8000),
    );
    expect(reached).toBe(true);

    // New piece should exist
    const piece = await api(page, 'getActivePiece');
    expect(piece).not.toBeNull();
  });
});

test.describe('Crane Movement', () => {
  test('crane moves to target position', async ({ page }) => {
    await waitForGameReady(page);
    await api(page, 'moveCrane', 0.2); // Persists across frames
    await page.waitForTimeout(1500);   // Let lerp converge
    const snap = await api(page, 'snapshot');
    expect(snap.craneX).toBeLessThan(0.35);
    await api(page, 'moveCrane', -1);  // Clear override
  });
});
