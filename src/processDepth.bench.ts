import { bench, describe } from 'vitest'

interface PreBinEntry {
  entryDepth: number
  [-1]: number
  [0]: number
  [1]: number
}

interface PreBaseCoverageBin {
  depth: number
  readsCounted: number
  ref: PreBinEntry
  snps: Record<string, unknown>
  mods: Record<string, unknown>
  nonmods: Record<string, unknown>
  delskips: Record<string, unknown>
  noncov: Record<string, unknown>
}

function createPreBinEntry(): PreBinEntry {
  return { entryDepth: 0, [-1]: 0, [0]: 0, [1]: 0 }
}

interface Feature {
  start: number
  end: number
  strand: -1 | 0 | 1
}

// Generate realistic test data
function generateFeatures(
  count: number,
  regionStart: number,
  regionEnd: number,
): Feature[] {
  const features: Feature[] = []
  const regionSize = regionEnd - regionStart
  for (let i = 0; i < count; i++) {
    // Random read length between 100-300bp (short reads) or longer for long reads
    const readLength = 100 + Math.floor(Math.random() * 200)
    // Random start position within region
    const start =
      regionStart + Math.floor(Math.random() * (regionSize - readLength))
    const end = start + readLength
    const strand = (Math.random() > 0.5 ? 1 : -1) as -1 | 1
    features.push({ start, end, strand })
  }
  return features
}

// Current implementation: O(features × region_size)
function processDepthOriginal(
  features: Feature[],
  regionStart: number,
  regionEnd: number,
): PreBaseCoverageBin[] {
  const bins: PreBaseCoverageBin[] = []

  for (const feature of features) {
    const { start: fstart, end: fend, strand: fstrand } = feature

    const visStart = Math.max(fstart, regionStart)
    const visEnd = Math.min(fend + 1, regionEnd)

    for (let j = visStart; j < visEnd; j++) {
      const i = j - regionStart
      const bin = (bins[i] ??= {
        depth: 0,
        readsCounted: 0,
        ref: createPreBinEntry(),
        snps: {},
        mods: {},
        nonmods: {},
        delskips: {},
        noncov: {},
      })
      if (j !== fend) {
        bin.depth++
        bin.readsCounted++
        bin.ref.entryDepth++
        bin.ref[fstrand]++
      }
    }
  }

  return bins
}

// Optimized: prefix sums for depth, O(features + region_size)
function processDepthPrefixSum(
  features: Feature[],
  regionStart: number,
  regionEnd: number,
): PreBaseCoverageBin[] {
  const regionSize = regionEnd - regionStart
  const depthChanges = new Int32Array(regionSize + 1)
  const readCountChanges = new Int32Array(regionSize + 1)
  const refDepthChanges = new Int32Array(regionSize + 1)
  const strandPlusChanges = new Int32Array(regionSize + 1)
  const strandMinusChanges = new Int32Array(regionSize + 1)

  // O(features) - record changes at boundaries
  for (const feature of features) {
    const { start: fstart, end: fend, strand: fstrand } = feature

    const visStart = Math.max(fstart, regionStart) - regionStart
    // fend is excluded from depth (see original: j !== fend)
    const visEnd = Math.min(fend, regionEnd) - regionStart

    if (visStart < visEnd) {
      depthChanges[visStart]++
      depthChanges[visEnd]--

      readCountChanges[visStart]++
      readCountChanges[visEnd]--

      refDepthChanges[visStart]++
      refDepthChanges[visEnd]--

      if (fstrand === 1) {
        strandPlusChanges[visStart]++
        strandPlusChanges[visEnd]--
      } else if (fstrand === -1) {
        strandMinusChanges[visStart]++
        strandMinusChanges[visEnd]--
      }
    }
  }

  // O(region_size) - compute prefix sums and build bins
  const bins: PreBaseCoverageBin[] = new Array(regionSize)
  let depth = 0
  let readsCounted = 0
  let refDepth = 0
  let strandPlus = 0
  let strandMinus = 0

  for (let i = 0; i < regionSize; i++) {
    depth += depthChanges[i]!
    readsCounted += readCountChanges[i]!
    refDepth += refDepthChanges[i]!
    strandPlus += strandPlusChanges[i]!
    strandMinus += strandMinusChanges[i]!

    bins[i] = {
      depth,
      readsCounted,
      ref: {
        entryDepth: refDepth,
        [-1]: strandMinus,
        [0]: 0,
        [1]: strandPlus,
      },
      snps: {},
      mods: {},
      nonmods: {},
      delskips: {},
      noncov: {},
    }
  }

  return bins
}

