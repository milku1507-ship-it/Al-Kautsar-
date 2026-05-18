import { FiqhAnalysisRequest, FiqhAnalysisResult, UserHabit, DayRecord, ExperienceStatus } from "../types";
import { validateAge, parseDays, determineStatus, DayStrength, getBloodStrengthScore } from "./fiqhEngine";
import { parseISO, differenceInHours, differenceInDays, addDays, isSameDay, isBefore, isAfter, eachDayOfInterval } from "date-fns";

/**
 * UTILITY: DETEKSI WAKTU SHOLAT & INFO QODLO
 */
interface PrayerInfo {
  name: string;
  startMinutes: number;
}

function getPrayerInfo(timeStr: string): PrayerInfo {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMinutes = h * 60 + m;

  // Refined slots based on standard approximations
  if (totalMinutes >= 270 && totalMinutes < 345) return { name: 'Subuh', startMinutes: 270 }; // 04:30 - 05:45
  if (totalMinutes >= 720 && totalMinutes < 915) return { name: 'Dzuhur', startMinutes: 720 }; // 12:00 - 15:15
  if (totalMinutes >= 915 && totalMinutes < 1080) return { name: 'Ashar', startMinutes: 915 }; // 15:15 - 18:00
  if (totalMinutes >= 1080 && totalMinutes < 1155) return { name: 'Maghrib', startMinutes: 1080 }; // 18:00 - 19:15
  if (totalMinutes >= 1155 || totalMinutes < 270) return { name: 'Isya', startMinutes: 1155 }; // 19:15 - 04:30
  return { name: 'Luar Waktu', startMinutes: -1 };
}

/**
 * UTILITY: DETEKSI POLA ADAT (PATTERN RECOGNITION)
 */
function determineActiveAdat(durations: number[], istihadlohMonthIndex: number = 0): number {
    if (!durations || durations.length === 0) return 7;
    if (durations.length === 1) return durations[0];
    
    // 1. Adat Tetap (Semua angka sama)
    const allSame = durations.every(d => d === durations[0]);
    if (allSame) return durations[0];
    
    // 2. Adat Berubah Teratur (Minimal 2 Putaran)
    for (let n = 1; n <= Math.floor(durations.length / 2); n++) {
        const pattern = durations.slice(0, n);
        let isPatternMatch = true;
        for (let i = 0; i < durations.length; i++) {
            if (durations[i] !== pattern[i % n]) {
                isPatternMatch = false;
                break;
            }
        }
        
        if (isPatternMatch && (durations.length / n) >= 2) {
            return pattern[(durations.length + istihadlohMonthIndex) % n];
        }
    }
    
    return durations[durations.length - 1];
}

/**
 * UTILITY: DYNAMIC ANALYSIS SUMMARY BUILDER (ANTI-HALUSINASI)
 */
function buildFiqhAnalysisSummary(
    category: string,
    statusTimeline: any[],
    days: DayStrength[]
): string {
    const haidCount = statusTimeline.filter(s => s.status === 'Haid').length;
    const istihadlohCount = statusTimeline.filter(s => s.status === 'Istihadloh').length;
    const nifasCount = statusTimeline.filter(s => s.status === 'Nifas').length;
    const ihtiyathCount = statusTimeline.filter(s => s.status === 'Ihtiyath').length;

    const bIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
    const isIntermittent = bIndices.length > 1 && (bIndices[bIndices.length - 1] - bIndices[0] + 1) > bIndices.length;

    let summary = `Total rangkaian darah Anda adalah ${statusTimeline.length} hari. Berdasarkan kaidah ${category}, masa tersebut dibagi menjadi: `;
    const parts = [];
    if (haidCount > 0) parts.push(`${haidCount} hari dihukumi HAIDL`);
    if (nifasCount > 0) parts.push(`${nifasCount} hari dihukumi NIFAS`);
    if (istihadlohCount > 0) parts.push(`${istihadlohCount} hari dihukumi ISTIHADLOH`);
    if (ihtiyathCount > 0) parts.push(`${ihtiyathCount} hari dihukumi IHTIYATH`);
    
    if (parts.length === 0) {
        summary = `Total rangkaian darah Anda adalah ${statusTimeline.length} hari. Berdasarkan kaidah ${category}, masa tersebut dihukumi SUCI/ISTIHADLOH.`;
    } else {
        summary += parts.join(', ') + ". ";
    }

    if (isIntermittent) {
        summary += "Karena darah Anda keluar secara terputus-putus (terdapat hari di mana darah berhenti), maka sistem menerapkan kaidah Jam'u/Talfiq. ";
    }

    return summary;
}

/**
 * UTILITY: PENGELOMPOKAN LINI MASA (TIMELINE AGGREGATION)
 */
function groupTimeline(timeline: { day: number; status: string; reason: string }[]) {
  if (timeline.length === 0) return [];
  const groups: { startDay: number; endDay: number; status: any; reason: string }[] = [];
  let currentGroup = { ...timeline[0], startDay: timeline[0].day, endDay: timeline[0].day };

  for (let i = 1; i < timeline.length; i++) {
    const item = timeline[i];
    if (item.status === currentGroup.status) {
      currentGroup.endDay = item.day;
    } else {
      groups.push({
        startDay: currentGroup.startDay,
        endDay: currentGroup.endDay,
        status: currentGroup.status as any,
        reason: currentGroup.reason
      });
      currentGroup = { ...item, startDay: item.day, endDay: item.day };
    }
  }
  groups.push({
    startDay: currentGroup.startDay,
    endDay: currentGroup.endDay,
    status: currentGroup.status as any,
    reason: currentGroup.reason
  });
  return groups;
}

/**
 * UTILITY: PENGELOMPOKAN KEWAJIBAN QODLO (QODLO AGGREGATION)
 */
function groupQodlo(qodloStrings: string[]) {
  if (qodloStrings.length === 0) return [];
  
  const parsed = [];
  const nonStandard = [];

  for (const s of qodloStrings) {
    const match = s.match(/hari ke-(\d+)/);
    if (match) {
      const day = parseInt(match[1]);
      let message = s.includes(':') ? s.split(':').slice(1).join(':').trim() : s.replace(/.*hari ke-\d+\s*/, "").trim();
      parsed.push({ day, message });
    } else {
      nonStandard.push(s);
    }
  }

  // Handle standard grouping
  const groups: { startDay: number; endDay: number; message: string }[] = [];
  
  if (parsed.length > 0) {
    parsed.sort((a, b) => a.day - b.day);
    let current = { ...parsed[0], startDay: parsed[0].day, endDay: parsed[0].day };

    for (let i = 1; i < parsed.length; i++) {
      const item = parsed[i];
      if (item.day === current.endDay + 1 && item.message === current.message) {
        current.endDay = item.day;
      } else {
        groups.push({
          startDay: current.startDay,
          endDay: current.endDay,
          message: current.message
        });
        current = { ...item, startDay: item.day, endDay: item.day };
      }
    }
    groups.push({
      startDay: current.startDay,
      endDay: current.endDay,
      message: current.message
    });
  }

  // Add non-standard ones as single-day or general entries (using -1 or 0 index)
  for (const s of nonStandard) {
    groups.push({
      startDay: 0,
      endDay: 0,
      message: s
    });
  }

  return groups;
}

/**
 * 6. KALKULASI QODLO SHOLAT & PUASA
 */
function calculateQodlo(
  timeline: { status: string; day: number; isBlood?: boolean; isFirstMonthWaiting?: boolean }[],
  startTime: string | undefined, // Waktu darah datang
  stopTime: string | undefined,  // Waktu darah berhenti
  hasPerformed: boolean | undefined, // Sudah sholat sebelum darah datang?
  isRamadhan: boolean | undefined,
  existingObligations: string[] = [] // Existing obligations from sub-functions
) {
  const qodloSholat: string[] = [...existingObligations];
  let totalQodloPuasa = 0;

  // 1. Qodlo Awal (Saat Datangnya Mani')
  if (startTime && hasPerformed === false) {
    const info = getPrayerInfo(startTime);
    if (info.name !== 'Luar Waktu') {
      const [h, m] = startTime.split(':').map(Number);
      const nowMin = h * 60 + m;
      let diff = nowMin - info.startMinutes;
      if (info.name === 'Isya' && nowMin < 270) diff = (nowMin + 1440) - info.startMinutes;
      
      // Threshold 15 menit (untuk sholat + bersuci)
      if (diff >= 15) {
        if (!qodloSholat.some(q => q.includes(`hari ke-1: Sholat ${info.name} (Awal)`))) {
          qodloSholat.push(`Sholat hari ke-1: Sholat ${info.name} (Awal) wajib diqodlo karena darah datang di waktu ${info.name} (${startTime}) dan telah melewati jarak waktu yang cukup untuk sholat & bersuci, namun Anda belum melaksanakannya.`);
        }
      }
    }
  }

  // 2. Qodlo Akhir (Saat Hilangnya Mani')
  if (stopTime) {
    const info = getPrayerInfo(stopTime);
    if (info.name !== 'Luar Waktu') {
      const lastDay = timeline.length > 0 ? timeline[timeline.length - 1].day : 1;
      const isAlreadyAdded = (prayerName: string) => qodloSholat.some(q => q.includes(`hari ke-${lastDay}:`) && q.includes(prayerName));

      if (info.name === 'Ashar') {
        if (!isAlreadyAdded('Ashar')) {
          qodloSholat.push(`Sholat hari ke-${lastDay}: Sholat Ashar & Dzuhur wajib diqodlo karena darah berhenti di waktu Ashar (${stopTime}) dan masih ada waktu minimal untuk Takbirotul Ihrom (Allahu Akbar). Dan Anda tidak melaksanakannya atau keburu magrib. Maka Anda wajib mengqodlo Ashar DAN Dzuhur sebelumnya (karena keduanya bisa dijama' menurut Kaidah Fiqlh).`);
        }
      } else if (info.name === 'Isya') {
        if (!isAlreadyAdded('Isya')) {
          qodloSholat.push(`Sholat hari ke-${lastDay}: Sholat Isya & Maghrib wajib diqodlo karena darah berhenti di waktu Isya (${stopTime}) dan masih ada waktu minimal untuk Takbirotul Ihrom (Allahu Akbar). Dan Anda tidak melaksanakannya atau keburu subuh. Maka Anda wajib mengqodlo Isya DAN Maghrib sebelumnya (karena keduanya bisa dijama' menurut Kaidah Fiqlh).`);
        }
      } else {
        if (!isAlreadyAdded(info.name)) {
          qodloSholat.push(`Sholat hari ke-${lastDay}: Sholat ${info.name} wajib diqodlo karena darah berhenti di waktu ${info.name} (${stopTime}). Karena saat berhenti masih ada waktu minimal muat Takbirotul Ihrom (Allahu Akbar), Anda wajib langsung mandi & sholat (ada') jika waktu cukup, atau mengqodlo jika waktu habis.`);
        }
      }
    }
  }

  // 3. Qodlo Hari-hari Istihadloh/Ihtiyath yang ditinggalkan (Menanti/Disangka Haid)
  timeline.forEach(t => {
      // Jika statusnya Istihadloh atau Ihtiyath, dan darah keluar (biasanya orang berhenti sholat saat darah keluar)
      // ATAU jika memang sedang dalam masa menanti 15 hari (isFirstMonthWaiting)
      if (t.isFirstMonthWaiting || (t.status === 'Istihadloh' && t.isBlood) || (t.status === 'Ihtiyath' && t.isBlood)) {
          // Hanya tambahkan jika belum ada pesan qodlo untuk hari tersebut (menghindari duplikasi)
          const alreadyAdded = qodloSholat.some(q => q.includes(`hari ke-${t.day}:`));
          if (!alreadyAdded) {
               let reason = "";
               if (t.isFirstMonthWaiting) reason = "Masa menanti kepastian (Waiting Period)";
               else if (t.status === 'Istihadloh') reason = "Darah Istihadloh (Fasad)";
               else if (t.status === 'Ihtiyath') reason = "Status Ihtiyath (Kehati-hatian)";
               
               qodloSholat.push(`Sholat hari ke-${t.day}: Sholat fardlu di hari ini wajib diqodlo jika belum dikerjakan (${reason}). Karena status hukum hari ini bukan Haid/Nifas.`);
          }
      }
  });

  // 4. Qodlo Puasa
  if (isRamadhan) {
    timeline.forEach(t => {
      // Wajib qodlo jika status Haid/Nifas (haram puasa) atau Istihadloh/Ihtiyath/Waiting tapi Anda tidak puasa karena disangka Haid.
      if (t.status === 'Haid' || t.status === 'Nifas' || t.isFirstMonthWaiting || (t.status === 'Ihtiyath' && t.isBlood)) {
        totalQodloPuasa++;
      }
    });
  }

  return { qodloSholat, totalQodloPuasa };
}

