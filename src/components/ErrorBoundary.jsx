import React from 'react';

// A React error boundary, which has to be a class — there is no hook form of
// getDerivedStateFromError.
//
// This exists because a decorative widget must never be able to take the page
// down with it. The 3D lanyard could: `THREE.WebGLRenderer` throws synchronously
// during mount when the browser cannot give it a WebGL context (no GPU, a
// blocklisted driver, WebGL disabled, a headless/remote session), and with
// nothing to catch it React unmounts the whole tree — the entire site rendered
// as an empty <div id="root">, not as a page missing its lanyard.
//
// Placed OUTSIDE a <Suspense>, it also catches the other failure mode of a lazy
// import: if the ~3MB Lanyard chunk fails to fetch, the rejected promise would
// otherwise take the tree down the same way.
//
// Caveat worth knowing before relying on this elsewhere: error boundaries only
// catch errors thrown during render, in lifecycles, and in constructors. They do
// NOT catch anything thrown asynchronously — a WebGL context lost later, inside
// r3f's animation loop, will not land here.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    // console.warn, not console.error: this path is an expected degradation on
    // machines without WebGL, not a defect to shout about. The label makes it
    // obvious in a bug report which widget bailed.
    console.warn(`[${this.props.label || 'ErrorBoundary'}] disabled after an error:`, error);
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
