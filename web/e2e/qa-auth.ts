import { expect, type Page } from '@playwright/test'

export const QA_SECRET = process.env.QA_AUTH_SECRET || 'playwright-qa-secret'

export type QaAccount = 'qa-loss' | 'qa-gain' | 'qa-sporadic'

export async function startQaSession(page: Page, account: QaAccount = 'qa-loss') {
  const response = await page.request.post('/api/auth/qa', {
    data: { account, secret: QA_SECRET },
  })
  expect(response.ok(), `QA login failed (${response.status()}): ${await response.text()}`).toBeTruthy()
}

export async function waitForQaAppReady(page: Page) {
  await expect(page.getByRole('heading', { name: 'Calorie Tracker' })).toBeVisible()
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
  await expect(page.locator('#boot-splash')).toBeHidden()
}

export async function loginAsQa(page: Page, account: QaAccount = 'qa-loss') {
  await startQaSession(page, account)
  await page.goto('/')
  await waitForQaAppReady(page)
}