// Even more optimized: reuse typed arrays, lazy bin creation
const MAX_REGION_SIZE = 100_000
const sharedDepthChanges = new Int32Array(MAX_REGION_SIZE + 1)
const sharedStrandPlusChanges = new Int32Array(MAX_REGION_SIZE + 1)
const sharedStrandMinusChanges = new Int32Array(MAX_REGION_SIZE + 1)

function processDepthPrefixSumOptimized(
  features: Feature[],
  regionStart: number,
  regionEnd: number,
): PreBaseCoverageBin[] {
  const regionSize = regionEnd - regionStart

  // Clear only the portion we'll use
  sharedDepthChanges.fill(0, 0, regionSize + 1)
  sharedStrandPlusChanges.fill(0, 0, regionSize + 1)
  sharedStrandMinusChanges.fill(0, 0, regionSize + 1)

  // O(features)
  for (const feature of features) {
    const { start: fstart, end: fend, strand: fstrand } = feature

    const visStart = Math.max(fstart, regionStart) - regionStart
    const visEnd = Math.min(fend, regionEnd) - regionStart

    if (visStart < visEnd) {
      sharedDepthChanges[visStart]++
      sharedDepthChanges[visEnd]--

      if (fstrand === 1) {
        sharedStrandPlusChanges[visStart]++
        sharedStrandPlusChanges[visEnd]--
      } else if (fstrand === -1) {
        sharedStrandMinusChanges[visStart]++
        sharedStrandMinusChanges[visEnd]--
      }
    }
  }

  // O(region_size)
  const bins: PreBaseCoverageBin[] = new Array(regionSize)
  let depth = 0
  let strandPlus = 0
  let strandMinus = 0

  for (let i = 0; i < regionSize; i++) {
    depth += sharedDepthChanges[i]!
    strandPlus += sharedStrandPlusChanges[i]!
    strandMinus += sharedStrandMinusChanges[i]!

    bins[i] = {
      depth,
      readsCounted: depth,
      ref: {
        entryDepth: depth,
        [-1]: strandMinus,
        [0]: 0,
        [1]: strandPlus,
      },
      snps: {},
      mods: {},
      nonmods: {},
      delskips: {},
      noncov: {},
    }
  }

  return bins
}

// Test scenarios
const SCENARIOS = [
  { name: '1k features, 10kb region', features: 1000, regionSize: 10_000 },
  { name: '5k features, 10kb region', features: 5000, regionSize: 10_000 },
  { name: '1k features, 50kb region', features: 1000, regionSize: 50_000 },
  { name: '5k features, 50kb region', features: 5000, regionSize: 50_000 },
] as const

// ============================================================
// REALISTIC SEQUENCING SCENARIOS
// ============================================================

// Calculate number of reads needed for target depth:
// depth = (numReads * readLength) / regionSize
// numReads = (depth * regionSize) / readLength

function generateFeaturesWithReadLength(
  count: number,
  regionStart: number,
  regionEnd: number,
  readLength: number,
): Feature[] {
  const features: Feature[] = []
  const regionSize = regionEnd - regionStart

  for (let i = 0; i < count; i++) {
    // For long reads that may extend beyond region, allow starts before region
    const maxStart = regionEnd - Math.min(readLength, regionSize)
    const minStart = regionStart - Math.max(0, readLength - regionSize)
    const start = minStart + Math.floor(Math.random() * (maxStart - minStart))
    const end = start + readLength
    const strand = (Math.random() > 0.5 ? 1 : -1) as -1 | 1
    features.push({ start, end, strand })
  }
  return features
}

// Short read scenarios (150bp)
const SHORT_READ_LENGTH = 150
const SHORT_READ_REGION = 10_000 // 10kb region

