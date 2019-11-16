import React from 'react'
import {
  Cell,
  Column,
  HeaderGroup,
  HeaderComponent,
  Row,
  Hook,
  TablePlugin,
  TableInstance,
} from './globalTypes'

export const defaultColumn = {
  Cell: ({ cell: { value = '' } }: { cell: Cell }) => String(value),
  show: true,
  width: 150,
  minWidth: 0,
  maxWidth: Number.MAX_SAFE_INTEGER,
}

// SSR has issues with useLayoutEffect still, so use useEffect during SSR
export const safeUseLayoutEffect =
  typeof window !== 'undefined' && process.env.NODE_ENV === 'production'
    ? React.useLayoutEffect
    : React.useEffect

// Find the depth of the columns
export function findMaxDepth(columns: Column[], depth = 0): number {
  return columns.reduce((prev, curr) => {
    if (curr.columns) {
      return Math.max(prev, findMaxDepth(curr.columns, depth + 1))
    }
    return depth
  }, 0)
}

export function decorateColumn(
  column: Column,
  userDefaultColumn: Column,
  parent?: Column,
  depth?: number,
  index?: number
) {
  // Apply the userDefaultColumn
  column = { ...defaultColumn, ...userDefaultColumn, ...column }

  // First check for string accessor
  let { id, accessor, Header } = column

  if (typeof accessor === 'string') {
    id = id || accessor
    const accessorPath = accessor.split('.')
    accessor = row => getBy(row, accessorPath)
  }

  if (!id && typeof Header === 'string' && Header) {
    id = Header
  }

  if (!id && column.columns) {
    console.error(column)
    throw new Error('A column ID (or unique "Header" value) is required!')
  }

  if (!id) {
    console.error(column)
    throw new Error('A column ID (or string accessor) is required!')
  }

  column = {
    // Make sure there is a fallback header, just in case
    Header: () => <>&nbsp;</>,
    ...column,
    // Materialize and override this stuff
    id,
    accessor,
    parent,
    depth,
    index,
  }

  return column
}

// Build the visible columns, headers and flat column list
export function decorateColumnTree(
  columns: Column[],
  defaultColumn: Column,
  parent?: Column,
  depth = 0
) {
  return columns.map((column, columnIndex) => {
    column = decorateColumn(column, defaultColumn, parent, depth, columnIndex)
    if (column.columns) {
      column.columns = decorateColumnTree(
        column.columns,
        defaultColumn,
        column,
        depth + 1
      )
    }
    return column
  })
}

// Build the header groups from the bottom up
export function makeHeaderGroups(flatColumns: Column[], defaultColumn: Column) {
  const headerGroups = [] as HeaderGroup[]

  // Build each header group from the bottom up
  const buildGroup = (columns: Column[], depth: number) => {
    const headerGroup = {
      headers: [],
    } as HeaderGroup

    const parentColumns = [] as Column[]

    // Do any of these columns have parents?
    const hasParents = columns.some(col => col.parent)

    columns.forEach(column => {
      // Are we the first column in this group?
      const isFirst = !parentColumns.length

      // What is the latest (last) parent column?
      let latestParentColumn = [...parentColumns].reverse()[0]

      // If the column has a parent, add it if necessary
      const parent = column.parent
      if (parent) {
        const similarParentColumns = parentColumns.filter(
          d => d.originalID === parent.id
        )
        if (isFirst || latestParentColumn.originalID !== parent.id) {
          parentColumns.push({
            ...column.parent,
            originalID: parent.id,
            id: [parent.id, similarParentColumns.length].join('_'),
          })
        }
      } else if (hasParents) {
        // If other columns have parents, we'll need to add a place holder if necessary
        const originalID = [column.id, 'placeholder'].join('_')
        const similarParentColumns = parentColumns.filter(
          d => d.originalID === originalID
        )
        const placeholderColumn = decorateColumn(
          {
            originalID,
            id: [column.id, 'placeholder', similarParentColumns.length].join(
              '_'
            ),
            placeholderOf: column,
          },
          defaultColumn
        )
        if (
          isFirst ||
          latestParentColumn.originalID !== placeholderColumn.originalID
        ) {
          parentColumns.push(placeholderColumn)
        }
      }

      // Establish the new headers[] relationship on the parent
      if (column.parent || hasParents) {
        latestParentColumn = [...parentColumns].reverse()[0]
        latestParentColumn.headers = latestParentColumn.headers || []
        if (!latestParentColumn.headers.includes(column)) {
          latestParentColumn.headers.push(column)
        }
      }

      column.totalHeaderCount = column.headers
        ? column.headers.reduce(
            (sum, header) => sum + header.totalHeaderCount!,
            0
          )
        : 1 // Leaf node columns take up at least one count
      headerGroup.headers.push(column)
    })

    headerGroups.push(headerGroup)

    if (parentColumns.length) {
      buildGroup(parentColumns, depth + 1)
    }
  }

  buildGroup(flatColumns, 0)

  return headerGroups.reverse()
}

