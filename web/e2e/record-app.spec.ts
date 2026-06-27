import { spawnSync } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { startQaSession, waitForQaAppReady } from './qa-auth'

const shouldRun = process.env.TAKE_RECORDING === '1'
const outputRoot = path.resolve(import.meta.dirname, '../recordings')
const framesDir = path.join(outputRoot, 'frames')
const gifPath = path.join(outputRoot, 'app-tour.gif')
const palettePath = path.join(outputRoot, 'palette.png')
const framePattern = path.join(framesDir, 'frame-%04d.png')
const iphoneViewport = { width: 430, height: 932 }
const fps = 5
const frameMs = 1000 / fps
let frameIndex = 0

test.describe('app recording', () => {
  test.skip(!shouldRun, 'Set TAKE_RECORDING=1 or run npm run recording.')

  test.beforeAll(async () => {
    await rm(outputRoot, { recursive: true, force: true })
    await mkdir(framesDir, { recursive: true })
  })

  test('qa-loss iPhone tour GIF', async ({ page }) => {
    await page.setViewportSize(iphoneViewport)
    await startQaSession(page, 'qa-loss')

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await recordMoment(page, 900)

    await waitForQaAppReady(page)
    await waitForLogReady(page)
    await settle(page)
    await recordMoment(page, 1000)

    await page.locator('.log-actions').getByRole('button', { name: /food/i }).click()
    await waitForFoodModalReady(page)
    await settle(page)
    await recordMoment(page, 900)

    const dialog = page.getByRole('dialog')
    const search = dialog.getByPlaceholder(/Search, or describe a food/)
    for (const query of ['t', 'tu', 'tun', 'tuna']) {
      await search.fill(query)
      await page.waitForTimeout(250)
      await recordMoment(page, 400)
    }

    const tunaRow = dialog.locator('.recent-chip').filter({ hasText: 'Tuna rice bowl' }).first()
    await expect(tunaRow).toBeVisible()
    await recordMoment(page, 800)

    await tunaRow.locator('.recent-chip__main').click()
    await expect(dialog.locator('.estimate')).toBeVisible()
    await expect(dialog.getByText('Tuna rice bowl')).toBeVisible()
    await settle(page)
    await recordMoment(page, 1100)

    await dialog.getByRole('button', { name: 'Discard' }).click()
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByRole('button', { name: /trends/i }).click()
    await expect(page.getByRole('heading', { name: 'Calories by macro' })).toBeVisible()
    await waitForTrendsReady(page)
    await settle(page)
    await recordMoment(page, 1100)

    await page.getByRole('button', { name: /guide/i }).click()
    await expect(page.getByRole('heading', { name: 'Your best logged servings' })).toBeVisible()
    await expect(page.locator('.guide-food').first()).toBeVisible()
    await settle(page)
    await recordMoment(page, 1100)

    await page.getByRole('button', { name: /goals/i }).click()
    await expect(page.getByRole('heading', { name: 'Daily targets' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Recommended calories' })).toBeVisible()
    await settle(page)
    await recordMoment(page, 1200)

    await createGif()
  })
})

async function waitForLogReady(page: Page) {
  await expect(page.locator('.log-actions')).toBeVisible()
  await expect(page.locator('.meal-section').first()).toBeVisible()
}

async function waitForFoodModalReady(page: Page) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'What did you eat?' })).toBeVisible()
  await expect(dialog.locator('.capture-composer')).toBeVisible()
  await expect(dialog.locator('.recent-chip').first()).toBeVisible()
}

async function waitForTrendsReady(page: Page) {
  const calorieCard = page.locator('.chart-card').filter({ hasText: 'Calories by macro' }).first()
  await expect(calorieCard).not.toContainText('No entries in this range yet.')
  await expect(calorieCard.locator('.recharts-wrapper')).toBeVisible()
}

async function settle(page: Page) {
  await page.waitForTimeout(750)
}

async function recordMoment(page: Page, durationMs: number) {
  const frames = Math.max(1, Math.round(durationMs / frameMs))
  for (let i = 0; i < frames; i += 1) {
    frameIndex += 1
    await page.screenshot({
      path: path.join(framesDir, `frame-${String(frameIndex).padStart(4, '0')}.png`),
      fullPage: false,
      animations: 'allow',
      scale: 'css',
    })
    await page.waitForTimeout(frameMs)
  }
}

async function createGif() {
  const palette = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-start_number',
      '1',
      '-framerate',
      String(fps),
      '-i',
      framePattern,
      '-vf',
      'fps=5,scale=320:-1:flags=lanczos,palettegen',
      palettePath,
    ],
    { encoding: 'utf8' },
  )
  expect(palette.status, palette.stderr || palette.stdout).toBe(0)

  const gif = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-start_number',
      '1',
      '-framerate',
      String(fps),
      '-i',
      framePattern,
      '-i',
      palettePath,
      '-lavfi',
      'fps=5,scale=320:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5',
      gifPath,
    ],
    { encoding: 'utf8' },
  )
  expect(gif.status, gif.stderr || gif.stdout).toBe(0)
}
