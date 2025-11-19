import { bench, describe } from 'vitest'

function getCigar(n = 100) {
  let s = ''
  const ops = 'MID'
  for (let i = 0; i < n; i++) {
    const len = Math.floor(Math.random() * 10)
    const op = ops[Math.floor(Math.random() * 3)]
    s += len + op
  }
  return s
}

export function parseCigar(s = '') {
  let currLen = ''
  let len
  let op
  let ret = []
  for (let i = 0, l = s.length; i < l; i++) {
    const c = s[i]!
    if (c >= '0' && c <= '9') {
      currLen = currLen + c
    } else {
      len = currLen
      op = c
      currLen = ''
      ret.push(len, op)
    }
  }
  return ret
}

const cigarRegex = new RegExp(/([MIDNSHPX=])/)
export function parseCigar2(cigar = '') {
  return cigar.split(cigarRegex).slice(0, -1)
}

describe('cigar parsing methods', () => {
  bench('regex', () => {
    parseCigar(getCigar())
  }, { time: 1000 })

  bench('regex2', () => {
    parseCigar2(getCigar())
  }, { time: 1000 })
})
