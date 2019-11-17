import { useMemo } from 'react'
import PropTypes from 'prop-types'

import * as aggregations from '../aggregations'
import { addActions, actions } from '../actions'
import { defaultState } from '../hooks/useTable'
import {
  mergeProps,
  applyPropHooks,
  defaultGroupByFn,
  getFirstDefined,
  ensurePluginOrder,
} from '../utils'
import {
  HooksList,
  Column,
  TableInstance,
  ColumnHook,
  TableHook,
  Row,
} from '../globalTypes'

defaultState.groupBy = []

addActions('toggleGroupBy')

const propTypes = {
  // General
  columns: PropTypes.arrayOf(
    PropTypes.shape({
      aggregate: PropTypes.oneOfType([
        PropTypes.func,
        PropTypes.string,
        PropTypes.arrayOf(
          PropTypes.oneOfType([PropTypes.func, PropTypes.string])
        ),
      ]),
      disableGrouping: PropTypes.bool,
      Aggregated: PropTypes.any,
    })
  ),
  groupByFn: PropTypes.func,
  manualGrouping: PropTypes.bool,
  disableGrouping: PropTypes.bool,
  aggregations: PropTypes.object,
}

export const useGroupBy = (hooks: HooksList) => {
  hooks.columnsBeforeHeaderGroups.push(columnsBeforeHeaderGroups)
  hooks.columnsBeforeHeaderGroupsDeps.push((deps, instance) => {
    deps.push(instance.state.groupBy as any)
    return deps
  })
  hooks.useMain.push(useMain)
}

useGroupBy.pluginName = 'useGroupBy'

const columnsBeforeHeaderGroups: ColumnHook = (flatColumns, instance) => {
  const groupBy = instance.state.groupBy
  // Sort grouped columns to the start of the column list
  // before the headers are built

  const groupByColumns = groupBy.map(g => flatColumns.find(col => col.id === g))
  const nonGroupByColumns = flatColumns.filter(
    col => !groupBy.includes(col.id!)
  )

  // If a groupByBoundary column is found, place the groupBy's after it
  const groupByBoundaryColumnIndex =
    flatColumns.findIndex(column => column.groupByBoundary) + 1

  return [
    ...nonGroupByColumns.slice(0, groupByBoundaryColumnIndex),
    ...(groupByColumns as Column[]),
    ...nonGroupByColumns.slice(groupByBoundaryColumnIndex),
  ]
}