// Long read scenarios (50kb average)
const LONG_READ_LENGTH = 50_000
const LONG_READ_REGION = 100_000 // 100kb region

const SEQUENCING_SCENARIOS = [
  {
    name: 'Short read 30x (150bp, 10kb region)',
    readLength: SHORT_READ_LENGTH,
    regionSize: SHORT_READ_REGION,
    depth: 30,
    // numReads = (30 * 10000) / 150 = 2000
    numReads: Math.ceil((30 * SHORT_READ_REGION) / SHORT_READ_LENGTH),
  },
  {
    name: 'Short read 300x (150bp, 10kb region)',
    readLength: SHORT_READ_LENGTH,
    regionSize: SHORT_READ_REGION,
    depth: 300,
    // numReads = (300 * 10000) / 150 = 20000
    numReads: Math.ceil((300 * SHORT_READ_REGION) / SHORT_READ_LENGTH),
  },
  {
    name: 'Long read 30x (50kb, 100kb region)',
    readLength: LONG_READ_LENGTH,
    regionSize: LONG_READ_REGION,
    depth: 30,
    // numReads = (30 * 100000) / 50000 = 60
    numReads: Math.ceil((30 * LONG_READ_REGION) / LONG_READ_LENGTH),
  },
  {
    name: 'Long read 300x (50kb, 100kb region)',
    readLength: LONG_READ_LENGTH,
    regionSize: LONG_READ_REGION,
    depth: 300,
    // numReads = (300 * 100000) / 50000 = 600
    numReads: Math.ceil((300 * LONG_READ_REGION) / LONG_READ_LENGTH),
  },
] as const

// ============================================================
// ALTERNATIVE OUTPUT DATA STRUCTURES
// ============================================================

// SoA output format - much more memory efficient
interface CoverageBinsSoA {
  regionStart: number
  regionSize: number
  depth: Int32Array
  strandPlus: Int32Array
  strandMinus: Int32Array
  // Sparse data for SNPs/indels - only positions that have them
  snpPositions: number[]
  snpData: Map<number, Record<string, number>>
  delskipPositions: number[]
  delskipData: Map<number, Record<string, number>>
}

// Prefix sum with SoA output - most efficient
function processDepthSoAOutput(
  features: Feature[],
  regionStart: number,
  regionEnd: number,
): CoverageBinsSoA {
  const regionSize = regionEnd - regionStart

  const depthChanges = new Int32Array(regionSize + 1)
  const strandPlusChanges = new Int32Array(regionSize + 1)
  const strandMinusChanges = new Int32Array(regionSize + 1)

  for (const feature of features) {
    const { start: fstart, end: fend, strand: fstrand } = feature

    const visStart = Math.max(fstart, regionStart) - regionStart
    const visEnd = Math.min(fend, regionEnd) - regionStart

    if (visStart < visEnd) {
      depthChanges[visStart]++
      depthChanges[visEnd]--

      if (fstrand === 1) {
        strandPlusChanges[visStart]++
        strandPlusChanges[visEnd]--
      } else if (fstrand === -1) {
        strandMinusChanges[visStart]++
        strandMinusChanges[visEnd]--
      }
    }
  }

  // Build output arrays with prefix sums
  const depth = new Int32Array(regionSize)
  const strandPlus = new Int32Array(regionSize)
  const strandMinus = new Int32Array(regionSize)

  let d = 0
  let sp = 0
  let sm = 0

  for (let i = 0; i < regionSize; i++) {
    d += depthChanges[i]!
    sp += strandPlusChanges[i]!
    sm += strandMinusChanges[i]!
    depth[i] = d
    strandPlus[i] = sp
    strandMinus[i] = sm
  }

  return {
    regionStart,
    regionSize,
    depth,
    strandPlus,
    strandMinus,
    snpPositions: [],
    snpData: new Map(),
    delskipPositions: [],
    delskipData: new Map(),
  }
}

