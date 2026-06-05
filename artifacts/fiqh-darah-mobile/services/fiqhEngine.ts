import { DayRecord, BloodColor, BloodTexture, BloodAroma, CalculationContext, UserHabit, FiqhAnalysisResult, ExperienceStatus } from '../types';
import { isSameDay, differenceInDays, parseISO, addDays } from 'date-fns';

export interface FiqhValidationResult {
  isValid: boolean;
  message: string;
}

export function validateAge(years: number, months: number, days: number): FiqhValidationResult {
  const totalDays = (years * 354.367) + (months * 29.53) + days;
  const minimumDays = (9 * 354.367) - 16;

  if (totalDays < minimumDays) {
    return {
      isValid: false,
      message: 'Status: Darah Fasad/Istihadloh. Usia belum mencapai batas minimal haidl (9 Tahun Qomariyah kurang 16 hari).',
    };
  }

  return { isValid: true, message: 'Usia memenuhi syarat minimal haidl.' };
}

const COLOR_RANK: Record<BloodColor, number> = {
  hitam: 1,
  merah: 2,
  coklat: 3,
  kuning: 4,
  keruh: 5,
};

const TEXTURE_RANK: Record<BloodTexture, number> = {
  kental: 0,
  cair: 1,
};

const AROMA_RANK: Record<BloodAroma, number> = {
  busuk: 0,
  tidak_busuk: 1,
};

export function getBloodStrengthScore(color: BloodColor, texture: BloodTexture, aroma: BloodAroma): number {
  let score = COLOR_RANK[color] * 10;
  score += TEXTURE_RANK[texture] * 2;
  score += AROMA_RANK[aroma];
  return score;
}

export interface DayStrength {
  dayNumber: number;
  date: string;
  score: number;
  isBlood: boolean;
  isStrong: boolean;
  originalRecord?: DayRecord;
}

