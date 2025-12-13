import { bench, describe } from 'vitest'

// Simulate feature.get() overhead
interface Feature {
  _start: number
  _end: number
  _strand: number
  _mismatches: { type: string; start: number; cliplen: number }[]
  get(field: string): unknown
}

function createFeature(start: number, end: number): Feature {
  return {
    _start: start,
    _end: end,
    _strand: 1,
    _mismatches: [
      { type: 'mismatch', start: 10, cliplen: 0 },
      { type: 'softclip', start: 0, cliplen: 5 },
    ],
    get(field: string) {
      switch (field) {
        case 'start':
          return this._start
        case 'end':
          return this._end
        case 'strand':
          return this._strand
        case 'mismatches':
          return this._mismatches
        default:
          return undefined
      }
    },
  }
}

// Direct property access feature
interface DirectFeature {
  start: number
  end: number
  strand: number
  mismatches: { type: string; start: number; cliplen: number }[]
}

function createDirectFeature(start: number, end: number): DirectFeature {
  return {
    start,
    end,
    strand: 1,
    mismatches: [
      { type: 'mismatch', start: 10, cliplen: 0 },
      { type: 'softclip', start: 0, cliplen: 5 },
    ],
  }
}

// Generate features
function generateFeatures(count: number, regionSize: number): Feature[] {
  const features: Feature[] = []
  for (let i = 0; i < count; i++) {
    const readLength = 100 + Math.floor(Math.random() * 50)
    const start = Math.floor(Math.random() * (regionSize - readLength))
    features.push(createFeature(start, start + readLength))
  }
  return features
}

function generateDirectFeatures(
  count: number,
  regionSize: number,
): DirectFeature[] {
  const features: DirectFeature[] = []
  for (let i = 0; i < count; i++) {
    const readLength = 100 + Math.floor(Math.random() * 50)
    const start = Math.floor(Math.random() * (regionSize - readLength))
    features.push(createDirectFeature(start, start + readLength))
  }
  return features
}

// Simulate iterMap from @jbrowse/core
function iterMap<T, U>(
  iterable: Iterable<T>,
  func: (item: T) => U,
  _sizeHint?: number,
): U[] {
  const results: U[] = []
  for (const item of iterable) {
    results.push(func(item))
  }
  return results
}

// ============================================================
// LAYOUT FEATURE IMPLEMENTATIONS
// ============================================================

interface LayoutRecord {
  leftPx: number
  rightPx: number
  topPx: number
}

// Original style with multiple get() calls
function layoutFeatureOriginal(
  feature: Feature,
  bpPerPx: number,
  regionStart: number,
  showSoftClip: boolean,
): LayoutRecord {
  let expansionBefore = 0
  let expansionAfter = 0

  if (showSoftClip) {
    const mismatches = feature.get('mismatches') as
      | { type: string; start: number; cliplen: number }[]
      | undefined
    if (mismatches) {
      for (const { type, start, cliplen = 0 } of mismatches) {
        if (type === 'softclip') {
          if (start === 0) {
            expansionBefore = cliplen
          } else {
            expansionAfter = cliplen
          }
        }
      }
    }
  }

  const s = (feature.get('start') as number) - expansionBefore
  const e = (feature.get('end') as number) + expansionAfter
  const leftPx = (s - regionStart) / bpPerPx
  const rightPx = (e - regionStart) / bpPerPx

  // Simulate addRect returning a value
  const topPx = Math.floor(Math.random() * 100)

  return { leftPx, rightPx, topPx }
}

// Optimized with cached start/end
function layoutFeatureOptimized(
  feature: Feature,
  bpPerPx: number,
  regionStart: number,
  showSoftClip: boolean,
): LayoutRecord {
  const featureStart = feature.get('start') as number
  const featureEnd = feature.get('end') as number

  let expansionBefore = 0
  let expansionAfter = 0

  if (showSoftClip) {
    const mismatches = feature.get('mismatches') as
      | { type: string; start: number; cliplen: number }[]
      | undefined
    if (mismatches) {
      for (const mismatch of mismatches) {
        if (mismatch.type === 'softclip') {
          const cliplen = mismatch.cliplen ?? 0
          if (mismatch.start === 0) {
            expansionBefore = cliplen
          } else {
            expansionAfter = cliplen
          }
        }
      }
    }
  }

  const s = featureStart - expansionBefore
  const e = featureEnd + expansionAfter

  const topPx = Math.floor(Math.random() * 100)

  const leftPx = (s - regionStart) / bpPerPx
  const rightPx = (e - regionStart) / bpPerPx

  return { leftPx, rightPx, topPx }
}

