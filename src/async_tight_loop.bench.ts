import { bench, describe } from 'vitest'

const iters = 1_000_000

async function asyncTightLoop() {
  let val = 0
  for (let i = 0; i < iters; i++) {
    const { doStuff } = await import('./util.js')
    val += doStuff()
  }
  return val
}

function nonAsyncTightLoop() {
  let val = 0
  for (let i = 0; i < iters; i++) {
    val += Math.random()
  }
  return val
}

describe('async tight loop', () => {
  bench('async tight loop', async () => {
    await asyncTightLoop()
  })

  bench('non-async tight loop', () => {
    nonAsyncTightLoop()
  })
})
