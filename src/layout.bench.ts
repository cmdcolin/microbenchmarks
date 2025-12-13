import { bench, describe } from 'vitest'

// Simulate the GranularRectLayout with flat interval arrays

// Simple interval-based row
class LayoutRowSimple {
  private intervals: number[] = []
  private padding = 1

  isRangeClear(left: number, right: number): boolean {
    const intervals = this.intervals
    const len = intervals.length
    if (len === 0) return true

    for (let i = 0; i < len; i += 2) {
      const start = intervals[i]!
      const end = intervals[i + 1]!
      if (end > left && start < right) {
        return false
      }
    }
    return true
  }

  addRect(left: number, right: number): void {
    this.intervals.push(left, right + this.padding)
  }
}

// Optimized with binary search for larger arrays
class LayoutRowBinarySearch {
  private intervals: number[] = []
  private padding = 1

  isRangeClear(left: number, right: number): boolean {
    const intervals = this.intervals
    const len = intervals.length
    if (len === 0) return true

    // Linear scan for small arrays
    if (len < 40) {
      for (let i = 0; i < len; i += 2) {
        const start = intervals[i]!
        const end = intervals[i + 1]!
        if (end > left && start < right) {
          return false
        }
      }
      return true
    }

    // Binary search for larger arrays
    let low = 0
    let high = len >> 1

    while (low < high) {
      const mid = (low + high) >>> 1
      const midIdx = mid << 1
      if (intervals[midIdx + 1]! <= left) {
        low = mid + 1
      } else {
        high = mid
      }
    }

    const idx = low << 1
    if (idx >= len) return true
    return intervals[idx]! >= right
  }

  addRect(left: number, right: number): void {
    const r = right + this.padding
    const intervals = this.intervals
    const len = intervals.length

    if (len < 40) {
      // Linear insertion for small arrays
      let idx = len
      for (let i = 0; i < len; i += 2) {
        if (left < intervals[i]!) {
          idx = i
          break
        }
      }
      intervals.splice(idx, 0, left, r)
    } else {
      // Binary search insertion
      let low = 0
      let high = len >> 1

      while (low < high) {
        const mid = (low + high) >>> 1
        const midIdx = mid << 1
        if (intervals[midIdx]! < left) {
          low = mid + 1
        } else {
          high = mid
        }
      }

      intervals.splice(low << 1, 0, left, r)
    }
  }
}

// Using typed arrays
class LayoutRowTypedArray {
  private intervals: Int32Array
  private length = 0
  private capacity = 64
  private padding = 1

  constructor() {
    this.intervals = new Int32Array(this.capacity)
  }

  private grow() {
    this.capacity *= 2
    const newIntervals = new Int32Array(this.capacity)
    newIntervals.set(this.intervals)
    this.intervals = newIntervals
  }

  isRangeClear(left: number, right: number): boolean {
    const intervals = this.intervals
    const len = this.length

    if (len === 0) return true

    for (let i = 0; i < len; i += 2) {
      const start = intervals[i]!
      const end = intervals[i + 1]!
      if (end > left && start < right) {
        return false
      }
    }
    return true
  }

  addRect(left: number, right: number): void {
    if (this.length + 2 > this.capacity) {
      this.grow()
    }
    this.intervals[this.length++] = left
    this.intervals[this.length++] = right + this.padding
  }
}

// Simple layout using array of rows
class SimpleLayout {
  private rows: LayoutRowSimple[] = []
  private maxHeight: number

  constructor(maxHeight = 1000) {
    this.maxHeight = maxHeight
  }

  addRect(left: number, right: number, height: number): number | null {
    for (let top = 0; top <= this.maxHeight - height; top++) {
      let clear = true
      for (let y = top; y < top + height; y++) {
        const row = this.rows[y]
        if (row && !row.isRangeClear(left, right)) {
          clear = false
          break
        }
      }
      if (clear) {
        for (let y = top; y < top + height; y++) {
          if (!this.rows[y]) {
            this.rows[y] = new LayoutRowSimple()
          }
          this.rows[y]!.addRect(left, right)
        }
        return top
      }
    }
    return null
  }
}

// Layout with binary search rows
class BinarySearchLayout {
  private rows: LayoutRowBinarySearch[] = []
  private maxHeight: number

