import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { startQaSession, waitForQaAppReady, type QaAccount } from './qa-auth'

const shouldRun = process.env.TAKE_SCREENSHOTS === '1'
const outputRoot = path.resolve(import.meta.dirname, '../screenshots')

const accounts: QaAccount[] = ['qa-loss', 'qa-gain', 'qa-sporadic']
const iphoneViewport = { width: 430, height: 932 }
const screenSettleMs = 750

test.describe('app screenshots', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!shouldRun, 'Set TAKE_SCREENSHOTS=1 or run npm run screenshots.')

  test.beforeAll(async () => {
    await rm(outputRoot, { recursive: true, force: true })
  })

  for (const account of accounts) {
    test(`${account} iPhone`, async ({ page }) => {
      await page.setViewportSize(iphoneViewport)
      await startQaSession(page, account)
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await capture(page, account, 'loading')
      await waitForQaAppReady(page)

      await waitForLogReady(page)
      await settleForScreenshot(page)
      await capture(page, account, 'log')

      await page.locator('.log-actions').getByRole('button', { name: /food/i }).click()
      await waitForFoodModalReady(page)
      await settleForScreenshot(page)
      await capture(page, account, 'log-add-food')
      await page.getByRole('button', { name: 'Close' }).click()
      await expect(page.getByRole('dialog')).toBeHidden()

      await page.getByRole('button', { name: /trends/i }).click()
      await expect(page.getByRole('heading', { name: 'Calories by macro' })).toBeVisible()
      await waitForTrendsReady(page, account)
      await settleForScreenshot(page)
      await capture(page, account, 'trends')

      await page.getByRole('button', { name: /guide/i }).click()
      await expect(page.getByRole('heading', { name: 'Your best logged servings' })).toBeVisible()
      await waitForGuideReady(page)
      await settleForScreenshot(page)
      await capture(page, account, 'guide')

      await page.getByRole('button', { name: /goals/i }).click()
      await expect(page.getByRole('heading', { name: 'Daily targets' })).toBeVisible()
      await waitForGoalsReady(page)
      await settleForScreenshot(page)
      await capture(page, account, 'goals')

      await page.getByRole('button', { name: 'Settings' }).click()
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
      await settleForScreenshot(page)
      await capture(page, account, 'settings')
    })
  }
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

async function waitForTrendsReady(page: Page, account: QaAccount) {
  const calorieCard = page.locator('.chart-card').filter({ hasText: 'Calories by macro' }).first()
  if (account === 'qa-sporadic') {
    await expect(calorieCard.locator('.recharts-wrapper, .chart-card__empty').first()).toBeVisible()
    return
  }
  await expect(calorieCard).not.toContainText('No entries in this range yet.')
  await expect(calorieCard.locator('.recharts-wrapper')).toBeVisible()
}

async function waitForGuideReady(page: Page) {
  await expect(page.locator('.guide-food').first()).toBeVisible()
}

async function waitForGoalsReady(page: Page) {
  await expect(page.getByRole('heading', { name: 'Recommended calories' })).toBeVisible()
}

async function settleForScreenshot(page: Page) {
  await page.waitForTimeout(screenSettleMs)
}

async function capture(page: Page, account: QaAccount, name: string) {
  const dir = path.join(outputRoot, account)
  await mkdir(dir, { recursive: true })
  await page.screenshot({
    path: path.join(dir, `iphone-${name}.png`),
    fullPage: false,
    animations: 'disabled',
    scale: 'css',
  })
}
