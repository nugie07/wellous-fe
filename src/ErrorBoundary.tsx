import { Component, type ErrorInfo, type ReactNode } from "react"

type Props = { children: ReactNode }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App error:", error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 600 }}>
          <h1 style={{ color: "#b91c1c", marginBottom: 16 }}>Something went wrong</h1>
          <pre style={{ background: "#fef2f2", padding: 16, borderRadius: 8, overflow: "auto", fontSize: 13 }}>
            {this.state.error.message}
          </pre>
          <p style={{ marginTop: 16, color: "#6b7280" }}>
            Check the browser console for more details.
          </p>
        </div>
      )
    }
    return this.props.children
  }
}
