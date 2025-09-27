import type { KiteState, MessageFromChild, MessageToChild } from './types';

export interface MessagingConfig {
  getState: () => KiteState;
  onTheme?: (theme: 'light' | 'ink' | 'auto') => void;
  onLocale?: (locale: 'zh' | 'en') => void;
  onParams?: (params: Partial<{ wind: number; angle: number; tension: number }>) => void;
  onReset?: () => void;
}

export interface MessagingHandle {
  dispose(): void;
  postReady(): void;
  postState(state?: KiteState): void;
  postScore(score: { stableSec: number; attempts: number; passed: boolean }): void;
  postEnd(): void;
}

export function createMessaging(config: MessagingConfig): MessagingHandle {
  const handler = (event: MessageEvent<MessageToChild>) => {
    const data = event.data;
    if (!data || data.target !== 'kite-lab') return;
    switch (data.type) {
      case 'set-theme':
        config.onTheme?.(data.payload);
        break;
      case 'set-locale':
        config.onLocale?.(data.payload);
        break;
      case 'set-params':
        config.onParams?.(data.payload);
        break;
      case 'reset':
        config.onReset?.();
        break;
      case 'get-state':
        postToParent({ source: 'kite-lab', type: 'state', payload: config.getState() });
        break;
      default:
        break;
    }
  };

  window.addEventListener('message', handler);

  return {
    dispose() {
      window.removeEventListener('message', handler);
    },
    postReady() {
      postToParent({ source: 'kite-lab', type: 'ready' });
    },
    postState(state) {
      postToParent({ source: 'kite-lab', type: 'state', payload: state ?? config.getState() });
    },
    postScore(score) {
      postToParent({ source: 'kite-lab', type: 'score', payload: score });
    },
    postEnd() {
      postToParent({ source: 'kite-lab', type: 'end' });
    }
  };
}

function postToParent(message: MessageFromChild) {
  if (typeof window === 'undefined') return;
  window.parent?.postMessage(message, '*');
}