// Direct property access (no get() method)
function layoutFeatureDirect(
  feature: DirectFeature,
  bpPerPx: number,
  regionStart: number,
  showSoftClip: boolean,
): LayoutRecord {
  let expansionBefore = 0
  let expansionAfter = 0

  if (showSoftClip) {
    const mismatches = feature.mismatches
    if (mismatches) {
      for (const mismatch of mismatches) {
        if (mismatch.type === 'softclip') {
          const cliplen = mismatch.cliplen ?? 0
          if (mismatch.start === 0) {
            expansionBefore = cliplen
          } else {
            expansionAfter = cliplen
          }
        }
      }
    }
  }

  const s = feature.start - expansionBefore
  const e = feature.end + expansionAfter

  const topPx = Math.floor(Math.random() * 100)

  const leftPx = (s - regionStart) / bpPerPx
  const rightPx = (e - regionStart) / bpPerPx

  return { leftPx, rightPx, topPx }
}

// ============================================================
// ITERATION PATTERN TESTS
// ============================================================

const FEATURE_COUNTS = [2000, 20000] as const
const REGION_SIZE = 10000
const BP_PER_PX = 0.1
const REGION_START = 0

for (const count of FEATURE_COUNTS) {
  const features = generateFeatures(count, REGION_SIZE)
  const directFeatures = generateDirectFeatures(count, REGION_SIZE)
  const featureMap = new Map(features.map((f, i) => [i, f]))

  describe(`layoutFeature ${count} features`, () => {
    bench('original (multiple get() calls)', () => {
      const results: LayoutRecord[] = []
      for (const feature of features) {
        results.push(
          layoutFeatureOriginal(feature, BP_PER_PX, REGION_START, true),
        )
      }
      return results
    })

    bench('optimized (cached start/end)', () => {
      const results: LayoutRecord[] = []
      for (const feature of features) {
        results.push(
          layoutFeatureOptimized(feature, BP_PER_PX, REGION_START, true),
        )
      }
      return results
    })

    bench('direct property access (no get())', () => {
      const results: LayoutRecord[] = []
      for (const feature of directFeatures) {
        results.push(
          layoutFeatureDirect(feature, BP_PER_PX, REGION_START, true),
        )
      }
      return results
    })
  })

  describe(`iteration pattern ${count} features`, () => {
    bench('iterMap over Map.values()', () => {
      return iterMap(
        featureMap.values(),
        feature => layoutFeatureOptimized(feature, BP_PER_PX, REGION_START, true),
        featureMap.size,
      )
    })

    bench('for...of over Map.values()', () => {
      const results: LayoutRecord[] = []
      for (const feature of featureMap.values()) {
        results.push(
          layoutFeatureOptimized(feature, BP_PER_PX, REGION_START, true),
        )
      }
      return results
    })

    bench('for...of over array', () => {
      const results: LayoutRecord[] = []
      for (const feature of features) {
        results.push(
          layoutFeatureOptimized(feature, BP_PER_PX, REGION_START, true),
        )
      }
      return results
    })

    bench('traditional for loop over array', () => {
      const results: LayoutRecord[] = []
      for (let i = 0; i < features.length; i++) {
        results.push(
          layoutFeatureOptimized(features[i]!, BP_PER_PX, REGION_START, true),
        )
      }
      return results
    })
  })
}

// ============================================================
// OBJECT CREATION PATTERNS
// ============================================================

describe('Object creation patterns (20000 iterations)', () => {
  const iterations = 20000

  bench('create new object each time', () => {
    const results: LayoutRecord[] = []
    for (let i = 0; i < iterations; i++) {
      results.push({
        leftPx: i * 0.1,
        rightPx: i * 0.1 + 10,
        topPx: i % 100,
      })
    }
    return results
  })

  bench('reuse object (mutate)', () => {
    const results: LayoutRecord[] = []
    const record = { leftPx: 0, rightPx: 0, topPx: 0 }
    for (let i = 0; i < iterations; i++) {
      record.leftPx = i * 0.1
      record.rightPx = i * 0.1 + 10
      record.topPx = i % 100
      results.push({ ...record }) // Still need to copy for storage
    }
    return results
  })

  bench('pre-allocate array of objects', () => {
    const results: LayoutRecord[] = new Array(iterations)
    for (let i = 0; i < iterations; i++) {
      results[i] = {
        leftPx: i * 0.1,
        rightPx: i * 0.1 + 10,
        topPx: i % 100,
      }
    }
    return results
  })

  bench('typed arrays (SoA)', () => {
    const leftPx = new Float64Array(iterations)
    const rightPx = new Float64Array(iterations)
    const topPx = new Float64Array(iterations)
    for (let i = 0; i < iterations; i++) {
      leftPx[i] = i * 0.1
      rightPx[i] = i * 0.1 + 10
      topPx[i] = i % 100
    }
    return { leftPx, rightPx, topPx }
  })
})
