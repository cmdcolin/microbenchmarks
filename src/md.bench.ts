import { bench, describe } from 'vitest'

interface Mismatch {
  start: number
  type: string
  base: string
  altbase?: string
  length: number
  qual?: number
  insertedBases?: string
  cliplen?: number
}

// CIGAR operation indices (from BAM spec)
const CIGAR_M = 0
const CIGAR_I = 1
const CIGAR_D = 2
const CIGAR_N = 3
const CIGAR_S = 4
const CIGAR_H = 5
const CIGAR_EQ = 7
const CIGAR_X = 8

const SEQRET_STRING_DECODER = '=ACMGRSVTWYHKDBN'.split('')

const SEQRET_NUMERIC_DECODER = new Uint8Array([
  61, 97, 99, 109, 103, 114, 115, 118, 116, 119, 121, 104, 107, 100, 98, 110,
])

// Pre-computed lookup table for String.fromCharCode (optimization)
const CHAR_CODE_TO_STRING = Array.from({ length: 128 }, (_, i) =>
  String.fromCharCode(i),
)

// Generate test data
function generateTestData(readLength: number, mismatchRate: number) {
  // Create a simple CIGAR that's just one M operation
  const cigar = new Uint32Array(1)
  cigar[0] = (readLength << 4) | CIGAR_M

  // Create numeric sequence (packed 4-bit encoding)
  const seqLength = readLength
  const numericSeq = new Uint8Array(Math.ceil(seqLength / 2))
  for (let i = 0; i < numericSeq.length; i++) {
    // Random bases: A=1, C=2, G=4, T=8
    const bases = [1, 2, 4, 8]
    const b1 = bases[Math.floor(Math.random() * 4)]
    const b2 = bases[Math.floor(Math.random() * 4)]
    numericSeq[i] = (b1 << 4) | b2
  }

  // Generate MD string with mismatches
  let md = ''
  let matchRun = 0
  const numMismatches = Math.floor(readLength * mismatchRate)
  const mismatchPositions = new Set<number>()

  while (mismatchPositions.size < numMismatches) {
    mismatchPositions.add(Math.floor(Math.random() * readLength))
  }

  const sortedPositions = [...mismatchPositions].sort((a, b) => a - b)

  let lastPos = 0
  for (const pos of sortedPositions) {
    const gap = pos - lastPos
    if (gap > 0) {
      md += gap
    }
    // Random reference base that differs from read
    const refBases = 'ACGT'
    md += refBases[Math.floor(Math.random() * 4)]
    lastPos = pos + 1
  }
  // Add trailing matches
  const remaining = readLength - lastPos
  if (remaining > 0) {
    md += remaining
  }

  return { cigar, numericSeq, seqLength, md }
}

// Original implementation
function mdToMismatchesOriginal(
  mdstring: string,
  ops: Uint32Array,
  mismatches: Mismatch[],
  numericSeq: Uint8Array,
  seqLength: number,
  hasSkips: boolean,
  qual?: Uint8Array,
) {
  const opsLength = ops.length
  const hasQual = qual !== undefined
  const cigarLength = mismatches.length

  let currStart = 0
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0

  let i = 0
  const len = mdstring.length
  while (i < len) {
    const char = mdstring.charCodeAt(i)

    if (char >= 48 && char <= 57) {
      let num = 0
      while (i < len) {
        const c = mdstring.charCodeAt(i)
        if (c >= 48 && c <= 57) {
          num = num * 10 + (c - 48)
          i++
        } else {
          break
        }
      }
      currStart += num
    } else if (char === 94) {
      i++
      while (i < len && mdstring.charCodeAt(i) >= 65) {
        i++
        currStart++
      }
    } else if (char >= 65) {
      const letter = String.fromCharCode(char)
      i++

      if (hasSkips && cigarLength > 0) {
        for (let k = lastSkipPos; k < cigarLength; k++) {
          const m = mismatches[k]!
          if (m.type === 'skip' && currStart >= m.start) {
            currStart += m.length
            lastSkipPos = k
          }
        }
      }

      let templateOffset = lastTemplateOffset
      let refOffset = lastRefOffset
      for (
        let j = lastCigar;
        j < opsLength && refOffset <= currStart;
        j++, lastCigar = j
      ) {
        const packed = ops[j]!
        const len = packed >> 4
        const op = packed & 0xf

        if (op === CIGAR_S || op === CIGAR_I) {
          templateOffset += len
        } else if (op === CIGAR_D || op === 6 || op === CIGAR_N) {
          refOffset += len
        } else if (op !== CIGAR_H) {
          templateOffset += len
          refOffset += len
        }
      }
      lastTemplateOffset = templateOffset
      lastRefOffset = refOffset
      const s = templateOffset - (refOffset - currStart)

      let base: string
      if (s < seqLength) {
        const sb = numericSeq[s >> 1]!
        const nibble = (sb >> ((1 - (s & 1)) << 2)) & 0xf
        base = SEQRET_STRING_DECODER[nibble]!
      } else {
        base = 'X'
      }
      mismatches.push({
        start: currStart,
        base,
        qual: hasQual ? qual[s] : undefined,
        altbase: letter,
        length: 1,
        type: 'mismatch',
      })

      currStart++
    } else {
      i++
    }
  }
}

