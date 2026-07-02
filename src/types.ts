export type BloodStatus = 'darah' | 'bersih';

export type BloodColor = 'hitam' | 'merah' | 'coklat' | 'kuning' | 'keruh';
export type BloodTexture = 'kental' | 'cair';
export type BloodAroma = 'busuk' | 'tidak_busuk';

export interface DayRecord {
  date: string; // ISO format
  status: BloodStatus;
  color?: BloodColor;
  texture?: BloodTexture;
  aroma?: BloodAroma;
  durationHours?: number; // Jam keluar darah (bisa 0 s/d 24)
  durationMinutes?: number; // Menit keluar darah (bisa 0 s/d 59)
}

export type ExperienceStatus = 'mubtadiah' | 'mutadah';
export type CalculationContext = 'haid' | 'nifas';

export type HabitRetrospection = 
  | 'ingat_semua' 
  | 'ingat_durasi' 
  | 'ingat_waktu' 
  | 'lupa_semua'
  | 'ingat_angka_lupa_urutan';

export interface UserHabit {
  retrospection: HabitRetrospection;
  habitType?: 'TETAP' | 'BERUBAH';
  lupaUrutan?: boolean;
  duration?: number;
  durations?: number[];
  durationNifas?: number;
  durationsNifas?: number[];
  lastCycleStart?: string;
  ingatWaktuBerhenti?: boolean;
  timeRange?: number; // Rentang waktu (misal: 10 hari)
  knownPureDay?: number; // Hari yakin suci (misal: tgl 1)
  pernahHaid?: boolean;
  habitSuci?: number;
}

export interface FiqhAnalysisRequest {
  ageYears: number;
  ageMonths: number;
  ageDays: number;
  context: CalculationContext;
  experience: ExperienceStatus;
  records: DayRecord[];
  habit?: UserHabit;
  startTime?: string; // HH:mm
  stopTime?: string; // HH:mm
  laborDate?: string; // ISO format
  isRamadhan?: boolean;
  hasPerformedPrayerBeforeBleeding?: boolean;
  isFirstMonthIstihadloh?: boolean;
  calculationMonthIndex?: number;
}

export interface FiqhAnalysisResult {
  analysis: string;
  statusTimeline: {
    day: number;
    date: string;
    status: 'Haid' | 'Nifas' | 'Suci' | 'Istihadloh' | 'Ihtiyath';
    reason: string;
  }[];
  groupedTimeline?: {
    startDay: number;
    endDay: number;
    startDate?: string;
    endDate?: string;
    status: 'Haid' | 'Nifas' | 'Suci' | 'Istihadloh' | 'Ihtiyath';
    reason: string;
  }[];
  groupedQadho?: {
    startDay: number;
    endDay: number;
    startDate?: string;
    endDate?: string;
    message: string;
  }[];
  category: string;
  categoryReason?: string;
  shortCategory: string;
  purificationInstructions: string[];
  qadhoObligations: string[];
  totalQodloPuasa?: number;
  specialNotes?: string[];
  langkahSelanjutnyaTeks?: string;
  isFirstMonth?: boolean;
  legalBasis: string;
}
