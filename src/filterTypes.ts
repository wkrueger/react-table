import { Row } from './globalTypes'

export interface FilterTypeHandler<Comparator = string> {
  (rows: Row[], id: string, filterValue: Comparator): Row[]
}

function filterType<C>(
  handler: FilterTypeHandler<C>,
  autoRemove: (x: C) => boolean
) {
  return {
    ...handler,
    autoRemove,
  } as typeof handler & { autoRemove: (x: C) => boolean }
}

export const text = filterType(
  (rows, id, filterValue) => {
    rows = rows.filter(row => {
      const rowValue = row.values![id]
      return String(rowValue)
        .toLowerCase()
        .includes(String(filterValue).toLowerCase())
    })
    return rows
  },
  val => !val
)

export const exactText = filterType(
  (rows, id, filterValue) => {
    return rows.filter(row => {
      const rowValue = row.values![id]
      return rowValue !== undefined
        ? String(rowValue).toLowerCase() === String(filterValue).toLowerCase()
        : true
    })
  },
  val => !val
)

export const exactTextCase = filterType(
  (rows, id, filterValue) => {
    return rows.filter(row => {
      const rowValue = row.values![id]
      return rowValue !== undefined
        ? String(rowValue) === String(filterValue)
        : true
    })
  },
  val => !val
)

export const includes = filterType(
  (rows, id, filterValue: string[]) => {
    return rows.filter(row => {
      const rowValue = row.values![id]
      return filterValue.includes(rowValue)
    })
  },
  val => !val || !val.length
)

export const includesAll = filterType(
  (rows, id, filterValue: string[]) => {
    return rows.filter(row => {
      const rowValue = row.values![id]
      return (
        rowValue &&
        rowValue.length &&
        filterValue.every(val => rowValue.includes(val))
      )
    })
  },
  val => !val || !val.length
)

export const exact = filterType(
  (rows, id, filterValue) => {
    return rows.filter(row => {
      const rowValue = row.values![id]
      return rowValue === filterValue
    })
  },
  val => typeof val === 'undefined'
)

export const equals = filterType(
  (rows, id, filterValue) => {
    return rows.filter(row => {
      const rowValue = row.values![id]
      // eslint-disable-next-line eqeqeq
      return rowValue == filterValue
    })
  },
  val => val == null
)

export const between = filterType(
  (rows, id, filterValue: [number, number]) => {
    let [min, max] = filterValue || []

    min = typeof min === 'number' ? min : -Infinity
    max = typeof max === 'number' ? max : Infinity

    if (min > max) {
      const temp = min
      min = max
      max = temp
    }

    return rows.filter(row => {
      const rowValue = row.values![id]
      return rowValue >= min && rowValue <= max
    })
  },
  val => !val || (typeof val[0] !== 'number' && typeof val[1] !== 'number')
)
