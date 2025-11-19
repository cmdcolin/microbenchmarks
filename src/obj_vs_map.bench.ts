import { bench, describe } from 'vitest'

let size = 1_000_000

function getData() {
  const weird = []
  for (let i = 0; i < size; i++) {
    weird[i] = [
      btoa(Math.random().toString()).substr(10, 5),
      btoa(Math.random().toString()).substr(10, 5),
    ] as [string, string]
  }
  return weird
}

describe('object vs map', () => {
  bench('object.fromentries', () => {
    const arr = getData()
    Object.fromEntries(arr)
  })

  bench('new map', () => {
    const arr = getData()
    new Map(arr)
  })
})