/**
 * MESIN LOGIKA (ENGINE) NIFAS LOKAL KOMPREHENSIF (BAB III)
 */
export function analyzeNifas(
  records: DayRecord[],
  laborDate: string,
  experience: ExperienceStatus,
  habit: UserHabit,
  startTime?: string,
  stopTime?: string,
  hasPerformed?: boolean,
  isRamadhan?: boolean
): FiqhAnalysisResult {
  const labor = parseISO(laborDate);
  
  if (records.length === 0) {
    return {
      analysis: "Data darah kosong.",
      statusTimeline: [],
      category: "Data Kosong",
      shortCategory: "Data Kosong",
      purificationInstructions: [],
      qadhoObligations: [],
      legalBasis: ""
    };
  }

  // SINKRONISASI TIMELINE ABSOLUT: Mencakup Labor s.d Hari Terakhir Input atau Labor + 60
  const firstInputDate = parseISO(records[0].date);
  const lastInputDate = parseISO(records[records.length - 1].date);
  const startDate = isBefore(firstInputDate, labor) ? firstInputDate : labor;
  const limit60 = addDays(labor, 60);
  const endDate = isAfter(lastInputDate, limit60) ? lastInputDate : limit60;

  const absoluteInterval = eachDayOfInterval({ start: startDate, end: endDate });
  const days: any[] = absoluteInterval.map((date, idx) => {
    const existing = records.find(r => isSameDay(parseISO(r.date), date));
    const isBlood = existing ? existing.status === 'darah' : false;
    const score = existing && isBlood ? getBloodStrengthScore(existing.color || 'merah', existing.texture || 'cair', existing.aroma || 'tidak_busuk') : 999;
    
    return {
      ...(existing || { date: date.toISOString(), status: 'bersih' }),
      dayNumber: idx + 1,
      isBlood,
      score,
      isStrong: false // Will be calculated below
    };
  });

  const bloodDaysInDays = days.filter(d => d.isBlood);
  if (bloodDaysInDays.length > 0) {
    const minScore = Math.min(...bloodDaysInDays.map(d => d.score));
    days.forEach(d => {
      if (d.isBlood && d.score === minScore) d.isStrong = true;
    });
  }

  const dayZones = days.map(d => {
    const current = parseISO(d.date);
    if (isSameDay(current, labor)) return 'B';
    return current < labor ? 'A' : 'C';
  });

  const statusTimeline: any[] = [];
  const qadhoObligations: string[] = [];
  const sixtyDaysLimit = 60;

  // 1. Evaluasi Zona A & B (Nglarani Manak)
  let laborBloodIsHaid = false;
  const laborIdx = days.findIndex((_, i) => dayZones[i] === 'B');
  if (laborIdx !== -1 && days[laborIdx].isBlood) {
    let bloodHoursPre = 0;
    for (let i = laborIdx; i >= 0; i--) {
        if (days[i].isBlood) bloodHoursPre += 24;
        else break;
    }
    if (bloodHoursPre >= 24) laborBloodIsHaid = true;
  }

  for (let i = 0; i < days.length; i++) {
    if (dayZones[i] === 'A' || dayZones[i] === 'B') {
      const d = days[i];
      if (d.isBlood) {
        if (laborBloodIsHaid) {
          statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Haid', isBlood: d.isBlood, reason: 'Darah saat melahirkan (Nglarani) yang bersambung dengan Haidl sebelumnya.' });
        } else {
          statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Istihadloh', isBlood: d.isBlood, reason: 'Darah saat melahirkan (Nglarani) / Darah pembuka yang tidak memenuhi syarat Haidl.' });
          if (d.dayNumber <= 15) {
            qadhoObligations.push(`Sholat hari ke-${d.dayNumber} (saat melahirkan) wajib diqodho karena statusnya Istihadloh.`);
          }
        }
      } else {
        statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Suci', isBlood: d.isBlood, reason: 'Masa suci sebelum melahirkan.' });
      }
    }
  }

  // 2. Evaluasi Zona C (Pasca-Melahirkan)
  const postLaborDays = days.filter((_, i) => dayZones[i] === 'C');
  const firstPostBloodIdxRelative = postLaborDays.findIndex(d => d.isBlood);

  if (firstPostBloodIdxRelative === -1) {
    postLaborDays.forEach(d => statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Suci', isBlood: false, reason: 'Tidak ada darah keluar setelah melahirkan.' }));
    return buildFinalNifasResult(
        statusTimeline, 
        "Suci", 
        "Suci (Tanpa Nifas)", 
        qadhoObligations, 
        days, 
        habit,
        startTime,
        stopTime,
        hasPerformed,
        isRamadhan
    );
  }

  if (firstPostBloodIdxRelative >= 15) {
     postLaborDays.forEach((d, idx) => {
       statusTimeline.push({ 
         day: d.dayNumber, date: d.date, 
         status: idx < firstPostBloodIdxRelative ? 'Suci' : 'Haid', 
         isBlood: d.isBlood,
         reason: idx < firstPostBloodIdxRelative ? 'Jeda 15 hari dari melahirkan (Dihukumi Suci).' : 'Darah keluar lewat 15 hari dari kelahiran (Hukum Haidl).' 
       });
     });
     return buildFinalNifasResult(statusTimeline, "Nifas Kadaluwarsa", "Haidl (Nifas Kadaluwarsa)", qadhoObligations, days, habit, startTime, stopTime, hasPerformed, isRamadhan);
  }

  // Determine Nifas Range
  const bloodSess: { start: number; end: number }[] = [];
  let sStart = -1;
  for (let i = 0; i < postLaborDays.length; i++) {
    if (postLaborDays[i].isBlood && i < sixtyDaysLimit) {
      if (sStart === -1) sStart = i;
    } else {
      if (sStart !== -1) {
        bloodSess.push({ start: sStart, end: i - 1 });
        sStart = -1;
      }
    }
  }
  if (sStart !== -1) bloodSess.push({ start: sStart, end: Math.min(postLaborDays.length - 1, sixtyDaysLimit - 1) });

  let nifasEndIdxRel = bloodSess.length > 0 ? bloodSess[0].end : -1;
  for (let i = 1; i < bloodSess.length; i++) {
    if (bloodSess[i].start - nifasEndIdxRel <= 15) nifasEndIdxRel = bloodSess[i].end;
    else break;
  }

  // DETEKSI MUSTAHADLOH NIFAS (> 60 HARI)
  if (nifasEndIdxRel >= sixtyDaysLimit - 1) {
    const postLaborDaysStrength: DayStrength[] = postLaborDays.map(d => ({
        dayNumber: d.dayNumber,
        date: d.date,
        isBlood: d.isBlood,
        isStrong: d.isStrong,
        score: d.score || 999
    }));
    const istihadlohResult = evaluateIstihadlohNifas(
        postLaborDaysStrength, 
        habit, 
        experience,
        startTime,
        stopTime,
        hasPerformed,
        isRamadhan
    );
    
    // Gabungkan dengan statusTimeline Zona A & B yang sudah ada
    const combinedTimeline = [...statusTimeline, ...istihadlohResult.statusTimeline];
    return {
        ...istihadlohResult,
        statusTimeline: combinedTimeline,
        groupedTimeline: groupTimeline(combinedTimeline),
        qadhoObligations: [...qadhoObligations, ...istihadlohResult.qadhoObligations]
    };
  }

  postLaborDays.forEach((d, i) => {
    if (i < firstPostBloodIdxRelative) {
      statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Suci', isBlood: d.isBlood, reason: 'Masa suci (jeda) sebelum darah nifas pertama.' });
    } else if (i <= nifasEndIdxRel) {
      statusTimeline.push({ day: d.dayNumber, date: d.date, status: 'Nifas', isBlood: d.isBlood, reason: d.isBlood ? 'Darah Nifas.' : 'Masa berhenti di sela-sela Nifas (Hukum Jam\'u).' });
    } else if (i < sixtyDaysLimit) {
      statusTimeline.push({ day: d.dayNumber, date: d.date, status: d.isBlood ? 'Haid' : 'Suci', isBlood: d.isBlood, reason: d.isBlood ? 'Darah Haidl sesudah nifas (dipisah jeda 15 hari).' : 'Suci pemisah Nifas dan Haidl.' });
    } else {
      statusTimeline.push({ day: d.dayNumber, date: d.date, status: d.isBlood ? 'Haid' : 'Suci', isBlood: d.isBlood, reason: d.isBlood ? 'Darah Haidl (di luar 60 hari nifas).' : 'Suci pasca 60 hari.' });
    }
  });

  let shortCat = bloodSess.length > 1 ? "NIFAS NORMAL" : "NIFAS NORMAL";
  if (nifasEndIdxRel === sixtyDaysLimit - 1) shortCat = "ISTIHADLOH NIFAS"; // Fallback, will be overridden by evaluateIstihadlohNifas

  return buildFinalNifasResult(
    statusTimeline, 
    "Nifas", 
    shortCat, 
    qadhoObligations, 
    days, 
    habit,
    startTime,
    stopTime,
    hasPerformed,
    isRamadhan
  );
}

/**
 * BAB: MUSTAHADLOH NIFAS (> 60 HARI)
 */
function evaluateIstihadlohNifas(
  days: DayStrength[], 
  habit: UserHabit, 
  experience: ExperienceStatus,
  startTime?: string,
  stopTime?: string,
  hasPerformed?: boolean,
  isRamadhan?: boolean
): FiqhAnalysisResult {
    const statusTimeline: any[] = [];
    const qadhoObligations: string[] = [];
    const specialNotes: string[] = [];
    
    // Syarat Mumayyizah Nifas: Kuat <= 60 hari
    const sessions = getSessions(days);
    const firstStrongSession = sessions.find(s => s.type === 'strong');
    const isMumayyizah = firstStrongSession && firstStrongSession.days.length <= 60;
    
    // Adat Nifas
    const nifasDurs = habit.durationsNifas && habit.durationsNifas.length > 0 ? habit.durationsNifas : [habit.durationNifas || 0];
    const hasNifasHabit = nifasDurs.some(d => d > 0);
    
    // Penentuan Adat Nifas Aktif
    let activeNifasDur = 1; // Default "setetes" (Mubtadi'ah)
    if (hasNifasHabit) {
        // Cek pola nifas (2 kali putaran tetap)
        const allSame = nifasDurs.every(d => d === nifasDurs[0]);
        if (allSame) {
            activeNifasDur = nifasDurs[0];
        } else {
            // Cek putaran (misal: 40, 60, 40, 60)
            let patternFound = false;
            for (let n = 1; n <= Math.floor(nifasDurs.length / 2); n++) {
                const pattern = nifasDurs.slice(0, n);
                let match = true;
                for (let i = 0; i < nifasDurs.length; i++) {
                    if (nifasDurs[i] !== pattern[i % n]) { match = false; break; }
                }
                if (match && (nifasDurs.length / n) >= 2) {
                    // Pakai pola putaran (karena nifas jarang, kita asumsikan perulangan nifas ke-N)
                    // Namun karena biasanya input user terbatas, kita sederhanakan: 
                    // Jika tidak teratur/belum 2 putaran, ambil yang terakhir.
                    patternFound = true;
                    activeNifasDur = nifasDurs[nifasDurs.length - 1]; // Sederhananya ambil yg sesuai urutan putaran
                    break;
                }
            }
            if (!patternFound) {
                activeNifasDur = nifasDurs[nifasDurs.length - 1]; // Ambil terakhir sebelum istihadloh
            }
        }
    }

    const isNasiyahNifas = hasNifasHabit && (habit.retrospection === 'lupa_semua');
    
    let category = "";
    let shortCategory = "";

    if (isMumayyizah) {
        // Mumayyizah finnifas (Mubtadi'ah or Mu'tadah)
        category = hasNifasHabit ? "Mu'tadah Mumayyizah finnifas" : "Mubtadi'ah Mumayyizah finnifas";
        shortCategory = hasNifasHabit ? "ISTIHADLOH NIFAS (MU'TADAH MUMAYYIZAH FINNIFAS)" : "ISTIHADLOH NIFAS (MUBTADI'AH MUMAYYIZAH FINNIFAS)";
        const firstStrongIdx = days.findIndex(d => d.isStrong);
        const lastStrongIdx = days.map(d => d.isStrong).lastIndexOf(true);
        
        const totalRange = (lastStrongIdx - firstStrongIdx + 1);
        const isWithin60Days = totalRange <= 60;

        days.forEach((d, idx) => {
            let isNifas = false;
            if (firstStrongIdx !== -1 && lastStrongIdx !== -1 && idx >= firstStrongIdx && idx <= lastStrongIdx) {
                if (isWithin60Days) {
                    isNifas = true;
                } else if (d.isStrong) {
                    isNifas = true;
                }
            }

            statusTimeline.push({
                day: d.dayNumber,
                date: d.date,
                status: isNifas ? 'Nifas' : 'Istihadloh',
                isBlood: d.isBlood,
                reason: isNifas 
                    ? (d.isStrong ? "Darah Kuat (Nifas)." : "Masa berhenti/lemah di sela-sela Nifas (Hukum Jam'u karena total <= 60 hari).") 
                    : (firstStrongIdx !== -1 && idx >= firstStrongIdx && idx <= lastStrongIdx ? "Istihadloh (Darah Lemah di sela-sela darah kuat Nifas yang totalnya > 60 hari)." : "Istihadloh (Darah Lemah).")
            });
            if (!isNifas && d.dayNumber <= 60) {
                if (d.isBlood) {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
                }
            }
        });
        specialNotes.push("Ketentuan: Darah kuat (<= 60 hari) dihukumi Nifas meskipun berbeda dengan adat, darah lemah dihukumi Istihadloh.");
    } else if (isNasiyahNifas) {
        // 05. Mu'tadah Ghoiru Mumayyizah finnifas Nasiyah (Mutahayyiroh Nifas)
        category = "Mu'tadah Ghoiru Mumayyizah finnifas Nasiyah";
        shortCategory = "ISTIHADLOH NIFAS (MU'TADAH GHOIRU MUMAYYIZAH FINNIFAS NASIYAH LI'ADATIHA QODRON WA WAQTAN / MUTAHAYYIROH)";
        
        days.forEach((d, idx) => {
            let status: string;
            let reason: string;
            
            if (idx === 0) {
                status = 'Nifas';
                reason = "Nifas Yakin (Setetes pertama).";
            } else {
                status = 'Ihtiyath';
                reason = "Masa Ihtiyath (Mungkin haid/nifas, mungkin suci).";
            }
            statusTimeline.push({ day: d.dayNumber, date: d.date, status, isBlood: d.isBlood, reason });
            if (status === 'Ihtiyath' && d.dayNumber <= 60) {
                if (d.isBlood) {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Ihtiyath - Darah Keluar). Karena status Lupa Adat, sholat tetap wajib dilaksanakan, namun jika ditinggalkan wajib diqodlo.`);
                } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Ihtiyath - Berhenti Darah). Meskipun berhenti darah, status hukum adalah Ihtiyath sehingga sholat wajib diqodlo jika tidak dilaksanakan.`);
                }
            }
        });
        
        specialNotes.push("Hukum Nasiyah Nifas (Mutahayyiroh): Anda lupa adat nifas. Hari pertama (setetes) yakin nifas.");
        specialNotes.push("Instruksi Mandi: Wajib mandi besar (mandi janabah) setiap akan melaksanakan sholat fardlu selama masa istihadloh ini.");
    } else if (hasNifasHabit && habit.retrospection === 'ingat_durasi') {
        // N6: Ingat Durasi, Lupa Waktu Mulai (Qodron la Waqtan)
        category = "Mu'tadah Ghoiru Mumayyizah finnifas Qodron la Waqtan";
        shortCategory = "ISTIHADLOH NIFAS (MU'TADAH GHOIRU MUMAYYIZAH FINNIFAS DZAKIROH LI'ADATIHA QODRON LA WAQTAN)";
        
        const dur = activeNifasDur; 
        const sixty = 60;
        // Intersection in 60-day range
        const startOfIntersection = sixty - dur; // Index (0-based)
        const endOfIntersection = dur - 1; // Index (0-based)
        const hasIntersection = startOfIntersection <= endOfIntersection;

        days.forEach((d, idx) => {
            let status: string;
            let reason: string;
            
            if (idx >= sixty) {
                status = 'Istihadloh';
                reason = "Yakin Suci (Di luar rentang maksimal nifas 60 hari).";
            } else if (hasIntersection && idx >= startOfIntersection && idx <= endOfIntersection) {
                status = 'Nifas';
                reason = "Yakin Nifas (Titik irisan semua kemungkinan jadwal nifas).";
            } else {
                status = 'Ihtiyath';
                reason = idx < startOfIntersection ? "Ihtiyath (Mungkin nifas, mungkin belum mulai)." : "Ihtiyath (Mungkin nifas, mungkin sudah putus).";
            }
            statusTimeline.push({ day: d.dayNumber, date: d.date, status, isBlood: d.isBlood, reason });
            if (status === 'Ihtiyath' && d.isBlood && d.dayNumber <= 60) qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo jika ditinggalkan (Status: Ihtiyath).`);
        });

        specialNotes.push(`Kondisi: Ingat durasi nifas ${dur} hari, tapi lupa waktu mulainya.`);
        specialNotes.push("Hukum Ihtiyath: Pada masa yang meragukan, wajib ibadah (sholat/puasa) namun haram berjimak. Wajib mandi besar pada masa yang mungkin nifasnya putus.");
    } else if (hasNifasHabit && habit.retrospection === 'ingat_waktu') {
        // N7: Ingat Waktu Mulai, Lupa Durasi (Waqtan la Qodron)
        category = "Mu'tadah Ghoiru Mumayyizah finnifas Waqtan la Qodron";
        shortCategory = "ISTIHADLOH NIFAS (MU'TADAH GHOIRU MUMAYYIZAH FINNIFAS DZAKIROH LI'ADATIHA WAQTAN LA QODRON)";
        
        days.forEach((d, idx) => {
            let status: string;
            let reason: string;
            
            if (idx === 0) {
                status = 'Nifas';
                reason = "Yakin Nifas (Waktu mulai yang diingat).";
            } else if (idx < 60) {
                status = 'Ihtiyath';
                reason = "Ihtiyath (Mungkin nifas, mungkin sudah putus).";
            } else {
                status = 'Istihadloh';
                reason = "Yakin Suci (Melewati 60 hari).";
            }
            statusTimeline.push({ day: d.dayNumber, date: d.date, status, isBlood: d.isBlood, reason });
            if (status === 'Ihtiyath' && d.isBlood && d.dayNumber <= 60) qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo jika ditinggalkan (Status: Ihtiyath).`);
        });

        specialNotes.push("Kondisi: Ingat waktu mulai (hari ke-1), tapi lupa durasinya.");
        specialNotes.push("Instruksi Mandi: Wajib mandi besar (mandi janabah) SETIAP AKAN sholat fardlu mulai hari ke-2 s.d ke-60.");
    } else {
        // Ghoiru Mumayyizah finnifas (Mubtadi'ah (N2) or Dzakiroh (N4))
        category = hasNifasHabit ? "Mu'tadah Ghoiru Mumayyizah finnifas Dzakiroh" : "Mubtadi'ah Ghoiru Mumayyizah finnifas";
        shortCategory = hasNifasHabit ? "ISTIHADLOH NIFAS (MU'TADAH GHOIRU MUMAYYIZAH FINNIFAS DZAKIROH LI'ADATIHA QODRON WA WAQTAN)" : "ISTIHADLOH NIFAS (MUBTADI'AH GHOIRU MUMAYYIZAH FINNIFAS)";
        
        const hasHaidHabit = (habit.duration && habit.duration > 0) || (habit.durations && habit.durations.length > 0);
        const durHaid = habit.duration || 5; 
        const durSuci = habit.habitSuci || (30 - durHaid); 
        
        const nifasReason = hasNifasHabit ? `Nifas (Sesuai Adat Nifas ${activeNifasDur} hari).` : "Nifas (Setetes pertama/Lahdzoh).";

        days.forEach((d, idx) => {
            let status: string;
            let reason: string;
            
            if (idx < activeNifasDur) {
                status = 'Nifas';
                reason = d.isBlood ? nifasReason : "Masa berhenti di sela-sela Nifas Adat (Hukum Jam'u).";
            } else {
                if (!hasHaidHabit || habit.retrospection === 'lupa_semua') {
                    // Case A: Belum pernah haid / Lupa adat haid
                    const cycleDay = (idx - activeNifasDur) % 30; 
                    if (cycleDay < 29) {
                        status = 'Istihadloh';
                        reason = "Istihadloh (Masa suci 29 hari).";
                    } else {
                        status = 'Haid';
                        reason = "Haid (Masa haid 1 hari).";
                    }
                } else {
                    // Case B: Sudah pernah haid & suci
                    const cycleDay = (idx - activeNifasDur) % (durSuci + durHaid);
                    if (cycleDay < durSuci) {
                        status = 'Istihadloh';
                        reason = `Istihadloh (Sesuai Adat Suci ${durSuci} hari).`;
                    } else {
                        status = 'Haid';
                        reason = `Haid (Sesuai Adat Haid ${durHaid} hari).`;
                    }
                }
            }
            statusTimeline.push({ day: d.dayNumber, date: d.date, status, isBlood: d.isBlood, reason });
            if (status === 'Istihadloh' && d.dayNumber <= 60) {
                if (d.isBlood) {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
                }
            }
        });

        if (hasNifasHabit) {
            specialNotes.push(`Kondisi: Mu'tadah (Pernah nifas ${activeNifasDur} hari).`);
        } else {
            specialNotes.push("Kondisi: Mubtadi'ah (Pertama kali nifas).");
        }
        
        if (!hasHaidHabit) {
            specialNotes.push("Hukum: Nifas disesuaikan adat (atau setetes), lalu 29 hari Istihadloh & 1 hari Haid berulang.");
        } else {
            specialNotes.push(`Hukum: Nifas disesuaikan adat (atau setetes), lalu Istihadloh setara Adat Suci (${durSuci} hari) & Haid setara Adat Haid (${durHaid} hari) berulang.`);
        }
    }
    
    const purifications = ["Mandi wajib di akhir masa Nifas dan setiap akhir masa haid."];
    if (statusTimeline.some(s => s.status === 'Ihtiyath')) {
        purifications.push("Wajib mandi janabah setiap kali akan melaksanakan sholat fardlu (Ihtiyath).");
    }

    return buildFinalNifasResult(
        statusTimeline, 
        category, 
        shortCategory, 
        qadhoObligations, 
        days, 
        habit,
        startTime,
        stopTime,
        hasPerformed,
        isRamadhan
    );
}