  constructor(maxHeight = 1000) {
    this.maxHeight = maxHeight
  }

  addRect(left: number, right: number, height: number): number | null {
    for (let top = 0; top <= this.maxHeight - height; top++) {
      let clear = true
      for (let y = top; y < top + height; y++) {
        const row = this.rows[y]
        if (row && !row.isRangeClear(left, right)) {
          clear = false
          break
        }
      }
      if (clear) {
        for (let y = top; y < top + height; y++) {
          if (!this.rows[y]) {
            this.rows[y] = new LayoutRowBinarySearch()
          }
          this.rows[y]!.addRect(left, right)
        }
        return top
      }
    }
    return null
  }
}

// Layout with typed array rows
class TypedArrayLayout {
  private rows: LayoutRowTypedArray[] = []
  private maxHeight: number

  constructor(maxHeight = 1000) {
    this.maxHeight = maxHeight
  }

  addRect(left: number, right: number, height: number): number | null {
    for (let top = 0; top <= this.maxHeight - height; top++) {
      let clear = true
      for (let y = top; y < top + height; y++) {
        const row = this.rows[y]
        if (row && !row.isRangeClear(left, right)) {
          clear = false
          break
        }
      }
      if (clear) {
        for (let y = top; y < top + height; y++) {
          if (!this.rows[y]) {
            this.rows[y] = new LayoutRowTypedArray()
          }
          this.rows[y]!.addRect(left, right)
        }
        return top
      }
    }
    return null
  }
}

// Generate features like short reads
function generateShortReadFeatures(count: number, regionSize: number) {
  const features: { start: number; end: number }[] = []
  for (let i = 0; i < count; i++) {
    const readLength = 100 + Math.floor(Math.random() * 50) // 100-150bp
    const start = Math.floor(Math.random() * (regionSize - readLength))
    features.push({ start, end: start + readLength })
  }
  // Sort by start position (like BAM features typically come)
  features.sort((a, b) => a.start - b.start)
  return features
}

// Generate features like long reads
function generateLongReadFeatures(count: number, regionSize: number) {
  const features: { start: number; end: number }[] = []
  for (let i = 0; i < count; i++) {
    const readLength = 5000 + Math.floor(Math.random() * 45000) // 5-50kb
    const start = Math.floor(Math.random() * (regionSize - readLength))
    features.push({ start, end: start + readLength })
  }
  features.sort((a, b) => a.start - b.start)
  return features
}

const SCENARIOS = [
  {
    name: 'Short reads 30x (2000 features, 10kb)',
    features: generateShortReadFeatures(2000, 10000),
    pitchX: 10,
    heightPx: 10,
  },
  {
    name: 'Short reads 300x (20000 features, 10kb)',
    features: generateShortReadFeatures(20000, 10000),
    pitchX: 10,
    heightPx: 10,
  },
  {
    name: 'Long reads 30x (60 features, 100kb)',
    features: generateLongReadFeatures(60, 100000),
    pitchX: 10,
    heightPx: 10,
  },
  {
    name: 'Long reads 300x (600 features, 100kb)',
    features: generateLongReadFeatures(600, 100000),
    pitchX: 10,
    heightPx: 10,
  },
] as const

for (const scenario of SCENARIOS) {
  describe(`Layout: ${scenario.name}`, () => {
    bench('Simple (linear scan)', () => {
      const layout = new SimpleLayout()
      for (const f of scenario.features) {
        layout.addRect(
          Math.floor(f.start / scenario.pitchX),
          Math.floor(f.end / scenario.pitchX),
          1,
        )
      }
    })

    bench('Binary search (hybrid)', () => {
      const layout = new BinarySearchLayout()
      for (const f of scenario.features) {
        layout.addRect(
          Math.floor(f.start / scenario.pitchX),
          Math.floor(f.end / scenario.pitchX),
          1,
        )
      }
    })

    bench('Typed array rows', () => {
      const layout = new TypedArrayLayout()
      for (const f of scenario.features) {
        layout.addRect(
          Math.floor(f.start / scenario.pitchX),
          Math.floor(f.end / scenario.pitchX),
          1,
        )
      }
    })
  })
}
