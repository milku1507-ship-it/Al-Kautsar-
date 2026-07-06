export type BloodStatus = 'darah' | 'bersih';
export type BloodColor = 'hitam' | 'merah' | 'coklat' | 'kuning' | 'keruh';
export type BloodTexture = 'kental' | 'cair';
export type BloodAroma = 'busuk' | 'tidak_busuk';

export type EventType = 'START_BLOOD' | 'CHANGE_CHARACTERISTIC' | 'STOP_BLOOD' | 'CLEAN_PERIOD' | 'BLEED_AGAIN';

export interface BloodEvent {
  id: string;
  datetime: string; // ISO format
  eventType: EventType;
  color?: BloodColor;
  texture?: BloodTexture;
  aroma?: BloodAroma;
}

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
  | 'ingat_awal_dan_durasi' 
  | 'ingat_durasi_saja' 
  | 'ingat_awal_saja' 
  | 'lupa_semua';

export interface UserHabit {
  retrospection: HabitRetrospection;
  durasiHari?: number;
  durasiJam?: number;
  tanggalMulai?: number; // Tanggal hijriah / masehi
  jamMulai?: string;
}

export interface FiqhAnalysisRequest {
  ageYears: number;
  ageMonths: number;
  ageDays: number;
  context: CalculationContext;
  experience: ExperienceStatus;
  events: BloodEvent[]; // NEW: uses events instead of records
  habit?: UserHabit;
  laborDate?: string; // ISO format
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

