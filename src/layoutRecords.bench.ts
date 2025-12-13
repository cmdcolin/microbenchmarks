import { bench, describe } from 'vitest'

// Benchmark: LayoutFeature object creation vs SoA
// The question is whether the overhead of creating LayoutFeature objects
// is significant compared to the actual layout algorithm

interface Feature {
  id: () => string
  get: (key: string) => unknown
}

interface LayoutFeature {
  feature: Feature
  topPx: number
  heightPx: number
}

interface LayoutFeaturesSoA {
  features: Feature[]
  topPx: Int32Array
  // heightPx is often the same for all features, store once
}

function createMockFeature(id: number): Feature {
  const start = Math.floor(Math.random() * 10000)
  const end = start + 100 + Math.floor(Math.random() * 50)
  return {
    id: () => `feature-${id}`,
    get: (key: string) => {
      if (key === 'start') return start
      if (key === 'end') return end
      return undefined
    },
  }
}

// Simulate the layout algorithm (simplified)
class MockLayout {
  private nextTop = 0

  addRect(_id: string, _left: number, _right: number, height: number): number {
    const top = this.nextTop
    this.nextTop += height
    return top
  }

  reset() {
    this.nextTop = 0
  }
}

const FEATURE_COUNTS = [2000, 20000] as const

for (const count of FEATURE_COUNTS) {
  const features = Array.from({ length: count }, (_, i) => createMockFeature(i))
  const heightPx = 10
  const displayMode = 'normal'

  describe(`LayoutFeature creation: ${count} features`, () => {
    bench('AoS (current approach)', () => {
      const layout = new MockLayout()
      const layoutRecords: LayoutFeature[] = []

      for (const feature of features) {
        const s = feature.get('start') as number
        const e = feature.get('end') as number
        const topPx = layout.addRect(feature.id(), s, e, heightPx)

        layoutRecords.push({
          feature,
          topPx: displayMode === 'collapse' ? 0 : topPx,
          heightPx,
        })
      }

      return layoutRecords
    })

    bench('SoA (typed arrays)', () => {
      const layout = new MockLayout()
      const resultFeatures: Feature[] = new Array(features.length)
      const topPxArray = new Int32Array(features.length)
      let resultCount = 0

      for (let i = 0; i < features.length; i++) {
        const feature = features[i]!
        const s = feature.get('start') as number
        const e = feature.get('end') as number
        const topPx = layout.addRect(feature.id(), s, e, heightPx)

        resultFeatures[resultCount] = feature
        topPxArray[resultCount] = displayMode === 'collapse' ? 0 : topPx
        resultCount++
      }

      return { features: resultFeatures, topPx: topPxArray, heightPx, count: resultCount }
    })

    bench('SoA with pre-allocated arrays', () => {
      const layout = new MockLayout()
      // Pre-allocate outside the hot path
      const resultFeatures: Feature[] = []
      const topPxValues: number[] = []

      for (const feature of features) {
        const s = feature.get('start') as number
        const e = feature.get('end') as number
        const topPx = layout.addRect(feature.id(), s, e, heightPx)

        resultFeatures.push(feature)
        topPxValues.push(displayMode === 'collapse' ? 0 : topPx)
      }

      return { features: resultFeatures, topPx: topPxValues, heightPx }
    })
  })

  describe(`LayoutFeature iteration: ${count} features`, () => {
    // Pre-create the layout records for iteration benchmarks
    const layout = new MockLayout()
    const aosRecords: LayoutFeature[] = []
    const soaFeatures: Feature[] = []
    const soaTopPx = new Int32Array(count)

    for (let i = 0; i < features.length; i++) {
      const feature = features[i]!
      const s = feature.get('start') as number
      const e = feature.get('end') as number
      const topPx = layout.addRect(feature.id(), s, e, heightPx)

      aosRecords.push({ feature, topPx, heightPx })
      soaFeatures.push(feature)
      soaTopPx[i] = topPx
    }

    bench('AoS iteration (destructure)', () => {
      let sum = 0
      for (const record of aosRecords) {
        const { feature, topPx, heightPx } = record
        // Simulate accessing values like render functions do
        sum += topPx + heightPx + (feature.get('start') as number)
      }
      return sum
    })

    bench('SoA iteration (index access)', () => {
      let sum = 0
      const len = soaFeatures.length
      for (let i = 0; i < len; i++) {
        const feature = soaFeatures[i]!
        const topPx = soaTopPx[i]!
        // Simulate accessing values
        sum += topPx + heightPx + (feature.get('start') as number)
      }
      return sum
    })

    bench('AoS iteration (for...of with index)', () => {
      let sum = 0
      let i = 0
      for (const record of aosRecords) {
        sum += record.topPx + record.heightPx + (record.feature.get('start') as number)
        i++
      }
      return sum
    })
  })
}

// Benchmark: Does filtering (null check) add significant overhead?
describe('Filter overhead: 20000 features', () => {
  const features = Array.from({ length: 20000 }, (_, i) => createMockFeature(i))
  const heightPx = 10

  bench('with inline null check', () => {
    const layout = new MockLayout()
    const layoutRecords: LayoutFeature[] = []

    for (const feature of features) {
      const s = feature.get('start') as number
      const e = feature.get('end') as number
      const topPx = layout.addRect(feature.id(), s, e, heightPx)

      // Simulate potential null return (in real code, addRect can return null)
      if (topPx !== null) {
        layoutRecords.push({ feature, topPx, heightPx })
      }
    }

    return layoutRecords
  })

  bench('with .filter(notEmpty)', () => {
    const layout = new MockLayout()
    const layoutRecords = features
      .map(feature => {
        const s = feature.get('start') as number
        const e = feature.get('end') as number
        const topPx = layout.addRect(feature.id(), s, e, heightPx)
        return topPx !== null ? { feature, topPx, heightPx } : null
      })
      .filter((x): x is LayoutFeature => x !== null)

    return layoutRecords
  })
})
