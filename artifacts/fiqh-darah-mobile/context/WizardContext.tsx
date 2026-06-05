import React, { createContext, useContext, useState, ReactNode } from 'react';
import {
  CalculationContext,
  DayRecord,
  ExperienceStatus,
  FiqhAnalysisResult,
  UserHabit,
} from '@/types';

export interface WizardState {
  dateOfBirth: string;
  context: CalculationContext;
  experience: ExperienceStatus;
  laborDate: string;
  records: DayRecord[];
  habit: UserHabit;
  startTime: string;
  stopTime: string;
  isRamadhan: boolean;
  hasPerformedPrayer: boolean;
  result: FiqhAnalysisResult | null;
}

const DEFAULT_STATE: WizardState = {
  dateOfBirth: '',
  context: 'haid',
  experience: 'mubtadiah',
  laborDate: '',
  records: [],
  habit: { retrospection: 'lupa_semua' },
  startTime: '',
  stopTime: '',
  isRamadhan: false,
  hasPerformedPrayer: false,
  result: null,
};

interface WizardContextValue {
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | undefined>(undefined);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);

  function reset() {
    setState(DEFAULT_STATE);
  }

  return (
    <WizardContext.Provider value={{ state, setState, reset }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used inside WizardProvider');
  return ctx;
}