function buildFinalNifasResult(
  statusTimeline: any[],
  category: string,
  shortCategory: string,
  qadhoObligations: string[],
  days: any[],
  habit: any,
  startTime?: string,
  stopTime?: string,
  hasPerformed?: boolean,
  isRamadhan?: boolean
): FiqhAnalysisResult {
  const { qodloSholat, totalQodloPuasa } = calculateQodlo(
    statusTimeline,
    startTime,
    stopTime,
    hasPerformed,
    isRamadhan,
    qadhoObligations
  );

  const nifasNotes = [];
  if (statusTimeline.some(s => s.status === 'Nifas')) {
    nifasNotes.push("Minimal nifas adalah sekejap (lahdzoh). Maksimal adalah 60 hari dari saat kelahiran.");
    nifasNotes.push("Setiap kali darah berhenti di masa nifas, wajib mandi (janabah) dan melaksanakan ibadah.");
  }

  if (isRamadhan && totalQodloPuasa > 0) {
    nifasNotes.push(`Status Puasa: Anda memiliki hutang qodlo puasa sebanyak ${totalQodloPuasa} hari Ramadhan.`);
    nifasNotes.push("Hari jeda bersih di sela nifas tetap wajib diqodlo jika bertepatan dengan puasa Ramadhan.");
  }

  const analysis = `Analisis status darah pasca-melahirkan menunjukkan kategori ${shortCategory}. ${statusTimeline.some(s => s.status === 'Nifas') ? "Anda sedang dalam masa nifas." : "Anda sedang dalam masa suci/haidl pasca-melahirkan."}`;

  return {
    analysis,
    category,
    shortCategory,
    statusTimeline,
    purificationInstructions: ["Mandi besar setiap kali darah nifas berhenti.", "Lakukan pengecekan suci (jufuf) secara berkala."],
    qadhoObligations: qodloSholat,
    legalBasis: "Fathul Qorib & Risalatul Mahidl (Bab III: Nifas).",
    specialNotes: nifasNotes,
    totalQodloPuasa,
    groupedTimeline: groupTimeline(statusTimeline),
    groupedQadho: groupQodlo(qodloSholat)
  };
}

