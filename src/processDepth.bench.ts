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