// Reusable buffers for SoA output
const MAX_SOA_REGION = 100_000
const reusableDepth = new Int32Array(MAX_SOA_REGION)
const reusableStrandPlus = new Int32Array(MAX_SOA_REGION)
const reusableStrandMinus = new Int32Array(MAX_SOA_REGION)
const reusableDepthChanges = new Int32Array(MAX_SOA_REGION + 1)
const reusableStrandPlusChanges = new Int32Array(MAX_SOA_REGION + 1)
const reusableStrandMinusChanges = new Int32Array(MAX_SOA_REGION + 1)

interface CoverageBinsSoAView {
  regionStart: number
  regionSize: number
  depth: Int32Array // subarray view
  strandPlus: Int32Array
  strandMinus: Int32Array
}

// Most optimized: reuse all buffers, return views
function processDepthSoAReused(
  features: Feature[],
  regionStart: number,
  regionEnd: number,
): CoverageBinsSoAView {
  const regionSize = regionEnd - regionStart

  // Clear only needed portion
  reusableDepthChanges.fill(0, 0, regionSize + 1)
  reusableStrandPlusChanges.fill(0, 0, regionSize + 1)
  reusableStrandMinusChanges.fill(0, 0, regionSize + 1)

  for (const feature of features) {
    const { start: fstart, end: fend, strand: fstrand } = feature

    const visStart = Math.max(fstart, regionStart) - regionStart
    const visEnd = Math.min(fend, regionEnd) - regionStart

    if (visStart < visEnd) {
      reusableDepthChanges[visStart]++
      reusableDepthChanges[visEnd]--

      if (fstrand === 1) {
        reusableStrandPlusChanges[visStart]++
        reusableStrandPlusChanges[visEnd]--
      } else if (fstrand === -1) {
        reusableStrandMinusChanges[visStart]++
        reusableStrandMinusChanges[visEnd]--
      }
    }
  }

  let d = 0
  let sp = 0
  let sm = 0

  for (let i = 0; i < regionSize; i++) {
    d += reusableDepthChanges[i]!
    sp += reusableStrandPlusChanges[i]!
    sm += reusableStrandMinusChanges[i]!
    reusableDepth[i] = d
    reusableStrandPlus[i] = sp
    reusableStrandMinus[i] = sm
  }

  return {
    regionStart,
    regionSize,
    depth: reusableDepth.subarray(0, regionSize),
    strandPlus: reusableStrandPlus.subarray(0, regionSize),
    strandMinus: reusableStrandMinus.subarray(0, regionSize),
  }
}

for (const scenario of SEQUENCING_SCENARIOS) {
  const regionStart = 0
  const regionEnd = scenario.regionSize
  const features = generateFeaturesWithReadLength(
    scenario.numReads,
    regionStart,
    regionEnd,
    scenario.readLength,
  )

  describe(`Sequencing: ${scenario.name} (~${scenario.numReads} reads)`, () => {
    bench('original (per-base iteration, object output)', () => {
      processDepthOriginal(features, regionStart, regionEnd)
    })

    bench('prefix sum (object output)', () => {
      processDepthPrefixSumOptimized(features, regionStart, regionEnd)
    })

    bench('prefix sum (SoA output, reused arrays)', () => {
      processDepthSoAReused(features, regionStart, regionEnd)
    })
  })
}

for (const scenario of SCENARIOS) {
  const regionStart = 0
  const regionEnd = scenario.regionSize
  const features = generateFeatures(scenario.features, regionStart, regionEnd)

  describe(`processDepth - ${scenario.name}`, () => {
    bench('original (per-base iteration)', () => {
      processDepthOriginal(features, regionStart, regionEnd)
    })

    bench('prefix sum (new arrays each call)', () => {
      processDepthPrefixSum(features, regionStart, regionEnd)
    })

    bench('prefix sum (reused arrays)', () => {
      processDepthPrefixSumOptimized(features, regionStart, regionEnd)
    })
  })
}

// ============================================================
// MISMATCH PROCESSING BENCHMARKS
// ============================================================

// Mismatch types
const TYPE_MISMATCH = 0
const TYPE_DELETION = 1
const TYPE_SKIP = 2
const TYPE_INSERTION = 4
const TYPE_SOFTCLIP = 5

interface MismatchesSOA {
  count: number
  starts: Uint32Array
  lengths: Uint32Array
  types: Uint8Array
  bases: Uint8Array
  altbases: Uint8Array
  insertedBases: Map<number, string>
}

