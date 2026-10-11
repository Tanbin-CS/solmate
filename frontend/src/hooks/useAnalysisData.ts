import { useCallback, useEffect, useState } from 'react'
import { loadAnalysisData, type AnalysisData } from '@/data/load'

type State = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ready'; data: AnalysisData }

export function useAnalysisData() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    loadAnalysisData()
      .then((data) => alive && setState({ status: 'ready', data }))
      .catch((error: Error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((a) => a + 1)
  }, [])

  return { ...state, retry }
}
