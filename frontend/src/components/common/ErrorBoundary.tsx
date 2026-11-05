import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  /** What to show instead of the children after a render error; `reset` tries the children again. */
  fallback: (error: Error, reset: () => void) => ReactNode
  /** When this value changes (for example the route), a caught error is cleared. */
  resetKey?: unknown
  children: ReactNode
}

interface State {
  error: Error | null
  key: unknown
}

/** Keeps a render error (a failed WebGL context, a missing code chunk) inside one part of the page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return Object.is(props.resetKey, state.key) ? null : { error: null, key: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SolMate view error', error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.reset) : this.props.children
  }
}