interface FeatureWithMismatches extends Feature {
  mismatches: MismatchesSOA
}

function generateMismatches(
  featureStart: number,
  featureLength: number,
  mismatchRate: number,
  deletionRate: number,
): MismatchesSOA {
  const numMismatches = Math.floor(featureLength * mismatchRate)
  const numDeletions = Math.floor(featureLength * deletionRate)
  const total = numMismatches + numDeletions

  const soa: MismatchesSOA = {
    count: total,
    starts: new Uint32Array(total),
    lengths: new Uint32Array(total),
    types: new Uint8Array(total),
    bases: new Uint8Array(total),
    altbases: new Uint8Array(total),
    insertedBases: new Map(),
  }

  const positions = new Set<number>()
  while (positions.size < total) {
    positions.add(Math.floor(Math.random() * featureLength))
  }
  const sortedPositions = [...positions].sort((a, b) => a - b)

  for (let i = 0; i < total; i++) {
    soa.starts[i] = sortedPositions[i]!
    if (i < numMismatches) {
      soa.types[i] = TYPE_MISMATCH
      soa.lengths[i] = 1
      soa.bases[i] = [65, 67, 71, 84][Math.floor(Math.random() * 4)]! // A,C,G,T
      soa.altbases[i] = [65, 67, 71, 84][Math.floor(Math.random() * 4)]!
    } else {
      soa.types[i] = TYPE_DELETION
      soa.lengths[i] = 1 + Math.floor(Math.random() * 5) // 1-5bp deletions
      soa.bases[i] = 42 // '*'
    }
  }

  return soa
}

function generateFeaturesWithMismatches(
  count: number,
  regionStart: number,
  regionEnd: number,
  mismatchRate: number,
  deletionRate: number,
): FeatureWithMismatches[] {
  const features: FeatureWithMismatches[] = []
  const regionSize = regionEnd - regionStart
  for (let i = 0; i < count; i++) {
    const readLength = 100 + Math.floor(Math.random() * 200)
    const start =
      regionStart + Math.floor(Math.random() * (regionSize - readLength))
    const end = start + readLength
    const strand = (Math.random() > 0.5 ? 1 : -1) as -1 | 1
    features.push({
      start,
      end,
      strand,
      mismatches: generateMismatches(start, readLength, mismatchRate, deletionRate),
    })
  }
  return features
}

// Original mismatch processing (per-base for deletions)
function processMismatchesOriginal(
  features: FeatureWithMismatches[],
  bins: PreBaseCoverageBin[],
  regionStart: number,
  regionEnd: number,
) {
  const binsLength = bins.length

  for (const feature of features) {
    const { start: fstart, strand: fstrand, mismatches } = feature
    const { count, starts, lengths, types, bases } = mismatches

    for (let i = 0; i < count; i++) {
      const type = types[i]!
      const mstart = fstart + starts[i]!
      const mlen = type === TYPE_MISMATCH ? 1 : lengths[i]!
      const mend = mstart + mlen

      const visStart = Math.max(mstart, regionStart)
      const visEnd = Math.min(mend, regionEnd)

      if (visStart < visEnd) {
        if (type === TYPE_DELETION) {
          // Per-base iteration for deletions
          for (let j = visStart; j < visEnd; j++) {
            const epos = j - regionStart
            if (epos < binsLength) {
              const bin = bins[epos]!
              bin.delskips.deletion = ((bin.delskips.deletion as number) || 0) + 1
              bin.depth--
            }
          }
        } else if (type === TYPE_MISMATCH) {
          const epos = mstart - regionStart
          if (epos >= 0 && epos < binsLength) {
            const bin = bins[epos]!
            const baseChar = String.fromCharCode(bases[i]!)
            bin.snps[baseChar] = ((bin.snps[baseChar] as number) || 0) + 1
            bin.ref.entryDepth--
            bin.ref[fstrand]--
          }
        }
      }
    }
  }
}

