const Benchmark = require('benchmark')
var suite = new Benchmark.Suite()

suite.add('no pre-allocate', () => {
  const arr = []
  for (let i = 0; i < 100000; i++) {
    arr[i] = Math.random()
  }
})

suite.add('pre-allocate', () => {
  const arr = new Array(100000)
  for (let i = 0; i < 100000; i++) {
    arr[i] = Math.random()
  }
})

suite.add('pre-allocate and fill', () => {
  const arr = new Array(100000).fill(0)
  for (let i = 0; i < 100000; i++) {
    arr[i] = Math.random()
  }
})

suite.add('new Array() constructor', () => {
  const arr = new Array()
  for (let i = 0; i < 100000; i++) {
    arr[i] = Math.random()
  }
})

suite
  .on('cycle', function (event) {
    console.log(String(event.target))
  })
  .on('complete', function () {
    console.log('Fastest is ' + this.filter('fastest').map('name'))
  })
  .run()
