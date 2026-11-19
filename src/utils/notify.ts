export type NoticeType = 'success' | 'error' | 'info';

export function notify(message: string, type: NoticeType = 'info') {
  window.dispatchEvent(new CustomEvent('hal5-notice', { detail: { message, type } }));
}

export function askConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    window.dispatchEvent(new CustomEvent('hal5-confirm', { detail: { message, resolve } }));
  });
}