export function parseDays(records: DayRecord[]): DayStrength[] {
  if (records.length === 0) return [];

  const sorted = [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const firstDate = parseISO(sorted[0].date);
  const lastDate = parseISO(sorted[sorted.length - 1].date);

  const totalSpan = differenceInDays(lastDate, firstDate) + 1;
  const timeline: DayStrength[] = [];

  for (let i = 0; i < totalSpan; i++) {
    const current = addDays(firstDate, i);
    const dateStr = current.toISOString();
    const record = sorted.find(r => isSameDay(parseISO(r.date), current));

    if (record && record.status === 'darah') {
      timeline.push({
        dayNumber: i + 1,
        date: dateStr,
        isBlood: true,
        isStrong: false,
        score: getBloodStrengthScore(record.color || 'merah', record.texture || 'cair', record.aroma || 'tidak_busuk'),
        originalRecord: record,
      });
    } else {
      timeline.push({
        dayNumber: i + 1,
        date: dateStr,
        isBlood: false,
        isStrong: false,
        score: 999,
      });
    }
  }

  const bloodDays = timeline.filter(d => d.isBlood);
  if (bloodDays.length > 0) {
    const minScore = Math.min(...bloodDays.map(d => d.score));
    timeline.forEach(d => {
      if (d.isBlood && d.score === minScore) d.isStrong = true;
    });
  }

  return timeline;
}

export function calculateBloodHours(days: DayStrength[]): number {
  let total = 0;
  days.forEach(d => {
    if (d.isBlood) {
      const rec = d.originalRecord;
      const hours = rec?.durationHours !== undefined ? rec.durationHours : 24;
      const mins = rec?.durationMinutes !== undefined ? rec.durationMinutes : 0;
      total += hours + (mins / 60);
    }
  });
  return total;
}

function generateActionableNotes(
  days: DayStrength[],
  context: CalculationContext,
  totalSpan: number,
  bloodHours: number,
): string[] {
  const maxDays = context === 'haid' ? 15 : 60;
  const notes: string[] = [];

  if (totalSpan > maxDays) {
    notes.push('PANDUAN MUSTAHADLAH: Karena masa darah telah melewati batas maksimal, Anda saat ini berstatus Mustahadlah.');
    notes.push('Instruksi Bersuci: Wajib berwudhu setiap kali masuk waktu shalat fardhu, setelah membersihkan farji dan menyumbatnya dengan pembalut yang rapat.');
    return notes;
  }

  const isBleedingNow = days[days.length - 1]?.isBlood ?? false;
  const hasGapInBetween = days.some((d, idx) =>
    !d.isBlood && idx > 0 && idx < days.length - 1 &&
    days[idx - 1].isBlood && days.slice(idx + 1).some(f => f.isBlood)
  );

  if (!isBleedingNow) {
    if (context === 'haid') {
      if (bloodHours < 24) {
        notes.push('Darah berhenti SEBELUM mencapai batas minimal haidl (24 jam). Anda CUKUP membersihkan darah (istinja) dan berwudlu jika ingin sholat. Belum diwajibkan mandi besar.');
      } else {
        notes.push('Darah telah mencapai minimal haid (24 jam) dan saat ini berhenti. Anda WAJIB segera mandi besar (mandi janabah) dan melaksanakan rutinitas ibadah.');
      }
    } else {
      notes.push('Darah nifas berhenti. Anda WAJIB mandi besar (mandi janabah) dan mulai laksanakan ibadah.');
    }
  } else {
    notes.push(`Darah ${context} masih keluar. Hindari hal-hal yang diharamkan bagi wanita ${context} (Sholat, Puasa, Jima\u2019, dll).`);
  }

  if (hasGapInBetween && (bloodHours >= 24 || context === 'nifas')) {
    notes.push(`PERHATIAN (Hukum Jam'u): Masa berhenti di sela darah dihukumi ${context.toUpperCase()}. Sholat di masa tersebut secara hukum tidak sah. Jika puasa RAMADHAN, puasa di hari jeda BATAL dan wajib DIQODLO.`);
  }

  return notes;
}

export function determineStatus(
  days: DayStrength[],
  experience: ExperienceStatus,
  habit: UserHabit,
  context: CalculationContext,
): FiqhAnalysisResult {
  const maxDays = context === 'haid' ? 15 : 60;
  const totalSpan = days.length;
  const bloodHours = calculateBloodHours(days);

  let category = '';
  const statusTimeline: any[] = [];
  const qadhoObligations: string[] = [];
  const purificationInstructions: string[] = [];
  const legalBasis = "Kitab Uyunul Masa-il Linnisa (Mazhab Syafi\u2019i) & Fathul Qorib.";

  const bloodDayIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
  const firstBloodIdx = bloodDayIndices.length > 0 ? bloodDayIndices[0] : -1;
  const lastBloodIdx = bloodDayIndices.length > 0 ? bloodDayIndices[bloodDayIndices.length - 1] : -1;
  const bleedingSpan = bloodDayIndices.length > 0 ? (lastBloodIdx - firstBloodIdx + 1) : 0;
  const isTerputus = bloodDayIndices.length > 1 && bleedingSpan > bloodDayIndices.length;

  if (bleedingSpan <= maxDays) {
    if (bloodHours >= 24) {
      category = context === 'haid' ? 'Haidl Normal' : 'Nifas Normal';

      days.forEach((d, idx) => {
        if (idx < firstBloodIdx) {
          statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Suci', reason: 'Masa suci sebelum pendarahan.' });
        } else if (idx > lastBloodIdx) {
          statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Suci', reason: 'Masa suci setelah pendarahan berakhir.' });
        } else {
          statusTimeline.push({
            day: d.dayNumber,
            date: d.date,
            status: context === 'haid' ? 'Haid' : 'Nifas',
            reason: d.isBlood
              ? `Darah keluar (${context === 'haid' ? 'Haid' : 'Nifas'}).`
              : `Masa henti dihukumi ${context === 'haid' ? 'Haid' : 'Nifas'} (Kaidah Jam\u2019u/Talfiq).`,
          });
        }
      });
    } else {
      category = 'Darah Fasad (Bukan Haidl)';
      days.forEach(d => {
        if (d.isBlood) {
          statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Istihadloh', reason: 'Darah Fasad (akumulasi kurang dari 24 jam).' });
          qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodho (Kasus Darah Fasad).`);
        } else {
          statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Suci', reason: 'Masa suci.' });
        }
      });
    }
  } else {
    const strongDays = days.filter(d => d.isStrong);
    const totalStrongHours = strongDays.length * 24;
    const isMumayyizah = totalStrongHours >= 24 && totalStrongHours <= (maxDays * 24);

    if (experience === 'mubtadiah') {
      if (isMumayyizah) {
        category = "Mubtadi'ah Mumayyizah";
        const firstStrongIdx = days.findIndex(d => d.isStrong);
        const lastStrongIdx = days.map(d => d.isStrong).lastIndexOf(true);

        days.forEach((d, idx) => {
          if (idx < firstStrongIdx) {
            statusTimeline.push({ day: d.dayNumber, date: d.date, status: d.isBlood ? 'Istihadloh' : 'Suci', reason: d.isBlood ? 'Darah Lemah (Istihadloh sebelum darah kuat).' : 'Masa suci.' });
            if (d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodho (Istihadloh).`);
          } else if (idx > lastStrongIdx) {
            statusTimeline.push({ day: d.dayNumber, date: d.date, status: d.isBlood ? 'Istihadloh' : 'Suci', reason: d.isBlood ? 'Darah Lemah (Istihadloh setelah darah kuat).' : 'Masa suci.' });
            if (d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodho (Istihadloh).`);
          } else {
            statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Haid', reason: d.isStrong ? 'Darah Kuat (Haid).' : 'Darah Lemah di sela darah kuat (Haid - Tamyiz).' });
          }
        });
      } else {
        category = "Mubtadi'ah Ghoiru Mumayyizah";
        days.forEach(d => {
          const isHaid = d.dayNumber === 1;
          statusTimeline.push({ day: d.dayNumber, date: d.date, status: isHaid ? 'Haid' : (d.isBlood ? 'Istihadloh' : 'Suci'), reason: isHaid ? 'Ketentuan haid minimal (24 jam pertama).' : (d.isBlood ? 'Istihadloh.' : 'Masa suci.') });
          if (!isHaid && d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodho.`);
        });
      }
    } else {
      if (isMumayyizah) {
        category = "Mu'tadah Mumayyizah";
        const firstStrongIdx = days.findIndex(d => d.isStrong);
        const lastStrongIdx = days.map(d => d.isStrong).lastIndexOf(true);

        days.forEach((d, idx) => {
          if (idx < firstStrongIdx) {
            statusTimeline.push({ day: d.dayNumber, date: d.date, status: d.isBlood ? 'Istihadloh' : 'Suci', reason: d.isBlood ? 'Darah Lemah (Istihadloh).' : 'Masa suci.' });
            if (d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodho.`);
          } else if (idx > lastStrongIdx) {
            statusTimeline.push({ day: d.dayNumber, date: d.date, status: d.isBlood ? 'Istihadloh' : 'Suci', reason: d.isBlood ? 'Darah Lemah (Istihadloh).' : 'Masa suci.' });
            if (d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodho.`);
          } else {
            statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Haid', reason: d.isStrong ? 'Darah Kuat (Haid).' : 'Darah Lemah di sela darah kuat (Tamyiz).' });
          }
        });
      } else if (habit.retrospection === 'ingat_semua' || habit.retrospection === 'ingat_durasi') {
        const dur = habit.duration || 7;
        category = "Mu'tadah Ghoiru Mumayyizah Dzakiroh";
        days.forEach((d, idx) => {
          const isHaidZone = d.dayNumber <= dur;
          let status = 'Suci';
          let reason = 'Masa suci.';

          if (isHaidZone) {
            if (d.isBlood) {
              status = 'Haid';
              reason = `Haid sesuai Adat (${dur} hari).`;
            } else {
              let leftHasBlood = false;
              for (let l = idx - 1; l >= 0; l--) {
                if (days[l].dayNumber <= dur && days[l].isBlood) { leftHasBlood = true; break; }
              }
              let rightHasBlood = false;
              for (let r = idx + 1; r < days.length; r++) {
                if (days[r].dayNumber <= dur && days[r].isBlood) { rightHasBlood = true; break; }
              }
              if (leftHasBlood && rightHasBlood) {
                status = 'Haid';
                reason = `Masa henti di sela haid adat (Hukum Jam\u2019u).`;
              }
            }
          } else {
            status = d.isBlood ? 'Istihadloh' : 'Suci';
            reason = d.isBlood ? 'Istihadloh (melampaui adat haid).' : 'Masa suci.';
          }

          statusTimeline.push({ day: d.dayNumber, date: d.date, status, reason });
          if (status !== 'Haid' && d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodho.`);
        });
      } else {
        category = 'Mutahayyiroh (Lupa Adat)';
        days.forEach(d => {
          statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Ihtiyath', reason: 'Masa kehati-hatian (Mutahayyiroh).' });
        });
        purificationInstructions.push('Wajib mandi wajib setiap akan shalat fardhu.');
      }
    }
  }

  const haidCount = statusTimeline.filter(s => s.status === 'Haid').length;
  const istihadlohCount = statusTimeline.filter(s => s.status === 'Istihadloh').length;
  const nifasCount = statusTimeline.filter(s => s.status === 'Nifas').length;
  const ihtiyathCount = statusTimeline.filter(s => s.status === 'Ihtiyath').length;

  let shortCategory = category;
  if (category === 'Haidl Normal') shortCategory = 'HAIDL NORMAL';
  else if (category === 'Nifas Normal') shortCategory = 'NIFAS NORMAL';
  else if (category === "Mubtadi'ah Mumayyizah") shortCategory = "ISTIHADLOH (MUBTADI'AH MUMAYYIZAH)";
  else if (category === "Mubtadi'ah Ghoiru Mumayyizah") shortCategory = "ISTIHADLOH (MUBTADI'AH GHOIRU MUMAYYIZAH)";
  else if (category === "Mu'tadah Mumayyizah") shortCategory = "ISTIHADLOH (MU'TADAH MUMAYYIZAH)";
  else if (category === "Mu'tadah Ghoiru Mumayyizah Dzakiroh") shortCategory = "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH)";
  else if (category === 'Mutahayyiroh (Lupa Adat)') shortCategory = 'ISTIHADLOH (MUTAHAYYIROH)';
  else if (category === 'Darah Fasad (Bukan Haidl)') shortCategory = 'DARAH FASAD (BUKAN HAIDL)';

  let analysis = `Total rangkaian darah Anda adalah ${statusTimeline.length} hari. Berdasarkan kaidah ${category}, masa tersebut dibagi menjadi: `;
  const parts = [];
  if (haidCount > 0) parts.push(`${haidCount} hari dihukumi HAIDL`);
  if (nifasCount > 0) parts.push(`${nifasCount} hari dihukumi NIFAS`);
  if (istihadlohCount > 0) parts.push(`${istihadlohCount} hari dihukumi ISTIHADLOH`);
  if (ihtiyathCount > 0) parts.push(`${ihtiyathCount} hari dihukumi IHTIYATH`);
  analysis += (parts.length > 0 ? parts.join(', ') : 'Suci') + '.';

  if (isTerputus) {
    analysis += ' Darah keluar secara terputus-putus, sistem menerapkan kaidah Jam\u2019u/Talfiq.';
  }

  const specialNotes = generateActionableNotes(days, context, totalSpan, bloodHours);

  if (totalSpan > maxDays) {
    purificationInstructions.push('Wajib berwudhu setiap kali masuk waktu sholat setelah membersihkan farji.');
    purificationInstructions.push('Gunakan pembalut yang rapat agar darah tidak menetes.');
  } else if (bloodHours >= 24 || context === 'nifas') {
    if (isTerputus) {
      purificationInstructions.push('SETIAP KALI darah berhenti, Anda WAJIB segera mandi besar (janabah) agar dapat melaksanakan sholat dan puasa.');
    } else {
      purificationInstructions.push('Mandi wajib saat darah benar-benar berhenti (nampak cairan bening/suci).');
    }
  }

  return {
    analysis,
    statusTimeline,
    category,
    shortCategory,
    specialNotes: Array.from(new Set(specialNotes)),
    purificationInstructions: Array.from(new Set(purificationInstructions)),
    qadhoObligations: Array.from(new Set(qadhoObligations)),
    legalBasis,
  };
}