// Optimized: prefix sums for deletions too
function processMismatchesPrefixSum(
  features: FeatureWithMismatches[],
  bins: PreBaseCoverageBin[],
  regionStart: number,
  regionEnd: number,
) {
  const regionSize = regionEnd - regionStart
  const binsLength = bins.length

  // Track deletion depth changes
  const deletionChanges = new Int32Array(regionSize + 1)

  // Track per-position SNP counts (we still need per-base for SNPs)
  const snpCounts: Map<string, number>[] = new Array(regionSize)

  for (const feature of features) {
    const { start: fstart, strand: fstrand, mismatches } = feature
    const { count, starts, lengths, types, bases } = mismatches

    for (let i = 0; i < count; i++) {
      const type = types[i]!
      const mstart = fstart + starts[i]!

      if (type === TYPE_DELETION) {
        const mlen = lengths[i]!
        const mend = mstart + mlen
        const visStart = Math.max(mstart, regionStart) - regionStart
        const visEnd = Math.min(mend, regionEnd) - regionStart

        if (visStart < visEnd) {
          // O(1) per deletion instead of O(deletion_length)
          deletionChanges[visStart]++
          deletionChanges[visEnd]--
        }
      } else if (type === TYPE_MISMATCH) {
        const epos = mstart - regionStart
        if (epos >= 0 && epos < binsLength) {
          const bin = bins[epos]!
          const baseChar = String.fromCharCode(bases[i]!)
          bin.snps[baseChar] = ((bin.snps[baseChar] as number) || 0) + 1
          bin.ref.entryDepth--
          bin.ref[fstrand]--
        }
      }
    }
  }

  // Apply deletion prefix sums
  let deletionDepth = 0
  for (let i = 0; i < regionSize; i++) {
    deletionDepth += deletionChanges[i]!
    if (deletionDepth > 0 && bins[i]) {
      bins[i]!.delskips.deletion = deletionDepth
      bins[i]!.depth -= deletionDepth
    }
  }
}

// Combined: process depth AND mismatches together with prefix sums
function processAllPrefixSum(
  features: FeatureWithMismatches[],
  regionStart: number,
  regionEnd: number,
): PreBaseCoverageBin[] {
  const regionSize = regionEnd - regionStart

  const depthChanges = new Int32Array(regionSize + 1)
  const strandPlusChanges = new Int32Array(regionSize + 1)
  const strandMinusChanges = new Int32Array(regionSize + 1)
  const deletionChanges = new Int32Array(regionSize + 1)

  // Collect SNPs (these are point events, not ranges)
  const snpEvents: { pos: number; base: number; strand: -1 | 0 | 1 }[] = []

  for (const feature of features) {
    const { start: fstart, end: fend, strand: fstrand, mismatches } = feature

    // Depth changes
    const visStart = Math.max(fstart, regionStart) - regionStart
    const visEnd = Math.min(fend, regionEnd) - regionStart

    if (visStart < visEnd) {
      depthChanges[visStart]++
      depthChanges[visEnd]--

      if (fstrand === 1) {
        strandPlusChanges[visStart]++
        strandPlusChanges[visEnd]--
      } else if (fstrand === -1) {
        strandMinusChanges[visStart]++
        strandMinusChanges[visEnd]--
      }
    }

    // Mismatch changes
    const { count, starts, lengths, types, bases } = mismatches
    for (let i = 0; i < count; i++) {
      const type = types[i]!
      const mstart = fstart + starts[i]!

      if (type === TYPE_DELETION) {
        const mlen = lengths[i]!
        const mend = mstart + mlen
        const delVisStart = Math.max(mstart, regionStart) - regionStart
        const delVisEnd = Math.min(mend, regionEnd) - regionStart

        if (delVisStart < delVisEnd) {
          deletionChanges[delVisStart]++
          deletionChanges[delVisEnd]--
        }
      } else if (type === TYPE_MISMATCH) {
        const epos = mstart - regionStart
        if (epos >= 0 && epos < regionSize) {
          snpEvents.push({ pos: epos, base: bases[i]!, strand: fstrand })
        }
      }
    }
  }

  // Build bins with prefix sums
  const bins: PreBaseCoverageBin[] = new Array(regionSize)
  let depth = 0
  let strandPlus = 0
  let strandMinus = 0
  let deletionDepth = 0

  for (let i = 0; i < regionSize; i++) {
    depth += depthChanges[i]!
    strandPlus += strandPlusChanges[i]!
    strandMinus += strandMinusChanges[i]!
    deletionDepth += deletionChanges[i]!

    bins[i] = {
      depth: depth - deletionDepth,
      readsCounted: depth,
      ref: {
        entryDepth: depth,
        [-1]: strandMinus,
        [0]: 0,
        [1]: strandPlus,
      },
      snps: {},
      mods: {},
      nonmods: {},
      delskips: deletionDepth > 0 ? { deletion: deletionDepth } : {},
      noncov: {},
    }
  }

  // Apply SNP events (point updates, unavoidable)
  for (const evt of snpEvents) {
    const bin = bins[evt.pos]!
    const baseChar = String.fromCharCode(evt.base)
    bin.snps[baseChar] = ((bin.snps[baseChar] as number) || 0) + 1
    bin.ref.entryDepth--
    bin.ref[evt.strand]--
  }

  return bins
}

