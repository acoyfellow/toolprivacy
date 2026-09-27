import { createContext } from 'react';

export interface ScenarioController {
  readonly activeKey: string;
  readonly busy: boolean;
  readonly source: 'worker' | 'offline-sample';
  readonly onSelect: (key: string) => void;
}

const noop: ScenarioController = {
  activeKey: '',
  busy: false,
  source: 'offline-sample',
  onSelect: () => {},
};

export const ScenarioContext = createContext<ScenarioController>(noop);