const useMain: TableHook = instance => {
  PropTypes.checkPropTypes(propTypes, instance, 'property', 'useGroupBy')

  const {
    debug,
    rows,
    flatColumns,
    flatHeaders,
    groupByFn = defaultGroupByFn,
    manualGroupBy,
    disableGrouping,
    aggregations: userAggregations = {},
    hooks,
    plugins,
    state: { groupBy },
    setState,
  } = instance

  ensurePluginOrder(plugins, [], 'useGroupBy', ['useSortBy', 'useExpanded'])

  flatColumns.forEach(column => {
    const { id, accessor, disableGrouping: columnDisableGrouping } = column
    column.isGrouped = groupBy.includes(id!)
    column.groupedIndex = groupBy.indexOf(id!)

    column.canGroupBy = accessor
      ? getFirstDefined(
          columnDisableGrouping === true ? false : undefined,
          disableGrouping === true ? false : undefined,
          true
        )
      : false

    if (column.canGroupBy) {
      column.toggleGroupBy = () => toggleGroupBy(column.id!)
    }

    column.Aggregated = column.Aggregated || column.Cell
  })

  const toggleGroupBy = (id: string, toggle?: boolean) => {
    return setState(old => {
      const resolvedToggle =
        typeof toggle !== 'undefined' ? toggle : !groupBy.includes(id)
      if (resolvedToggle) {
        return {
          ...old,
          groupBy: [...groupBy, id],
        }
      }
      return {
        ...old,
        groupBy: groupBy.filter(d => d !== id),
      }
    }, actions.toggleGroupBy)
  }

  hooks.getGroupByToggleProps = []

  flatHeaders.forEach(header => {
    const { canGroupBy } = header
    header.getGroupByToggleProps = props => {
      return mergeProps(
        {
          onClick: canGroupBy
            ? (e: any) => {
                e.persist()
                header.toggleGroupBy()
              }
            : undefined,
          style: {
            cursor: canGroupBy ? 'pointer' : undefined,
          },
          title: 'Toggle GroupBy',
        },
        applyPropHooks(instance.hooks.getGroupByToggleProps, header, instance),
        props
      )
    }
  })

  hooks.prepareRow.push(row => {
    row.cells.forEach(cell => {
      // Grouped cells are in the groupBy and the pivot cell for the row
      cell.isGrouped =
        cell.column!.isGrouped && cell.column!.id === row.groupByID
      // Repeated cells are any columns in the groupBy that are not grouped
      cell.isRepeatedValue = !cell.isGrouped && cell.column!.isGrouped
      // Aggregated cells are not grouped, not repeated, but still have subRows
      cell.isAggregated =
        !cell.isGrouped && !cell.isRepeatedValue && row.canExpand
    })
    return row
  })

  const groupedRows = useMemo(() => {
    if (manualGroupBy || !groupBy.length) {
      return rows
    }

    if (process.env.NODE_ENV === 'development' && debug)
      console.info('getGroupedRows')
    // Find the columns that can or are aggregating

    // Uses each column to aggregate rows into a single value
    const aggregateRowsToValues = (rows: Row[], isSourceRows?: boolean) => {
      const values = {} as Record<string, any>

      flatColumns.forEach(column => {
        // Don't aggregate columns that are in the groupBy
        if (groupBy.includes(column.id!)) {
          values[column.id!] = rows[0] ? rows[0].values![column.id!] : null
          return
        }

        const columnValues = rows.map(d => d.values![column.id!])

        let aggregator = column.aggregate

        if (Array.isArray(aggregator)) {
          if (aggregator.length !== 2) {
            console.info({ column })
            throw new Error(
              `React Table: Complex aggregators must have 2 values, eg. aggregate: ['sum', 'count']. More info above...`
            )
          }
          if (isSourceRows) {
            aggregator = aggregator[1]
          } else {
            aggregator = aggregator[0]
          }
        }

        let aggregateFn =
          typeof aggregator === 'function'
            ? aggregator
            : userAggregations[aggregator as any] ||
              (aggregations as any)[aggregator as any]

        if (aggregateFn) {
          values[column.id!] = aggregateFn(columnValues, rows)
        } else if (aggregator) {
          console.info({ column })
          throw new Error(
            `React Table: Invalid aggregate option for column listed above`
          )
        } else {
          values[column.id!] = null
        }
      })
      return values
    }

    // Recursively group the data
    const groupRecursively = (
      rows: Row[],
      depth = 0,
      parentPath = [] as string[]
    ) => {
      // This is the last level, just return the rows
      if (depth >= groupBy.length) {
        return rows
      }

      const columnID = groupBy[depth]

      // Group the rows together for this level
      let _groupedRows = groupByFn(rows, columnID)

      // Recurse to sub rows before aggregation
      const groupedRows = Object.entries(_groupedRows).map(
        ([groupByVal, subRows]: [any, any], index) => {
          const path = [...parentPath, `${columnID}:${groupByVal}`]

          subRows = groupRecursively(subRows, depth + 1, path)

          const values = aggregateRowsToValues(
            subRows,
            depth + 1 >= groupBy.length
          )

          const row = {
            isAggregated: true,
            groupByID: columnID,
            groupByVal,
            values,
            subRows,
            depth,
            index,
            path,
          }

          return row
        }
      )

      return groupedRows
    }

    // Assign the new data
    return groupRecursively(rows)
  }, [
    manualGroupBy,
    groupBy,
    debug,
    rows,
    flatColumns,
    userAggregations,
    groupByFn,
  ])

  return {
    ...instance,
    toggleGroupBy,
    rows: groupedRows,
    preGroupedRows: rows,
  } as TableInstance
}

declare global {
  namespace ReactTableGlobal {
    export interface AllActions {
      toggleGroupBy: any
    }
  }
}

declare module '../globalTypes' {
  interface HooksList {
    getGroupByToggleProps: Hook[]
  }
}