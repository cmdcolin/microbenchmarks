import { bench, describe } from 'vitest'

function makeid(length: number) {
  var result = ''
  var characters = 'ACGT\n'
  var charactersLength = characters.length
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength))
  }
  return result
}

let strlen = 1_000_000

describe('remove newlines', () => {
  bench('replaceAll newline char', () => {
    const str = makeid(strlen)
    str.replaceAll('\n', '')
  })

  bench('replaceAll newline regex', () => {
    const str = makeid(strlen)
    str.replaceAll(/\n/g, '')
  })

  bench('regex whitespace', () => {
    const str = makeid(strlen)
    str.replace(/\s+/g, '')
  })

  bench('regex newline', () => {
    const str = makeid(strlen)
    str.replace(/\n/g, '')
  })
})