/**
 * UTILITY: HITUNG JUMLAH SIFAT DARAH UNIK (VALIDASI TAMYIZ)
 */
export function countUniqueBloodAttributes(records: DayRecord[]): number {
  return new Set(
    records
      .filter(r => r.status === 'darah')
      .map(r => `${r.color}-${r.texture}-${r.aroma}`)
  ).size;
}

/**
 * UTILITY: SESSION ANALYZER
 */
export function getSessions(days: DayStrength[]) {
    const sessions: { type: 'strong' | 'weak', days: DayStrength[] }[] = [];
    if (days.length === 0) return sessions;
    
    let currentType: 'strong' | 'weak' = days[0].isStrong ? 'strong' : 'weak';
    let currentDays: DayStrength[] = [days[0]];
    
    for (let i = 1; i < days.length; i++) {
        const type = days[i].isStrong ? 'strong' : 'weak';
        if (type === currentType) {
            currentDays.push(days[i]);
        } else {
            sessions.push({ type: currentType, days: currentDays });
            currentType = type;
            currentDays = [days[i]];
        }
    }
    sessions.push({ type: currentType, days: currentDays });
    return sessions;
}

/**
 * 7. EVALUASI MUBTADI'AH MUMAYYIZAH (TAMYIZ LEVEL 2)
 * Sesuai Kitab: Darah kuat haid, darah lemah istihadloh.
 * Syarat Mumayyizah:
 * 1. Kuat >= 24 jam.
 * 2. Kuat <= 15 hari.
 * 3. Lemah >= 15 hari (juga berfungsi sebagai pemisah jika ada kuat kedua).
 */
export function checkTamyiz(darahKuat: DayStrength[], darahLemah: DayStrength[], sessions: { type: 'strong' | 'weak', days: DayStrength[] }[], records?: DayRecord[]) {
    // SYARAT MUTLAK TAMYIZ: Minimal 2 Sifat Darah Berbeda
    if (records) {
        const uniqueBloodCount = countUniqueBloodAttributes(records);
        if (uniqueBloodCount <= 1) return false;
    }

    // SYARAT TAMYIZ: 
    // 1. Darah kuat tidak kurang dari 24 jam.
    // 2. Darah kuat tidak melebihi 15 hari. (Jika ada beberapa sesi kuat dipisah lemah < 15 hari, maka dihitung satu rentang).
    // 3. Darah lemah tidak kurang dari 15 hari (sebagai pemisah jika ada kuat berikutnya).
    
    const firstStrongSession = sessions.find(s => s.type === 'strong');
    if (!firstStrongSession) return false;

    // Cari rentang "pool" kuat pertama
    let firstPoolEndIdx = sessions.indexOf(firstStrongSession);
    let totalPoolDays = firstStrongSession.days.length;
    
    for (let i = firstPoolEndIdx + 1; i < sessions.length; i++) {
        if (sessions[i].type === 'strong') {
            // Cek gap lemah sebelumnya
            let weakGap = 0;
            for (let j = firstPoolEndIdx + 1; j < i; j++) {
                if (sessions[j].type === 'weak') weakGap += sessions[j].days.length;
            }
            
            if (weakGap < 15) {
                totalPoolDays += weakGap + sessions[i].days.length;
                firstPoolEndIdx = i;
            } else {
                break; // Gap >= 15, pool berakhir
            }
        }
    }

    const poolHours = totalPoolDays * 24;
    
    // Syarat 1 & 2: Pool kuat pertama harus 24 jam - 15 hari
    const s1 = poolHours >= 24;
    const s2 = poolHours <= 360; // 15 hari
    
    if (!s1 || !s2) return false;

    // Syarat 3: Jika ada darah kuat diluar pool pertama, lemah pemisah harus >= 15 hari
    // (Sudah terhandle oleh logika break di atas, tapi kita pastikan minimal ada 15 hari lemah total setelah pool kuat)
    let totalWeakAfter = 0;
    for (let i = firstPoolEndIdx + 1; i < sessions.length; i++) {
        if (sessions[i].type === 'weak') totalWeakAfter += sessions[i].days.length;
    }
    
    // Lemah yang tersisa (yang mengikuti darah kuat) harus >= 15 hari agar darah kuat tersebut sah sbg haid
    // Tapi jika darah lemah tersebut terus menerus (istihadloh), syaratnya adalah dia tidak kurang dari 15 hari 
    // kecuali jika bersambung ke akhir (maka dianggap suci pemisah).
    // Secara umum, Tamyiz sah jika pool kuat <= 15 hari dan diikuti lemah.
    
    return true;
}

