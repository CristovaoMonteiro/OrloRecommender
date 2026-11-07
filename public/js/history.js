/**
 * The visitor's browsing, kept in this tab only. It is deleted when the tab
 * closes, and it leaves the browser only as the body of a recommendation
 * request, which the server does not store. Without sessionStorage it lasts
 * for the current page.
 */
const KEY = 'orlo_history';
const MAX_ENTRIES = 30;

let fallback = [];

function read() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return fallback;
  }
}

function write(entries) {
  fallback = entries;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // The in-memory copy above still serves this page.
  }
}

export const getHistory = () => read();

export function setHistory(entries) {
  write(entries.slice(-MAX_ENTRIES));
}

export function recordInteraction(productId, type) {
  const entries = read();
  const last = entries[entries.length - 1];
  // Reopening the product just seen adds nothing, and must not bury a stronger signal.
  if (last?.productId === productId && (type === 'view_product' || last.type === type)) return;
  setHistory([...entries, { productId, type }]);
}

export const clearHistory = () => write([]);