// Mismatch scenarios
const MISMATCH_SCENARIOS = [
  {
    name: '1k features, 10kb, 1% mismatches, 0.1% deletions',
    features: 1000,
    regionSize: 10_000,
    mismatchRate: 0.01,
    deletionRate: 0.001,
  },
  {
    name: '5k features, 10kb, 1% mismatches, 0.1% deletions',
    features: 5000,
    regionSize: 10_000,
    mismatchRate: 0.01,
    deletionRate: 0.001,
  },
  {
    name: '1k features, 10kb, 5% mismatches, 1% deletions (high error)',
    features: 1000,
    regionSize: 10_000,
    mismatchRate: 0.05,
    deletionRate: 0.01,
  },
] as const

for (const scenario of MISMATCH_SCENARIOS) {
  const regionStart = 0
  const regionEnd = scenario.regionSize
  const features = generateFeaturesWithMismatches(
    scenario.features,
    regionStart,
    regionEnd,
    scenario.mismatchRate,
    scenario.deletionRate,
  )

  describe(`Full coverage processing - ${scenario.name}`, () => {
    bench('original (separate depth + mismatches, per-base)', () => {
      const bins = processDepthOriginal(features, regionStart, regionEnd)
      processMismatchesOriginal(features, bins, regionStart, regionEnd)
    })

    bench('prefix sum depth + original mismatches', () => {
      const bins = processDepthPrefixSumOptimized(features, regionStart, regionEnd)
      processMismatchesOriginal(features, bins, regionStart, regionEnd)
    })

    bench('prefix sum depth + prefix sum mismatches', () => {
      const bins = processDepthPrefixSumOptimized(features, regionStart, regionEnd)
      processMismatchesPrefixSum(features, bins, regionStart, regionEnd)
    })

    bench('combined prefix sum (depth + mismatches together)', () => {
      processAllPrefixSum(features, regionStart, regionEnd)
    })
  })
}

// ============================================================
// CORRECTNESS VERIFICATION
// ============================================================

// Verify correctness
const testFeatures = generateFeatures(100, 0, 1000)
const originalResult = processDepthOriginal(testFeatures, 0, 1000)
const prefixResult = processDepthPrefixSum(testFeatures, 0, 1000)
const optimizedResult = processDepthPrefixSumOptimized(testFeatures, 0, 1000)

for (let i = 0; i < 1000; i++) {
  const orig = originalResult[i]
  const prefix = prefixResult[i]
  const opt = optimizedResult[i]
  if (orig && prefix && opt) {
    if (
      orig.depth !== prefix.depth ||
      orig.depth !== opt.depth ||
      orig.ref[1] !== prefix.ref[1] ||
      orig.ref[-1] !== prefix.ref[-1]
    ) {
      console.error(`Mismatch at position ${i}:`, {
        original: { depth: orig.depth, plus: orig.ref[1], minus: orig.ref[-1] },
        prefix: { depth: prefix.depth, plus: prefix.ref[1], minus: prefix.ref[-1] },
        optimized: { depth: opt.depth, plus: opt.ref[1], minus: opt.ref[-1] },
      })
    }
  }
}