export function determineHeaderVisibility(instance: TableInstance) {
  const { headers } = instance

  const handleColumn = (column: Column, parentVisible?: boolean) => {
    column.isVisible = parentVisible
      ? typeof column.show === 'function'
        ? column.show(instance)
        : !!column.show
      : false

    let totalVisibleHeaderCount = 0

    if (column.headers && column.headers.length) {
      column.headers.forEach(
        subColumn =>
          (totalVisibleHeaderCount += handleColumn(subColumn, column.isVisible))
      )
    } else {
      totalVisibleHeaderCount = column.isVisible ? 1 : 0
    }

    column.totalVisibleHeaderCount = totalVisibleHeaderCount

    return totalVisibleHeaderCount
  }

  let totalVisibleHeaderCount = 0

  headers!.forEach(
    subHeader => (totalVisibleHeaderCount += handleColumn(subHeader, true))
  )
}

export function getBy(
  obj: Record<string, any>,
  path: string[],
  defaultValue?: any
) {
  if (!path) {
    return obj
  }
  const pathObj = makePathArray(path)
  let val
  try {
    val = pathObj.reduce((cursor, pathPart) => cursor[pathPart], obj)
  } catch (e) {
    // continue regardless of error
  }
  return typeof val !== 'undefined' ? val : defaultValue
}

export function defaultOrderByFn(
  arr: Row[],
  funcs: ((rowA: Row, rowB: Row) => number)[],
  dirs: (boolean | 'asc' | 'desc')[]
) {
  return [...arr].sort((rowA, rowB) => {
    for (let i = 0; i < funcs.length; i += 1) {
      const sortFn = funcs[i]
      const desc = dirs[i] === false || dirs[i] === 'desc'
      const sortInt = sortFn(rowA, rowB)
      if (sortInt !== 0) {
        return desc ? -sortInt : sortInt
      }
    }
    return dirs[0] ? rowA.index - rowB.index : rowB.index - rowA.index
  })
}

export function getFirstDefined(...args: any[]) {
  for (let i = 0; i < args.length; i += 1) {
    if (typeof args[i] !== 'undefined') {
      return args[i]
    }
  }
}

export function defaultGroupByFn(rows: Row[], columnID: string) {
  return rows.reduce(
    (prev, row, i) => {
      // TODO: Might want to implement a key serializer here so
      // irregular column values can still be grouped if needed?
      const resKey = `${row.values![columnID]}`
      prev[resKey] = Array.isArray(prev[resKey]) ? prev[resKey] : []
      prev[resKey].push(row)
      return prev
    },
    {} as Record<string, Row[]>
  )
}

export function getElementDimensions(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  const margins = {
    left: parseInt(style.marginLeft),
    right: parseInt(style.marginRight),
  }
  const padding = {
    left: parseInt(style.paddingLeft),
    right: parseInt(style.paddingRight),
  }
  return {
    left: Math.ceil(rect.left),
    width: Math.ceil(rect.width),
    outerWidth: Math.ceil(
      rect.width + margins.left + margins.right + padding.left + padding.right
    ),
    marginLeft: margins.left,
    marginRight: margins.right,
    paddingLeft: padding.left,
    paddingRight: padding.right,
    scrollWidth: element.scrollWidth,
  }
}

export function flexRender<Props extends {}>(
  Comp: React.ComponentType | JSX.Element,
  props: Props
): JSX.Element {
  const _comp: any = Comp
  return isReactComponent(_comp) ? <_comp {...props} /> : _comp
}

function isClassComponent(component: any): component is React.ComponentClass {
  return (
    typeof component === 'function' &&
    !!(() => {
      let proto = Object.getPrototypeOf(component)
      return proto.prototype && proto.prototype.isReactComponent
    })()
  )
}

function isFunctionComponent(
  component: any
): component is React.FunctionComponent {
  return typeof component === 'function'
}

