import { FiqhAnalysisRequest, FiqhAnalysisResult, UserHabit } from '../types';
import { validateAge, parseDays, determineStatus } from './fiqhEngine';

const DEFAULT_HABIT: UserHabit = { retrospection: 'lupa_semua' };

export function analyzeLocal(req: FiqhAnalysisRequest): FiqhAnalysisResult {
  const ageCheck = validateAge(req.ageYears, req.ageMonths, req.ageDays);

  if (!ageCheck.isValid) {
    return {
      analysis: ageCheck.message,
      statusTimeline: [],
      category: 'Darah Fasad (Belum Layak Haid)',
      shortCategory: 'DARAH FASAD',
      purificationInstructions: ['Tidak wajib mandi besar karena darah ini bukan haid.'],
      qadhoObligations: [],
      legalBasis: "Kitab Uyunul Masa-il Linnisa (Mazhab Syafi'i)",
    };
  }

  if (req.records.length === 0) {
    return {
      analysis: 'Belum ada data darah yang dimasukkan.',
      statusTimeline: [],
      category: 'Data Kosong',
      shortCategory: 'DATA KOSONG',
      purificationInstructions: [],
      qadhoObligations: [],
      legalBasis: '',
    };
  }

  const days = parseDays(req.records);
  const habit = req.habit ?? DEFAULT_HABIT;

  return determineStatus(days, req.experience, habit, req.context);
}
