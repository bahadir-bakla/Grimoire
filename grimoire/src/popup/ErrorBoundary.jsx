import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, lang: 'en' }
  }

  componentDidMount() {
    try {
      chrome.storage.local.get(['settings'], (data) => {
        this.setState({ lang: data.settings?.appLanguage || 'en' })
      })
    } catch (_) {}
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[Grimoire] Popup error:', error, info)
  }

  render() {
    const { lang } = this.state
    const isEN = lang === 'en'

    if (this.state.hasError) {
      return (
        <div style={{
          padding: 20,
          color: '#e24b4a',
          fontFamily: 'sans-serif',
          fontSize: 13,
        }}>
          <div style={{ fontWeight: 500, marginBottom: 8 }}>
            {isEN ? 'An error occurred' : 'Bir hata oluştu'}
          </div>
          <div style={{ color: '#888780', marginBottom: 16, fontSize: 12 }}>
            {this.state.error?.message ?? (isEN ? 'Unknown error' : 'Bilinmeyen hata')}
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
            {isEN ? 'Try again' : 'Tekrar dene'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
