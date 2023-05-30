import bench from 'nanobench'

const iters = 1_000_000
const iters2 = 5

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

bench('async tight loop', async (b: any) => {
  b.start()
  for (let i = 0; i < iters2; i++) {
    await asyncTightLoop()
  }
  b.end()
})

bench('non-async tight loop', async (b: any) => {
  b.start()
  for (let i = 0; i < iters2; i++) {
    nonAsyncTightLoop()
  }
  b.end()
})