function evaluateMubtadiahMumayyizah(days: DayStrength[], isFirstMonth: boolean): FiqhAnalysisResult {
    const sessions = getSessions(days);
    const strongDays = days.filter(d => d.isStrong);
    const weakDays = days.filter(d => !d.isStrong);
    
    const isTamyizValid = checkTamyiz(strongDays, weakDays, sessions);
    
    const statusTimeline: any[] = [];
    const qadhoObligations: string[] = [];
    let category = "Mubtadi'ah Mumayyizah";

    if (!isTamyizValid) {
        return evaluateMubtadiahGhoiruMumayyizah(days, isFirstMonth);
    }
    
    // Tamyiz Berhasil: Tentukan Haid per sesi
    const firstStrongIdx = days.findIndex(d => d.isStrong);
    const lastStrongIdx = days.map(d => d.isStrong).lastIndexOf(true);
    
    const haidIndices = new Set<number>();
    
    // Sesi Haid: 
    // 1. Jika total rentang (kuat pertama s/d terakhir) <= 15 hari, maka semuanya Haid (Hukum Jam'u).
    // 2. Jika total rentang > 15 hari, maka hanya darah KUAT yang dihukumi Haid. Darah lemah di sela-selanya adalah Istihadloh.
    const totalRange = (lastStrongIdx - firstStrongIdx + 1);
    const isWithin15Days = totalRange <= 15;

    if (firstStrongIdx !== -1 && lastStrongIdx !== -1) {
        for (let i = firstStrongIdx; i <= lastStrongIdx; i++) {
            if (isWithin15Days) {
                haidIndices.add(i);
            } else {
                if (days[i].isStrong) {
                    haidIndices.add(i);
                }
            }
        }
    }

    days.forEach((d, idx) => {
        const isHaid = haidIndices.has(idx);
        const isWaiting = isFirstMonth && d.dayNumber <= 15;
        
        statusTimeline.push({
            day: d.dayNumber,
            date: d.date,
            status: isHaid ? 'Haid' : 'Istihadloh',
            isBlood: d.isBlood,
            isFirstMonthWaiting: isWaiting && !isHaid,
            reason: isHaid 
                ? (d.isStrong ? "Darah Kuat (Haid)." : "Masa berhenti/lemah di sela-sela darah kuat (Haid - Hukum Jam'u karena total <= 15 hari).") 
                : (idx >= firstStrongIdx && idx <= lastStrongIdx ? "Istihadloh (Darah Lemah di sela-sela darah kuat yang totalnya > 15 hari)." : "Istihadloh.")
        });
        
        if (!isHaid && d.dayNumber <= 15) {
            if (isWaiting) {
                const startQodho = lastStrongIdx + 2;
                const totalQodho = 15 - (lastStrongIdx + 1);
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Total ${totalQodho} Hari WAJIB DIQODLO (dari hari ke-${startQodho} s/d ke-15). Anda wajib mengganti sholat pada hari-hari darah lemah di dalam rentang 15 hari pertama masa penantian tersebut.`);
            } else if (d.isBlood) {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
            } else {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
            }
        }
    });

    const specialNotes: string[] = [];
    if (isFirstMonth) {
        specialNotes.push("Aturan Mandi (Bulan Pertama): Anda wajib menanti selama 15 hari (batas maksimal haid) untuk mandi besar, karena ini adalah pengalaman pertama Anda dan status darah belum bisa dipastikan hingga melewati 15 hari.");
    } else {
        specialNotes.push("Aturan Mandi (Bulan Kedua+): Anda wajib segera mandi besar tepat saat melihat perpindahan dari darah kuat ke darah lemah (tanpa harus menunggu 15 hari).");
    }

    const bIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
    const isIntermittent = bIndices.length > 1 && (bIndices[bIndices.length - 1] - bIndices[0] + 1) > bIndices.length;
    if (isIntermittent) {
        specialNotes.push("Karena darah terputus-putus, setiap kali darah berhenti, Anda wajib mandi dan sholat. Jika darah keluar lagi dalam masa haid, sholat tersebut batal.");
    }

    return {
        analysis: buildFiqhAnalysisSummary(category, statusTimeline, days),
        category,
        shortCategory: "ISTIHADLOH (MUBTADI'AH MUMAYYIZAH)",
        statusTimeline,
        purificationInstructions: ["Mandi wajib di saat perpindahan sifat darah (jika sudah bulan kedua)."],
        qadhoObligations,
        specialNotes,
        legalBasis: "Fathul Qorib & Risalatul Mahidl (Mubtadi'ah Mumayyizah)."
    };
}

/**
 * 8. GOLONGAN 2: MUBTADI'AH GHOIRU MUMAYYIZAH
 */
export function evaluateMubtadiahGhoiruMumayyizah(days: DayStrength[], isFirstMonth: boolean): FiqhAnalysisResult {
    const statusTimeline: any[] = [];
    const qadhoObligations: string[] = [];
    let category = "Golongan 2: Mubtadi'ah Ghoiru Mumayyizah Haidl";
    let analysis = "Status: Ghoiru Mumayyizah. Karena darah tidak bisa dibedakan kekuatannya, maka haid ditetapkan 1 hari (24 jam) dan sisa 29 hari berikutnya Istihadloh (Siklus 30 hari).";

    days.forEach((d, idx) => {
        // Siklus 30 hari: Hari ke-1 Haid, ke-2 s/d 30 Istihadloh
        const cycleDay = (idx % 30) + 1;
        const isHaid = cycleDay === 1;
        const isWaiting = isFirstMonth && d.dayNumber <= 15;

        statusTimeline.push({
            day: d.dayNumber,
            date: d.date,
            status: isHaid ? 'Haid' : 'Istihadloh',
            isBlood: d.isBlood,
            isFirstMonthWaiting: isWaiting && !isHaid,
            reason: isHaid ? "Haid standar mubtadi'ah ghoiru mumayyizah (24 jam pertama)." : "Istihadloh (Masa suci 29 hari dalam siklus 30 hari)."
        });

        // Logika Qodlo
        if (!isHaid && d.dayNumber <= 15) {
            if (isWaiting) {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Total 14 Hari WAJIB DIQODLO. Karena Anda belum memiliki kebiasaan (adat), Anda diwajibkan menanti masa maksimal haid (15 hari) sebelum mandi. Kini setelah terbukti Istihadloh, Anda wajib mengganti sholat dari hari ke-2 hingga ke-15.`);
            } else if (d.isBlood) {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
            } else {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
            }
        }
    });

    const specialNotes: string[] = [];
    if (isFirstMonth) {
        specialNotes.push("Aturan Mandi (Bulan Pertama): Anda wajib menanti (meninggalkan sholat) selama 15 hari. Begitu genap 15 hari, Anda wajib mandi besar dan mengqodlo sholat dari hari ke-2 sampai hari ke-15.");
    } else {
        specialNotes.push("Aturan Mandi (Bulan Kedua+): Anda cukup mandi besar segera setelah darah keluar genap 24 jam (hari ke-1). Setelah itu Anda wajib sholat meskipun darah masih keluar (Istihadloh).");
        specialNotes.push("Untuk bulan ini dan seterusnya, Anda tidak memiliki hutang qodlo sholat 14 hari.");
    }

    const bIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
    const isIntermittent = bIndices.length > 1 && (bIndices[bIndices.length - 1] - bIndices[0] + 1) > bIndices.length;
    if (isIntermittent) {
        specialNotes.push("Setiap kali darah Anda berhenti (meskipun belum 15 hari), Anda WAJIB segera mandi besar (janabah) dan melaksanakan kewajiban sholat serta puasa, karena secara zahir darah yang berhenti dihukumi suci.");
    }

    let shortCategory = "ISTIHADLOH (MUBTADI'AH GHOIRU MUMAYYIZAH)";
    analysis = buildFiqhAnalysisSummary(category, statusTimeline, days);

    return {
        analysis,
        category,
        shortCategory,
        statusTimeline,
        purificationInstructions: ["Mandi wajib tepat setelah 24 jam berlalu dari awal keluarnya darah."],
        qadhoObligations,
        specialNotes,
        legalBasis: "Fathul Qorib & Uyunul Masa-il."
    };
}

/**
 * 9. GOLONGAN 3: MU'TADAH MUMAYYIZAH
 */
