import { browser } from 'wxt/browser';

/**
 * Menu tĩnh thuần presentation (ui-architecture-conventions §6, D10 Phase 5) —
 * không mang business meta, chỉ link điều hướng.
 */
export interface MenuItem {
  label: string;
  open: () => void;
}

function openPage(page: '/debug-console.html' | '/options.html'): () => void {
  return () => {
    void browser.tabs.create({ url: browser.runtime.getURL(page) });
  };
}

export function buildMenu(): MenuItem[] {
  return [
    { label: 'Popup', open: () => void browser.action.openPopup() },
    { label: 'Debug Console', open: openPage('/debug-console.html') },
    { label: 'Options', open: openPage('/options.html') },
  ];
}
