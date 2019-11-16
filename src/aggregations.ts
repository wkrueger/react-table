export function sum(values: number[]) {
  return values.reduce((sum, next) => sum + next, 0)
}

export function average(values) {
  return Math.round((sum(values) / values.length) * 100) / 100
}

export function median(values: number[]) {
  let min = values[0] || 0
  let max = values[0] || 0

  values.forEach(value => {
    min = Math.min(min, value)
    max = Math.max(max, value)
  })

  return (min + max) / 2
}

export function uniqueCount(values: number[]) {
  return new Set(values).size
}

export function count(values: number[]) {
  return values.length
}
