// Runs negative security regressions and legitimate controls entirely offline.
import { spawnSync } from 'node:child_process'
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.config.ts'], { stdio: 'inherit' })
process.exit(result.status ?? 1)
