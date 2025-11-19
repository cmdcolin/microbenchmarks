import { bench, describe } from 'vitest'

function generateSmallArray() {
  return ['A', 'T', 'G', 'C']
}

function generateMediumArray() {
  const chars = 'ATGCNX'
  return Array.from({ length: 50 }, () => chars[Math.floor(Math.random() * chars.length)])
}

function generateLargeArray() {
  const chars = 'ATGCNX'
  return Array.from({ length: 1000 }, () => chars[Math.floor(Math.random() * chars.length)])
}

describe('string concatenation - small arrays (4 elements)', () => {
  bench('Array.join("")', () => {
    const arr = generateSmallArray()
    return arr.join('')
  }, { time: 1000 })

  bench('String concatenation', () => {
    const arr = generateSmallArray()
    let result = ''
    for (let i = 0; i < arr.length; i++) {
      result += arr[i]
    }
    return result
  }, { time: 1000 })
})

describe('string concatenation - medium arrays (50 elements)', () => {
  bench('Array.join("")', () => {
    const arr = generateMediumArray()
    return arr.join('')
  }, { time: 1000 })

  bench('String concatenation', () => {
    const arr = generateMediumArray()
    let result = ''
    for (let i = 0; i < arr.length; i++) {
      result += arr[i]
    }
    return result
  }, { time: 1000 })
})

describe('string concatenation - large arrays (1000 elements)', () => {
  bench('Array.join("")', () => {
    const arr = generateLargeArray()
    return arr.join('')
  }, { time: 1000 })

  bench('String concatenation', () => {
    const arr = generateLargeArray()
    let result = ''
    for (let i = 0; i < arr.length; i++) {
      result += arr[i]
    }
    return result
  }, { time: 1000 })
})

describe('string concatenation - real-world scenario (sequence decoding)', () => {
  bench('Array.join("") - seqret style', () => {
    const buf = []
    for (let i = 0; i < 100; i++) {
      buf.push('A')
      buf.push('T')
    }
    return buf.join('')
  }, { time: 1000 })

  bench('String concatenation - seqret style', () => {
    let result = ''
    for (let i = 0; i < 100; i++) {
      result += 'A'
      result += 'T'
    }
    return result
  }, { time: 1000 })
})
