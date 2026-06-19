import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { loginAsQa, type QaAccount } from './qa-auth'

const shouldRun = process.env.TAKE_SCREENSHOTS === '1'
const outputRoot = path.resolve(import.meta.dirname, '../screenshots')

const accounts: QaAccount[] = ['qa-loss', 'qa-gain', 'qa-sporadic']
const iphoneViewport = { width: 430, height: 932 }

test.describe('app screenshots', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(!shouldRun, 'Set TAKE_SCREENSHOTS=1 or run npm run screenshots.')

  test.beforeAll(async () => {
    await rm(outputRoot, { recursive: true, force: true })
  })

  for (const account of accounts) {
    test(`${account} iPhone`, async ({ page }) => {
      await page.setViewportSize(iphoneViewport)
      await loginAsQa(page, account)

      await capture(page, account, 'log')

      await page.getByRole('button', { name: /trends/i }).click()
      await expect(page.getByRole('heading', { name: 'Calories by macro' })).toBeVisible()
      await capture(page, account, 'trends')

      await page.getByRole('button', { name: /guide/i }).click()
      await expect(page.getByRole('heading', { name: 'Your best logged servings' })).toBeVisible()
      await capture(page, account, 'guide')

      await page.getByRole('button', { name: /goals/i }).click()
      await expect(page.getByRole('heading', { name: 'Daily targets' })).toBeVisible()
      await capture(page, account, 'goals')

      await page.getByRole('button', { name: 'Settings' }).click()
      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
      await capture(page, account, 'settings')
    })
  }
})

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
