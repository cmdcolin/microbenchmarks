import bench from 'nanobench'

let iter = 100
let size = 1_000_000

bench('no pre-allocate', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = []
    for (let i = 0; i < size; i++) {
      arr[i] = Math.random()
    }
  }
  b.end()
})

bench('pre-allocate', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = new Array(size)
    for (let i = 0; i < size; i++) {
      arr[i] = Math.random()
    }
  }
  b.end()
})

bench('pre-allocate and fill', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = new Array(size).fill(0)
    for (let i = 0; i < size; i++) {
      arr[i] = Math.random()
    }
  }
  b.end()
})
