export interface Cell {
  value: string
  getCellProps(props: CellPropsBase): CellPropsMerged
  render(type: 'Header' | React.ComponentType): JSX.Element
  isGrouped?: boolean
  column?: Column
  isRepeatedValue?: boolean
  isAggregated?: boolean
}

export interface Row {
  index: number
  path: string[]
  isExpanded?: boolean
  original?: any
  canExpand?: boolean
  subRows?: Row[]
  values?: Record<string, any>
  cells: Cell[]
  getRowProps?(i: RowPropsBase): RowPropsMerged
  groupByID?: string
}

type AcessorFn = (
  row: Row,
  idx: number,
  opts: {
    subRows: Row[]
    depth: number
    data: Record<string, any>
  }
) => any

export interface Column {
  columns?: Column[]
  id?: string
  accessor?: AcessorFn | string
  Header?: HeaderComponent
  headers?: Column[]
  isVisible?: boolean

  originalID?: string
  placeholderOf?: Column
  parent?: Column
  totalHeaderCount?: number
  totalVisibleHeaderCount?: number
  show?: ColumnShowFunction | boolean
  depth?: number
  index?: number

  render?: (type: 'Header' | React.ComponentType) => JSX.Element
  getHeaderProps?: (props: HeaderPropsBase) => HeaderPropsMerged
  totalLeft?: number
  totalWidth?: number
  maxWidth?: number
  minWidth?: number
  width?: number
  filter: string | ((x: any) => boolean)
  disableFilters: boolean
  canFilter: boolean
  setFilter(val: any): TableState
  filterValue: any
  preFilteredRows: Row[]
  filteredRows: Row[]
  groupByBoundary?: {}
  disableGrouping: boolean
  isGrouped?: boolean
  groupedIndex: number
  canGroupBy?: boolean
  toggleGroupBy: () => TableState
  Aggregated?: Cell
  Cell: Cell
  getGroupByToggleProps(props: any): any
  aggregate: ((values: any, rows: Row[]) => any) | [any, any]
}

export type ColumnShowFunction = (c: TableInstance) => boolean

export type HeaderComponent = React.ComponentType

export interface HeaderGroup {
  headers: Column[]
  getHeaderGroupProps?: (props: HeaderGroupPropsBase) => HeaderGroupPropsMerged
}

export interface TablePlugin {
  (i: TableInstance['hooks']): void
  pluginName: string
}

export interface TableState {
  columnOrder: string[]
  expanded: string[]
  filters: Record<string, any>
  groupBy: string[]
}

export interface TableProps {
  data: any[]
  columns: Column[]
  defaultColumn?: Column
  getSubRows?: () => Row[]
  getRowId?: () => string
  debug?: boolean

  initialState?: TableState
  state: TableState
  getRowID?: () => string
  reducer?: (old: TableState, newState: TableState, type?: string) => TableState
}

export type RowHook = (row: Row) => Row
export type TableHook = (tbl: TableInstance) => TableInstance
export type ColumnHook = (cols: Column[], instance: TableInstance) => Column[]
export type Hook = RowHook | TableHook | ColumnHook

export interface HooksList {
  columnsBeforeHeaderGroups: ColumnHook[]
  columnsBeforeHeaderGroupsDeps: ColumnHook[]
  useBeforeDimensions: Hook[]
  useMain: TableHook[]
  useRows: Hook[]
  prepareRow: RowHook[]
  getTableProps: Hook[]
  getTableBodyProps: Hook[]
  getRowProps: Hook[]
  getHeaderGroupProps: Hook[]
  getHeaderProps: Hook[]
  getCellProps: Hook[]
}

export interface TableInstance extends TableProps {
  setState: (fn: (s: TableState) => TableState, action: string) => TableState
  plugins: TablePlugin[]
  hooks: HooksList

  rows: Row[]
  flatRows: Row[]
  flatHeaders: Column[]
  flatColumns: Column[]
  headerGroups: HeaderGroup[]
  prepareRow: (row: Row) => void

  getTableProps(props: TablePropsBase): TablePropsMerged
  getTableBodyProps(props: TablePropsBase): TablePropsMerged
  headers: Column[]
  totalColumnsWidth: number
  manualExpandedKey: string
  paginateExpandedRows: boolean
  expandSubRows: boolean

  filterTypes: Record<string, any>
  manualFilters: Record<string, any>
  disableFilters: Record<string, any>
  groupByFn(rows: Row[], columnId: string): Record<string, Row>
  manualGroupBy?: boolean
  disableGrouping?: boolean
  aggregations?: Record<string, any>
}

export interface HeaderPropsBase {}

export interface HeaderPropsMerged extends HeaderPropsBase {}

export interface HeaderGroupPropsBase {}

export interface HeaderGroupPropsMerged extends HeaderGroupPropsBase {}

export interface RowPropsBase {}

export interface RowPropsMerged extends RowPropsBase {}

export interface CellPropsBase {}

export interface CellPropsMerged extends CellPropsBase {}

export interface TablePropsBase {}

export interface TablePropsMerged extends TablePropsBase {}
