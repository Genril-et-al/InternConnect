import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean; message: string }

/**
 * Catches render/runtime errors anywhere below it so a single failing
 * component shows a branded fallback instead of blanking the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'An unexpected error occurred.'
    return { hasError: true, message }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Keep a record in the console for debugging.
    console.error('[InternConnect] UI error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="app-error">
        <img className="app-error-logo" src="/logo.png" alt="InternConnect" />
        <h1>Something went wrong</h1>
        <p>
          The page hit an unexpected error. Your data is safe — reloading usually
          fixes it.
        </p>
        <p className="app-error-detail">{this.state.message}</p>
        <button className="app-error-button" onClick={this.handleReload} type="button">
          Reload page
        </button>
      </div>
    )
  }
}
