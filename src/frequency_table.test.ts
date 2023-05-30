import bench from 'nanobench'

let iter = 100
let size = 1_000_000

//motivated by https://stackoverflow.com/questions/5667888/counting-the-occurrences-frequency-of-array-elements/59225909#comment125913203_59225909

function getData() {
  let arr = []
  for (let i = 0; i < size; i++) {
    arr.push(Math.floor(Math.random() * 100))
  }
  return arr
}

type Table = { [key: number]: number }

bench('reduce+optional chaining', (b: any) => {
  b.start()

  for (let i = 0; i < iter; i++) {
    const arr = getData()
    const counts = {} as Table

    for (const num of arr) {
      counts[num] = counts[num] ? counts[num] + 1 : 1
    }
  }
  b.end()
})

bench('fromEntries+map->object+reduce', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = getData()
    const hash = Object.fromEntries([
      ...arr.reduce(
        (map, key) => map.set(key, (map.get(key) || 0) + 1),
        new Map<number, number>(),
      ),
    ])
  }
  b.end()
})

bench('bit twiddle+object+reduce', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = getData()
    const res = arr.reduce((acc, curr) => {
      acc[curr] = -~acc[curr]
      return acc
    }, {} as Table)
  }
  b.end()
})

bench('reduce+map', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = getData()

    const map = arr.reduce(
      (acc, e) => acc.set(e, (acc.get(e) || 0) + 1),
      new Map<number, number>(),
    )
  }
  b.end()
})

bench('for loop+obj+bit twiddle', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = getData()

    const map = {} as Table
    for (let i = 0; i < arr.length; i++) {
      map[arr[i]] = ~~map[arr[i]] + 1
    }
  }
  b.end()
})

bench('for loop+map+bit twiddle', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = getData()

    const map = new Map<number, number>()
    for (let i = 0; i < arr.length; i++) {
      const a = map.get(i) ?? 0
      map.set(a, ~~a + 1)
    }
  }
  b.end()
})
