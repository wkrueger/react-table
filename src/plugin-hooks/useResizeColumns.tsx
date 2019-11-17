import PropTypes from 'prop-types'

//

import { defaultState } from '../hooks/useTable'
import { defaultColumn, getFirstDefined } from '../utils'
import { mergeProps, applyPropHooks } from '../utils'
import { HooksList, TableHook, Row, Column } from '../globalTypes'

defaultState.columnResizing = {
  columnWidths: {},
}

defaultColumn.canResize = true

const propTypes = {}

export const useResizeColumns = (hooks: HooksList) => {
  hooks.useBeforeDimensions.push(useBeforeDimensions)
}

useResizeColumns.pluginName = 'useResizeColumns'

const useBeforeDimensions: TableHook = instance => {
  PropTypes.checkPropTypes(propTypes, instance, 'property', 'useResizeColumns')

  instance.hooks.getResizerProps = []

  const {
    flatHeaders,
    disableResizing,
    hooks: { getHeaderProps },
    state: { columnResizing },
    setState,
  } = instance

  getHeaderProps.push(() => {
    return {
      style: {
        position: 'relative',
      },
    }
  })

  const onMouseDown = (e: any, header: Column) => {
    const headersToResize = getLeafHeaders(header)
    const startWidths = headersToResize.map(header => header.totalWidth!)
    const startX = e.clientX

    const onMouseMove = (e: any) => {
      const currentX = e.clientX
      const deltaX = currentX - startX

      const percentageDeltaX = deltaX / headersToResize.length

      const newColumnWidths = {} as Record<string, any>
      headersToResize.forEach((header, index) => {
        newColumnWidths[header.id!] = Math.max(
          startWidths[index] + percentageDeltaX,
          0
        )
      })

      setState(old => ({
        ...old,
        columnResizing: {
          ...old.columnResizing,
          columnWidths: {
            ...old.columnResizing.columnWidths,
            ...newColumnWidths,
          },
        },
      }))
    }

    const onMouseUp = (e: any) => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)

      setState(old => ({
        ...old,
        columnResizing: {
          ...old.columnResizing,
          startX: null,
          isResizingColumn: null,
        },
      }))
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    setState(old => ({
      ...old,
      columnResizing: {
        ...old.columnResizing,
        startX,
        isResizingColumn: header.id!,
      },
    }))
  }

  flatHeaders.forEach(header => {
    const canResize = getFirstDefined(
      header.disableResizing === true ? false : undefined,
      disableResizing === true ? false : undefined,
      true
    )

    header.canResize = canResize
    header.width = columnResizing.columnWidths[header.id!] || header.width
    header.isResizing = columnResizing.isResizingColumn === header.id

    if (canResize) {
      header.getResizerProps = userProps => {
        return mergeProps(
          {
            onMouseDown: (e: any) => e.persist() || onMouseDown(e, header),
            style: {
              cursor: 'ew-resize',
            },
            draggable: false,
          },
          applyPropHooks(instance.hooks.getResizerProps, header, instance),
          userProps
        ) as any
      }
    }
  })

  return instance
}

function getLeafHeaders(header: Column) {
  const leafHeaders = [] as Column[]
  const recurseHeader = (header: Column) => {
    if (header.columns && header.columns.length) {
      header.columns.map(recurseHeader)
    }
    leafHeaders.push(header)
  }
  recurseHeader(header)
  return leafHeaders
}

declare module '../globalTypes' {
  interface HooksList {
    getResizerProps: Hook[]
  }
}
