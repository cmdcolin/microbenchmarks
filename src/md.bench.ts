import { bench, describe } from 'vitest'

interface Mismatch {
  start: number
  type: string
  base: string
  altbase?: string
  length: number
  qual?: number
}

// CIGAR operation indices (from BAM spec)
const CIGAR_M = 0
const CIGAR_I = 1
const CIGAR_D = 2
const CIGAR_N = 3
const CIGAR_S = 4
const CIGAR_H = 5

const SEQRET_STRING_DECODER = '=ACMGRSVTWYHKDBN'.split('')

// Generate test data
function generateTestData(readLength: number, mismatchRate: number) {
  const cigar = new Uint32Array(1)
  cigar[0] = (readLength << 4) | CIGAR_M

  const seqLength = readLength
  const numericSeq = new Uint8Array(Math.ceil(seqLength / 2))
  for (let i = 0; i < numericSeq.length; i++) {
    const bases = [1, 2, 4, 8]
    const b1 = bases[Math.floor(Math.random() * 4)]!
    const b2 = bases[Math.floor(Math.random() * 4)]!
    numericSeq[i] = (b1 << 4) | b2
  }

  let md = ''
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
    const refBases = 'ACGT'
    md += refBases[Math.floor(Math.random() * 4)]
    lastPos = pos + 1
  }
  const remaining = readLength - lastPos
  if (remaining > 0) {
    md += remaining
  }

  return { cigar, numericSeq, seqLength, md }
}

// Original implementation (baseline)
function mdToMismatchesOriginal(
  mdstring: string,
  ops: Uint32Array,
  mismatches: Mismatch[],
  numericSeq: Uint8Array,
  seqLength: number,
  hasSkips: boolean,
) {
  const opsLength = ops.length
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

// Structure-of-arrays result type for zero object allocation
interface MismatchesSoA {
  starts: Uint32Array
  bases: Uint8Array
  altbases: Uint8Array
  count: number
}

// Winner: SoA with TextEncoder (for string input)
const textEncoder = new TextEncoder()
const mdBuffer = new Uint8Array(200000)

function mdToMismatchesSoA(
  mdstring: string,
  numericSeq: Uint8Array,
  result: MismatchesSoA,
) {
  const { written } = textEncoder.encodeInto(mdstring, mdBuffer)
  const md = mdBuffer
  const starts = result.starts
  const bases = result.bases
  const altbases = result.altbases
  let count = 0
  let currStart = 0
  let i = 0

  while (i < written) {
    const char = md[i]!

    if (char <= 57) {
      if (char >= 48) {
        let num = char - 48
        i++
        while (i < written) {
          const c = md[i]!
          if (c >= 48 && c <= 57) {
            num = num * 10 + (c - 48)
            i++
          } else {
            break
          }
        }
        currStart += num
      } else {
        i++
      }
    } else if (char === 94) {
      i++
      while (i < written && md[i]! >= 65) {
        i++
        currStart++
      }
    } else {
      i++
      const s = currStart
      const sb = numericSeq[s >> 1]!

      starts[count] = currStart
      bases[count] = (sb >> ((1 - (s & 1)) << 2)) & 0xf
      altbases[count] = char
      count++
      currStart++
    }
  }

  result.count = count
}

// Winner: SoA with pre-encoded bytes (for byte input)
function mdToMismatchesSoABytes(
  md: Uint8Array,
  mdLength: number,
  numericSeq: Uint8Array,
  result: MismatchesSoA,
) {
  const starts = result.starts
  const bases = result.bases
  const altbases = result.altbases
  let count = 0
  let currStart = 0
  let i = 0

  while (i < mdLength) {
    const char = md[i]!

    if (char <= 57) {
      if (char >= 48) {
        let num = char - 48
        i++
        while (i < mdLength) {
          const c = md[i]!
          if (c >= 48 && c <= 57) {
            num = num * 10 + (c - 48)
            i++
          } else {
            break
          }
        }
        currStart += num
      } else {
        i++
      }
    } else if (char === 94) {
      i++
      while (i < mdLength && md[i]! >= 65) {
        i++
        currStart++
      }
    } else {
      i++
      const s = currStart
      const sb = numericSeq[s >> 1]!

      starts[count] = currStart
      bases[count] = (sb >> ((1 - (s & 1)) << 2)) & 0xf
      altbases[count] = char
      count++
      currStart++
    }
  }

  result.count = count
}

// Test data
const shortRead = generateTestData(150, 0.01)
const longRead = generateTestData(100_000, 0.05)

// Pool of 5000 short reads for batch testing
const SHORT_READ_POOL_SIZE = 5000
const shortReadPool = Array.from({ length: SHORT_READ_POOL_SIZE }, () =>
  generateTestData(150, 0.01),
)
const shortReadPoolEncoded = shortReadPool.map(r => textEncoder.encode(r.md))

// Pre-encoded for byte-based tests
const longReadMdEncoded = textEncoder.encode(longRead.md)

// SoA buffers
const soaResult: MismatchesSoA = {
  starts: new Uint32Array(10000),
  bases: new Uint8Array(10000),
  altbases: new Uint8Array(10000),
  count: 0,
}

const shortReadBenchOpts = { warmupIterations: 50, iterations: 5000 }
const longReadBenchOpts = { warmupIterations: 100, iterations: 20_000 }

describe('MD string parsing - short reads (5000x 150bp, 1% mismatches)', () => {
  bench(
    'original',
    () => {
      for (let r = 0; r < SHORT_READ_POOL_SIZE; r++) {
        const read = shortReadPool[r]!
        const mismatches: Mismatch[] = []
        mdToMismatchesOriginal(
          read.md,
          read.cigar,
          mismatches,
          read.numericSeq,
          read.seqLength,
          false,
        )
      }
    },
    shortReadBenchOpts,
  )

  bench(
    'SoA (TextEncoder)',
    () => {
      for (let r = 0; r < SHORT_READ_POOL_SIZE; r++) {
        const read = shortReadPool[r]!
        mdToMismatchesSoA(read.md, read.numericSeq, soaResult)
      }
    },
    shortReadBenchOpts,
  )

  bench(
    'SoA (pre-encoded bytes)',
    () => {
      for (let r = 0; r < SHORT_READ_POOL_SIZE; r++) {
        const read = shortReadPool[r]!
        const encoded = shortReadPoolEncoded[r]!
        mdToMismatchesSoABytes(encoded, encoded.length, read.numericSeq, soaResult)
      }
    },
    shortReadBenchOpts,
  )
})

describe('MD string parsing - long read (100kb, 5% mismatches)', () => {
  bench(
    'original',
    () => {
      const mismatches: Mismatch[] = []
      mdToMismatchesOriginal(
        longRead.md,
        longRead.cigar,
        mismatches,
        longRead.numericSeq,
        longRead.seqLength,
        false,
      )
    },
    longReadBenchOpts,
  )

  bench(
    'SoA (TextEncoder)',
    () => {
      mdToMismatchesSoA(longRead.md, longRead.numericSeq, soaResult)
    },
    longReadBenchOpts,
  )

  bench(
    'SoA (pre-encoded bytes)',
    () => {
      mdToMismatchesSoABytes(
        longReadMdEncoded,
        longReadMdEncoded.length,
        longRead.numericSeq,
        soaResult,
      )
    },
    longReadBenchOpts,
  )
})
