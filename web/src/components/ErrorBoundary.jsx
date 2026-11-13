import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center" style={{ flexDirection: 'column' }}>
        <h3>Something went wrong</h3>
        <p className="muted">{String(this.state.error.message || this.state.error)}</p>
        <button className="btn" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
