import { IPlayerAdapter } from './playerTypes';
import { ExpoVideoAdapter } from './ExpoVideoAdapter';
import { MockPlayerAdapter } from './MockPlayerAdapter';

export type AdapterType = 'expo' | 'mock';

let defaultAdapter: IPlayerAdapter | null = null;

export function createPlayerAdapter(type: AdapterType = 'expo'): IPlayerAdapter {
  if (type === 'mock') {
    return new MockPlayerAdapter();
  }
  return new ExpoVideoAdapter();
}

export function getDefaultPlayerAdapter(): IPlayerAdapter {
  if (!defaultAdapter) {
    defaultAdapter = createPlayerAdapter('expo');
  }
  return defaultAdapter;
}

export function setDefaultPlayerAdapter(adapter: IPlayerAdapter): void {
  defaultAdapter = adapter;
}

export * from './playerTypes';
export * from './capabilities';
export * from './BasePlayerAdapter';
export * from './ExpoVideoAdapter';
export * from './MockPlayerAdapter';
