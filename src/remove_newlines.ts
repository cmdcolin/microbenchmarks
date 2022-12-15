import bench from 'nanobench'

function makeid(length: number) {
  var result = ''
  var characters = 'ACGT\n'
  var charactersLength = characters.length
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

let iter = 1_000
let strlen = 1_000_000

bench('replaceAll newline char', (b: any) => {
  b.start()

  for (let i = 0; i < iter; i++) {
    const str = makeid(strlen)
    str.replaceAll('\n', '')
  }
  b.end()
})

bench('replaceAll newline regex', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const str = makeid(strlen)
    str.replaceAll(/\n/g, '')
  }
  b.end()
})

bench('regex whitespace', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const str = makeid(strlen)
    str.replace(/\s+/g, '')
  }
  b.end()
})

bench('regex newline', (b: any) => {
  b.start()
  for (let i = 0; i < iter; i++) {
    const str = makeid(strlen)
    str.replace(/\n/g, '')
  }
  b.end()
})

// const str = makeid()
// str.replace(/\n/g, '')
// str.replace(/\s+/g, '')
// str.replaceAll(/\n/g, '')
// str.replaceAll('\n', '')
//