export function evaluateMutadahMumayyizah(days: DayStrength[], habit: UserHabit, isFirstMonth: boolean): FiqhAnalysisResult {
    const sessions = getSessions(days);
    const statusTimeline: any[] = [];
    const qadhoObligations: string[] = [];
    const specialNotes: string[] = [];
    let category = "Golongan 3: Mu'tadah Mumayyizah Haidl";
    let analysis = "";

    if (isFirstMonth) {
        specialNotes.push("Meskipun ini bulan pertama Anda mengalami pendarahan panjang, Anda sudah memiliki kebiasaan (adat). Anda cukup menanti selama durasi adat haid Anda. Begitu melewati durasi adat tersebut, Anda WAJIB segera mandi besar dan mulai sholat.");
    }

    // Cek apakah lemah di awal
    if (sessions.length > 0 && sessions[0].type === 'weak') {
        const weakSession = sessions[0];
        const durAdat = habit.duration || 7; 

        if (weakSession.days.length >= 15) {
            // Kasus: Lemah di awal >= 15 hari. Haid diambil dari Adat di awal, lalu Suci, lalu Kuat berikutnya jadi Haid baru.
            analysis = `Status: Mu'tadah Mumayyizah. Karena darah lemah di awal melebihi 15 hari, maka haid pertama diambil dari Adat (${durAdat} hari). Sisa darah lemahnya adalah Istihadloh (Masa Suci). Darah kuat berikutnya dihukumi Haid kedua karena muncul setelah masa minimal suci.`;
            
            let isCycle2 = false;
            days.forEach((d, idx) => {
                const sessionIdx = sessions.findIndex(s => s.days.includes(d));
                const session = sessions[sessionIdx];
                const isWaiting = isFirstMonth && d.dayNumber <= 15;
                
                let status: string;
                let reason: string;

                if (idx < durAdat) {
                    status = 'Haid';
                    reason = `Haid Siklus 1 (Sesuai Adat ${durAdat} hari karena darah lemah di awal panjang).`;
                } else if (sessionIdx === 0) {
                    status = 'Istihadloh';
                    reason = "Istihadloh (Masa suci/fathroh setelah haid adat).";
                } else if (session.type === 'strong') {
                    status = 'Haid';
                    reason = "Haid Siklus 2 (Darah kuat muncul setelah masa suci 15 hari).";
                    isCycle2 = true;
                } else {
                    status = 'Istihadloh';
                    reason = isCycle2 ? "Istihadloh (Pasca haid kuat)." : "Istihadloh (Masa suci).";
                }

                statusTimeline.push({ 
                  day: d.dayNumber, 
                  date: d.date, 
                  status, 
                  isBlood: d.isBlood,
                  reason,
                  isFirstMonthWaiting: isWaiting && status !== 'Haid'
                });
                
                if (status === 'Istihadloh' && d.dayNumber <= 15) {
                  if (d.isBlood) {
                    if (isWaiting) {
                      qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Karena ini pengalaman pertama, Anda wajib menanti 15 hari. Ternyata Anda terbukti Istihadloh, maka wajib qodlo sholat yang ditinggalkan setelah masa adat.`);
                    } else {
                      qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                    }
                  } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
                  }
                }
            });
        } else {
            // Tamyiz menang: Kuat dihukumi Haid (dari kuat pertama sampai kuat terakhir)
            category = "Mu'tadah Mumayyizah";
            const firstStrongIdx = days.findIndex(d => d.isStrong);
            const lastStrongIdx = days.map(d => d.isStrong).lastIndexOf(true);
            const totalRange = (lastStrongIdx - firstStrongIdx + 1);
            const isWithin15Days = totalRange <= 15;
            
            days.forEach((d, idx) => {
                let isHaid = false;
                if (firstStrongIdx !== -1 && lastStrongIdx !== -1 && idx >= firstStrongIdx && idx <= lastStrongIdx) {
                    if (isWithin15Days) {
                        isHaid = true;
                    } else if (d.isStrong) {
                        isHaid = true;
                    }
                }

                const isWaiting = isFirstMonth && d.dayNumber <= 15;
                statusTimeline.push({
                    day: d.dayNumber,
                    date: d.date,
                    status: isHaid ? 'Haid' : 'Istihadloh',
                    isBlood: d.isBlood,
                    isFirstMonthWaiting: isWaiting && !isHaid,
                    reason: isHaid 
                        ? (d.isStrong ? "Darah Kuat (Haid). Tamyiz mengalahkan Adat." : "Masa berhenti/lemah di sela-sela darah kuat (Haid - Hukum Jam'u karena total <= 15 hari).") 
                        : (firstStrongIdx !== -1 && idx >= firstStrongIdx && idx <= lastStrongIdx ? "Istihadloh (Darah Lemah di sela-sela darah kuat yang totalnya > 15 hari). Tamyiz Level 2." : "Istihadloh.")
                });
                if (!isHaid && d.dayNumber <= 15) {
                  if (d.isBlood) {
                    if (isWaiting) {
                      qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Anda menanti 15 hari karena pengalaman pertama istihadloh, ternyata dihukumi Istihadloh karena Tamyiz.`);
                    } else {
                      qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                    }
                  } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
                  }
                }
            });
        }
    } else {
        // Kuat di awal: Tamyiz menang mutlak (sampai kuat terakhir)
        const firstStrongIdx = days.findIndex(d => d.isStrong);
        const lastStrongIdx = days.map(d => d.isStrong).lastIndexOf(true);
        const totalRange = (lastStrongIdx - firstStrongIdx + 1);
        const isWithin15Days = totalRange <= 15;

        days.forEach((d, idx) => {
            let isHaid = false;
            if (firstStrongIdx !== -1 && lastStrongIdx !== -1 && idx >= firstStrongIdx && idx <= lastStrongIdx) {
                if (isWithin15Days) {
                    isHaid = true;
                } else if (d.isStrong) {
                    isHaid = true;
                }
            }

            const isWaiting = isFirstMonth && d.dayNumber <= 15;
            statusTimeline.push({
                day: d.dayNumber,
                date: d.date,
                status: isHaid ? 'Haid' : 'Istihadloh',
                isBlood: d.isBlood,
                isFirstMonthWaiting: isWaiting && !isHaid,
                reason: isHaid 
                    ? (d.isStrong ? "Darah Kuat (Haid). Tamyiz mengalahkan Adat." : "Masa berhenti/lemah di sela-sela darah kuat (Haid - Hukum Jam'u karena total <= 15 hari).") 
                    : (firstStrongIdx !== -1 && idx >= firstStrongIdx && idx <= lastStrongIdx ? "Istihadloh (Darah Lemah di sela-sela darah kuat yang totalnya > 15 hari). Tamyiz Level 2." : "Istihadloh.")
            });
            if (!isHaid && d.dayNumber <= 15) {
              if (d.isBlood) {
                if (isWaiting) {
                  qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Karena pengalaman pertama pendarahan panjang, Anda menanti 15 hari, ternyata hukumnya Istihadloh menurut Tamyiz.`);
                } else {
                  qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                }
              } else {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
              }
            }
        });
    }

    const bIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
    const isIntermittent = bIndices.length > 1 && (bIndices[bIndices.length - 1] - bIndices[0] + 1) > bIndices.length;
    if (isIntermittent) {
        specialNotes.push("Setiap kali darah Anda berhenti (meskipun belum 15 hari), Anda WAJIB segera mandi besar (janabah) dan melaksanakan kewajiban sholat serta puasa, karena secara zahir darah yang berhenti dihukumi suci.");
    }

    let shortCategory = "ISTIHADLOH (MU'TADAH MUMAYYIZAH)";
    analysis = buildFiqhAnalysisSummary(category, statusTimeline, days);

    return {
        analysis,
        category,
        shortCategory,
        statusTimeline,
        purificationInstructions: ["Mandi wajib tepat di saat karakter darah berubah dari kuat ke lemah."],
        qadhoObligations,
        legalBasis: "Kitab Uyunul Masa-il Linnisa."
    };
}

/**
 * 10. GOLONGAN 4: MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH (INGAT ADAT)
 */
export function evaluateMutadahGhoiruMumayyizahDzakiroh(days: DayStrength[], habit: UserHabit, calculationMonthIndex: number = 0, isFirstMonth: boolean = false): FiqhAnalysisResult {
    const statusTimeline: any[] = [];
    const qadhoObligations: string[] = [];
    const specialNotes: string[] = [];
    let analysis = "";
    let category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah Haidl (Dzakiroh)";

    if (isFirstMonth) {
        specialNotes.push("Meskipun ini bulan pertama Anda mengalami pendarahan panjang, Anda sudah memiliki kebiasaan (adat). Anda cukup menanti selama durasi adat haid Anda. Begitu melewati durasi adat tersebut, Anda WAJIB segera mandi besar dan mulai sholat.");
    }

    // Kita gunakan calculationMonthIndex untuk penentuan pola (misal pola: 3, 5, 7)
    const istihadlohMonthIndex = calculationMonthIndex;
    const durs = habit.durations && habit.durations.length > 0 ? habit.durations : [habit.duration || 7];
    
    // Deteksi Pola Adat
    const allSame = durs.every(d => d === durs[0]);
    let patternN = -1;
    if (!allSame) {
        for (let n = 1; n <= Math.floor(durs.length / 2); n++) {
            const pattern = durs.slice(0, n);
            let match = true;
            for (let i = 0; i < durs.length; i++) {
                if (durs[i] !== pattern[i % n]) { match = false; break; }
            }
            if (match && (durs.length / n) >= 2) { patternN = n; break; }
        }
    }
    
    const activeDur = determineActiveAdat(durs, istihadlohMonthIndex);

    if (habit.retrospection === 'ingat_angka_lupa_urutan' && habit.durations && habit.durations.length > 0) {
        // KASUS: LUPA URUTAN / LUPA TERAKHIR (IHTIYATH BERLAPIS)
        const sortedDurs = Array.from(new Set(habit.durations)).sort((a, b) => a - b);
        const minDur = sortedDurs[0];
        const maxDur = sortedDurs[sortedDurs.length - 1];
        
        category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Dzakiroh - Lupa Urutan)";
        analysis = "Status: Mu'tadah Ghoiru Mumayyizah (Lupa Urutan/Lupa Adat Terakhir). Menerapkan hukum Ihtiyath (kehati-hatian) karena tidak ada pola teratur dan Anda lupa mana yang terakhir.";
        
        specialNotes.push(`Karena Anda ingat jumlah hari haid (${sortedDurs.join(', ')}) tapi lupa urutan atau mana yang terakhir, Anda wajib mandi besar sebanyak ${sortedDurs.length} kali di setiap akhir hari ke-${sortedDurs.join(', ')}.`);
        specialNotes.push("Hukum Ihtiyath: Di antara mandi pertama (hari ke-minimal) sampai mandi terakhir (hari ke-maksimal), Anda wajib sholat & puasa seperti orang suci, namun dilarang bersetubuh dan membaca Al-Qur'an (seperti orang haid).");

        days.forEach(d => {
            const isWaiting = isFirstMonth && d.dayNumber <= 15;
            let status: 'Haid' | 'Ihtiyath' | 'Istihadloh';
            let reason: string;

            if (d.dayNumber <= minDur) {
                status = 'Haid';
                reason = "Haid Yakin (Batas minimal adat).";
            } else if (d.dayNumber <= maxDur) {
                status = 'Ihtiyath';
                reason = "Masa Ihtiyath (Antara durasi minimal dan maksimal adat). Wajib sholat & puasa, tapi dilarang pasutri & baca Quran.";
            } else {
                status = 'Istihadloh';
                reason = "Istihadloh (Melampaui batas maksimal adat).";
            }

            statusTimeline.push({ 
                day: d.dayNumber, 
                date: d.date, 
                status, 
                isBlood: d.isBlood,
                reason,
                isFirstMonthWaiting: isWaiting && status !== 'Haid'
            });
            if (status === 'Istihadloh' && d.dayNumber <= 15) {
                if (d.isBlood) {
                    if (isWaiting) {
                        qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Anda menanti kepastian haid (first month), ternyata dihukumi Istihadloh karena melebihi durasi maksimal adat.`);
                    } else {
                        qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                    }
                } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
                }
            }
        });
    } else {
        // KASUS: INGAT SEMUA / INGAT DURASI (ADAT TETAP/PUTARAN/TIDAK TERATUR)
        if (allSame) {
            category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Adat Tetap)";
            analysis = `Status: Mu'tadah Ghoiru Mumayyizah (Adat Tetap). Haid dikembalikan ke adat tunggal Anda yaitu ${activeDur} hari.`;
        } else if (patternN !== -1) {
            category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Adat Berubah Teratur)";
            analysis = `Status: Mu'tadah Ghoiru Mumayyizah (Adat Berubah Teratur/Pola). Mengikuti pola putaran haid Anda (${durs.slice(0, patternN).join(', ')}). Untuk bulan ke-${istihadlohMonthIndex + 1} istihadloh ini, haid Anda adalah ${activeDur} hari.`;
        } else if (durs.length >= 2) {
            // Cek apakah 2 putaran tapi tak beraturan
            category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Adat Tak Berurutan)";
            analysis = `Status: Mu'tadah Ghoiru Mumayyizah (Adat Berubah Tidak Berurutan). Karena pola tidak teratur atau belum genap 2 putaran, haid dikembalikan ke bulan terakhir sebelum istihadloh, yaitu ${activeDur} hari.`;
        } else {
            category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Adat Tetap)";
            analysis = `Status: Mu'tadah Ghoiru Mumayyizah (Adat Tetap). Haid dikembalikan ke adat ${activeDur} hari.`;
        }
        
        days.forEach(d => {
            const isHaid = d.dayNumber <= activeDur;
            const isWaiting = isFirstMonth && d.dayNumber <= 15;
            
            statusTimeline.push({
                day: d.dayNumber,
                date: d.date,
                status: isHaid ? 'Haid' : 'Istihadloh',
                isBlood: d.isBlood,
                isFirstMonthWaiting: isWaiting && !isHaid,
                reason: isHaid ? (d.isBlood ? `Haid sesuai Adat (${activeDur} hari).` : `Masa berhenti di sela-sela Haid Adat (Hukum Jam'u).`) : "Istihadloh (Melebihi Adat)."
            });
            if (!isHaid && d.dayNumber <= 15) {
                if (d.isBlood) {
                    if (isWaiting) {
                        qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Anda menanti kepastian haid hingga batas maksimal, ternyata setelah adat tetap dihitung Istihadloh.`);
                    } else {
                        qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                    }
                } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
                }
            }
        });
    }

    const bIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
    const isIntermittent = bIndices.length > 1 && (bIndices[bIndices.length - 1] - bIndices[0] + 1) > bIndices.length;
    if (isIntermittent) {
        specialNotes.push("Setiap kali darah Anda berhenti (meskipun belum 15 hari), Anda WAJIB segera mandi besar (janabah) dan melaksanakan kewajiban sholat serta puasa, karena secara zahir darah yang berhenti dihukumi suci.");
    }

    let shortCategory = habit.retrospection === 'ingat_angka_lupa_urutan' ? "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA QODRON WA WAQTAN)" : "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA QODRON WA WAQTAN)";
    const baseSummary = buildFiqhAnalysisSummary(category, statusTimeline, days);
    analysis = `${analysis} ${baseSummary}`;

    return {
        analysis,
        category,
        shortCategory,
        statusTimeline,
        purificationInstructions: ["Mandi wajib di setiap akhir kemungkinan durasi adat (jika lupa urutan) atau setelah masa adat tetap berlalu."],
        qadhoObligations,
        specialNotes,
        legalBasis: "Kitab Uyunul Masa-il Linnisa & Fathul Qorib."
    };
}

/**
 * 11. GOLONGAN 5: MU'TAHAYYIROH (LUPA TOTAL / MUTAHAYYIROH / MUHAYYAROH)
 */
export function evaluateMutahayyiroh(days: DayStrength[], habit: UserHabit, isRamadhan: boolean, isFirstMonth: boolean = false): FiqhAnalysisResult {
    const statusTimeline: any[] = [];
    const specialNotes: string[] = [];
    const qadhoObligations: string[] = [];
    let analysis = "Status: Mu'tadah Ghoiru Mumayyizah Nasiyah (Mutahayyiroh / Muhayyaroh / Muhayyiroh). Anda lupa durasi haid dan waktu mulainya. Hukum yang diterapkan adalah Ihtiyath (Kehati-hatian).";
    let category = "Golongan 5: Mutahayyiroh (Lupa Adat Total)";

    if (isFirstMonth) {
        specialNotes.push("Catatan: Anda masuk kategori Mutahayyiroh karena sudah pernah haid/suci namun lupa pola adatnya saat mengalami istihadloh.");
    }

    days.forEach(d => {
        const isWaiting = isFirstMonth && d.dayNumber <= 15;
        const status = 'Ihtiyath';
        const reason = "Status Mutahayyiroh Mutlaqoh (Lupa Adat Kadar & Waktu). Wajib Ihtiyath.";
        statusTimeline.push({ 
            day: d.dayNumber, 
            date: d.date, 
            status, 
            isBlood: d.isBlood,
            reason,
            isFirstMonthWaiting: isWaiting
        });
        
        if (d.isBlood && d.dayNumber <= 15) {
            if (isWaiting) {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Anda menanti 15 hari kepastian haid karena lupa adat total. Status Anda adalah Ihtiyath, maka sholat yang ditinggalkan wajib diqodlo.`);
            } else {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Ihtiyath - Darah Keluar). Karena status Lupa Adat, sholat tetap wajib dilaksanakan, namun jika ditinggalkan wajib diqodlo.`);
            }
        } else if (d.dayNumber <= 15) {
            qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Ihtiyath - Berhenti Darah). Meskipun berhenti darah, status hukum adalah Ihtiyath sehingga sholat wajib diqodlo jika tidak dilaksanakan.`);
        }
    });

    specialNotes.push("HUKUM SEBAGAI ORANG HAIDL (KEHARAMAN):");
    specialNotes.push("1. Menikmati anggota tubuh di antara pusar dan lutut bagi suami.");
    specialNotes.push("2. Membaca Al-Qur'an di luar sholat.");
    specialNotes.push("3. Menyentuh dan membawa Al-Qur'an.");
    specialNotes.push("4. Berdiam dan lewat di dalam masjid (jika khawatir menetes).");

    specialNotes.push("HUKUM SEBAGAI ORANG SUCI (KEWAJIBAN):");
    specialNotes.push("Tetap wajib: Sholat, Puasa, Thowaf, I'tikaf, Tholaq, dan Mandi.");

    if (habit.ingatWaktuBerhenti) {
        specialNotes.push("INSTRUKSI MANDI: Karena Anda ingat waktu berhentinya saja, maka Anda WAJIB mandi ketika waktu itu saja (setiap hari di jam yang sama), selanjutnya cukup berwudlu.");
    } else {
        specialNotes.push("INSTRUKSI MANDI: Karena Anda sama sekali tidak ingat waktu berhentinya haid, Anda WAJIB mandi setiap akan melakukan ibadah fardlu (setiap masuk waktu sholat fardlu).");
    }

    if (isRamadhan) {
        specialNotes.push("CARA PUASA RAMADHAN MUTAHAYYIROH:");
        specialNotes.push("1. Puasa satu bulan penuh di bulan Ramadhan.");
        specialNotes.push("2. Puasa 30 hari berturut-turut setelah Ramadhan.");
        specialNotes.push("3. Setelah itu, Anda pasti memiliki hutang 2 hari (karena ketidakpastian masa haid maksimal 15 hari).");
        specialNotes.push("CARA QODLO 2 HARI: Puasa 3 hari berturut-turut, tidak puasa 12 hari berturut-turut, lalu puasa lagi 3 hari berturut-turut.");
    }

    let shortCategory = "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH NASIYAH LI'ADATIHA QODRON WA WAQTAN / MUTAHAYYIROH)";
    const baseSummary = buildFiqhAnalysisSummary(category, statusTimeline, days);
    analysis = `${analysis} ${baseSummary}`;

    return {
        analysis,
        category,
        shortCategory,
        statusTimeline,
        purificationInstructions: [habit.ingatWaktuBerhenti ? "Mandi besar setiap hari di jam berhenti haid." : "Mandi besar setiap kali akan sholat fardlu."],
        qadhoObligations,
        specialNotes,
        legalBasis: "Kitab Al-Majmu' & Fathul Qorib."
    };
}

