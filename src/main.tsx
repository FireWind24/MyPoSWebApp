import { createRoot } from 'react-dom/client'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('React Error Boundary:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#f05252', background: '#1a1a22', height: '100vh' }}>
          <h1 style={{ color: '#fff' }}>App Crashed</h1>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>{this.state.error.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8, fontSize: 11, color: '#888' }}>{this.state.error.stack}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

try {
  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
} catch (e: any) {
  document.getElementById('root')!.innerHTML = `<div style="padding:40px;font-family:monospace;color:#f05252;background:#1a1a22;height:100vh"><h1 style="color:#fff">Failed to start app</h1><pre>${e?.message}\n${e?.stack}</pre></div>`
}
