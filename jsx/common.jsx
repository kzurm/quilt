/* Quilt — icons + shared bits exported to window. */

const { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, Fragment } = React;

// Stroke-based icon set
const Icon = ({ name, size = 14, className, style }) => {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {paths}
    </svg>
  );
};

const ICONS = {
  upload: <><path d="M12 16V4M6 10l6-6 6 6" /><path d="M4 16v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></>,
  file: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /></>,
  download: <><path d="M12 4v12M6 12l6 6 6-6" /><path d="M4 20h16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  x: <><path d="M6 6l12 12M18 6L6 18" /></>,
  check: <><path d="M5 13l4 4L19 7" /></>,
  chevD: <><path d="M6 9l6 6 6-6" /></>,
  chevR: <><path d="M9 6l6 6-6 6" /></>,
  chevL: <><path d="M15 6l-6 6 6 6" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.5 5.4A11 11 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.1 3.9M6.6 6.6A17 17 0 002 12s4 7 10 7c1.5 0 2.9-.3 4.1-.8" /></>,
  filter: <><path d="M3 5h18M6 12h12M10 19h4" /></>,
  grip: <><circle cx="9" cy="6" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="18" r="1.2" /></>,
  table: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></>,
  heading: <><path d="M6 4v16M18 4v16M6 12h12" /></>,
  text: <><path d="M5 6h14M5 12h10M5 18h14" /></>,
  divider: <><path d="M4 12h16" strokeDasharray="2 3" /></>,
  trash: <><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.4 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.4 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.4l-.1.1A2 2 0 114.2 17l.1-.1a1.7 1.7 0 00.4-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.7 9a1.7 1.7 0 00-.4-1.8l-.1-.1A2 2 0 117 4.2l.1.1a1.7 1.7 0 001.8.4H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.4 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></>,
  word: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M7 8l2 8 3-6 3 6 2-8" /></>,
  pdf: <><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6" /><path d="M8 14h2a1.5 1.5 0 110 3H8v-3zm0 0v-2M13 12v5h2M17 12v5M17 14h1.5" /></>,
  sparkle: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3" /></>,
  refresh: <><path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5" /></>,
  back: <><path d="M19 12H5M12 19l-7-7 7-7" /></>,
  panel: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" /></>,
};

// Drag util — simple drag/drop state without HTML5 DnD weirdness
function useDrag() {
  const [drag, setDrag] = useState({ id: null, over: null });
  return {
    drag,
    onStart: (id) => setDrag(d => ({ ...d, id })),
    onOver: (id) => setDrag(d => d.id ? { ...d, over: id } : d),
    onEnd: () => setDrag({ id: null, over: null }),
  };
}

function useClickOutside(ref, fn, active = true) {
  useEffect(() => {
    if (!active) return;
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) fn();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [active, fn]);
}

function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}

function Toast({ msg }) {
  if (!msg) return null;
  return <div className="toast">{msg}</div>;
}

Object.assign(window, { Icon, ICONS, useDrag, useClickOutside, uid, Toast,
  useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect, Fragment });
