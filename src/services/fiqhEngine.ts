import { DayRecord, BloodColor, BloodTexture, BloodAroma, CalculationContext, UserHabit, FiqhAnalysisResult, ExperienceStatus } from "../types";
import { isSameDay, differenceInDays, parseISO, addDays } from "date-fns";

/**
 * 1. STRUKTUR DATA & VALIDASI AWAL
 */

export interface FiqhValidationResult {
  isValid: boolean;
  message: string;
}

/**
 * Menghitung apakah usia memenuhi syarat minimal Haid (9 Tahun Qomariyah kurang 16 hari).
 * 1 Tahun Qomariyah ≈ 354.36 hari. 
 */
export function validateAge(years: number, months: number, days: number): FiqhValidationResult {
  const totalDays = (years * 354.367) + (months * 29.53) + days;
  const minimumDays = (9 * 354.367) - 16;

  if (totalDays < minimumDays) {
    return {
      isValid: false,
      message: "Status: Darah Fasad/Istihadloh. Usia belum mencapai batas minimal haidl (9 Tahun Qomariyah kurang 16 hari)."
    };
  }

  return { isValid: true, message: "Usia memenuhi syarat minimal haidl." };
}

/**
 * 2. SISTEM SKORING HIERARKI PERINGKAT
 */
const COLOR_RANK: Record<BloodColor, number> = {
  hitam: 1,
  merah: 2,
  coklat: 3,
  kuning: 4,
  keruh: 5
};

const TEXTURE_RANK: Record<BloodTexture, number> = {
  kental: 0,
  cair: 1
};

