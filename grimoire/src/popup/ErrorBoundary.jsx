import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[Grimoire] Popup error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 20,
          color: '#e24b4a',
          fontFamily: 'sans-serif',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>Bir hata oluştu</div>
          <div style={{ color: '#888780', marginBottom: 16, fontSize: 12 }}>
            {this.state.error?.message ?? 'Bilinmeyen hata'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              background: 'none',
              border: '1px solid rgba(226,75,74,.4)',
              borderRadius: 7,
              color: '#e24b4a',
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
            }}
          >
            Tekrar dene
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
