import { bench, describe } from 'vitest'

function getCigar(n = 10000) {
  let s = ''
  const ops = 'MID'
  for (let i = 0; i < n; i++) {
    const len = Math.floor(Math.random() * 100)
    const op = ops[Math.floor(Math.random() * 3)]
    s += len + op
  }
  return s
}

describe('cigar parsing', () => {
  bench('regex', () => {
    const s = getCigar()
    const ops = s.split(/([MIDNSHPX=])/)
    let lenOnRef = 0
    for (let i = 0; i < ops.length; i += 2) {
      const len = +ops[i]
      const op = ops[i + 1]

      if (op === 'D' || op === 'M') {
        lenOnRef += len
      }
    }
  })

  bench('manual', () => {
    const s = getCigar()
    let currLen = ''
    let lenOnRef = 0
    let len
    let op

    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (c >= '0' && c <= '9') {
        currLen += c
      } else {
        len = +currLen
        op = s[i]
        if (op === 'D' || op === 'M') {
          lenOnRef += +len
        }
        currLen = ''
      }
    }
  })

  bench('manual, w/ number append', () => {
    const s = getCigar()
    let currLen = ''
    let lenOnRef = 0
    let len
    let op
    for (let i = 0; i < s.length; i++) {
      const d = s.codePointAt(i)!
      if (d >= 48 && d <= 57) {
        currLen += s[i]
      } else {
        len = +currLen
        op = s[i]
        if (op === 'D' || op === 'M') {
          lenOnRef += +len
        }
        currLen = ''
      }
    }
  })

  bench('manual2', () => {
    const s = getCigar()
    let currLen = 0
    let lenOnRef = 0
    let len
    let op

    for (let i = 0; i < s.length; i++) {
      const c = s[i]
      if (c >= '0' && c <= '9') {
        currLen = currLen * 10 + +c
      } else {
        len = +currLen
        op = c
        if (op === 'D' || op === 'M') {
          lenOnRef += +len
        }
        currLen = 0
      }
    }
  })

  bench('manual3', () => {
    const s = getCigar()
    let currLen = 0
    let lenOnRef = 0
    let len
    let op

    for (let i = 0, l = s.length; i < l; i++) {
      const c = s[i]
      if (c >= '0' && c <= '9') {
        currLen = currLen * 10 + +c
      } else {
        len = +currLen
        op = c
        if (op === 'D' || op === 'M') {
          lenOnRef += +len
        }
        currLen = 0
      }
    }
  })
})
