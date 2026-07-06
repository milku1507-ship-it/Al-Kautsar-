import { FiqhAnalysisRequest, FiqhAnalysisResult, BloodEvent, DayRecord } from "../../types";

export interface Phase {
  id: string;
  startTime: Date;
  endTime: Date;
  isBlood: boolean;
  
  color?: string;
  texture?: string;
  aroma?: string;
  
  durationHours: number;
  
  // Hierarchy: Hitam > Merah > Coklat > Kuning > Keruh
  strengthScore?: number;
  isStrong?: boolean;
  
  status?: 'Haid' | 'Nifas' | 'Suci' | 'Istihadloh' | 'Ihtiyath';
  reason?: string;
}

export interface EngineContext {
  request: FiqhAnalysisRequest;
  result: Partial<FiqhAnalysisResult>;
  debug: string[];
  
  caseType: 'haid' | 'nifas';
  experience: 'mubtadiah' | 'mutadah';
  
  phases: Phase[];
  
  totalSpanHours: number;
  totalBloodHours: number;
  
  validation: {
    isValid: boolean;
    errors: string[];
  };
  
  flags: {
    isTamyizValid: boolean;
    isFasad: boolean;
    tamyizReason?: string;
    isIntermittent: boolean;
  };
}

export interface FiqhRule {
  name: string;
  execute: (context: EngineContext) => EngineContext;
}
