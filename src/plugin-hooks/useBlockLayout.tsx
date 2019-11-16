import PropTypes from 'prop-types'
import { HooksList, TableInstance } from '../globalTypes'

const propTypes = {}

export const useBlockLayout = (hooks: HooksList) => {
  hooks.useMain.push(useMain)
}

useBlockLayout.pluginName = 'useBlockLayout'

const useMain = (instance: TableInstance) => {
  PropTypes.checkPropTypes(propTypes, instance, 'property', 'useBlockLayout')

  const {
    totalColumnsWidth,
    hooks: { getRowProps, getHeaderGroupProps, getHeaderProps, getCellProps },
  } = instance

  const rowStyles = {
    style: {
      display: 'flex',
      width: `${totalColumnsWidth}px`,
    },
  }

  getRowProps.push(() => rowStyles)
  getHeaderGroupProps.push(() => rowStyles)

  const cellStyles = {
    display: 'inline-block',
    boxSizing: 'border-box',
  }

  getHeaderProps.push(header => {
    return {
      style: {
        ...cellStyles,
        width: `${header.totalWidth}px`,
      },
    }
  })

  getCellProps.push(cell => {
    return {
      style: {
        ...cellStyles,
        width: `${cell.column.totalWidth}px`,
      },
    }
  })

  return instance
}
