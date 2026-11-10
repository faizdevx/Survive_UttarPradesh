// Hindi switch. The pages are written in English; this swaps each piece of text for its Hindi line as it appears,
// so every module is covered without touching it. Names, headlines and anything not in the list stay as they are.
import { HI, HI_PATTERNS } from './hi.js';

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const SKIP = 'script, style, .leaflet-tile-pane, .leaflet-control-attribution, [data-keep]';
export const missed = new Set();

export function toHindi(text) {
  const key = text.trim().replace(/\s+/g, ' ');
  if (!key || !/[A-Za-z]/.test(key)) return null;
  if (Object.hasOwn(HI, key)) return text.replace(text.trim(), HI[key]);
  for (const [re, to] of HI_PATTERNS) if (re.test(key)) return text.replace(text.trim(), key.replace(re, to));
  missed.add(key);
  return null;
}

function fix(node) {
  if (node.parentElement?.closest(SKIP)) return;
  const hi = toHindi(node.nodeValue);
  if (hi != null && hi !== node.nodeValue) node.nodeValue = hi;
}
function walk(root) {
  if (root.nodeType === 3) return fix(root);
  if (root.nodeType !== 1 || root.closest(SKIP)) return;
  const texts = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (texts.nextNode()) fix(texts.currentNode);
  [root, ...root.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(','))].forEach((el) => ATTRS.forEach((a) => {
    const hi = el.hasAttribute?.(a) && toHindi(el.getAttribute(a));
    if (hi) el.setAttribute(a, hi);
  }));
}

export function initLang(store) {
  const hi = (store.get('lang') || navigator.language || '').startsWith('hi');
  document.documentElement.lang = hi ? 'hi' : 'en';
  const btn = document.querySelector('#langBtn');
  btn.textContent = hi ? 'English' : 'हिंदी';
  // A reload is the one sure way to put every page back in the other language
  btn.addEventListener('click', () => { store.set('lang', hi ? 'en' : 'hi'); location.reload(); });
  if (!hi) return;
  walk(document.body);
  new MutationObserver((changes) => changes.forEach((c) => {
    if (c.type === 'characterData') fix(c.target);
    c.addedNodes.forEach(walk);
  })).observe(document.body, { childList: true, subtree: true, characterData: true });
}
