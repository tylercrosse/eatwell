import { expect, test } from '@playwright/test'

import { loginAsQa } from './qa-auth'

test('qa account can load every primary app tab', async ({ page }) => {
  await loginAsQa(page, 'qa-loss')

  const logActions = page.locator('.log-actions')
  await expect(logActions.getByRole('button', { name: /food/i })).toBeVisible()
  await expect(logActions.getByRole('button', { name: /exercise/i })).toBeVisible()
  await expect(logActions.getByRole('button', { name: /body/i })).toBeVisible()

  await page.getByRole('button', { name: /trends/i }).click()
  await expect(page.getByRole('heading', { name: 'Calories by macro' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Weight & forecast' })).toBeVisible()

  await page.getByRole('button', { name: /guide/i }).click()
  await expect(page.getByRole('heading', { name: 'Your best logged servings' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Build a filling meal' })).toBeVisible()

  await page.getByRole('button', { name: /goals/i }).click()
  await expect(page.getByRole('heading', { name: 'Daily targets' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recommended calories' })).toBeVisible()

  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})