function isReactComponent(component: any): component is React.ComponentType {
  return isClassComponent(component) || isFunctionComponent(component)
}

export const mergeProps = (...groups: Record<string, any>[]): unknown => {
  let props = {} as Record<string, any>
  groups.forEach(({ style = {}, className, ...rest } = {}) => {
    props = {
      ...props,
      ...rest,
      style: {
        ...(props.style || {}),
        ...style,
      },
      className: [props.className, className].filter(Boolean).join(' '),
    }
  })
  if (props.className === '') {
    delete props.className
  }
  return props
}

export const applyHooks = <T,>(hooks: Hook[], initial: T, ...args: any[]): T =>
  hooks.reduce((prev, next: any) => {
    const nextValue = next(prev, ...args)
    if (typeof nextValue === 'undefined') {
      throw new Error(
        'React Table: A hook just returned undefined! This is not allowed.'
      )
    }
    return nextValue
  }, initial)

export const applyPropHooks = (hooks: Hook[], ...args: any[]) =>
  hooks.reduce(
    (prev, next: any) => mergeProps(prev, next(...args)) as Record<string, any>,
    {}
  )

export const warnUnknownProps = (props: Record<string, any>) => {
  if (Object.keys(props).length) {
    throw new Error(
      `Unknown options passed to useReactTable:

${JSON.stringify(props, null, 2)}`
    )
  }
}

export function sum(arr: number[]) {
  return arr.reduce((prev, curr) => prev + curr, 0)
}

export function isFunction<T>(a: T) {
  if (typeof a === 'function') {
    return a
  }
}

export function flattenBy(columns: Column[], childKey: string) {
  const flatColumns = [] as Column[]

  const recurse = (columns: Column[]) => {
    columns.forEach((d: any) => {
      if (!d[childKey]) {
        flatColumns.push(d)
      } else {
        recurse(d[childKey])
      }
    })
  }

  recurse(columns)

  return flatColumns
}

export function ensurePluginOrder(
  plugins: TablePlugin[],
  befores: string[],
  pluginName: string,
  afters: string[]
) {
  const pluginIndex = plugins.findIndex(
    plugin => plugin.pluginName === pluginName
  )

  if (pluginIndex === -1) {
    throw new Error(`The plugin ${pluginName} was not found in the plugin list!
This usually means you need to need to name your plugin hook by setting the 'pluginName' property of the hook function, eg:

  ${pluginName}.pluginName = '${pluginName}'
`)
  }

  befores.forEach(before => {
    const beforeIndex = plugins.findIndex(
      plugin => plugin.pluginName === before
    )
    if (beforeIndex > -1 && beforeIndex > pluginIndex) {
      throw new Error(
        `React Table: The ${pluginName} plugin hook must be placed after the ${before} plugin hook!`
      )
    }
  })

  afters.forEach(after => {
    const afterIndex = plugins.findIndex(plugin => plugin.pluginName === after)
    if (afterIndex > -1 && afterIndex < pluginIndex) {
      throw new Error(
        `React Table: The ${pluginName} plugin hook must be placed before the ${after} plugin hook!`
      )
    }
  })
}

export function expandRows(
  rows: Row[],
  {
    manualExpandedKey,
    expanded,
    expandSubRows = true,
  }: { manualExpandedKey: string; expanded: string[]; expandSubRows?: boolean }
) {
  const expandedRows = [] as Row[]

  const handleRow = (row: Row) => {
    const key = row.path.join('.')

    row.isExpanded =
      (row.original && row.original[manualExpandedKey]) ||
      expanded.includes(key)

    row.canExpand = row.subRows && !!row.subRows.length

    expandedRows.push(row)

    if (expandSubRows && row.subRows && row.subRows.length && row.isExpanded) {
      row.subRows.forEach(handleRow)
    }
  }

  rows.forEach(handleRow)

  return expandedRows
}

//

function makePathArray(obj: any): string[] {
  return (
    flattenDeep(obj)
      // remove all periods in parts
      .map(d => String(d).replace('.', '_'))
      // join parts using period
      .join('.')
      // replace brackets with periods
      .replace(/\[/g, '.')
      .replace(/\]/g, '')
      // split it back out on periods
      .split('.')
  )
}

function flattenDeep<T>(arr: T[], newArr = []): T[] {
  if (!Array.isArray(arr)) {
    newArr.push(arr)
  } else {
    for (let i = 0; i < arr.length; i += 1) {
      flattenDeep(arr[i] as any, newArr)
    }
  }
  return newArr
}