/**
 * 12. GOLONGAN 7: MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA WAKTAN LA QODRON
 * Ingat waktu mulai, lupa durasi (Category 7)
 */
export function evaluateMutadahIngatWaktuLupaDurasi(days: DayStrength[], isFirstMonth: boolean = false): FiqhAnalysisResult {
  const statusTimeline: any[] = [];
  const specialNotes: string[] = [];
  const qadhoObligations: string[] = [];
  let category = "Golongan 7: Mu'tadah Ghoiru Mumayyizah Dzakiroh Waktan la Qodron";
  let analysis = "Status: Mu'tadah Ghoiru Mumayyizah (Ingat Waktu Mulai, Lupa Durasi). Berdasarkan kaidah fiqh: Masa yakin haid dihukumi haid, masa yakin suci dihukumi suci, dan masa meragukan dihukumi Ihtiyath (Mutahayyiroh).";

  if (isFirstMonth) {
    specialNotes.push("Catatan: Anda masuk kategori ini karena mengalami istihadloh namun lupa durasi haid biasanya, sedangkan waktu mulainya Anda ingat.");
  }

  days.forEach((d, idx) => {
    let status: 'Haid' | 'Ihtiyath' | 'Suci' | 'Istihadloh';
    let reason: string;

    if (idx === 0) {
      status = 'Haid';
      reason = "Yakin Haid (Waktu mulai yang diingat & minimal haid).";
    } else if (idx < 15) {
      status = 'Ihtiyath';
      reason = "Masa Ihtiyath (Mungkin haid, mungkin suci, mungkin putus).";
    } else {
      status = 'Suci';
      reason = "Yakin Suci (Pasti sudah melampaui batas maksimal haid 15 hari).";
    }

    statusTimeline.push({ 
      day: d.dayNumber, 
      date: d.date, 
      status: status === 'Suci' ? 'Suci' : status as any, 
      isBlood: d.isBlood,
      reason 
    });
    if (status === 'Ihtiyath' && d.dayNumber <= 15) {
        if (d.isBlood) {
            qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Ihtiyath - Darah Keluar). Karena status meragukan, sholat tetap wajib dilaksanakan, namun jika ditinggalkan wajib diqodlo.`);
        } else {
            qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Ihtiyath - Berhenti Darah). Masa meragukan (Ihtiyath) mewajibkan sholat diqodlo jika tidak dilaksanakan.`);
        }
    }
  });

  specialNotes.push("HUKUM MASA YAKIN HAID (Hari Pertama): Dihukumi layaknya orang haid (Haram sholat, puasa, pasutri, baca Quran).");
  specialNotes.push("HUKUM MASA YAKIN SUCI (Hari ke-16 dst): Dihukumi layaknya orang suci (Halal pasutri, wajib ibadah).");
  specialNotes.push("HUKUM MASA IHTIYATH (Hari ke-2 s.d ke-15): Dihukumi sebagaimana wanita Mutahayyiroh. Wajib sholat & puasa, tapi dilarang pasutri & baca Quran. Wajib mandi besar setiap akan sholat fardlu di masa ini.");

  let shortCategory = "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA WAQTAN LA QODRON)";
  const baseSummary = buildFiqhAnalysisSummary(category, statusTimeline, days);
  analysis = `${analysis} ${baseSummary}`;

  return {
    analysis,
    category,
    shortCategory,
    statusTimeline,
    purificationInstructions: ["Mandi besar setiap kali akan sholat fardlu selama masa Ihtiyath (Hari ke-2 s.d ke-15)."],
    qadhoObligations,
    specialNotes,
    legalBasis: "Kitab Uyunul Masa-il Linnisa'."
  };
}

/**
 * 13. GOLONGAN 6: MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA QODRON LA WAKTAN
 * Ingat durasi, lupa waktu mulai (Category 6)
 */
export function evaluateMutadahIngatDurasiLupaWaktu(days: DayStrength[], habit: UserHabit, isFirstMonth: boolean = false): FiqhAnalysisResult {
  const statusTimeline: any[] = [];
  const specialNotes: string[] = [];
  const qadhoObligations: string[] = [];
  let category = "Golongan 6: Mu'tadah Ghoiru Mumayyizah Dzakiroh Qodron la Waktan";
  
  if (isFirstMonth) {
    specialNotes.push("Catatan: Anda masuk kategori ini karena mengingat durasi haid biasanya, tapi lupa tepatnya di tanggal berapa (dalam suatu rentang waktu).");
  }
  
  const durHaid = habit.duration || 5;
  const rentangWaktu = habit.timeRange || 10;
  const tglSuci = habit.knownPureDay || 1;

  // Mencari kemungkinan start yang valid
  let possibleStarts: number[] = [];
  const totalPossibleStarts = rentangWaktu - durHaid + 1;
  for (let s = 1; s <= totalPossibleStarts; s++) {
    const end = s + durHaid - 1;
    // Cek apakah tglSuci masuk ke dlm blok haid ini? Jika ya, maka s bukan start yg valid.
    const isPureDayInBlock = tglSuci >= s && tglSuci <= end;
    if (!isPureDayInBlock) {
      possibleStarts.push(s);
    }
  }

  // Titik yakin haid adalah irisan dari semua kemungkinan blocks yang tersisa
  let startOfIntersection = -1;
  let endOfIntersection = -1;

  if (possibleStarts.length > 0) {
    const minStart = Math.min(...possibleStarts);
    const maxStart = Math.max(...possibleStarts);

    // Intersection: [maxStart, minStart + durHaid - 1]
    startOfIntersection = maxStart;
    endOfIntersection = minStart + durHaid - 1;
  }

  const hasIntersection = startOfIntersection !== -1 && startOfIntersection <= endOfIntersection;

  let analysis = `Status: Mu'tadah Ghoiru Mumayyizah (Ingat Durasi ${durHaid} hari dalam rentang ${rentangWaktu} hari, Day ${tglSuci} Suci). `;
  
  days.forEach((d, idx) => {
    const tgl = idx + 1;
    let status: 'Haid' | 'Ihtiyath' | 'Suci' | 'Istihadloh';
    let reason: string;

    if (tgl === tglSuci || tgl > rentangWaktu) {
      status = 'Suci';
      reason = tgl === tglSuci ? "Yakin Suci (Input Data)." : "Yakin Suci (Di luar rentang kebiasaan).";
    } else if (hasIntersection && tgl >= startOfIntersection && tgl <= endOfIntersection) {
      status = 'Haid';
      reason = "Yakin Haid (Titik irisan semua kemungkinan jadwal haid).";
    } else {
      status = 'Ihtiyath';
      reason = tgl < startOfIntersection ? "Ihtiyath (Mungkin haid, mungkin suci)." : "Ihtiyath (Mungkin haid, maybe suci, mungkin putus).";
    }

    statusTimeline.push({ 
      day: d.dayNumber, 
      date: d.date, 
      status: status === 'Suci' ? 'Suci' : status as any, 
      isBlood: d.isBlood,
      reason 
    });
    if (status === 'Ihtiyath' && d.dayNumber <= 15) {
        if (d.isBlood) {
            qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Ihtiyath - Darah Keluar). Karena status meragukan, sholat tetap wajib dilaksanakan, namun jika ditinggalkan wajib diqodlo.`);
        } else {
            qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Ihtiyath - Berhenti Darah). Masa meragukan (Ihtiyath) mewajibkan sholat diqodlo jika tidak dilaksanakan.`);
        }
    }
  });

  specialNotes.push("WAKTU YAKIN HAID: Dihukumi layaknya orang haid (Haram sholat, Quran, pasutri).");
  specialNotes.push("WAKTU YAKIN SUCI: Dihukumi layaknya orang suci (Wajib ibadah, Halal pasutri).");
  specialNotes.push(`WAKTU MUNGKIN HAID & SUCI (IHTIYATH): Dihukumi sebagaimana Mutahayyiroh. Khusus mandi, Anda HANYA wajib mandi besar pada masa yang mungkin mulai putusnya haid (yaitu hari ke-${endOfIntersection + 1} s.d hari ke-${rentangWaktu}).`);

  let shortCategory = "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA QODRON LA WAQTAN)";
  const baseSummary = buildFiqhAnalysisSummary(category, statusTimeline, days);
  analysis = `${analysis} ${baseSummary}`;

  return {
    analysis,
    category,
    shortCategory,
    statusTimeline,
    purificationInstructions: [`Mandi besar pada masa kemungkinan putusnya haid (Antara hari ke-${endOfIntersection + 1} sampai ke-${rentangWaktu}).`],
    qadhoObligations,
    specialNotes,
    legalBasis: "Kitab Uyunul Masa-il Linnisa'."
  };
}

