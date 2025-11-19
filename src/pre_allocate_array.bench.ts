import { bench, describe } from 'vitest'

let size = 1_000_000

describe('pre-allocate array', () => {
  bench('no pre-allocate', () => {
    const arr = []
    for (let i = 0; i < size; i++) {
      arr[i] = Math.random()
    }
  })

  bench('pre-allocate', () => {
    const arr = new Array(size)
    for (let i = 0; i < size; i++) {
      arr[i] = Math.random()
    }
  })

  bench('pre-allocate and fill', () => {
    const arr = new Array(size).fill(0)
    for (let i = 0; i < size; i++) {
      arr[i] = Math.random()
    }
  })
})
