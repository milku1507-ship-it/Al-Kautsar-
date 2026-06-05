export type BloodStatus = 'darah' | 'bersih';

export type BloodColor = 'hitam' | 'merah' | 'coklat' | 'kuning' | 'keruh';
export type BloodTexture = 'kental' | 'cair';
export type BloodAroma = 'busuk' | 'tidak_busuk';

export interface DayRecord {
  date: string;
  status: BloodStatus;
  color?: BloodColor;
  texture?: BloodTexture;
  aroma?: BloodAroma;
  durationHours?: number;
  durationMinutes?: number;
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
  timeRange?: number;
  knownPureDay?: number;
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
  startTime?: string;
  stopTime?: string;
  laborDate?: string;
  isRamadhan?: boolean;
  hasPerformedPrayerBeforeBleeding?: boolean;
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
    status: 'Haid' | 'Nifas' | 'Suci' | 'Istihadloh' | 'Ihtiyath';
    reason: string;
  }[];
  category: string;
  categoryReason?: string;
  shortCategory: string;
  purificationInstructions: string[];
  qadhoObligations: string[];
  totalQodloPuasa?: number;
  specialNotes?: string[];
  legalBasis: string;
}

export interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  category?: string;
  published: boolean;
  createdAt?: any;
  updatedAt?: any;
  authorName?: string;
}