export function analyzeFiqhLocal(data: FiqhAnalysisRequest): FiqhAnalysisResult {
  const { 
    records, context, habit, experience, ageYears, ageMonths, ageDays, laborDate,
    startTime, stopTime, hasPerformedPrayerBeforeBleeding, isRamadhan
  } = data;
  
  // 1. Validasi Awal
  if (records.length === 0) {
    return {
      analysis: "Belum ada data darah yang dimasukkan.",
      statusTimeline: [],
      category: "Data Kosong",
      shortCategory: "Data Kosong",
      purificationInstructions: ["Silakan masukkan data pada kalender."],
      qadhoObligations: [],
      legalBasis: "Silakan masukkan data pada kalender."
    };
  }

  const ageValidation = validateAge(ageYears, ageMonths, ageDays);
  if (!ageValidation.isValid) {
    return {
      analysis: ageValidation.message,
      statusTimeline: records.map((r, i) => ({
        day: i + 1,
        date: r.date,
        status: 'Istihadloh',
        reason: "Belum mencapai usia minimal Haid."
      })),
      category: "Istihadloh (Darah Fasad)",
      shortCategory: "Istihadloh (Usia Belum Cukup)",
      purificationInstructions: ["Tidak wajib mandi besar, cukup berwudhu setiap sholat."],
      qadhoObligations: ["Seluruh sholat tetap wajib dikerjakan/diqodho."],
      legalBasis: "Min. 9 Tahun Qomariyah (Fathul Qorib)."
    };
  }

  // 2. Parsing Days
  const days = parseDays(records);
  const defaultHabit: UserHabit = habit || { retrospection: 'lupa_semua' };

  // 3. Router Konteks (Nifas vs Haid)
  let result: FiqhAnalysisResult;

  // CEK APAKAH ADA JEDA PEMISAH SIKLUS (>= 15 HARI)
  let separatorIdx = -1;
  const bloodDayIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
  for (let i = 0; i < bloodDayIndices.length - 1; i++) {
    if (bloodDayIndices[i+1] - bloodDayIndices[i] - 1 >= 15) {
      separatorIdx = bloodDayIndices[i] + 1; // Start of the gap
    }
  }

  if (context === 'nifas' && laborDate) {
    result = analyzeNifas(records, laborDate, experience, defaultHabit, startTime, stopTime, hasPerformedPrayerBeforeBleeding, isRamadhan);
  } else if (context === 'haid' && separatorIdx !== -1) {
    // KASUS PEMISAH SIKLUS MUTLAK
    const statusTimeline: any[] = [];
    const qadhoObligations: string[] = [];
    const specialNotes: string[] = ["Terdeteksi jeda bersih 15 hari atau lebih, hal ini memisahkan siklus haid lama dengan siklus haid baru."];

    days.forEach((d, idx) => {
      let status: 'Haid' | 'Suci' | 'Istihadloh' = 'Suci';
      let reason = "";

      const currentBloodBatch = bloodDayIndices.filter(i => i <= idx);
      const prevBloodIdx = currentBloodBatch.length > 0 ? currentBloodBatch[currentBloodBatch.length - 1] : -1;
      const nextBloodIdx = bloodDayIndices.find(i => i > idx);

      if (d.isBlood) {
        // Find segment
        const segmentStart = bloodDayIndices.find(i => {
           // Find the start of the current blood segment (before this idx, no 15 day gap)
           const prevGaps = bloodDayIndices.filter(bi => bi < idx).map((bi, j, arr) => j > 0 ? bi - arr[j-1] - 1 : 0);
           return true; // Simplified for now: check if this blood is part of haid
        });
        
        // Count blood in this sequence
        let sequenceStart = idx;
        while (sequenceStart > 0 && (idx - sequenceStart < 15)) {
            if (days[sequenceStart].isBlood) {
                // check gap before
                const pBlood = days.slice(0, sequenceStart).map(day => day.isBlood).lastIndexOf(true);
                if (pBlood !== -1 && (sequenceStart - pBlood - 1 >= 15)) break;
            }
            sequenceStart--;
        }
        
        let sequenceEnd = idx;
        while (sequenceEnd < days.length - 1 && (sequenceEnd - idx < 15)) {
            if (days[sequenceEnd].isBlood) {
                const nBlood = days.slice(sequenceEnd + 1).findIndex(day => day.isBlood);
                if (nBlood !== -1 && (nBlood >= 15)) break; // actually simpler
            }
            sequenceEnd++;
        }
        
        const bloodInSeq = days.slice(sequenceStart, sequenceEnd + 1).filter(day => day.isBlood).length;
        if (bloodInSeq * 24 >= 24) {
            status = 'Haid';
            reason = "Haid Baru (Siklus Berbeda).";
        } else {
            status = 'Istihadloh';
            reason = "Darah Fasad (Kurang 24 jam).";
        }
      } else {
          status = 'Suci';
          reason = "Masa Suci Pemisah.";
      }
      statusTimeline.push({ day: d.dayNumber, date: d.date, status, reason, isBlood: d.isBlood });
    });

    result = {
        analysis: buildFiqhAnalysisSummary("Pemisah Siklus Mutlak", statusTimeline, days),
        category: "Pemisah Siklus Mutlak",
        shortCategory: "Haidl (Dua Siklus Terpisah)",
        statusTimeline,
        purificationInstructions: ["Mandi wajib setiap kali darah haid berhenti."],
        qadhoObligations,
        specialNotes,
        legalBasis: "Kitab Fathul Mu'in."
    };
  } else if (context === 'haid' && days.length > 15) {
    // KASUS ISTIHADLOH HAID (> 15 HARI)
    const sessions = getSessions(days);
    const strongDays = days.filter(d => d.isStrong);
    const weakDays = days.filter(d => !d.isStrong);
    const isTamyizValid = checkTamyiz(strongDays, weakDays, sessions, records);

    if (experience === 'mubtadiah') {
      if (isTamyizValid) {
        result = evaluateMubtadiahMumayyizah(days, !!data.isFirstMonthIstihadloh);
      } else {
        result = evaluateMubtadiahGhoiruMumayyizah(days, !!data.isFirstMonthIstihadloh);
      }
    } else {
      // mu'tadah
      if (isTamyizValid) {
        result = evaluateMutadahMumayyizah(days, defaultHabit, !!data.isFirstMonthIstihadloh);
      } else if (defaultHabit.retrospection === 'ingat_waktu') {
        // GOLONGAN 7: INGAT WAKTU MULAI, LUPA DURASI
        result = evaluateMutadahIngatWaktuLupaDurasi(days, !!data.isFirstMonthIstihadloh);
      } else if (defaultHabit.retrospection === 'ingat_durasi') {
        // GOLONGAN 6: INGAT DURASI, LUPA WAKTU MULAI
        result = evaluateMutadahIngatDurasiLupaWaktu(days, defaultHabit, !!data.isFirstMonthIstihadloh);
      } else if (
        defaultHabit.retrospection === 'ingat_semua' || 
        defaultHabit.retrospection === 'ingat_angka_lupa_urutan'
      ) {
        // GOLONGAN 4: INGAT ADAT
        result = evaluateMutadahGhoiruMumayyizahDzakiroh(days, defaultHabit, data.calculationMonthIndex || 0, !!data.isFirstMonthIstihadloh);
      } else {
        // GOLONGAN 5: LUPA ADAT (MUTAHAYYIROH)
        result = evaluateMutahayyiroh(days, defaultHabit, !!isRamadhan, !!data.isFirstMonthIstihadloh);
      }
    }
  } else {
    // 4. Determine Status (Haid / Default)
    result = determineStatus(days, experience, defaultHabit, context);
  }

  // 5. Integrasi Qodlo
  const { qodloSholat, totalQodloPuasa } = calculateQodlo(
    result.statusTimeline, 
    startTime, 
    stopTime, 
    hasPerformedPrayerBeforeBleeding, 
    isRamadhan,
    result.qadhoObligations || []
  );

  const isTerputusFlow = bloodDayIndices.length > 1 && (bloodDayIndices[bloodDayIndices.length - 1] - bloodDayIndices[0] + 1) > bloodDayIndices.length;

  // Cleanup special notes to avoid hallucinations about intermittent bleeding
  if (!isTerputusFlow && result.specialNotes) {
    result.specialNotes = result.specialNotes.filter(n => 
      !n.includes("Setiap kali darah Anda berhenti") && 
      !n.includes("terputus-putus") && 
      !n.includes("jeda") &&
      !n.includes("Hukum Jam'u")
    );
  }

  if (isTerputusFlow) {
    result.specialNotes = result.specialNotes || [];
    const bloodHours = days.filter(d => d.isBlood).length * 24;
    
    if (bloodHours < 24) {
      result.specialNotes.push("Hukum Berhenti (Darah Belum 24 Jam): Karena akumulasi darah belum mencapai 24 jam, Anda cukup membersihkan darah (istinja) dan berwudlu jika ingin sholat. Belum diwajibkan mandi besar.");
    } else {
      if (!result.specialNotes.some(n => n.includes("WAJIB segera mandi besar"))) {
        result.specialNotes.push("Hukum Berhenti (Darah Sudah 24 Jam): Karena total darah sudah mencapai minimal haid (24 jam), maka SETIAP KALI darah berhenti (dengan memastikan tampon tidak lagi bernoda) meskipun belum 15 hari, Anda WAJIB segera mandi besar (janabah), melaksanakan sholat, dan puasa.");
      }
      result.specialNotes.push("Kebolehan Pasutri: Selama darah berhenti di sela-sela masa haid, suami diperbolehkan menggauli istrinya menurut riwayat yang kuat karena secara zahir darah yang berhenti dihukumi suci.");
      result.specialNotes.push(`PENTING (Hukum Jam'u): Karena darah keluar kembali dalam rentang masa maksimal, maka hari-hari berhenti di sela darah tersebut dihukumi ${context.toUpperCase()}. Sholat yang Anda kerjakan di hari jeda tersebut tidak sah (tapi tidak berdosa dan tidak perlu diqodlo). Namun, jika bertepatan dengan puasa RAMADHAN, maka puasa di hari jeda tersebut BATAL dan WAJIB DIQODLO.`);
    }
  }

  if (isRamadhan && totalQodloPuasa > 0) {
    result.specialNotes = result.specialNotes || [];
    if (!result.specialNotes.some(n => n.includes("hutang qodlo puasa"))) {
       result.specialNotes.push(`Status Puasa: Anda memiliki hutang qodlo puasa sebanyak ${totalQodloPuasa} hari. Hari jeda bersih di sela haid/nifas tetap wajib diqodlo jika bertepatan dengan puasa Ramadhan.`);
    }
  }

  const finalResult = {
    ...result,
    qadhoObligations: qodloSholat,
    totalQodloPuasa
  };

  return {
    ...finalResult,
    groupedTimeline: groupTimeline(finalResult.statusTimeline),
    groupedQadho: groupQodlo(finalResult.qadhoObligations)
  };
}

/**
 * UI HELPER: CEK APAKAH USER MUMAYYIZAH
 */
export function checkIfMumayyizah(records: DayRecord[]): boolean {
    if (records.length === 0) return false;
    
    // SYARAT MUTLAK TAMYIZ: Minimal 2 Sifat Darah Berbeda (Audit Hierarki)
    const uniqueBloodCount = countUniqueBloodAttributes(records);
    if (uniqueBloodCount <= 1) return false;

    const days = parseDays(records);
    if (days.length <= 15) return false; // Bukan istihadloh, Tamyiz tidak relevan sbg penentu golongan

    const sessions = getSessions(days);
    const strongDays = days.filter(d => d.isStrong);
    const weakDays = days.filter(d => !d.isStrong);
    return checkTamyiz(strongDays, weakDays, sessions, records);
}
