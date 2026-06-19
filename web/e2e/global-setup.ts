import { spawnSync } from 'node:child_process'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '../..')

export default async function globalSetup() {
  const args = ['run', 'python', 'scripts/seed_qa_data.py', '--yes']
  if (process.env.E2E_SEED_END_DATE) {
    args.push('--end-date', process.env.E2E_SEED_END_DATE)
  }

  const result = spawnSync('uv', args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`QA seed setup failed with exit code ${result.status ?? 'unknown'}`)
  }
}
