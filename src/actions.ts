const actions = {} as Record<Action, string>
const types = {} as Record<string, boolean>

export { actions, types }

type StringOnly<T> = T extends string ? T : never
export type Action = StringOnly<keyof ReactTableGlobal.AllActions>

export const addActions = (...acts: Action[]) => {
  acts.forEach(action => {
    // Action values are formatted this way to discourage
    // you (the dev) from interacting with them in any way
    // other than importing `{ actions } from 'react-table'`
    // and referencing an action via `actions[actionName]`
    actions[action] = `React Table Action: ${action}`
    types[actions[action]] = true
  })
}