// Optimized implementation with pre-computed string lookup
function mdToMismatchesOptimized(
  mdstring: string,
  ops: Uint32Array,
  mismatches: Mismatch[],
  numericSeq: Uint8Array,
  seqLength: number,
  hasSkips: boolean,
  qual?: Uint8Array,
) {
  const opsLength = ops.length
  const hasQual = qual !== undefined
  const cigarLength = mismatches.length

  let currStart = 0
  let lastCigar = 0
  let lastTemplateOffset = 0
  let lastRefOffset = 0
  let lastSkipPos = 0

  let i = 0
  const len = mdstring.length
  while (i < len) {
    const char = mdstring.charCodeAt(i)

    if (char >= 48 && char <= 57) {
      let num = 0
      while (i < len) {
        const c = mdstring.charCodeAt(i)
        if (c >= 48 && c <= 57) {
          num = num * 10 + (c - 48)
          i++
        } else {
          break
        }
      }
      currStart += num
    } else if (char === 94) {
      i++
      while (i < len && mdstring.charCodeAt(i) >= 65) {
        i++
        currStart++
      }
    } else if (char >= 65) {
      // Use pre-computed lookup instead of String.fromCharCode
      const letter = CHAR_CODE_TO_STRING[char]!
      i++

      if (hasSkips && cigarLength > 0) {
        for (let k = lastSkipPos; k < cigarLength; k++) {
          const m = mismatches[k]!
          if (m.type === 'skip' && currStart >= m.start) {
            currStart += m.length
            lastSkipPos = k
          }
        }
      }

      let templateOffset = lastTemplateOffset
      let refOffset = lastRefOffset
      for (
        let j = lastCigar;
        j < opsLength && refOffset <= currStart;
        j++, lastCigar = j
      ) {
        const packed = ops[j]!
        const len = packed >> 4
        const op = packed & 0xf

        if (op === CIGAR_S || op === CIGAR_I) {
          templateOffset += len
        } else if (op === CIGAR_D || op === 6 || op === CIGAR_N) {
          refOffset += len
        } else if (op !== CIGAR_H) {
          templateOffset += len
          refOffset += len
        }
      }
      lastTemplateOffset = templateOffset
      lastRefOffset = refOffset
      const s = templateOffset - (refOffset - currStart)

      let base: string
      if (s < seqLength) {
        const sb = numericSeq[s >> 1]!
        const nibble = (sb >> ((1 - (s & 1)) << 2)) & 0xf
        base = SEQRET_STRING_DECODER[nibble]!
      } else {
        base = 'X'
      }

      // Avoid conditional undefined property
      const mismatch: Mismatch = {
        start: currStart,
        base,
        altbase: letter,
        length: 1,
        type: 'mismatch',
      }
      if (hasQual) {
        mismatch.qual = qual[s]
      }
      mismatches.push(mismatch)

      currStart++
    } else {
      i++
    }
  }
}

// Test data for different scenarios
const shortRead = generateTestData(150, 0.01) // 150bp, 1% mismatch rate
const longRead = generateTestData(10000, 0.05) // 10kb, 5% mismatch rate
const highMismatch = generateTestData(150, 0.1) // 150bp, 10% mismatch rate

describe('MD string parsing - short read (150bp, 1% mismatches)', () => {
  bench('original', () => {
    const mismatches: Mismatch[] = []
    mdToMismatchesOriginal(
      shortRead.md,
      shortRead.cigar,
      mismatches,
      shortRead.numericSeq,
      shortRead.seqLength,
      false,
    )
  })

  bench('optimized (lookup table)', () => {
    const mismatches: Mismatch[] = []
    mdToMismatchesOptimized(
      shortRead.md,
      shortRead.cigar,
      mismatches,
      shortRead.numericSeq,
      shortRead.seqLength,
      false,
    )
  })
})

describe('MD string parsing - long read (10kb, 5% mismatches)', () => {
  bench('original', () => {
    const mismatches: Mismatch[] = []
    mdToMismatchesOriginal(
      longRead.md,
      longRead.cigar,
      mismatches,
      longRead.numericSeq,
      longRead.seqLength,
      false,
    )
  })

  bench('optimized (lookup table)', () => {
    const mismatches: Mismatch[] = []
    mdToMismatchesOptimized(
      longRead.md,
      longRead.cigar,
      mismatches,
      longRead.numericSeq,
      longRead.seqLength,
      false,
    )
  })
})

describe('MD string parsing - high mismatch (150bp, 10% mismatches)', () => {
  bench('original', () => {
    const mismatches: Mismatch[] = []
    mdToMismatchesOriginal(
      highMismatch.md,
      highMismatch.cigar,
      mismatches,
      highMismatch.numericSeq,
      highMismatch.seqLength,
      false,
    )
  })

  bench('optimized (lookup table)', () => {
    const mismatches: Mismatch[] = []
    mdToMismatchesOptimized(
      highMismatch.md,
      highMismatch.cigar,
      mismatches,
      highMismatch.numericSeq,
      highMismatch.seqLength,
      false,
    )
  })
})