const AROMA_RANK: Record<BloodAroma, number> = {
  busuk: 0,
  tidak_busuk: 1
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

/**
 * 3. PARSING DATA
 */
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
        originalRecord: record
      });
    } else {
      timeline.push({
        dayNumber: i + 1,
        date: dateStr,
        isBlood: false,
        isStrong: false,
        score: 999
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

/**
 * 5. GENERATOR CATATAN INSTRUKSI (HAIDL, NIFAS & ISTIHADLOH)
 */
function generateActionableNotes(
  days: DayStrength[],
  context: CalculationContext,
  totalSpan: number,
  bloodHours: number
): string[] {
  const maxDays = context === 'haid' ? 15 : 60;
  const notes: string[] = [];

  // 1. KASUS ISTIHADLOH (Melebihi batas maksimal)
  if (totalSpan > maxDays) {
    notes.push("PANDUAN MUSTAHADLOH: Karena masa darah telah melewati batas maksimal (15 hari haidl / 60 hari nifas), Anda saat ini berstatus Mustahadloh.");
    notes.push("Instruksi Bersuci: Wajib berwudhu istibahah (untuk memperbolehkan sholat) setiap kali masuk waktu sholat fardlu, setelah membersihkan farji dan menyumbatnya dengan pembalut yang rapat.");
    return notes;
  }

  // 2. KASUS SIKLUS NORMAL (Haid < 15, Nifas < 60)
  const isBleedingNow = days[days.length - 1].isBlood;
  const hasGapInBetween = days.some((d, idx) => !d.isBlood && idx > 0 && idx < days.length - 1 && days[idx-1].isBlood && days.slice(idx+1).some(future => future.isBlood));

  if (!isBleedingNow) {
    // Sedang berhenti (Jeda/Naqo')
    if (context === 'haid') {
      if (bloodHours < 24) {
        notes.push("Darah berhenti SEBELUM mencapai batas minimal haidl (24 jam). Anda CUKUP membersihkan darah (istinja) dan berwudlu jika ingin sholat. Belum diwajibkan mandi besar.");
      } else {
        notes.push("Darah telah mencapai minimal haid (24 jam) dan saat ini berhenti. Anda WAJIB segera mandi besar (mandi janabah) dan melaksanakan rutinitas ibadah.");
      }
    } else {
      // Nifas: Batas minimal sekejap (lahdzoh)
      notes.push("Darah nifas berhenti. Anda WAJIB mandi besar (mandi janabah) dan mulai laksanakan ibadah.");
    }
  } else {
    // Sedang keluar darah
    const previousBleedingSessions = days.filter((d, i) => d.isBlood && i < days.length - 1 && !days[i+1].isBlood).length;
    if (previousBleedingSessions > 0) {
      notes.push(`Darah ${context} keluar kembali. Anda wajib kembali menghindari hal-hal yang diharamkan bagi wanita ${context} (Sholat, Puasa, Jima', dll).`);
      if (bloodHours >= 24 || context === 'nifas') {
        notes.push("Karena total darah sudah mencapai batas minimal, maka setiap kali darah berhenti di masa mendatang (dengan memastikan tampon tidak lagi bernoda) selama masih dalam rentang masa maksimal, Anda wajib mandi besar lagi, sholat, dan puasa.");
        notes.push("Kebolehan Pasutri: Selama darah berhenti di sela-sela masa haid, suami diperbolehkan menggauli istrinya menurut riwayat yang kuat karena secara zahir darah yang berhenti dihukumi suci.");
      }
    } else {
      notes.push(`Darah ${context} baru saja tiba. Hindari hal-hal yang diharamkan (haram bi sababil haidl). Pastikan peralatan ibadah tidak terkena najis darah.`);
    }
  }

  // 3. HUKUM JEDA BERSIH (An-Naqo' / Hukum Jam'u)
  if (hasGapInBetween && (bloodHours >= 24 || context === 'nifas')) {
    notes.push(`PERHATIAN (Hukum Jam'u): Karena darah keluar kembali dalam rentang masa maksimal, maka masa berhenti di sela darah tersebut dihukumi ${context.toUpperCase()}. Sholat yang Anda kerjakan di masa tersebut secara hukum tidak sah (tapi tidak berdosa dan tidak perlu diqodlo). Namun, jika bertepatan dengan puasa RAMADHAN, maka puasa di hari jeda tersebut BATAL dan WAJIB DIQODLO. Syarat hukum Jam'u: Total akumulasi darah minimal 24 jam dan total rentang tidak lebih dari 15 hari.`);
  }

  return notes;
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

/**
 * 4. ROUTER & MESIN LOGIKA FIQH
 */
export function determineStatus(
  days: DayStrength[], 
  experience: ExperienceStatus, 
  habit: UserHabit, 
  context: CalculationContext
): FiqhAnalysisResult {
  const maxDays = context === 'haid' ? 15 : 60;
  const totalSpan = days.length;
  const bloodHours = calculateBloodHours(days);

  let category = "";
  let analysis = "";
  const statusTimeline: any[] = [];
  const qadhoObligations: string[] = [];
  const purificationInstructions: string[] = [];
  const legalBasis = "Kitab Uyunul Masa-il Linnisa (Mazhab Syafi'i) & Fathul Qorib.";

  const bloodDayIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
  const isTerputus = bloodDayIndices.length > 1 && (bloodDayIndices[bloodDayIndices.length - 1] - bloodDayIndices[0] + 1) > bloodDayIndices.length;

  // KASUS NORMAL (Rentang <= 15 hari)
  if (totalSpan <= maxDays) {
    if (bloodHours >= 24) {
      category = context === 'haid' ? "Haidl Normal" : "Nifas Normal";
      
      days.forEach(d => {
        statusTimeline.push({
          day: d.dayNumber,
          date: d.date,
          status: context === 'haid' ? 'Haid' : 'Nifas',
          isBlood: d.isBlood,
          reason: d.isBlood 
            ? `Darah keluar (${context === 'haid' ? 'Haid' : 'Nifas'}).` 
            : `Masa henti/jeda di antaranya ditarik menjadi masa ${context === 'haid' ? 'Haid' : 'Nifas'} (Kaidah Jam'u).`
        });
      });
    } else {
      category = "Darah Fasad (Bukan Haidl)";
      analysis = "Akumulasi darah kurang dari 24 jam dalam rentang 15 hari, sehingga tidak memenuhi syarat minimal haidl.";
      days.forEach(d => {
        statusTimeline.push({
          day: d.dayNumber, date: d.date, status: 'Istihadloh', isBlood: d.isBlood, reason: "Kurang dari 24 jam."
        });
        if (d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber} wajib diqodho.`);
      });
    }
  } 
  // KASUS ISTIHADLOH (Rentang > 15 hari)
  else {
    const strongDays = days.filter(d => d.isStrong);
    const totalStrongHours = strongDays.length * 24;
    const isMumayyizah = totalStrongHours >= 24 && totalStrongHours <= (maxDays * 24);

    if (experience === 'mubtadiah') {
      if (isMumayyizah) {
        category = "Mubtadi'ah Mumayyizah";
               // Cari index darah kuat pertama dan terakhir
        const firstStrongIdx = days.findIndex(d => d.isStrong);
        const lastStrongIdx = days.map(d => d.isStrong).lastIndexOf(true);

        days.forEach((d, idx) => {
          const isHaid = idx >= firstStrongIdx && idx <= lastStrongIdx;
          statusTimeline.push({
            day: d.dayNumber, date: d.date, status: isHaid ? 'Haid' : 'Istihadloh',
            isBlood: d.isBlood,
            reason: isHaid 
              ? (d.isStrong ? "Darah Kuat (Haid)." : "Darah Lemah/Henti di sela-sela darah kuat (Haid menurut Kaidah Tamyiz Intermittent).") 
              : "Istihadloh (Setelah darah kuat terakhir)."
          });
          if (!isHaid && d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber} wajib diqodho.`);
        });
      } else {
        category = "Mubtadi'ah Ghoiru Mumayyizah";
        days.forEach(d => {
          const isHaid = d.dayNumber === 1;
          statusTimeline.push({
            day: d.dayNumber, date: d.date, status: isHaid ? 'Haid' : 'Istihadloh',
            isBlood: d.isBlood,
            reason: isHaid ? "Ketentuan minimal haid." : "Istihadloh (melampaui 15 hari)."
          });
          if (!isHaid && d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber} wajib diqodho.`);
        });
      }
    } else {
      // MU'TADAH
      if (isMumayyizah) {
        category = "Mu'tadah Mumayyizah";
        
        const firstStrongIdx = days.findIndex(d => d.isStrong);
        const lastStrongIdx = days.map(d => d.isStrong).lastIndexOf(true);

        days.forEach((d, idx) => {
          const isHaid = idx >= firstStrongIdx && idx <= lastStrongIdx;
          statusTimeline.push({
            day: d.dayNumber, date: d.date, status: isHaid ? 'Haid' : 'Istihadloh',
            isBlood: d.isBlood,
            reason: isHaid 
              ? (d.isStrong ? "Darah Kuat (Haid)." : "Darah Lemah/Henti di sela-sela darah kuat (Haid menurut Kaidah Tamyiz Intermittent).") 
              : "Istihadloh (Darah Lemah)."
          });
          if (!isHaid && d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber} wajib diqodho.`);
        });
      } else if (habit.retrospection === 'ingat_semua' || habit.retrospection === 'ingat_durasi') {
        const dur = habit.duration || 7;
        category = "Mu'tadah Ghoiru Mumayyizah Dzakiroh";
        days.forEach(d => {
          const isHaid = d.dayNumber <= dur;
          statusTimeline.push({
            day: d.dayNumber, date: d.date, status: isHaid ? 'Haid' : 'Istihadloh',
            isBlood: d.isBlood,
            reason: isHaid ? `Masa Adat (${dur} hari).` : "Istihadloh (melebihi adat)."
          });
          if (!isHaid && d.isBlood) qadhoObligations.push(`Sholat hari ke-${d.dayNumber} wajib diqodho.`);
        });
      } else {
        category = "Mutahayyiroh (Lupa Adat)";
        days.forEach(d => {
          statusTimeline.push({
            day: d.dayNumber, date: d.date, status: 'Ihtiyath', isBlood: d.isBlood, reason: "Mutahayyiroh."
          });
        });
        purificationInstructions.push("Wajib mandi wajib setiap akan sholat fardlu.");
      }
    }
  }

  const haidCount = statusTimeline.filter(s => s.status === 'Haid').length;
  const istihadlohCount = statusTimeline.filter(s => s.status === 'Istihadloh').length;
  const nifasCount = statusTimeline.filter(s => s.status === 'Nifas').length;
  const ihtiyathCount = statusTimeline.filter(s => s.status === 'Ihtiyath').length;

  let shortCategory = category;
  if (category === "Haidl Normal") shortCategory = "HAIDL NORMAL";
  else if (category === "Nifas Normal") shortCategory = "NIFAS NORMAL";
  else if (category === "Mubtadi'ah Mumayyizah") shortCategory = "ISTIHADLOH (MUBTADI'AH MUMAYYIZAH)";
  else if (category === "Mubtadi'ah Ghoiru Mumayyizah") shortCategory = "ISTIHADLOH (MUBTADI'AH GHOIRU MUMAYYIZAH)";
  else if (category === "Mu'tadah Mumayyizah") shortCategory = "ISTIHADLOH (MU'TADAH MUMAYYIZAH)";
  else if (category === "Mu'tadah Ghoiru Mumayyizah Dzakiroh") shortCategory = "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA QODRON WA WAQTAN)";
  else if (category === "Mutahayyiroh (Lupa Adat)") shortCategory = "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH NASIYAH LI'ADATIHA QODRON WA WAQTAN / MUTAHAYYIROH)";

  analysis = `Total rangkaian darah Anda adalah ${statusTimeline.length} hari. Berdasarkan kaidah ${category}, masa tersebut dibagi menjadi: `;
  
  const parts = [];
  if (haidCount > 0) parts.push(`${haidCount} hari dihukumi HAIDL`);
  if (nifasCount > 0) parts.push(`${nifasCount} hari dihukumi NIFAS`);
  if (istihadlohCount > 0) parts.push(`${istihadlohCount} hari dihukumi ISTIHADLOH`);
  if (ihtiyathCount > 0) parts.push(`${ihtiyathCount} hari dihukumi IHTIYATH`);
  
  // Menambahkan Alasan Logis
  const alasanLogisMap: Record<string, string> = {
    "Haidl Normal": isTerputus 
      ? "Darah Anda keluar dalam rentang waktu yang wajar (antara 24 jam s.d. 15 hari) dan dipisahkan dengan masa suci/jeda di antaranya, sehingga seluruh hari pendarahan dan masa jeda di antaranya dihukumi sebagai darah haid berdasarkan kaidah Jam'u/Talfiq."
      : "Darah Anda keluar dalam rentang waktu yang wajar (antara 24 jam s.d. 15 hari) secara terus-menerus tanpa terputus, sehingga seluruh pendarahan dihukumi sebagai darah haid.",
    "Nifas Normal": isTerputus
      ? "Pendarahan pasca-melahirkan Anda keluar dalam rentang waktu yang wajar (tidak melebihi batas maksimal nifas 60 hari) dan dipisahkan dengan masa suci/jeda di antaranya, sehingga seluruh hari pendarahan dan masa jeda di antaranya dihukumi sebagai darah nifas berdasarkan kaidah Jam'u/Talfiq."
      : "Pendarahan pasca-melahirkan Anda keluar dalam rentang waktu yang wajar (tidak melebihi batas maksimal nifas 60 hari) secara terus-menerus tanpa terputus, sehingga seluruh pendarahan dihukumi sebagai darah nifas.",
    "Mubtadi'ah Mumayyizah": "Darah Anda memiliki perbedaan kualitas (kuat/lemah) yang memenuhi syarat Tamyiz, sehingga darah yang kuat dihukumi haid dan yang lemah dihukumi istihadloh.",
    "Mubtadi'ah Ghoiru Mumayyizah": "Darah tidak memiliki perbedaan kualitas yang memenuhi syarat Tamyiz, maka berdasarkan kaidah Mubtadi'ah Ghoiru Mumayyizah, hari pertama dihukumi haid dan sisanya istihadloh.",
    "Mu'tadah Mumayyizah": "Darah Anda memiliki perbedaan kualitas (kuat/lemah) yang memenuhi syarat Tamyiz, sehingga darah yang kuat dihukumi haid dan yang lemah dihukumi istihadloh.",
    "Mu'tadah Ghoiru Mumayyizah Dzakiroh": "Anda ingat durasi adat haid Anda sebelumnya, maka masa haid ditetapkan berdasarkan durasi adat tersebut, sisanya dihukumi istihadloh.",
    "Mutahayyiroh (Lupa Adat)": "Karena Anda lupa durasi maupun waktu adat haid, maka hukumnya adalah Mutahayyiroh: wajib bersikap ihtiyath (berhati-hati) dengan menanggung konsekuensi ibadah maksimal."
  };

  analysis += (parts.length > 0 ? parts.join(', ') : "Suci") + ". ";
  if (alasanLogisMap[category]) {
    analysis += `\n\nAlasan logis: ${alasanLogisMap[category]}`;
  }

  if (isTerputus) {
    analysis += "Karena darah Anda keluar secara terputus-putus (terdapat hari di mana darah berhenti), maka sistem menerapkan kaidah Jam'u/Talfiq. ";
  }

  // Final touches & Instructions
  const specialNotes = generateActionableNotes(days, context, totalSpan, bloodHours);

  if (totalSpan > maxDays) {
    purificationInstructions.push("Wajib berwudhu setiap kali masuk waktu sholat setelah membersihkan farji.");
    purificationInstructions.push("Gunakan pembalut yang rapat agar darah tidak menetes.");
  } else if (bloodHours >= 24 || context === 'nifas') {
    if (isTerputus) {
      purificationInstructions.push("SETIAP KALI darah berhenti (meskipun belum 15 hari/60 hari), Anda WAJIB segera mandi besar (janabah) agar dapat melaksanakan sholat dan puasa.");
    } else {
      purificationInstructions.push("Mandi wajib saat darah benar-benar berhenti (nampak cairan bening/suci).");
    }
  }

  return {
    analysis,
    statusTimeline,
    category,
    categoryReason: alasanLogisMap[category] || "",
    shortCategory,
    specialNotes: Array.from(new Set(specialNotes)),
    purificationInstructions: Array.from(new Set(purificationInstructions)),
    qadhoObligations: Array.from(new Set(qadhoObligations)),
    legalBasis
  };
}
