import { bench, describe } from 'vitest'

let size = 1_000_000

function getData() {
  let arr = []
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * 100))
  }
  return arr
}

type Table = { [key: number]: number }

describe('frequency table', () => {
  bench('reduce+optional chaining', () => {
    const arr = getData()
    const counts = {} as Table

    for (const num of arr) {
      counts[num] = counts[num] ? counts[num] + 1 : 1
    }
  })

  bench('fromEntries+map->object+reduce', () => {
    const arr = getData()
    const hash = Object.fromEntries([
      ...arr.reduce(
        (map, key) => map.set(key, (map.get(key) || 0) + 1),
        new Map<number, number>(),
      ),
    ])
  })

  bench('bit twiddle+object+reduce', () => {
    const arr = getData()
    const res = arr.reduce((acc, curr) => {
      acc[curr] = -~acc[curr]
      return acc
    }, {} as Table)
  })

  bench('reduce+map', () => {
    const arr = getData()

    const map = arr.reduce(
      (acc, e) => acc.set(e, (acc.get(e) || 0) + 1),
      new Map<number, number>(),
    )
  })

  bench('for loop+obj+bit twiddle', () => {
    const arr = getData()

    const map = {} as Table
    for (let i = 0; i < arr.length; i++) {
      map[arr[i]] = ~~map[arr[i]] + 1
    }
  })

  bench('for loop+map+bit twiddle', () => {
    const arr = getData()

    const map = new Map<number, number>()
    for (let i = 0; i < arr.length; i++) {
      const a = map.get(i) ?? 0
      map.set(a, ~~a + 1)
    }
  })
})
