import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

function showBootError(title, detail) {
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = '';
  const box = document.createElement('div');
  box.style.cssText = 'min-height:100vh;padding:24px;background:#fff7f7;color:#7f1d1d;font:16px system-ui,sans-serif;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const message = document.createElement('pre');
  message.style.cssText = 'white-space:pre-wrap;font:13px monospace;background:#fff;border:1px solid #fecaca;padding:12px;border-radius:8px';
  message.textContent = String(detail || 'বিস্তারিত পাওয়া যায়নি');
  const hint = document.createElement('p');
  hint.textContent = 'এই লেখাটি সাপোর্টে পাঠান। পাসওয়ার্ড বা গোপন কী পাঠাবেন না।';
  box.append(heading, message, hint);
  root.append(box);
}

window.addEventListener('error', (event) => {
  showBootError('অ্যাপ চালু হতে JavaScript সমস্যা হয়েছে', event.message || event.error || 'Unknown browser error');
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  showBootError('অ্যাপের একটি অনুরোধ সম্পন্ন হয়নি', reason?.stack || reason?.message || reason || 'Unknown promise rejection');
});

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    console.error('TK Sales app render error:', error);
  }
  render() {
    if (this.state.error) {
      return React.createElement('main', { style: { minHeight: '100vh', padding: 24, background: '#fff7f7', color: '#7f1d1d', fontFamily: 'system-ui', lineHeight: 1.6 } },
        React.createElement('h2', null, 'অ্যাপের স্ক্রিন তৈরি করতে সমস্যা হয়েছে'),
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', background: '#fff', padding: 12, border: '1px solid #fecaca', borderRadius: 8 } }, this.state.error?.stack || this.state.error?.message || String(this.state.error)),
        React.createElement('p', null, 'এই লেখাটি পাঠান। পাসওয়ার্ড বা গোপন কী পাঠাবেন না।')
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  document.body.innerHTML = '<p style="padding:24px;font:16px system-ui">অ্যাপের root element পাওয়া যায়নি।</p>';
} else {
  createRoot(rootElement).render(
    React.createElement(React.StrictMode, null,
      React.createElement(AppErrorBoundary, null, React.createElement(App))
    )
  );
}
