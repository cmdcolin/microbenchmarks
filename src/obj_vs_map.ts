import bench from 'nanobench'

let iter = 5
let size = 1_000_000

//motivated by https://stackoverflow.com/questions/5667888/counting-the-occurrences-frequency-of-array-elements/59225909#comment125913203_59225909

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

bench('object.fromentries', (b: any) => {
  b.start()

  for (let i = 0; i < iter; i++) {
    const arr = getData()
    Object.fromEntries(arr)
  }
  b.end()
})

bench('new map', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const arr = getData()
    new Map(arr)
  }
  b.end()
})
