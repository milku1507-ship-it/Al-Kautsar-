/**
 * KONSTANTA FIQH MUTLAK (Sourced from User's Fiqh Principles)
 */
const MIN_HAID_HOURS = 24;
const MAX_HAID_DAYS = 15;
const MAX_NIFAS_DAYS = 60;
const MIN_PURE_DAYS = 15;

import { FiqhAnalysisRequest, FiqhAnalysisResult, UserHabit, DayRecord, ExperienceStatus } from "../types";
import { validateAge, parseDays, determineStatus, DayStrength, getBloodStrengthScore, calculateBloodHours } from "./fiqhEngine";
import { parseISO, differenceInHours, differenceInDays, addDays, isSameDay, isBefore, isAfter, eachDayOfInterval } from "date-fns";
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
function getLogicalReason(category: string): string {
    if (category.includes("Mumayyizah")) {
        return "Penetapan ini didasarkan pada kemampuan Anda membedakan sifat darah (kuat/lemah) untuk menentukan masa haid atau nifas sesuai aturan tamyiz yang berlaku.";
    }
    if (category.includes("Istihadloh")) {
        return "Penetapan ini didasarkan karena darah yang keluar tidak memenuhi syarat untuk dihukumi haid atau nifas (misalnya durasi tidak memenuhi syarat minimal 24 jam atau melebihi batas maksimal yang diperbolehkan).";
    }
    if (category.includes("Haid")) {
        return "Penetapan ini didasarkan pada durasi darah yang minimal 24 jam dan tidak melebihi 15 hari, serta memenuhi kriteria masa suci pemisah minimal 15 hari dari haid sebelumnya.";
    }
    if (category.includes("Nifas")) {
         return "Penetapan ini didasarkan pada batas maksimal nifas yaitu 60 hari sejak kelahiran, dengan ketentuan khusus bagi darah yang terputus-putus.";
    }
    return "Penetapan ini didasarkan pada analisis durasi dan sifat darah Anda terhadap kaidah dasar fikih haid dan nifas.";
}

function buildFiqhAnalysisSummary(
    category: string,
    statusTimeline: any[],
    days: DayStrength[]
): string {
    const haidCount = statusTimeline.filter(s => s.status === 'Haid').length;
    const istihadlohCount = statusTimeline.filter(s => s.status === 'Istihadloh').length;
    const nifasCount = statusTimeline.filter(s => s.status === 'Nifas').length;
    const ihtiyathCount = statusTimeline.filter(s => s.status === 'Ihtiyath').length;

    let summary = `Total rangkaian Anda adalah ${statusTimeline.length} hari. Berdasarkan kaidah ${category}, masa tersebut dibagi menjadi: `;
    const parts = [];
    if (haidCount > 0) parts.push(`${haidCount} hari dihukumi HAIDL`);
    if (nifasCount > 0) parts.push(`${nifasCount} hari dihukumi NIFAS`);
    if (istihadlohCount > 0) parts.push(`${istihadlohCount} hari dihukumi ISTIHADLAH`);
    if (ihtiyathCount > 0) parts.push(`${ihtiyathCount} hari dihukumi IHTIYATH`);
    
    if (parts.length === 0) {
        summary = `Total rangkaian Anda adalah ${statusTimeline.length} hari. Berdasarkan kaidah ${category}, masa tersebut dihukumi SUCI/ISTIHADLAH.`;
    } else {
        summary += parts.join(', ') + ". ";
    }

    const limit = category.toLowerCase().includes("nifas") ? 60 : 15;
    if (statusTimeline.length > limit) {
        summary += "\nPendarahan Anda melampaui satu siklus normal. Sistem telah memetakan hukum secara berulang (siklus) sesuai kaidah golongan Anda untuk bulan-bulan berikutnya.";
    } else {
        summary += "\nSeluruh rangkaian pendarahan dan hari jeda bersih berada dalam batas durasi normal (maksimal 15 hari haid / 60 hari nifas) dan telah dianalisis sesuai ketentuan fikih.";
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
  existingObligations: string[] = [], // Existing obligations from sub-functions
  firstBleedingDay: number = 1,
  lastBleedingDay: number = -1
) {
  const qodloSholat: string[] = [...existingObligations];
  let totalQodloPuasa = 0;

  /**
 * KONSTANTA FIQH MUTLAK (Sourced from User's Fiqh Principles)
 */
const MIN_HAID_HOURS = 24;
const MAX_HAID_DAYS = 15;
const MAX_NIFAS_DAYS = 60;
const MIN_PURE_DAYS = 15;

  if (startTime && hasPerformed === false) {
    const info = getPrayerInfo(startTime);
    if (info.name !== 'Luar Waktu') {
      const [h, m] = startTime.split(':').map(Number);
      const nowMin = h * 60 + m;
      let diff = nowMin - info.startMinutes;
      if (info.name === 'Isya' && nowMin < 270) diff = (nowMin + 1440) - info.startMinutes;
      
      // Threshold 15 menit (untuk sholat + bersuci)
      if (diff >= 15) {
        if (!qodloSholat.some(q => q.includes(`hari ke-${firstBleedingDay}: Sholat ${info.name} (Awal)`))) {
          qodloSholat.push(`Sholat hari ke-${firstBleedingDay}: Sholat ${info.name} (Awal) wajib diqodlo karena darah datang di waktu ${info.name} (${startTime}) dan telah melewati jarak waktu yang cukup untuk sholat & bersuci, namun Anda belum melaksanakannya.`);
        }
      }
    }
  }

  // 2. Qodlo Akhir (Saat Hilangnya Mani')
  if (stopTime) {
    const info = getPrayerInfo(stopTime);
    if (info.name !== 'Luar Waktu') {
      const finalLastDay = lastBleedingDay !== -1 ? lastBleedingDay : (timeline.length > 0 ? timeline[timeline.length - 1].day : 1);
      const isAlreadyAdded = (prayerName: string) => qodloSholat.some(q => q.includes(`hari ke-${finalLastDay}:`) && q.includes(prayerName));

      if (info.name === 'Ashar') {
        if (!isAlreadyAdded('Ashar')) {
          qodloSholat.push(`Sholat hari ke-${finalLastDay}: Sholat Ashar & Dzuhur wajib diqodlo karena darah berhenti di waktu Ashar (${stopTime}) dan masih ada waktu minimal untuk Takbirotul Ihrom (Allahu Akbar). Dan Anda tidak melaksanakannya atau keburu magrib. Maka Anda wajib mengqodlo Ashar DAN Dzuhur sebelumnya (karena keduanya bisa dijama' menurut Kaidah Fiqlh).`);
        }
      } else if (info.name === 'Isya') {
        if (!isAlreadyAdded('Isya')) {
          qodloSholat.push(`Sholat hari ke-${finalLastDay}: Sholat Isya & Maghrib wajib diqodlo karena darah berhenti di waktu Isya (${stopTime}) dan masih ada waktu minimal untuk Takbirotul Ihrom (Allahu Akbar). Dan Anda tidak melaksanakannya atau keburu subuh. Maka Anda wajib mengqodlo Isya DAN Maghrib sebelumnya (karena keduanya bisa dijama' menurut Kaidah Fiqlh).`);
        }
      } else {
        if (!isAlreadyAdded(info.name)) {
          qodloSholat.push(`Sholat hari ke-${finalLastDay}: Sholat ${info.name} wajib diqodlo karena darah berhenti di waktu ${info.name} (${stopTime}). Karena saat berhenti masih ada waktu minimal muat Takbirotul Ihrom (Allahu Akbar), Anda wajib langsung mandi & sholat (ada') jika waktu cukup, atau mengqodlo jika waktu habis.`);
        }
      }
    }
  }

  // 4. Qodlo Puasa
  let totalHutangPuasa = 0;
  if (isRamadhan) {
    timeline.forEach(t => {
      // Wajib qodlo jika status Haid/Nifas (haram puasa) atau Istihadloh/Ihtiyath/Waiting tapi Anda tidak puasa karena disangka Haid.
      // DYNAMIC: Only count Haid/Waiting days for puasa
      if (t.status === 'Haid' || t.status === 'Nifas' || t.isFirstMonthWaiting) {
        totalHutangPuasa++;
      }
    });
  }

  const specialNotesPuasa: string[] = [];
  if (isRamadhan && totalHutangPuasa > 0) {
    specialNotesPuasa.push(`Status Puasa: Anda memiliki hutang qodlo puasa sebanyak ${totalHutangPuasa} hari. Puasa batal karena Haid/Nifas, atau wajib diqodlo karena Anda tidak berpuasa akibat menanti batas maksimal haid/nifas.`);
  }

  return { qodloSholat, totalQodloPuasa: totalHutangPuasa, specialNotesPuasa };
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

  // 1. Evaluasi Zona A & B (Nglarani Manak / Haidl Ibu Hamil)
  // Menentukan kelompok darah pre-labor (Zona A & B)
  const preLaborIdxs = days.map((_, i) => i).filter(i => dayZones[i] === 'A' || dayZones[i] === 'B');
  const preLaborBloodIdxs = preLaborIdxs.filter(i => days[i].isBlood);

  // Group pre-labor blood indices into clusters where gap is < 15 days
  const preLaborClusters: { start: number; end: number; isValidHaid: boolean }[] = [];
  if (preLaborBloodIdxs.length > 0) {
      let currentCluster = [preLaborBloodIdxs[0]];
      for (let i = 1; i < preLaborBloodIdxs.length; i++) {
          if (preLaborBloodIdxs[i] - preLaborBloodIdxs[i-1] - 1 < 15) {
              currentCluster.push(preLaborBloodIdxs[i]);
          } else {
              const start = currentCluster[0];
              const end = currentCluster[currentCluster.length - 1];
              preLaborClusters.push({ start, end, isValidHaid: false });
              currentCluster = [preLaborBloodIdxs[i]];
          }
      }
      const start = currentCluster[0];
      const end = currentCluster[currentCluster.length - 1];
      preLaborClusters.push({ start, end, isValidHaid: false });

      // For each cluster, evaluate if it satisfies the Haid conditions (span <= 15 days, blood hours >= 24)
      for (const cl of preLaborClusters) {
          const span = cl.end - cl.start + 1;
          let totalHours = 0;
          for (let j = cl.start; j <= cl.end; j++) {
              if (days[j].isBlood) {
                  const rec = days[j].originalRecord;
                  const hours = rec?.durationHours !== undefined ? rec.durationHours : 24;
                  const mins = rec?.durationMinutes !== undefined ? rec.durationMinutes : 0;
                  totalHours += hours + (mins / 60);
              }
          }
          if (span <= 15 && totalHours >= 24) {
              cl.isValidHaid = true;
          }
      }
  }

  // Populate timeline for pre-labor days (Zona A & B)
  for (let i = 0; i < days.length; i++) {
    if (dayZones[i] === 'A' || dayZones[i] === 'B') {
      const d = days[i];
      const cluster = preLaborClusters.find(cl => i >= cl.start && i <= cl.end);
      if (cluster) {
        if (cluster.isValidHaid) {
          statusTimeline.push({
            day: d.dayNumber,
            date: d.date,
            status: 'Haid',
            isBlood: d.isBlood,
            reason: d.isBlood 
              ? (dayZones[i] === 'B' ? 'Darah saat melahirkan (Nglarani) yang bersambung dengan Haidl sebelum melahirkan.' : 'Darah Haidl sebelum melahirkan (hukum Haidl ibu hamil).')
              : 'Masa berhenti (jeda bersih) di sela-sela Haidl sebelum melahirkan (Hukum Jam\'u).'
          });
        } else {
          if (d.isBlood) {
            statusTimeline.push({
              day: d.dayNumber,
              date: d.date,
              status: 'Istihadloh',
              isBlood: d.isBlood,
              reason: dayZones[i] === 'B' 
                ? 'Darah saat melahirkan (Nglarani) / Darah pembuka yang tidak memenuhi syarat Haidl.'
                : 'Darah penyakit (Istihadloh) sebelum melahirkan karena tidak memenuhi syarat durasi Haidl.'
            });
            if (d.dayNumber <= 15) {
              qadhoObligations.push(`Sholat hari ke-${d.dayNumber} (saat melahirkan/sebelum melahirkan) wajib diqodho karena statusnya Istihadloh.`);
            }
          } else {
            statusTimeline.push({
              day: d.dayNumber,
              date: d.date,
              status: 'Suci',
              isBlood: d.isBlood,
              reason: 'Masa suci sebelum melahirkan.'
            });
          }
        }
      } else {
        // Outside of any blood clusters.
        // Check if there is a valid Haid cluster before this index (meaning this is a pure separating gap before labor/nifas)
        const hasValidHaidBefore = preLaborClusters.some(cl => cl.isValidHaid && cl.end < i);
        if (hasValidHaidBefore && dayZones[i] !== 'C') {
          statusTimeline.push({
            day: d.dayNumber,
            date: d.date,
            status: 'Suci',
            isBlood: d.isBlood,
            reason: 'Masa suci pemisah antara haidl dan nifas (tidak disyaratkan minimal 15 hari suci pemisah).'
          });
        } else {
          statusTimeline.push({
            day: d.dayNumber,
            date: d.date,
            status: 'Suci',
            isBlood: d.isBlood,
            reason: 'Masa suci sebelum melahirkan.'
          });
        }
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
    // Rule: break of 15 days or more stops nifas. Gap < 15 continues nifas.
    if ((bloodSess[i].start - nifasEndIdxRel - 1) < 15) nifasEndIdxRel = bloodSess[i].end;
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
      statusTimeline.push({ 
        day: d.dayNumber, 
        date: d.date, 
        status: d.isBlood ? 'Haid' : 'Suci', 
        isBlood: d.isBlood, 
        reason: d.isBlood 
          ? 'Darah Haidl sesudah nifas (dipisah jeda suci minimal 15 hari di dalam rentang 60 hari nifas).' 
          : 'Masa suci pemisah antara nifas dan haidl (dalam rentang 60 hari nifas).' 
      });
    } else {
      statusTimeline.push({ 
        day: d.dayNumber, 
        date: d.date, 
        status: d.isBlood ? 'Haid' : 'Suci', 
        isBlood: d.isBlood, 
        reason: d.isBlood 
          ? 'Darah Haidl di luar batas nifas 60 hari (tidak disyaratkan jeda suci 15 hari setelah masa nifas berakhir).' 
          : 'Masa suci pemisah antara nifas dan haidl (di luar batas nifas 60 hari).' 
      });
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

            const isWaiting = (experience === 'mubtadiah') && d.dayNumber <= 60;

            statusTimeline.push({
                day: d.dayNumber,
                date: d.date,
                status: isNifas ? 'Nifas' : 'Istihadloh',
                isBlood: d.isBlood,
                isFirstMonthWaiting: isWaiting && !isNifas,
                reason: isNifas 
                    ? (d.isStrong ? "Darah Kuat (Nifas)." : "Masa berhenti/lemah di sela-sela Nifas (Hukum Jam'u karena total <= 60 hari).") 
                    : (firstStrongIdx !== -1 && idx >= firstStrongIdx && idx <= lastStrongIdx ? "Istihadloh (Darah Lemah di sela-sela darah kuat Nifas yang totalnya > 60 hari)." : "Istihadloh (Darah Lemah).")
            });
            if (!isNifas && d.dayNumber <= 60) {
                if (d.isBlood) {
                    if (isWaiting) {
                        qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 60 Hari). Karena Anda baru pertama kali melahirkan (Nifas) dan belum memiliki kebiasaan (adat), Anda diwajibkan menanti masa maksimal nifas (60 hari). Kini setelah terbukti Istihadloh, Anda wajib mandi besar dan mengqodlo sholat yang ditinggalkan.`);
                    } else {
                        qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                    }
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
        specialNotes.push("Instruksi Mandi: Wajib mandi besar (mandi janabah) setiap akan melaksanakan shalat fardhu selama masa istihadlah ini.");
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
        specialNotes.push("Instruksi Mandi: Wajib mandi besar (mandi janabah) SETIAP AKAN melaksanakan shalat fardhu mulai hari ke-2 s.d ke-60.");
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
            const isWaiting = (experience === 'mubtadiah') && d.dayNumber <= 60;
            statusTimeline.push({ 
                day: d.dayNumber, 
                date: d.date, 
                status, 
                isBlood: d.isBlood, 
                isFirstMonthWaiting: isWaiting && status !== 'Nifas',
                reason 
            });
            if (status === 'Istihadloh' && d.dayNumber <= 60) {
                if (d.isBlood) {
                    if (isWaiting) {
                        qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 60 Hari). Karena Anda baru pertama kali melahirkan (Nifas) dan belum memiliki kebiasaan (adat), Anda diwajibkan menanti masa maksimal nifas (60 hari). Kini setelah terbukti Istihadloh, Anda wajib mandi besar dan mengqodlo sholat yang ditinggalkan.`);
                    } else {
                        qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                    }
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
        purifications.push("Wajib mandi janabah setiap kali akan melaksanakan shalat fardhu (Ihtiyath).");
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

  const bloodDayIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
  const isTerputusFlow = bloodDayIndices.length > 1 && (bloodDayIndices[bloodDayIndices.length - 1] - bloodDayIndices[0] + 1) > bloodDayIndices.length;

  const nifasNotes = [];
  if (statusTimeline.some(s => s.status === 'Nifas')) {
    nifasNotes.push("Minimal nifas adalah sekejap (lahdzoh). Maksimal adalah 60 hari dari saat kelahiran.");
    if (isTerputusFlow) {
      nifasNotes.push("Setiap kali darah berhenti di masa nifas, wajib mandi (janabah) dan melaksanakan ibadah.");
    }
  }

  // Catatan strategis tentang masa suci pemisah (haid-nifas, nifas-haid, nifas-nifas)
  nifasNotes.push("Masa suci pemisah antara haidl & nifas, nifas & haidl, atau nifas & nifas yang lain tidak disyaratkan harus ada 15 hari 15 malam (bisa kurang dari satu hari, atau tanpa pemisah sama sekali). Hal ini berbeda dengan masa suci pemisah antara haidl dengan haidl yang wajib berdurasi minimal 15 hari 15 malam.");

  if (isRamadhan && totalQodloPuasa > 0) {
    nifasNotes.push(`Status Puasa: Anda memiliki hutang qodlo puasa sebanyak ${totalQodloPuasa} hari Ramadhan.`);
    if (isTerputusFlow) {
      nifasNotes.push("Hari jeda bersih di sela nifas tetap wajib diqodlo jika bertepatan dengan puasa Ramadhan.");
    }
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

    const strongSessions = sessions.filter(s => s.type === 'strong');
    if (strongSessions.length === 0) return false;

    // Check each strong session:
    // Any strong session must have length <= 15 days, and cumulative hours must be >= 24 hours.
    for (const s of strongSessions) {
        const strongHours = s.days.length * 24;
        if (strongHours < 24) return false; // must be at least 24 hours
        if (s.days.length > 15) return false; // must be at most 15 days
    }

    // Verify the relationship between consecutive strong sessions
    for (let i = 0; i < sessions.length; i++) {
        const current = sessions[i];
        if (current.type === 'strong') {
            // Find the next strong session and see if the weak session in-between is >= 15 days
            // Or if the combined span from this strong session to the next strong session is <= 15 days.
            for (let j = i + 1; j < sessions.length; j++) {
                if (sessions[j].type === 'strong') {
                    // Find all sessions between i and j
                    const intermediateWeb = sessions.slice(i, j + 1);
                    // Sum total days of intermediate sessions
                    let totalDaysSpan = 0;
                    intermediateWeb.forEach(s => totalDaysSpan += s.days.length);
                    
                    if (totalDaysSpan > 15) {
                        // The total span is > 15 days, so they cannot be merged.
                        // Thus, there must be at least 15 days of weak blood/purity in between!
                        let weakDaysCount = 0;
                        for (let k = i + 1; k < j; k++) {
                            if (sessions[k].type === 'weak') {
                                weakDaysCount += sessions[k].days.length;
                            }
                        }
                        if (weakDaysCount < 15) {
                            // Weak gap is too short and total span is > 15. Invalid Tamyiz!
                            return false;
                        }
                    }
                    // Break since we only need to compare adjacent strong sessions (j is the next strong session)
                    break;
                }
            }
        }
    }

    return true;
}

function evaluateMubtadiahMumayyizah(days: DayStrength[], isFirstMonth: boolean, context: string): FiqhAnalysisResult {
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
    // Rule: Strong session (DK) = Haid, Weak (DL) = Istihadloh
    // Special rule: DK1 + DL <= 15 days, then DK1+DL = Haid

    const haidIndices = new Set<number>();
    
    // 1. Tambahkan semua hari dari sesi kuat ke haidIndices
    sessions.forEach(s => {
        if (s.type === 'strong') {
            s.days.forEach(d => haidIndices.add(days.indexOf(d)));
        }
    });

    // 2. Lakukan penggabungan (merging) untuk sesi kuat yang jaraknya berdekatan (total rentang <= 15 hari)
    const strongSessionIndices = sessions.map((s, idx) => s.type === 'strong' ? idx : -1).filter(idx => idx !== -1);
    for (let x = 0; x < strongSessionIndices.length - 1; x++) {
        const i = strongSessionIndices[x];
        const j = strongSessionIndices[x + 1];
        
        const firstDayOfI = sessions[i].days[0];
        const lastDayOfJ = sessions[j].days[sessions[j].days.length - 1];
        const dayIdxOfI = days.indexOf(firstDayOfI);
        const dayIdxOfJ = days.indexOf(lastDayOfJ);
        
        const totalSpan = dayIdxOfJ - dayIdxOfI + 1;
        if (totalSpan <= 15) {
            // Gabungkan semua hari di antaranya (termasuk darah lemah / jeda suci) menjadi Haid
            for (let k = dayIdxOfI; k <= dayIdxOfJ; k++) {
                haidIndices.add(k);
            }
        }
    }
    
    // Dynamic Golongan & Analysis Construction
    const haidIndicesCount = haidIndices.size;
    
    const waitingDaysInfo = days.filter((d, idx) => isFirstMonth && !haidIndices.has(idx) && d.dayNumber <= 15 && d.isBlood);
    const minWaitingDay = waitingDaysInfo.length > 0 ? Math.min(...waitingDaysInfo.map(d => d.dayNumber)) : 2;
    const maxWaitingDay = waitingDaysInfo.length > 0 ? Math.max(...waitingDaysInfo.map(d => d.dayNumber)) : 15;

    // Build Timeline
    days.forEach((d, idx) => {
        const isHaid = haidIndices.has(idx);
        const isWaiting = isFirstMonth && d.dayNumber <= 15;
        const status = isHaid ? 'Haid' : (d.isBlood ? 'Istihadloh' : 'Suci');
        const reason = isHaid 
            ? "Darah Kuat/Lemah (Haid - Sesuai kaidah Mumayyizah)." 
            : (d.isBlood ? "Darah Lemah (Istihadloh)." : "Masa suci.");
        statusTimeline.push({
            day: d.dayNumber,
            date: d.date,
            status,
            isBlood: d.isBlood,
            isFirstMonthWaiting: isWaiting && !isHaid,
            reason
        });

        // Logika Qodlo
        if (isFirstMonth && !isHaid && d.dayNumber <= 15 && d.isBlood) {
            qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Karena Anda belum memiliki kebiasaan (adat) dan ini pengalaman pertama pendarahan panjang, Anda diwajibkan menanti (meninggalkan sholat) hingga hari ke-15. Setelah terbukti bahwa hari ke-${d.dayNumber} ini adalah Istihadloh, Anda wajib mandi besar dan mengqodlo sholat pada hari ini.`);
        }
    });

    const specialNotes: string[] = [];
    const bIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
    const isIntermittent = bIndices.length > 1 && (bIndices[bIndices.length - 1] - bIndices[0] + 1) > bIndices.length;
    if (isIntermittent) {
        specialNotes.push("Karena darah terputus-putus, setiap kali darah berhenti, Anda wajib mandi dan sholat. Jika darah keluar lagi dalam masa haid, sholat tersebut batal.");
    }

    let langkahSelanjutnyaTeks = "";
    
    // 1. Kondisi 1 & 2: Bulan Pertama
    if (isFirstMonth) {
        if (context === 'haid') {
            langkahSelanjutnyaTeks = "Masa Penantian 15 Hari telah berakhir. Mulai hari ini, Anda WAJIB MANDI BESAR (Janabah) dan status Anda resmi menjadi wanita Mustahadlah (Suci). Anda WAJIB melaksanakan shalat fardhu dan puasa tepat waktu (dengan tata cara bersuci khusus Mustahadlah). Jika ibadah di hari-hari ini terlanjur Anda tinggalkan, maka wajib diqadha.";
        } else if (context === 'nifas') {
            langkahSelanjutnyaTeks = "Masa Penantian 60 Hari telah berakhir. Mulai hari ini, Anda WAJIB MANDI BESAR (Janabah) dan status Anda resmi menjadi wanita Mustahadlah (Suci). Anda WAJIB melaksanakan shalat fardhu dan puasa tepat waktu (dengan tata cara bersuci khusus Mustahadlah). Jika ibadah di hari-hari ini terlanjur Anda tinggalkan, maka wajib diqadha.";
        }
    } 
    // 2. Kondisi 3: Tamyiz
    else {
        langkahSelanjutnyaTeks = "Mandi wajib (janabah) dilakukan TEPAT di saat karakter darah berubah dari sifat kuat ke sifat lemah (berakhirnya masa Tamyiz).";
    }

    return {
        analysis: buildFiqhAnalysisSummary(category, statusTimeline, days),
        category,
        shortCategory: "ISTIHADLOH (MUBTADI'AH MUMAYYIZAH)",
        statusTimeline,
        purificationInstructions: ["Mandi wajib di saat perpindahan sifat darah (jika sudah bulan kedua)."],
        qadhoObligations,
        specialNotes,
        langkahSelanjutnyaTeks,
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

    const waitingDaysInfo = days.filter((d, idx) => {
        const cycleDay = (idx % 30) + 1;
        const isHaid = cycleDay === 1;
        return isFirstMonth && !isHaid && d.dayNumber <= 15 && d.isBlood;
    });
    const minWaitingDay = waitingDaysInfo.length > 0 ? Math.min(...waitingDaysInfo.map(d => d.dayNumber)) : 2;
    const maxWaitingDay = waitingDaysInfo.length > 0 ? Math.max(...waitingDaysInfo.map(d => d.dayNumber)) : 15;
    const totalWaitingDays = waitingDaysInfo.length;

    days.forEach((d, idx) => {
        // Siklus 30 hari: Hari ke-1 Haid, ke-2 s/d 30 Istihadloh
        const cycleDay = (idx % 30) + 1;
        const isHaid = cycleDay === 1;
        const isWaiting = isFirstMonth && d.dayNumber <= 15;
        const status = isHaid ? 'Haid' : (d.isBlood ? 'Istihadloh' : 'Suci');
        const reason = isHaid 
            ? "Haid standar mubtadi'ah ghoiru mumayyizah (24 jam pertama)." 
            : (d.isBlood ? "Istihadloh (Masa suci 29 hari dalam siklus 30 hari)." : "Masa suci.");

        statusTimeline.push({
            day: d.dayNumber,
            date: d.date,
            status,
            isBlood: d.isBlood,
            isFirstMonthWaiting: isWaiting && !isHaid,
            reason
        });

        // Logika Qodlo
        if (isFirstMonth && !isHaid && d.dayNumber <= 15 && d.isBlood) {
            qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Menanti 15 Hari). Karena Anda belum memiliki kebiasaan (adat) dan ini pengalaman pertama pendarahan panjang, Anda diwajibkan menanti (meninggalkan sholat) hingga hari ke-15. Setelah terbukti bahwa hari ke-${d.dayNumber} ini adalah Istihadloh, Anda wajib mandi besar dan mengqodlo sholat pada hari ini.`);
        }
    });

    const specialNotes: string[] = [];
    if (isFirstMonth) {
        specialNotes.push(`Aturan Mandi (Bulan Pertama): Anda wajib menanti (meninggalkan sholat) selama 15 hari. Begitu genap 15 hari, Anda wajib mandi besar dan mengqodlo sholat pada hari-hari pendarahan Istihadloh dari hari ke-${minWaitingDay} sampai hari ke-${maxWaitingDay}.`);
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
        specialNotes.push("Catatan Bulan Pertama: Karena ini adalah bulan pertama terjadinya pendarahan panjang melebihi adat, Anda wajib menanti hingga genap 15 hari (batas maksimal haid) untuk melihat apakah darah berhenti atau berlanjut, guna memastikan status istihadlah Anda. Selama masa tunggu 15 hari ini, Anda dilarang beribadah (shalat, puasa, dll) karena secara zhohir masih dihukumi haid. Setelah melewati hari ke-15 dan darah terbukti melampaui batas maksimal haid, Anda wajib mandi besar, kembali beribadah, dan mengqadha shalat fardhu pada hari-hari istihadlah yang Anda tinggalkan selama masa tunggu tersebut.");
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
                const isWaiting = false;
                
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
                
                if (isFirstMonth && status === 'Istihadloh' && d.dayNumber <= 15) {
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
            const haidIndices = new Set<number>();
            
            // 1. Tambahkan semua hari dari sesi kuat ke haidIndices
            sessions.forEach(s => {
                if (s.type === 'strong') {
                    s.days.forEach(d => haidIndices.add(days.indexOf(d)));
                }
            });

            // 2. Lakukan penggabungan (merging) untuk sesi kuat yang jaraknya berdekatan (total rentang <= 15 hari)
            const strongSessionIndices = sessions.map((s, idx) => s.type === 'strong' ? idx : -1).filter(idx => idx !== -1);
            for (let x = 0; x < strongSessionIndices.length - 1; x++) {
                const i = strongSessionIndices[x];
                const j = strongSessionIndices[x + 1];
                
                const firstDayOfI = sessions[i].days[0];
                const lastDayOfJ = sessions[j].days[sessions[j].days.length - 1];
                const dayIdxOfI = days.indexOf(firstDayOfI);
                const dayIdxOfJ = days.indexOf(lastDayOfJ);
                
                const totalSpan = dayIdxOfJ - dayIdxOfI + 1;
                if (totalSpan <= 15) {
                    for (let k = dayIdxOfI; k <= dayIdxOfJ; k++) {
                        haidIndices.add(k);
                    }
                }
            }
            
            days.forEach((d, idx) => {
                const isHaid = haidIndices.has(idx);
                const isWaiting = false;
                const status = isHaid ? 'Haid' : (d.isBlood ? 'Istihadloh' : 'Suci');
                const reason = isHaid 
                    ? (d.isStrong ? "Darah Kuat (Haid). Tamyiz mengalahkan Adat." : "Masa berhenti/lemah di sela-sela darah kuat (Haid - Hukum Jam'u karena total <= 15 hari).") 
                    : (d.isBlood ? "Istihadloh (Darah Lemah)." : "Masa suci.");
                statusTimeline.push({
                    day: d.dayNumber,
                    date: d.date,
                    status,
                    isBlood: d.isBlood,
                    isFirstMonthWaiting: isWaiting && !isHaid,
                    reason
                });
                if (isFirstMonth && !isHaid && d.dayNumber <= 15) {
                  if (d.isBlood) {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
                  } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh). Anda meninggalkan sholat pada saat darah berhenti namun status hukumnya adalah Istihadloh.`);
                  }
                }
            });
        }
    } else {
        // Kuat di awal: Tamyiz menang mutlak (sampai kuat terakhir)
        category = "Mu'tadah Mumayyizah";
        const haidIndices = new Set<number>();
        
        // 1. Tambahkan semua hari dari sesi kuat ke haidIndices
        sessions.forEach(s => {
            if (s.type === 'strong') {
                s.days.forEach(d => haidIndices.add(days.indexOf(d)));
            }
        });

        // 2. Lakukan penggabungan (merging) untuk sesi kuat yang jaraknya berdekatan (total rentang <= 15 hari)
        const strongSessionIndices = sessions.map((s, idx) => s.type === 'strong' ? idx : -1).filter(idx => idx !== -1);
        for (let x = 0; x < strongSessionIndices.length - 1; x++) {
            const i = strongSessionIndices[x];
            const j = strongSessionIndices[x + 1];
            
            const firstDayOfI = sessions[i].days[0];
            const lastDayOfJ = sessions[j].days[sessions[j].days.length - 1];
            const dayIdxOfI = days.indexOf(firstDayOfI);
            const dayIdxOfJ = days.indexOf(lastDayOfJ);
            
            const totalSpan = dayIdxOfJ - dayIdxOfI + 1;
            if (totalSpan <= 15) {
                for (let k = dayIdxOfI; k <= dayIdxOfJ; k++) {
                    haidIndices.add(k);
                }
            }
        }

        days.forEach((d, idx) => {
            const isHaid = haidIndices.has(idx);
            const isWaiting = false;
            const status = isHaid ? 'Haid' : (d.isBlood ? 'Istihadloh' : 'Suci');
            const reason = isHaid 
                ? (d.isStrong ? "Darah Kuat (Haid). Tamyiz mengalahkan Adat." : "Masa berhenti/lemah di sela-sela darah kuat (Haid - Hukum Jam'u karena total <= 15 hari).") 
                : (d.isBlood ? "Istihadloh (Darah Lemah)." : "Masa suci.");
            statusTimeline.push({
                day: d.dayNumber,
                date: d.date,
                status,
                isBlood: d.isBlood,
                isFirstMonthWaiting: isWaiting && !isHaid,
                reason
            });
            if (isFirstMonth && !isHaid && d.dayNumber <= 15) {
              if (d.isBlood) {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan sholat pada saat darah keluar yang ternyata dihukumi Istihadloh.`);
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
    let purificationInstructions: string[] = [];

    if (isFirstMonth) {
        specialNotes.push("Catatan Bulan Pertama: Karena ini adalah bulan pertama terjadinya pendarahan panjang melebihi adat, Anda wajib menanti hingga genap 15 hari (batas maksimal haid) untuk melihat apakah darah berhenti or berlanjut, guna memastikan status istihadlah Anda. Selama masa tunggu 15 hari ini, Anda dilarang beribadah (shalat, puasa, dll) karena secara zhohir masih dihukumi haid. Setelah melewati hari ke-15 dan darah terbukti melampaui batas maksimal haid, Anda wajib mandi besar, kembali beribadah, dan mengqadha shalat fardhu pada hari-hari istihadlah yang Anda tinggalkan selama masa tunggu tersebut.");
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
        // KASUS: LUPA URUTAN / LUPA TERAKHIR (IHTIYATH BERLAPIS / DZAKIROTUL QODRI NASIYATUL WAQTI)
        const sortedDurs = Array.from(new Set(habit.durations)).sort((a, b) => a - b);
        const minDur = sortedDurs[0];
        const maxDur = sortedDurs[sortedDurs.length - 1];
        
        category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Dzakirotul Qodri Nasiyatul Waqti - Lupa Urutan Adat)";
        analysis = `Status: Mu'tadah Ghoiru Mumayyizah dengan Adat Berubah-ubah tetapi Lupa Urutan/Adat Terakhir (Dzakirotul Qodri Nasiyatul Waqti). Karena Anda mengingat angka-angka durasi haid kebiasaan Anda (${sortedDurs.join(', ')} hari) tetapi lupa urutan atau mana yang terjadi di bulan terakhir sebelum istihadlah, Mazhab Syafi'i memberlakukan hukum Kehati-hatian (Ihtiyath) Berlapis sebagai berikut:`;
        
        specialNotes.push("PANDUAN HUKUM IHTIYATH BERLAPIS (LUPA URUTAN):");
        specialNotes.push(`1. FASE YAKIN HAID (Hari ke-1 s.d ke-${minDur}): Dihukumi haid secara mutlak karena merupakan angka terendah yang pasti dilewati dan dialami dalam seluruh opsi kebiasaan adat Anda. Haram shalat, puasa, hubungan pasutri, dan membaca Al-Qur'an.`);
        specialNotes.push(`2. FASE IHTIYATH KEHATI-HATIAN (Hari ke-${minDur + 1} s.d ke-${maxDur}): Masa yang meragukan apakah sudah suci atau masih haid. Berlaku status ganda: Anda wajib mendirikan shalat fardhu dan puasa Ramadhan (meniru orang suci), namun haram bersetubuh (jima') dan haram membaca Al-Qur'an secara lisan di luar shalat (meniru orang haid).`);
        specialNotes.push(`3. FASE YAKIN SUCI / ISTIHADLAH (Hari ke-${maxDur + 1} ke atas): Merupakan masa suci secara meyakinkan karena pendarahan telah melampaui durasi adat maksimal Anda (${maxDur} hari). Anda dihukumi suci sepenuhnya, wajib beribadah fardhu, halal bersetubuh, dan boleh membaca Al-Qur'an.`);

        purificationInstructions = [
            `Aturan Mandi Besar Khusus Kasus Lupa Urutan (${sortedDurs.join(', ')} hari):`,
            `Anda WAJIB mandi besar (ghusl) sebanyak ${sortedDurs.length} kali, yaitu di setiap AKHIR hari dari angka-angka adat yang Anda ingat:`,
            ...sortedDurs.map(dur => `- Mandi besar ke-${sortedDurs.indexOf(dur) + 1}: Di akhir hari ke-${dur} siklus pendarahan Anda (karena ada kemungkinan haid Anda sebenarnya berdurasi ${dur} hari dan terputus di hari ini).`),
            `Pada hari selain akhir hari ${sortedDurs.join(', ')} (seperti hari ke-4 atau ke-6 jika tidak ada di daftar), Anda CUKUP berwudhu seperti biasa untuk mendirikan shalat fardhu baru tanpa perlu mandi besar lagi.`,
            `Langkah bersuci di Fase Ihtiyath: Bersihkan kemaluan -> Balut/seka -> Mandi fardhu (pada akhir hari yang ditentukan) -> Berwudhu fardhu -> Segera mendirikan shalat.`
        ];

        days.forEach((d, idx) => {
            const isWaiting = false;
            let status: string;
            let reason: string;

            if (d.dayNumber <= minDur) {
                if (d.isBlood) {
                    status = 'Haid';
                    reason = `Haid Yakin (Hari ke-${d.dayNumber} <= batas durasi minimal adat ${minDur} hari).`;
                } else {
                    // Check if flanked by blood within minDur on both sides
                    let leftHasHaidBlood = false;
                    for (let l = idx - 1; l >= 0; l--) {
                        if (days[l].dayNumber <= minDur && days[l].isBlood) {
                            leftHasHaidBlood = true;
                            break;
                        }
                    }
                    let rightHasHaidBlood = false;
                    for (let r = idx + 1; r < days.length; r++) {
                        if (days[r].dayNumber <= minDur && days[r].isBlood) {
                            rightHasHaidBlood = true;
                            break;
                        }
                    }
                    if (leftHasHaidBlood && rightHasHaidBlood) {
                        status = 'Haid';
                        reason = `Masa berhenti di sela-sela Haid Yakin (Hukum Jam'u).`;
                    } else {
                        status = 'Suci';
                        reason = `Masa bersih/mati darah di sela pendarahan (Diapit Haid & Istihadloh, Hukum Jam'u gugur, dihukumi SUCI).`;
                    }
                }
            } else if (d.dayNumber <= maxDur) {
                status = 'Ihtiyath';
                reason = `Masa Kehati-hatian / Ihtiyath (Hari ke-${d.dayNumber} berada di rentang ketidakpastian adat ${minDur + 1} s.d ${maxDur} hari). Wajib sholat & puasa fardhu, tetap dilarang jima' & membaca Quran secara lisan.`;
            } else {
                status = d.isBlood ? 'Istihadloh' : 'Suci';
                reason = d.isBlood 
                    ? `Istihadloh / Yakin Suci (Hari ke-${d.dayNumber} > batas durasi maksimal adat ${maxDur} hari).` 
                    : "Masa suci.";
            }

            statusTimeline.push({ 
                day: d.dayNumber, 
                date: d.date, 
                status: status === 'Haid' ? 'Haid' : (status === 'Istihadloh' ? 'Istihadloh' : (status === 'Suci' ? 'Suci' : 'Ihtiyath')), 
                isBlood: d.isBlood,
                reason,
                isFirstMonthWaiting: isWaiting && status !== 'Haid'
            });

            if (isFirstMonth && (status === 'Istihadloh' || status === 'Suci') && d.dayNumber <= 15) {
                if (d.isBlood) {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh - Melebihi Adat Maksimal). Sholat wajib dilaksanakan karena status hukumnya ternyata suci.`);
                } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh).`);
                }
            }
        });
    } else {
        // KASUS: INGAT SEMUA URUTAN / INGAT DURASI (ADAT TETAP/PUTARAN/TIDAK TERATUR - MUTANAQILAH)
        if (allSame) {
            category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Adat Tetap)";
            analysis = `Status: Mu'tadah Ghoiru Mumayyizah dengan Adat Tetap. Durasi haid adat Anda adalah konsisten ${activeDur} hari. Sesuai dengan ketetapan Mazhab Syafi'i, pendarahan Anda dihukumi haid sepanjang hari adat Anda yaitu ${activeDur} hari pertama, dan sisanya dihukumi Istihadlah (suci).`;
            
            purificationInstructions = [
                `Mandi besar wajib dilakukan TEPAT setelah melewati hari ke-${activeDur} (akhir masa haid adat Anda).`,
                `Setelah hari ke-${activeDur} berakhir, Anda berstatus suci (Istihadlah). Anda wajib shalat dan puasa fardhu, cukup bersuci secara normal (istinja' + pembalut) dan melakukan wudhu setiap kali masuk waktu shalat fardhu baru tanpa perlu mandi besar lagi.`
            ];
        } else if (patternN !== -1) {
            category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Adat Berubah Teratur - Mu'tadah Mutanaqolah)";
            analysis = `Status: Mu'tadah Ghoiru Mumayyizah dengan Adat Berubah Teratur (Mu'tadah Mutanaqolah Muntadzimah). Kebiasaan haid Anda berubah-ubah membentuk pola periodik berulang secara teratur, yaitu: [${durs.slice(0, patternN).join(', ')}]. Sesuai dengan ketetapan hukum fiqh Mazhab Syafi'i, durasi haid aktif Anda mengikuti urutan pola pada bulan berjalan ini (Bulan Istihadlah ke-${istihadlohMonthIndex + 1}), yaitu sebesar ${activeDur} hari.`;
            
            specialNotes.push("TENTANG ADAT MUTANAQILAH MUNTADZIMAH:");
            specialNotes.push(`Sistem mendeteksi pola haid Anda berulang tiap ${patternN} bulan dengan siklus [${durs.slice(0, patternN).join(', ')}]. Karena pola ini diulang secara konsisten hingga terbukti valid, durasi haid yang berlaku bulan ini adalah ${activeDur} hari.`);

            purificationInstructions = [
                `Mandi besar wajib Anda lakukan TEPAT setelah melewati hari ke-${activeDur} (akhir masa giliran adat haid aktif Anda bulan ini).`,
                `Memasuki hari ke-${activeDur + 1} dan seterusnya, status Anda adalah suci (Istihadlah). Anda wajib shalat dan puasa fardhu, cukup bersuci secara biasa (istinja' + pembalut) dan berwudhu fardhu setiap kali mendirikan shalat fardhu baru tanpa perlu mandi besar.`
            ];
        } else if (durs.length >= 2) {
            category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Adat Berubah Tidak Teratur)";
            analysis = `Status: Mu'tadah Ghoiru Mumayyizah dengan Adat Berubah Tidak Teratur (Mu'tadah Mutanaqolah Ghoiru Muntadzimah). Kebiasaan haid Anda sebelum istihadlah terbukti berubah-ubah beberapa kali (${durs.join(', ')} hari) tetapi pola perulangannya tidak teratur (atau belum genap 2 kali putaran pengulangan pola). Berdasarkan kaidah fiqh Mazhab Syafi'i, pendarahan dikembalikan kepada durasi haid pada bulan terakhir yang dialami persis sebelum istihadlah dimulai, yaitu ${activeDur} hari.`;
            
            specialNotes.push("TENTANG ADAT MUTANAQILAH GHOIRU MUNTADZIMAH:");
            specialNotes.push(`Karena daftar durasi haid Anda (${durs.join(', ')}) belum membentuk pola periodik yang teruji 2 kali berulang secara matematis, maka durasi haid yang diambil secara legal adalah bulan haid terakhir sebelum istihadlah, yaitu ${activeDur} hari.`);

            purificationInstructions = [
                `Mandi besar wajib Anda lakukan TEPAT setelah melewati hari ke-${activeDur} (akhir masa haid adat bulan terakhir Anda).`,
                `Memasuki hari ke-${activeDur + 1} dan seterusnya, status Anda adalah suci (Istihadlah). Anda wajib shalat dan puasa fardhu, cukup bersuci secara biasa (istinja' + pembalut) dan berwudhu fardhu setiap kali mendirikan shalat fardhu baru.`
            ];
        } else {
            category = "Golongan 4: Mu'tadah Ghoiru Mumayyizah (Adat Tetap)";
            analysis = `Status: Mu'tadah Ghoiru Mumayyizah dengan Adat Tetap. Durasi haid Anda ditetapkan kembali ke adat tunggal Anda yaitu ${activeDur} hari.`;
            purificationInstructions = [
                `Mandi besar setelah melewati hari ke-${activeDur} (batas akhir durasi haid Anda).`
            ];
        }
        
        const adatSuci = habit.habitSuci || (30 - activeDur);
        const siklusAdat = activeDur + adatSuci;
        
        days.forEach((d, idx) => {
            const posisi = (d.dayNumber - 1) % siklusAdat;
            const isHaidZone = posisi < activeDur;
            const isWaiting = false;
            
            let status = 'Suci';
            let reason = 'Masa suci.';
            
            if (isHaidZone) {
                if (d.isBlood) {
                    status = 'Haid';
                    reason = `Haid sesuai Adat aktif (${activeDur} hari).`;
                } else {
                    // Check if flanked by blood within the Haid zone on both left and right
                    let leftHasHaidBlood = false;
                    for (let l = idx - 1; l >= 0; l--) {
                        const lPos = (days[l].dayNumber - 1) % siklusAdat;
                        const lIsHaidZone = lPos < activeDur;
                        if (lIsHaidZone && days[l].isBlood) {
                            leftHasHaidBlood = true;
                            break;
                        }
                    }
                    
                    let rightHasHaidBlood = false;
                    for (let r = idx + 1; r < days.length; r++) {
                        const rPos = (days[r].dayNumber - 1) % siklusAdat;
                        const rIsHaidZone = rPos < activeDur;
                        if (rIsHaidZone && days[r].isBlood) {
                            rightHasHaidBlood = true;
                            break;
                        }
                    }
                    
                    if (leftHasHaidBlood && rightHasHaidBlood) {
                        status = 'Haid';
                        reason = `Masa berhenti di sela-sela Haid Adat aktif (Hukum Jam'u).`;
                    } else {
                        status = 'Suci';
                        reason = `Masa bersih/mati darah di sela pendarahan (Diapit Haid & Istihadloh, Hukum Jam'u gugur, dihukumi SUCI).`;
                    }
                }
            } else {
                status = d.isBlood ? 'Istihadloh' : 'Suci';
                reason = d.isBlood ? "Istihadloh (Masa Suci Adat)." : "Masa suci.";
            }
            
            statusTimeline.push({
                day: d.dayNumber,
                date: d.date,
                status,
                isBlood: d.isBlood,
                isFirstMonthWaiting: isWaiting && status !== 'Haid',
                reason
            });

            const isHaid = status === 'Haid';
            if (isFirstMonth && !isHaid && d.dayNumber <= 15) {
                if (d.isBlood) {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Darah Istihadloh). Anda meninggalkan shalat pada saat darah keluar yang ternyata dihukumi Istihadloh karena melampaui durasi adat.`);
                } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Kasus Berhenti Darah di Masa Istihadloh).`);
                }
            }
        });
    }

    const bIndices = days.map((d, i) => d.isBlood ? i : -1).filter(i => i !== -1);
    const isIntermittent = bIndices.length > 1 && (bIndices[bIndices.length - 1] - bIndices[0] + 1) > bIndices.length;
    if (isIntermittent) {
        specialNotes.push("Keterangan Tambahan (Pecah Darah - intermittency): Setiap kali darah Anda berhenti sementara di sela-sela masa pendarahan, Anda WAJIB segera mandi besar (janabah) dan melaksanakan kewajiban shalat serta puasa fardhu secara lahiriah, karena pendarahan yang berhenti dihukumi sebagai kesucian lahir.");
    }

    let shortCategory = habit.retrospection === 'ingat_angka_lupa_urutan' 
        ? "ISTIHADLO (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROTUL QODRI NASIYATUL WAQTI)" 
        : "ISTIHADLO (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROTUL QODRI WAL WAQTI)";
        
    const baseSummary = buildFiqhAnalysisSummary(category, statusTimeline, days);
    analysis = `${analysis} ${baseSummary}`;

    return {
        analysis,
        category,
        shortCategory,
        statusTimeline,
        purificationInstructions,
        qadhoObligations,
        specialNotes,
        legalBasis: "Kitab Al-Majmu' Syarh Al-Muhadzdzab, Hasyiyah Al-Bajuri jilid 1, & Kitab Uyunul Masa-il Linnisa."
    };
}

/**
 * 11. GOLONGAN 5: MU'TAHAYYIROH (LUPA TOTAL / MUTAHAYYIROH / MUHAYYAROH)
 */
export function evaluateMutahayyiroh(days: DayStrength[], habit: UserHabit, isRamadhan: boolean, isFirstMonth: boolean = false): FiqhAnalysisResult {
    const statusTimeline: any[] = [];
    const specialNotes: string[] = [];
    const qadhoObligations: string[] = [];
    let analysis = "Status: Mu'tadah Ghoiru Mumayyizah Nasiyah (Mutahayyirah Mutlaqah / Bingung Total). Anda mengalami Istihadlah panjang (melebihi 15 hari), darah seragam dan tidak bisa dibedakan kekuatannya (Ghoiru Mumayyizah), serta Anda lupa total durasi haid (qadar) dan waktu mulai biasanya (waqt). Berdasarkan Mazhab Syafi'i, hukum Anda dihukumi dengan asas Kehati-hatian penuh (Ihtiyath). Anda diperlakukan sebagai wanita haid untuk hal-hal yang membahayakan (keharaman) dan diperlakukan sebagai wanita suci untuk kewajiban (keabsahan ibadah fardhu).";
    let category = "Golongan 5: Mutahayyiroh (Lupa Adat Total)";

    if (isFirstMonth) {
        specialNotes.push("Catatan Khusus Bulan Pertama: Karena darah keluar melebihi 15 hari untuk pertama kalinya dan Anda lupa pola adat lama Anda, Anda resmi berada dalam kategori Mutahayyirah Mutlaqoh.");
    }

    days.forEach(d => {
        const isWaiting = isFirstMonth && d.dayNumber <= 15;
        const status = 'Ihtiyath';
        const reason = "Status Mutahayyiroh Mutlaqoh: Masa ketidakpastian (meragukan antara haid dan suci). Berdasarkan kaidah kehati-hatian (Ihtiyath), setiap hari dihukumi berpotensi haid (berlaku keharaman) sekaligus berpotensi suci (kewajiban ibadah fardhu tetap berjalan).";
        
        statusTimeline.push({ 
            day: d.dayNumber, 
            date: d.date, 
            status, 
            isBlood: d.isBlood,
            reason,
            isFirstMonthWaiting: isWaiting
        });
        
        if (isFirstMonth && d.dayNumber <= 15) {
            if (d.isBlood) {
                if (isWaiting) {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodly (Masa Menanti). Selama 15 hari pertama Anda tidak shalat karena mengira haid biasa. Karena terbukti sebagai Istihadlah panjang, masa tersebut wajib diqodly demi kehati-hatian.`);
                } else {
                    qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodly (Masa Ihtiyath - Darah Keluar).`);
                }
            } else {
                qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodly (Masa Ihtiyath - Berhenti Darah).`);
            }
        }
    });

    if (!isFirstMonth) {
        qadhoObligations.push("Kewajiban Shalat Bulanan: Seluruh shalat fardhu 5 waktu WAJIB dikerjakan tepat pada waktunya setelah bersuci dan mandi wajib (ghusl). Jika selama berjalannya hari ada shalat fardhu yang terlewat, Anda wajib segera mengqodly-nya.");
    }

    specialNotes.push("HUKUM KEHARAMAN (Sebagaimana Orang Haid):");
    specialNotes.push("Berdasarkan aturan kehati-hatian (Ihtiyath) karena kemungkinan sedang haid, Anda dilarang melakukan hal-hal berikut:");
    specialNotes.push("1. Bersetubuh (jima') dengan suami, atau menikmati bagian tubuh di antara pusar dan lutut.");
    specialNotes.push("2. Membaca Al-Qur'an secara lisan dengan niat membaca Al-Qur'an (tilawah) di luar shalat. Membaca Al-Qur'an dengan niat dzikir, perlindungan (ta'awwudz), atau doa tetap diperbolehkan. Saat shalat fardhu, Anda tetap wajib melafadzkan surat Al-Fatihah.");
    specialNotes.push("3. Menyentuh, membawa, dan memegang mushaf Al-Qur'an.");
    specialNotes.push("4. Berdiam diri (i'tikaf) dan melintasi masjid jika khawatir darah akan menetes dan menajiskan masjid.");

    specialNotes.push("HUKUM KEWAJIBAN & KEABSAHAN (Sebagaimana Orang Suci):");
    specialNotes.push("Karena kemungkinan Anda sedang suci, demi sahnya dan amannya status ibadah fardhu Anda:");
    specialNotes.push("1. Shalat fardhu lima waktu tetap wajib didirikan tepat waktu.");
    specialNotes.push("2. Puasa wajib Ramadhan tetap wajib dikerjakan seluruhnya.");
    specialNotes.push("3. Thawaf fardhu tetap wajib dilakukan dengan bersuci terlebih dahulu, dan tholaq (talak) yang dijatuhkan suami di masa ini tetap dihukumi sah.");

    if (habit.ingatWaktuBerhenti) {
        specialNotes.push("INSTRUKSI MANDI KHUSUS: Karena Anda ingat waktu berhentinya saja (misal sore hari), Anda hanya wajib mandi besar SEKALI sehari tepat pada jam tersebut. Untuk shalat fardhu lainnya dalam hari tersebut, Anda cukup bersuci (istinja' + pembalut) dan melakukan wudhu.");
    } else {
        specialNotes.push("INSTRUKSI MANDI UTAMA: Karena Anda sama sekali tidak ingat waktu berhentinya haid Anda, Anda WAJIB MANDI BESAR setiap kali hendak menunaikan shalat fardhu baru (setiap masuk waktu shalat). Hal ini karena ada probabilitas haid berhenti di setiap detik.");
    }

    if (isRamadhan) {
        specialNotes.push("TENTANG PUASA RAMADHAN & CARA QODHO (METODE SHAFI'I - 30+30+3-12-3):");
        specialNotes.push("Untuk menyucikan puasa wajib Anda dari keraguan haid, Mazhab Syafi'i mewajibkan tata cara qodho bertahap sebagai berikut:");
        specialNotes.push("1. Puasa Ramadhan: Wajib berpuasa penuh selama 30 hari di bulan Ramadhan demi menghormati bulan suci. Namun, keabsahan puasa ini belum dianggap sah sepenuhnya.");
        specialNotes.push("2. Qodho Tahap Pertama: Begitu bulan Ramadhan berakhir, Anda wajib mengqodho puasa sebanyak 30 hari berturut-turut. Dari gabungan puasa Ramadhan (30 hari) dan qodho beruntun (30 hari) ini, Anda secara matematis dipastikan mendapatkan minimal 28 hari puasa yang sah dan suci.");
        specialNotes.push("3. Qodho Tahap Kedua (Menutup Hutang 2 Hari): Untuk menyempurnakan sisa 2 hari puasa agar genap 30 hari yang sah, Anda harus melakukan puasa qodho tambahan dengan pola khusus:");
        specialNotes.push("   👉 Berpuasalah selama 3 hari berturut-turut, lalu tidak berpuasa (makan) selama 12 hari, kemudian lakukan puasa lagi selama 3 hari berturut-turut. Pola ini menjamin Anda mendapatkan sisa 2 hari puasa yang suci secara mutlak.");
        specialNotes.push("💡 Total hari pengerjaan puasa Anda untuk menyelesaikan satu bulan Ramadhan fardhu secara meyakinkan adalah 30 hari Ramadhan + 30 hari Qodho Tahap I + 6 hari Qodho Tahap II (total 66 hari jatah puasa).");
    }

    let shortCategory = "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH NASIYAH LI'ADATIHA QODRON WA WAQTAN / MUTAHAYYIROH)";
    const baseSummary = buildFiqhAnalysisSummary(category, statusTimeline, days);
    analysis = `${analysis} ${baseSummary}`;

    const purificationInstructions = [
        habit.ingatWaktuBerhenti 
          ? "Cara bersuci (Mandi Khusus): Karena Anda hanya ingat waktu berhentinya saja, Anda wajib mandi besar setiap hari tepat pada waktu tersebut (misal jam berhenti yang Anda ingat), lalu cukup berwudhu untuk fardhu berikutnya."
          : "Cara bersuci (Wajib Mandi Setiap Shalat Fardhu): Karena Anda sama sekali tidak ingat waktu berhentinya haid, Anda WAJIB MANDI BESAR setiap kali hendak menunaikan shalat fardhu (setiap masuk waktu shalat).",
        "Langkah-langkah bersuci untuk setiap shalat fardhu:",
        "1. Tunggu hingga waktu shalat fardhu benar-benar masuk.",
        "2. Bersihkan kemaluan dari darah dan kotoran (istinja').",
        "3. Segera sumbat dengan kapas pembalut jika darah masih mengalir dan gunakan pembalut yang rapat (jika sedang berpuasa di siang hari, cukup dibalut luarnya saja tanpa menyumbat bagian dalam).",
        "4. Lakukan mandi besar (Ghusl) dengan niat bersuci dari haid agar diperbolehkan melaksanakan shalat fardhu (Niat: 'Sengaja saya mandi fardhu karena istihadlah untuk kebolehan shalat fardhu' / 'نويت الغسل لاستباحة الصلاة الفرض').",
        "5. Lakukan wudhu dengan segera setelah mandi.",
        "6. Segera dirikan shalat fardhu tanpa menunda-nunda."
    ];

    return {
        analysis,
        category,
        shortCategory,
        statusTimeline,
        purificationInstructions,
        qadhoObligations,
        specialNotes,
        legalBasis: "Kitab Al-Majmu' Syarh Al-Muhadzdzab & Fathul Qorib."
    };
}

/**
 * 12. GOLONGAN 7: MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA WAKTAN LA QODRON
 * Ingat waktu mulai, lupa durasi (Category 7)
 */
export function evaluateMutadahIngatWaktuLupaDurasi(days: DayStrength[], isFirstMonth: boolean = false, isRamadhan: boolean = false): FiqhAnalysisResult {
  const statusTimeline: any[] = [];
  const specialNotes: string[] = [];
  const qadhoObligations: string[] = [];
  let category = "Golongan 7: Mu'tadah Ghoiru Mumayyizah Dzakiroh Waktan la Qodron (Lupa Kadar, Ingat Waktu)";
  let analysis = "Status: Mu'tadah Ghoiru Mumayyizah Dzakiroh li-'adatiha Waqtan la Qodron (Ingat Waktu Mulai, Lupa Durasi). Berdasarkan mazhab Syafi'i, siklus dibagi menjadi 3 fase: (1) Fase Yakin Haid pada hari pertama sesuai batas minimal haid, (2) Fase Kehati-hatian (Ihtiyath) pada hari ke-2 hingga hari ke-15 karena ketidakpastian persisnya durasi adat biasanya, (3) Fase Yakin Suci dari hari ke-16 dan seterusnya karena melampaui batas maksimal haid 15 hari.";

  if (isFirstMonth) {
    specialNotes.push("Catatan: Anda masuk kategori ini karena mengalami istihadlo panjang (melebihi 15 hari) dan tidak memiliki pola darah kuat-lemah yang memenuhi syarat Tamyiz, namun Anda mengingat dengan pasti waktu/hari mulainya haid sedangkan Anda lupa durasi/kadarnya.");
  }

  days.forEach((d, idx) => {
    let status: 'Haid' | 'Ihtiyath' | 'Suci' | 'Istihadloh';
    let reason: string;
    const isWaiting = isFirstMonth && d.dayNumber <= 15;

    if (idx === 0) {
      status = 'Haid';
      reason = "Fase Yakin Haid: Hari pertama dihitung yakin haid karena ini adalah waktu mulai adat yang Anda ingat dan memenuhi kadar minimal haid (24 jam).";
    } else if (idx < 15) {
      status = 'Ihtiyath';
      reason = "Fase Ihtiyath: Hari ke-2 sampai ke-15 dihukumi meragukan (antara haid dan suci) sebab Anda tidak tahu persis pada hari keberapa haid Anda biasanya selesai.";
    } else {
      status = 'Suci';
      reason = "Fase Yakin Suci: Sejak hari ke-16 Anda dipastikan sudah suci karena batas maksimal haid dalam mazhab Syafi'i adalah 15 hari.";
    }

    statusTimeline.push({ 
      day: d.dayNumber, 
      date: d.date, 
      status: status === 'Suci' ? (d.isBlood ? 'Istihadloh' : 'Suci') : status as any, 
      isBlood: d.isBlood,
      reason,
      isFirstMonthWaiting: isWaiting
    });

    if (status === 'Haid') {
      if (isFirstMonth) {
        qadhoObligations.push(`Sholat hari ke-${d.dayNumber} (Yakin Haid): Tidak perlu diqodlo karena dihukumi haid secara pasti.`);
      }
    } else if (status === 'Ihtiyath' && d.dayNumber <= 15) {
      if (isFirstMonth) {
        if (d.isBlood) {
          qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Masa Kehati-hatian / Ihtiyath). Selama masa ini Anda tetap sholat, namun karena statusnya meragukan, apabila ada sholat yang terlewat wajib diqodlo.`);
        } else {
          qadhoObligations.push(`Sholat hari ke-${d.dayNumber}: Wajib diqodlo (Masa Ihtiyath - Darah Berhenti).`);
        }
      }
    }
  });

  specialNotes.push("HUKUM FASE YAKIN HAID (Hari ke-1):");
  specialNotes.push("Berlaku penuh keharaman haid: Haram shalat, puasa, thawaf, bersetubuh (jima'), melintasi masjid jika khawatir menetes, dan haram membaca Al-Qur'an secara lisan di luar shalat fardhu.");
  
  specialNotes.push("HUKUM FASE IHTIYATH / KEHATI-HATIAN (Hari ke-2 s.d ke-15):");
  specialNotes.push("Status hukum Anda di fase ini menyerupai wanita Mutahayyiroh. Anda wajib bersikap hati-hati (Ihtiyath):");
  specialNotes.push("1. Wajib sholat fardhu lima waktu dan wajib berpuasa Ramadhan.");
  specialNotes.push("2. Haram bersetubuh (jima') dengan suami.");
  specialNotes.push("3. Haram menyentuh Al-Qur'an dan haram melafadzkan Al-Qur'an di luar shalat secara lisan dengan niat membaca Qur'an (sekadar dzikir/doa tetap boleh).");
  specialNotes.push("4. Wajib melakukan mandi besar (ghusl) setiap kali akan melaksanakan shalat fardhu baru karena ada kemungkinan haid Anda berhenti di setiap detiknya.");

  specialNotes.push("HUKUM FASE YAKIN SUCI (Hari ke-16 dst):");
  specialNotes.push("Darah yang keluar di fase ini dihukumi sebagai darah Istihadloh (bukan haid). Anda sudah sepenuhnya suci dari haid:");
  specialNotes.push("1. Wajib menjalankan ibadah sebagaimana wanita suci biasa (shalat fardhu, puasa).");
  specialNotes.push("2. Diperbolehkan bersetubuh dengan suami.");
  specialNotes.push("3. Boleh menyentuh, membaca, dan membawa Al-Qur'an.");
  specialNotes.push("4. Tidak perlu lagi mandi besar setiap kali shalat fardhu baru, cukup bersuci (istinja' + pembalut) dan wudhu setiap masuk waktu shalat.");

  if (isRamadhan) {
    specialNotes.push("TENTANG PUASA RAMADHAN & CARA QODLO:");
    specialNotes.push("1. Hari ke-1 (Yakin Haid): Anda haram berpuasa. Wajib mengqodho puasa yang ditinggalkan sebanyak 1 hari ini.");
    specialNotes.push("2. Hari ke-2 s.d 15 (Masa Ihtiyath): Anda wajib berpuasa fardhu Ramadhan untuk menghormati bulan suci. Namun puasa di masa keraguan ini tidak dihukumi sah sepenuhnya, sehingga Anda tetap berkewajiban mengqodho puasa tersebut sebanyak 14 hari.");
    specialNotes.push("3. Hari ke-16 s.d 30 (Yakin Suci): Puasa Ramadhan yang Anda jalani sah sepenuhnya dan tidak perlu diqodho karena Anda dipastikan telah berada di masa suci dari haid.");
    specialNotes.push("💡 REKOMENDASI CARA QODLO YANG MUDAH: Karena Anda ingat persis waktu mulainya haid bulanan Anda, maka Anda juga tahu persis kapan masa Yakin Suci Anda (yaitu hari ke-16 s.d 30 setelah waktu mulai haid). Lakukanlah puasa qodho hanya pada masa Yakin Suci di bulan-bulan berikutnya agar qodho Anda sah sepenuhnya tanpa keraguan.");
  }

  let shortCategory = "ISTIHADLOH (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA WAQTAN LA QODRON)";
  const baseSummary = buildFiqhAnalysisSummary(category, statusTimeline, days);
  analysis = `${analysis} ${baseSummary}`;

  const purificationInstructions = [
    "Cara Bersuci Pada Fase Ihtiyath (Hari ke-2 s.d 15):",
    "Karena ada kemungkinan haid Anda terputus/berhenti di setiap detik, Anda wajib melakukan MANDI BESAR setiap kali hendak melaksanakan shalat fardhu (setiap shalat fardhu membutuhkan satu kali mandi wajib tersendiri).",
    "Langkah-langkah bersuci untuk setiap shalat fardhu di masa Ihtiyath:",
    "1. Ketahuilah dengan yakin bahwa waktu shalat fardhu tersebut sudah benar-benar masuk.",
    "2. Bersihkan kemaluan dari darah dan kotoran (istinja').",
    "3. Sumpat dengan kapas pembalut jika darah masih mengalir dan gunakan pembalut yang rapat (jika sedang berpuasa di siang hari, cukup dibalut luarnya saja tanpa menyumbat bagian dalam untuk mencegah pembatalan puasa akibat masuknya benda ke dalam rongga tubuh).",
    "4. Segera lakukan mandi besar (Ghusl) dengan niat memperbolehkan shalat fardhu (Niat: 'Sengaja saya mandi fardhu karena istihadlah untuk kebolehan shalat fardhu' / 'نويت الغسل لاستباحة الفرض').",
    "5. Segera lakukan wudhu setelah mandi tanpa jeda lama.",
    "6. Segera laksanakan shalat fardhu tanpa menunda-nunda.",
    "Catatan penting setelah Hari ke-15 (Hari ke-16 dst): Anda tidak perlu lagi mandi besar setiap hendak shalat fardhu. Cukup lakukan istinja', balut dengan pembalut bersih, lalu berwudhu setiap kali masuk waktu shalat fardhu baru."
  ];

  return {
    analysis,
    category,
    shortCategory,
    statusTimeline,
    purificationInstructions,
    qadhoObligations,
    specialNotes,
    legalBasis: "Kitab Al-Majmu' Syarh Al-Muhadzdzab, Hasyiyah Al-Bajuri, & Uyunul Masa-il Linnisa'."
  };
}

/**
 * 13. GOLONGAN 6: MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA QODRON LA WAKTAN
 * Ingat durasi, lupa waktu mulai (Category 6)
 */
export function evaluateMutadahIngatDurasiLupaWaktu(days: DayStrength[], habit: UserHabit, isFirstMonth: boolean = false, isRamadhan: boolean = false): FiqhAnalysisResult {
  const statusTimeline: any[] = [];
  const specialNotes: string[] = [];
  const qadhoObligations: string[] = [];
  let category = "Golongan 6: Mu'tadah Ghoiru Mumayyizah Dzakiroh Qodron la Waqtan (Ingat Kadar/Durasi, Lupa Waktu)";
  let analysis = "Status: Mu'tadah Ghoiru Mumayyizah Dzakiroh li-adatiha Qodron la Waqtan. Berdasarkan Mazhab Syafi'i, siklus dianalisis menggunakan siklus standar 30 hari. Karena Anda mengetahui dengan pasti durasi haid adat Anda (qadar) tetapi lupa hari mulainya (waqt), maka hari-hari dikelompokkan berdasarkan kemungkinan terjadinya haid:";

  if (isFirstMonth) {
    specialNotes.push("Catatan Khusus Bulan Pertama: Anda memasuki kategori ini karena mengalami pendarahan panjang (lebih dari 15 hari) dan tidak memiliki pola darah kuat-lemah (Tamyiz) yang valid, namun Anda mengingat dengan pasti durasi/kadar haid bulanan Anda yang biasa sedangkan Anda lupa hari/waktu mulainya.");
  }

  const durHaid = habit.duration || 7;
  const tglSuci = habit.knownPureDay || 0;

  // Skenario 1: Tidak ada hari yang diyakini pasti suci (tglSuci = 0)
  // Skenario 2: Ada hari yang diyakini pasti suci (tglSuci > 0). Maka haid berdurasi durHaid tidak mungkin tumpang tindih dengan tglSuci.
  const K = tglSuci;
  const L1 = K > 1 ? K - 1 : 0;
  const L2 = K > 0 ? 30 - K : 0;
  
  const fit1 = K > 0 && durHaid <= L1;
  const fit2 = K > 0 && durHaid <= L2;

  days.forEach((d, idx) => {
    const tgl = d.dayNumber;
    const relDay = ((tgl - 1) % 30) + 1; // Relatif dalam siklus 30 hari
    let status: 'Haid' | 'Ihtiyath' | 'Suci' | 'Istihadloh';
    let reason: string;
    const isWaiting = isFirstMonth && tgl <= 15;

    if (K === 0) {
      status = 'Ihtiyath';
      reason = `Masa Kehati-hatian (Ihtiyath): Karena Anda tidak memiliki titik tanggal suci sebagai rujukan, seluruh hari dalam siklus berpotensi merupakan masa haid maupun suci. Anda wajib shalat dan puasa fardhu, namun dilarang bersetubuh (jima') dan dilarang membaca Qur'an secara lisan.`;
    } else {
      if (relDay === K) {
        status = 'Suci';
        reason = `Yakin Suci: Sesuai dengan tanggal rujukan adat suci yang Anda ingat secara pasti (Hari ke-${K}).`;
      } else if (!fit1 && !fit2) {
        status = 'Ihtiyath';
        reason = `Masa Kehati-hatian (Ihtiyath): Hubungan matematis durasi adat (${durHaid} hari) dengan tanggal suci ke-${K} tidak menyisakan ruang muat tunggal yang pasti. Seluruh hari di luar tanggal suci dihukumi meragukan.`;
      } else if (fit1 && !fit2) {
        // Haid hanya muat di rentang sebelum K [1, K-1]
        // Maka rentang sesudah K [K+1, 30] diyakini suci
        if (relDay > K) {
          status = d.isBlood ? 'Istihadloh' : 'Suci';
          reason = `Yakin Suci: Durasi haid adat Anda (${durHaid} hari) tidak muat lagi diletakkan di rentang hari ke-${K+1} s.d 30 karena areanya terlalu sempit (${L2} hari).`;
        } else {
          // relDay < K
          const startIntersection = L1 - durHaid + 1;
          const endIntersection = durHaid;
          if (startIntersection <= endIntersection && relDay >= startIntersection && relDay <= endIntersection) {
            status = 'Haid';
            reason = `Yakin Haid: Hari ke-${relDay} merupakan titik irisan (overlap) yang dipastikan selalu dilewati oleh pendarahan haid ${durHaid} hari Anda di dalam sub-rentang 1 s.d ${K-1}.`;
          } else {
            status = 'Ihtiyath';
            reason = `Masa Kehati-hatian (Ihtiyath): Hari ke-${relDay} berkemungkinan menjadi awal, pertengahan, atau akhir haid ${durHaid} hari Anda di dalam sub-rentang 1 s.d ${K-1}.`;
          }
        }
      } else if (fit2 && !fit1) {
        // Haid hanya muat di rentang sesudah K [K+1, 30]
        // Maka rentang sebelum K [1, K-1] diyakini suci
        if (relDay < K) {
          status = d.isBlood ? 'Istihadloh' : 'Suci';
          reason = `Yakin Suci: Durasi haid adat Anda (${durHaid} hari) tidak muat diletakkan di rentang hari ke-1 s.d ${K-1} karena areanya terlalu sempit (${L1} hari).`;
        } else {
          // relDay > K
          const startIntersection = 30 - durHaid + 1;
          const endIntersection = K + durHaid;
          if (startIntersection <= endIntersection && relDay >= startIntersection && relDay <= endIntersection) {
            status = 'Haid';
            reason = `Yakin Haid: Hari ke-${relDay} merupakan titik irisan (overlap) yang dipastikan selalu dilewati oleh pendarahan haid ${durHaid} hari Anda di dalam sub-rentang ${K+1} s.d 30.`;
          } else {
            status = 'Ihtiyath';
            reason = `Masa Kehati-hatian (Ihtiyath): Hari ke-${relDay} berkemungkinan menjadi awal, pertengahan, atau akhir haid ${durHaid} hari Anda di dalam sub-rentang ${K+1} s.d 30.`;
          }
        }
      } else {
        // fit1 && fit2 (Haid muat di kedua rentang)
        status = 'Ihtiyath';
        reason = `Masa Kehati-hatian (Ihtiyath): Haid adat Anda (${durHaid} hari) bisa diletakkan baik sebelum hari ke-${K} maupun sesudahnya, sehingga hari ke-${relDay} berada dalam posisi meragukan.`;
      }
    }

    statusTimeline.push({
      day: d.dayNumber,
      date: d.date,
      status: status === 'Suci' ? (d.isBlood ? 'Istihadloh' : 'Suci') : status as any,
      isBlood: d.isBlood,
      reason,
      isFirstMonthWaiting: isWaiting
    });

    if (status === 'Haid' && isFirstMonth) {
      qadhoObligations.push(`Sholat hari ke-${tgl} (Yakin Haid): Tidak perlu diqodlo karena dihukumi haid secara pasti.`);
    } else if (status === 'Ihtiyath' && isFirstMonth && tgl <= 15) {
      if (d.isBlood) {
        qadhoObligations.push(`Sholat hari ke-${tgl}: Wajib diqodlo (Masa Kehati-hatian / Ihtiyath - Darah Keluar).`);
      } else {
        qadhoObligations.push(`Sholat hari ke-${tgl}: Wajib diqodlo (Masa Kehati-hatian / Ihtiyath - Darah Berhenti).`);
      }
    }
  });

  specialNotes.push("HUKUM FASE YAKIN HAID (Jika Terbentuk Irisan):");
  specialNotes.push("Berlaku penuh keharaman haid seluruhnya: Haram shalat, puasa Ramadhan, tawaf, bersetubuh (jima'), membaca Al-Qur'an secara lisan di luar shalat fardhu, dan memegang mushaf.");

  specialNotes.push("HUKUM FASE IHTIYATH / KEHATI-HATIAN:");
  specialNotes.push("Selama masa ini Anda dihukumi menyerupai wanita Mutahayyirah:");
  specialNotes.push("1. Wajib shalat fardhu 5 waktu dan berpuasa fardhu Ramadhan.");
  specialNotes.push("2. Haram bersetubuh (jima') dengan suami.");
  specialNotes.push("3. Haram membaca Al-Qur'an secara lisan atau menyentuh mushaf di luar shalat.");
  specialNotes.push("4. WAJIB mandi besar (ghusl) setiap kali hendak mengerjakan shalat fardhu baru, karena ada probabilitas haid Anda terputus/berhenti di setiap detiknya.");

  specialNotes.push("HUKUM FASE YAKIN SUCI:");
  specialNotes.push("Anda berstatus suci sepenuhnya:");
  specialNotes.push("1. Wajib menunaikan ibadah fardhu (shalat, puasa).");
  specialNotes.push("2. Halal bersetubuh (jima') dengan suami.");
  specialNotes.push("3. Boleh membaca, menyentuh, dan membawa Al-Qur'an.");
  specialNotes.push("4. Cukup bersuci biasa (istinja' + pembalut) dan berwudhu setiap masuk waktu shalat tanpa perlu mandi besar.");

  if (isRamadhan) {
    specialNotes.push("TENTANG PUASA RAMADHAN & CARA QODHO:");
    specialNotes.push("1. Di Bulan Ramadhan: Anda wajib berpuasa penuh selama 30 hari karena kemungkinan sedang suci.");
    if (K > 0) {
      specialNotes.push(`💡 CARA QODHO YANG MUDAH (MEMANFAATKAN YAKIN SUCI): Karena Anda memiliki tanggal suci ke-${K} yang membagi siklus Anda, Anda memiliki hari-hari Yakin Suci di setiap bulannya. Lakukanlah puasa qodho hanya pada hari-hari Yakin Suci di bulan-bulan berikutnya demi menjamin keabsahan puasa qodho Anda secara mutlak tanpa keraguan.`);
    } else {
      specialNotes.push("2. Tata Cara Qodho (Metode Shafi'i - Lupa total waktu): Puasa Ramadhan yang dijalani tidak sah sepenuhnya sehingga Anda wajib mengqodho dengan pola 30 hari berturut-turut pasca Ramadhan (Tahap I), ditambah 6 hari pola khusus (Tahap II: puasa 3 hari, libur 12 hari, puasa 3 hari) agar menggenapkan 30 hari puasa yang suci.");
    }
  }

  // Menentukan instruksi mandi berdasarkan sub-rentang end-points
  const purificationInstructions = [
    "Aturan Mandi Besar Pada Fase Ihtiyath (Kehati-hatian):",
    "Karena haid berpeluang berhenti di setiap detiknya, Anda wajib mandi besar untuk setiap kali shalat fardhu hendak didirikan (1 kali mandi besar per 1 shalat fardhu)."
  ];

  if (K > 0) {
    purificationInstructions.push("💡 ANALISIS HARI MANDI EFISIEN:");
    if (fit1 && !fit2) {
      purificationInstructions.push(`Berdasarkan perhitungan fiqh, haid Anda hanya berpeluang berhenti pada rentang hari ke-${durHaid} s.d ke-${K-1} di setiap siklus 30 hari Anda. Maka Anda HANYA wajib mandi besar setiap kali shalat fardhu pada tanggal-tanggal tersebut. Untuk tanggal lain (di masa Yakin Suci), Anda tidak perlu mandi, cukup berwudhu fardhu.`);
    } else if (fit2 && !fit1) {
      purificationInstructions.push(`Berdasarkan perhitungan fiqh, haid Anda hanya berpeluang berhenti pada rentang hari ke-${K + durHaid} s.d ke-30 di setiap siklus 30 hari Anda. Maka Anda HANYA wajib mandi besar setiap kali shalat fardhu pada tanggal-tanggal tersebut. Untuk tanggal lain (di masa Yakin Suci), Anda tidak perlu mandi, cukup berwudhu fardhu.`);
    } else if (fit1 && fit2) {
      purificationInstructions.push(`Haid Anda berpeluang berhenti pada rentang hari ke-${durHaid} s.d ke-${K-1} ATAU hari ke-${K + durHaid} s.d ke-30. Anda wajib mandi fardhu pada rentang-rentang tersebut.`);
    }
  } else {
    purificationInstructions.push("Karena Anda tidak memiliki rujukan tanggal suci, probabilitas haid berhenti tersebar merata di seluruh hari. Oleh karena itu, Anda wajib melakukan mandi fardhu setiap kali akan shalat fardhu baru di sepanjang masa pendarahan ini.");
  }

  purificationInstructions.push(
    "Langkah-langkah bersuci untuk setiap shalat fardhu di masa Ihtiyath:",
    "1. Pastikan waktu shalat fardhu tersebut sudah masuk.",
    "2. Bersihkan kemaluan dari darah dan kotoran (istinja').",
    "3. Sumpat kemaluan dengan kapas/pembalut yang bersih dan rapat (kecuali sedang berpuasa di siang hari, cukup balut di luarnya saja).",
    "4. Segera lakukan mandi besar (Ghusl) dengan niat untuk memperbolehkan shalat fardhu (Niat: 'Sengaja saya mandi fardhu karena istihadlah untuk kebolehan shalat fardhu' / 'نويت الغسل لاستباحة الفرض').",
    "5. Segera lakukan wudhu setelah mandi tanpa jeda lama.",
    "6. Segera laksanakan shalat fardhu tanpa menunda-nunda."
  );

  let shortCategory = "ISTIHADLAH (MU'TADAH GHOIRU MUMAYYIZAH DZAKIROH LI'ADATIHA QODRON LA WAQTAN)";
  const baseSummary = buildFiqhAnalysisSummary(category, statusTimeline, days);
  analysis = `${analysis} ${baseSummary}`;

  return {
    analysis,
    category,
    shortCategory,
    statusTimeline,
    purificationInstructions,
    qadhoObligations,
    specialNotes,
    legalBasis: "Kitab Al-Majmu' Syarh Al-Muhadzdzab, Hasyiyah Al-Bajuri, & Uyunul Masa-il Linnisa'."
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
        result = evaluateMubtadiahMumayyizah(days, !!data.isFirstMonthIstihadloh, context);
      } else {
        result = evaluateMubtadiahGhoiruMumayyizah(days, !!data.isFirstMonthIstihadloh);
      }
    } else {
      // mu'tadah
      if (isTamyizValid) {
        result = evaluateMutadahMumayyizah(days, defaultHabit, !!data.isFirstMonthIstihadloh);
      } else if (defaultHabit.retrospection === 'ingat_waktu') {
        // GOLONGAN 7: INGAT WAKTU MULAI, LUPA DURASI
        result = evaluateMutadahIngatWaktuLupaDurasi(days, !!data.isFirstMonthIstihadloh, !!isRamadhan);
      } else if (defaultHabit.retrospection === 'ingat_durasi') {
        // GOLONGAN 6: INGAT DURASI, LUPA WAKTU MULAI
        result = evaluateMutadahIngatDurasiLupaWaktu(days, defaultHabit, !!data.isFirstMonthIstihadloh, !!isRamadhan);
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

  // Apply Aturan Emas for Hukum Jam'u on Naqo' (masa bersih) using simple Boundary Logic
  if (result && result.statusTimeline) {
    const sessions = getSessions(days);
    const strongDays = days.filter(d => d.isStrong);
    const weakDays = days.filter(d => !d.isStrong);
    const isTamyizValid = checkTamyiz(strongDays, weakDays, sessions, records);

    result.statusTimeline = applyHukumJamUAturanEmas(
      result.statusTimeline,
      days,
      defaultHabit,
      context,
      experience,
      data.calculationMonthIndex || 0,
      isTamyizValid
    );
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

  const parsedStatusTimeline = result.statusTimeline || [];
  const isJamUActive = parsedStatusTimeline.some((item: any) => 
    !item.isBlood && (item.status === 'Haid' || item.status === 'Nifas')
  );

  // Cleanup special notes to avoid hallucinations about intermittent bleeding
  if (!isTerputusFlow && result.specialNotes) {
    result.specialNotes = result.specialNotes.filter(n => {
      const lower = n.toLowerCase();
      return !lower.includes("darah berhenti") && 
             !lower.includes("terputus-putus") && 
             !lower.includes("jeda") &&
             !lower.includes("jam'u");
    });
  }

  if (isTerputusFlow) {
    result.specialNotes = result.specialNotes || [];
    const bloodHours = calculateBloodHours(days);
    
    if (bloodHours < 24) {
      result.specialNotes.push("Hukum Berhenti (Darah Belum 24 Jam): Karena akumulasi darah belum mencapai 24 jam, Anda cukup membersihkan darah (istinja) dan berwudlu jika ingin sholat. Belum diwajibkan mandi besar.");
    } else {
      if (!result.specialNotes.some(n => n.includes("WAJIB segera mandi besar"))) {
        result.specialNotes.push("Hukum Berhenti (Darah Sudah 24 Jam): Karena total darah sudah mencapai minimal haid (24 jam), maka SETIAP KALI darah berhenti (dengan memastikan tampon tidak lagi bernoda) meskipun belum 15 hari, Anda WAJIB segera mandi besar (janabah), melaksanakan sholat, dan puasa.");
      }
      if (isJamUActive) {
        result.specialNotes.push("Kebolehan Pasutri: Selama darah berhenti di sela-sela masa haid, suami diperbolehkan menggauli istrinya menurut riwayat yang kuat karena secara zahir darah yang berhenti dihukumi suci.");
        result.specialNotes.push(`PENTING (Hukum Jam'u): Karena darah keluar kembali dalam rentang masa maksimal, maka hari-hari berhenti di sela darah tersebut dihukumi ${context.toUpperCase()}. Sholat yang Anda kerjakan di hari jeda tersebut tidak sah (tapi tidak berdosa dan tidak perlu diqodlo). Namun, jika bertepatan dengan puasa RAMADHAN, maka puasa di hari jeda tersebut BATAL dan WAJIB DIQODLO.`);
      } else {
        result.specialNotes.push("Status Masa Berhenti (Suci): Karena masa berhenti/jeda pendarahan Anda berada di luar masa haid/nifas (tidak ditarik menjadi haid), maka hari jeda tersebut sepenuhnya dihukumi SUCI secara fiqh. Ibadah sholat dan puasa yang Anda lakukan di hari jeda tersebut sah demi hukum.");
      }
    }
  }

  if (isRamadhan && totalQodloPuasa > 0) {
    result.specialNotes = result.specialNotes || [];
    if (!result.specialNotes.some(n => n.includes("hutang qodlo puasa"))) {
       if (isTerputusFlow && isJamUActive) {
         result.specialNotes.push(`Status Puasa: Anda memiliki hutang qodlo puasa sebanyak ${totalQodloPuasa} hari. Hari jeda bersih di sela haid/nifas tetap wajib diqodlo jika bertepatan dengan puasa Ramadhan.`);
       } else {
         result.specialNotes.push(`Status Puasa: Anda memiliki hutang qodlo puasa sebanyak ${totalQodloPuasa} hari.`);
       }
    }
  }

function getCategoryReason(shortCategory: string, category: string, hasGaps: boolean = false): string {
  const clean = (str: string) => (str || "")
    .toUpperCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, " ");

  const sc = clean(shortCategory);
  const cat = clean(category);

  // Mubtadi'ah Mumayyizah
  if (sc.includes("MUBTADIAH MUMAYYIZAH") || cat.includes("MUBTADIAH MUMAYYIZAH")) {
    if (sc.includes("FINNIFAS") || cat.includes("FINNIFAS") || cat.includes("NIFAS")) {
      return "Pendarahan pasca-persalinan Anda melebihi batas maksimal nifas (60 hari). Karena ini adalah persalinan pertama Anda (Mubtadi'ah) dan Anda memiliki perbedaan kualitas sifat fisik darah (kuat seperti merah tua/pekat dan lemah seperti merah muda/kuning) yang memenuhi syarat Tamyiz, maka golongan Anda ditentukan sebagai Mubtadi'ah Mumayyizah Finnifas. Darah kuat dihukumi Nifas dan darah lemah dihukumi Istihadloh.";
    }
    return "Pendarahan Anda melebihi batas maksimal haid (15 hari). Karena Anda belum pernah mengalami haid sebelumnya (Mubtadi'ah) dan saat ini memiliki perbedaan kualitas sifat fisik darah (kuat seperti hitam/merah tua dan lemah seperti merah muda/kuning) yang memenuhi syarat Tamyiz, maka golongan Anda ditentukan sebagai Mubtadi'ah Mumayyizah. Darah kuat dihukumi Haid dan darah lemah dihukumi Istihadloh.";
  }

  // Mu'tadah Mumayyizah
  if (sc.includes("MUTADAH MUMAYYIZAH") || cat.includes("MUTADAH MUMAYYIZAH")) {
    if (sc.includes("FINNIFAS") || cat.includes("FINNIFAS") || cat.includes("NIFAS")) {
      return "Pendarahan pasca-persalinan Anda melebihi batas maksimal nifas (60 hari). Karena Anda sudah memiliki riwayat nifas sebelumnya (Mu'tadah) dan Anda memiliki perbedaan kualitas sifat fisik darah (kuat dan lemah) yang memenuhi syarat Tamyiz, maka golongan Anda ditentukan sebagai Mu'tadah Mumayyizah Finnifas. Darah kuat dihukumi Nifas dan darah lemah dihukumi Istihadloh.";
    }
    return "Pendarahan Anda melebihi batas maksimal haid (15 hari). Karena Anda sudah memiliki adat haid sebelumnya (Mu'tadah) dan saat ini memiliki perbedaan kualitas sifat fisik darah (kuat dan lemah) yang memenuhi syarat Tamyiz, maka golongan Anda ditentukan sebagai Mu'tadah Mumayyizah. Darah kuat dihukumi Haid dan darah lemah dihukumi Istihadloh.";
  }

  // Mubtadi'ah Ghoiru Mumayyizah
  if (sc.includes("MUBTADIAH GHOIRU MUMAYYIZAH") || cat.includes("MUBTADIAH GHOIRU MUMAYYIZAH")) {
    if (sc.includes("FINNIFAS") || cat.includes("FINNIFAS") || cat.includes("NIFAS")) {
      return "Pendarahan pasca-persalinan Anda melebihi batas maksimal nifas (60 hari). Karena ini adalah persalinan pertama Anda (Mubtadi'ah) dan karakter sifat darah Anda monoton/sama rata sehingga tidak memenuhi syarat Tamyiz (Ghoiru Mumayyizah), maka nifas Anda dihukumi sekejap (setetes) dan sisa harinya dihukumi Istihadloh.";
    }
    return "Pendarahan Anda melebihi batas maksimal haid (15 hari). Karena Anda baru pertama kali haid (Mubtadi'ah) dan sifat fisik darah Anda monoton/sama rata sehingga tidak memenuhi syarat Tamyiz (Ghoiru Mumayyizah), maka haid Anda dikembalikan ke batas minimal yaitu 1 hari (24 jam) dan 29 hari berikutnya dihukumi Istihadloh (Siklus 30 hari).";
  }

  // Mutahayyiroh / Nasiyah
  if (sc.includes("MUTAHAYYIROH") || sc.includes("NASIYAH") || cat.includes("MUTAHAYYIROH") || cat.includes("NASIYAH")) {
    if (sc.includes("FINNIFAS") || cat.includes("FINNIFAS") || cat.includes("NIFAS")) {
      return "Pendarahan pasca-persalinan Anda melebihi batas maksimal nifas (60 hari). Karena darah Anda tidak bisa dibedakan (Ghoiru Mumayyizah) dan Anda lupa total durasi serta waktu adat nifas lama Anda (Nasiyah / Mutahayyiroh), maka diterapkan hukum Ihtiyath (kehati-hatian) di mana Anda wajib mandi besar untuk setiap shalat fardhu setelah lewat 60 hari.";
    }
    return "Pendarahan Anda melebihi batas maksimal haid (15 hari). Karena karakter darah tidak dapat dibedakan (Ghoiru Mumayyizah) serta Anda benar-benar lupa durasi (qodr) dan waktu mulai (waqt) adat haid Anda yang lalu, maka Anda termasuk golongan Mutahayyiroh (bingung). Hukum fiqh menetapkan perlunya beribadah dengan penuh kehati-hatian (Ihtiyath).";
  }

  // Dzakiroh li-adatiha qodron wa waqtan (Ingat angka & urutan/ingat adat)
  if (sc.includes("QODRON WA WAQTAN") || cat.includes("QODRON WA WAQTAN") || (sc.includes("DZAKIROH LIADATIHA") && !sc.includes("LA WAQTAN") && !sc.includes("LA QODRON"))) {
    if (sc.includes("FINNIFAS") || cat.includes("FINNIFAS") || cat.includes("NIFAS")) {
      return "Pendarahan pasca-persalinan Anda melebihi batas maksimal nifas (60 hari). Karena darah Anda monoton (Ghoiru Mumayyizah) namun Anda mengingat dengan jelas durasi (qodr) dan waktu mulai (waqt) adat nifas Anda yang lalu, maka ketentuan hukum nifas dikembalikan sepenuhnya kepada adat nifas Anda yang lalu.";
    }
    return "Pendarahan Anda melebihi batas maksimal haid (15 hari). Karena sifat darah Anda monoton (Ghoiru Mumayyizah) namun Anda mengingat dengan jelas durasi (qodr) dan waktu mulai (waqt) adat haid bulanan Anda, maka nifas/haid Anda dikembalikan sepenuhnya kepada durasi adat haid Anda yang lalu.";
  }

  // Dzakiroh li-adatiha waqtan la qodron (Ingat waktu mulai, lupa durasi)
  if (sc.includes("WAQTAN LA QODRON") || cat.includes("WAQTAN LA QODRON")) {
    if (sc.includes("FINNIFAS") || cat.includes("FINNIFAS") || cat.includes("NIFAS")) {
      return "Pendarahan pasca-persalinan Anda melebihi 60 hari dengan karakter darah monoton (Ghoiru Mumayyizah). Karena Anda hanya mengingat waktu mulai adat nifas lalu tetapi lupa durasinya, maka hukum yang diterapkan adalah gabungan kepastian waktu nifas dan Ihtiyath (kehati-hatian).";
    }
    return "Pendarahan Anda melebihi 15 hari dengan karakter darah monoton (Ghoiru Mumayyizah). Karena Anda hanya mengingat waktu mulainya saja (waqt) tetapi lupa durasinya (qodr), maka hukum yang diterapkan adalah kombinasi antara kepastian waktu mulai haid dan kehati-hatian (Ihtiyath) pada hari-hari kemungkinan berakhirnya haid.";
  }

  // Dzakiroh li-adatiha qodron la waqtan (Ingat durasi, lupa waktu mulai)
  if (sc.includes("QODRON LA WAQTAN") || cat.includes("QODRON LA WAQTAN")) {
    if (sc.includes("FINNIFAS") || cat.includes("FINNIFAS") || cat.includes("NIFAS")) {
      return "Pendarahan pasca-persalinan Anda melebihi 60 hari dengan karakter darah monoton (Ghoiru Mumayyizah). Karena Anda hanya mengingat durasi adat nifas lalu tetapi lupa waktu mulainya, maka berlaku hukum Ihtiyath (kehati-hatian) pada hari-hari kemungkinan kemunculannya.";
    }
    return "Pendarahan Anda melebihi 15 hari dengan karakter darah monoton (Ghoiru Mumayyizah). Karena Anda hanya mengingat durasi adat saja (qodr) tetapi lupa tepatnya di tanggal/hari apa mulainya (waqt), maka berlaku hukum Ihtiyath (kehati-hatian) pada hari-hari kemungkinan dimulainya haid tersebut.";
  }

  // Mu'tadah Ghoiru Mumayyizah defaults
  if (sc.includes("MUTADAH GHOIRU MUMAYYIZAH") || cat.includes("MUTADAH GHOIRU MUMAYYIZAH")) {
    return "Pendarahan Anda melebihi batas maksimal haid (15 hari). Karena Anda sudah memiliki riwayat haid sebelumnya (Mu'tadah) namun sifat fisik darah Anda monoton (Ghoiru Mumayyizah), maka masa haid dikembalikan sepenuhnya ke adat haid Anda yang lalu.";
  }

  // Haidl Normal / Nifas Normal
  if (sc.includes("HAIDL NORMAL") || cat.includes("HAIDL NORMAL") || sc.includes("NORMAL HAID")) {
    return hasGaps 
      ? "Darah Anda keluar dalam rentang waktu normal haid (antara 24 jam s.d. 15 hari) dan dipisahkan dengan masa suci/jeda di antaranya, sehingga seluruh hari pendarahan dan masa jeda di antaranya dihukumi sebagai darah haid berdasarkan kaidah Jam'u/Talfiq."
      : "Darah Anda keluar dalam rentang waktu normal haid (antara 24 jam s.d. 15 hari) secara terus-menerus tanpa terputus, sehingga seluruh pendarahan dihukumi sebagai darah haid.";
  }
  if (sc.includes("NIFAS NORMAL") || cat.includes("NIFAS NORMAL") || sc.includes("NORMAL NIFAS")) {
    return hasGaps 
      ? "Pendarahan pasca-melahirkan Anda keluar dalam rentang waktu yang wajar (tidak melebihi batas maksimal nifas 60 hari) dan dipisahkan dengan masa suci/jeda di antaranya, sehingga seluruh hari pendarahan dan masa jeda di antaranya dihukumi sebagai darah nifas berdasarkan kaidah Jam'u/Talfiq."
      : "Pendarahan pasca-melahirkan Anda keluar dalam rentang waktu yang wajar (tidak melebihi batas maksimal nifas 60 hari) secara terus-menerus tanpa terputus, sehingga seluruh pendarahan dihukumi sebagai darah nifas.";
  }

  // Pemisah Siklus Mutlak / Dua Siklus Terpisah
  if (sc.includes("TERPISAH") || cat.includes("TERPISAH") || cat.includes("PEMISAH")) {
    return "Ditemukan jeda bersih/masa suci sebanyak 15 hari atau lebih di sela-sela pendarahan Anda, yang secara hukum fardhu memisahkan pendarahan lama dengan pendarahan baru sebagai dua siklus haid yang berbeda.";
  }

  if (sc.includes("BELUM CUKUP") || cat.includes("BELUM CUKUP")) {
    return "Usia Anda belum genap batas minimal usia haid (9 tahun Hijriyah kurang 16 hari), sehingga seluruh pendarahan yang keluar belum bisa dihukumi sebagai darah haid melainkan darah penyakit (Istihadloh).";
  }

  if (cat.includes("FASAD")) {
    return "Akumulasi darah yang Anda alami di dalam rentang 15 hari jika dijumlahkan ternyata kurang dari batas minimal haid yaitu 24 jam, sehingga pendarahan tersebut digolongkan sebagai darah penyakit / darah rusak (Fasad) dan tidak menggugurkan kewajiban sholat fardlu.";
  }

  return "Penetapan ini didasarkan pada analisis durasi, jeda suci, dan sifat darah Anda terhadap kaidah dasar fikih haid dan nifas menurut Mazhab Syafi'i.";
}

  const finalResult = {
    ...result,
    qadhoObligations: qodloSholat,
    totalQodloPuasa
  };

  const statusTimelineParsed = finalResult.statusTimeline || [];
  const parsedBloodIndices = statusTimelineParsed
    .map((item: any, idx: number) => item.isBlood ? idx : -1)
    .filter((idx: number) => idx !== -1);
  const hasGaps = parsedBloodIndices.length > 1 && 
    (parsedBloodIndices[parsedBloodIndices.length - 1] - parsedBloodIndices[0] + 1) > parsedBloodIndices.length;

  const cleanSpecialNotes = Array.from(new Set(finalResult.specialNotes || []))
    .map((s: string) => s.trim())
    .filter(Boolean);

  const cleanPurification = Array.from(new Set(finalResult.purificationInstructions || []))
    .map((s: string) => s.trim())
    .filter(Boolean);

  const cleanQadho = Array.from(new Set(finalResult.qadhoObligations || []))
    .map((s: string) => s.trim())
    .filter(Boolean);

  return {
    ...finalResult,
    specialNotes: cleanSpecialNotes,
    purificationInstructions: cleanPurification,
    qadhoObligations: cleanQadho,
    categoryReason: getCategoryReason(finalResult.shortCategory || "", finalResult.category || "", hasGaps),
    groupedTimeline: groupTimeline(finalResult.statusTimeline),
    groupedQadho: groupQodlo(cleanQadho)
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

/**
 * ATURAN EMAS HUKUM JAM'U UNTUK MASA BERSIH (NAQO'):
 * Hukum Jam'u TIDAK AKAN PERNAH BERLAKU jika darah yang keluar kembali (setelah masa bersih) berstatus Istihadoh.
 * Masa bersih tersebut harus tetap dihukumi Suci (dan sebaliknya jika dalam masa haid yang sesungguhnya).
 */
/**
 * ATURAN EMAS & BATAS WILAYAH HUKUM JAM'U UNTUK MASA BERSIH (NAQO'):
 * Menentukan batas wilayah haid/nifas secara dinamis, kemudian memindai setiap jeda bersih.
 * Jika jeda bersih berada <= Batas Wilayah ➡️ Dihukumi Haid/Nifas (Hukum Jam'u).
 * Jika jeda bersih berada > Batas Wilayah ➡️ Dihukumi Istihadloh atau Suci (jika tidak ada darah lagi setelahnya).
 */
function applyHukumJamUAturanEmas(
  timeline: any[],
  days: DayStrength[],
  habit: UserHabit,
  context: string,
  experience: string,
  calculationMonthIndex: number = 0,
  isTamyizValid: boolean = false
): any[] {
  if (!timeline || timeline.length === 0) return timeline;

  const maxDays = context === 'nifas' ? 60 : 15;
  const totalSpan = timeline.length;

  // 1. Tentukan Batas Wilayah Haidl / Nifas secara dinamis tanpa hardcoding
  let Batas_Wilayah = maxDays; // Default to max limit (15 for haid, 60 for nifas) for normal case
  
  if (totalSpan > maxDays) {
    if (context === 'nifas') {
      const nifasDurs = habit.durationsNifas && habit.durationsNifas.length > 0 ? habit.durationsNifas : [habit.durationNifas || 40];
      const allSame = nifasDurs.every(d => d === nifasDurs[0]);
      let activeNifasDur = 40;
      if (allSame) {
        activeNifasDur = nifasDurs[0];
      } else {
        activeNifasDur = nifasDurs[nifasDurs.length - 1];
      }
      Batas_Wilayah = Math.min(activeNifasDur || 40, 60);
    } else {
      // Context: Haid
      if (isTamyizValid) {
        const strongDays = days.filter(d => d.isStrong);
        if (strongDays.length > 0) {
          Batas_Wilayah = Math.max(...strongDays.map(d => d.dayNumber));
        } else {
          Batas_Wilayah = habit.duration || 7;
        }
      } else if (experience === 'mubtadiah') {
        Batas_Wilayah = 1; // Standard haid mubtadiah ghoiru mumayyizah
      } else {
        // Mu'tadah or other cases using Adat
        const durs = habit.durations && habit.durations.length > 0 ? habit.durations : [habit.duration || 7];
        Batas_Wilayah = determineActiveAdat(durs, calculationMonthIndex);
      }
      Batas_Wilayah = Math.min(Batas_Wilayah, 15); // Batas maksimal haid berkala
    }
  }

  const corrected = timeline.map((item: any) => ({ ...item }));

  // 2. Pindai (scan) HANYA hari-hari bersih (tidak keluar darah, isBlood === false) untuk menerapkan logika Jam'u diapit darah haid/nifas.
  // JANGAN PERNAH mengubah status hari yang keluar darah (isBlood === true) karena sudah dihitung secara akurat oleh masing-masing fungsi golongan.
  // Juga JANGAN PERNAH mengubah hari yang statusnya 'Ihtiyath' (Masa Kehati-hatian) agar tidak merusak fardh dari kasus Mutahayyiroh atau Lupa Urutan.
  for (let i = 0; i < corrected.length; i++) {
    const current = corrected[i];

    if (!current.isBlood && current.status !== 'Ihtiyath') {
      // Cari darah terdekat sebelumnya yang sah (Haid/Nifas)
      let prevBlood: any = null;
      for (let l = i - 1; l >= 0; l--) {
        if (corrected[l].isBlood) {
          prevBlood = corrected[l];
          break;
        }
      }

      // Cari darah terdekat berikutnya yang sah (Haid/Nifas)
      let nextBlood: any = null;
      for (let r = i + 1; r < corrected.length; r++) {
        if (corrected[r].isBlood) {
          nextBlood = corrected[r];
          break;
        }
      }

      // Syarat diapit darah haid/nifas yang sah:
      // - Berada di dalam wilayah imkan (kemungkinan) haid (day <= Batas_Wilayah)
      // - Ada darah haid/nifas di kiri dan di kanan
      const isDiapitHaid = 
        prevBlood && (prevBlood.status === 'Haid' || prevBlood.status === 'Nifas') &&
        nextBlood && (nextBlood.status === 'Haid' || nextBlood.status === 'Nifas');

      if (isDiapitHaid && current.day <= Batas_Wilayah) {
        current.status = context === 'nifas' ? 'Nifas' : 'Haid';
        current.reason = `Masa berhenti (jeda bersih) di sela-sela ${context === 'nifas' ? 'Nifas' : 'Haid'} (Hukum Jam'u karena diapit oleh darah ${context === 'nifas' ? 'Nifas' : 'Haid'} yang sah dan berada di dalam Wilayah ${context === 'nifas' ? 'Nifas' : 'Haid'} <= ${Batas_Wilayah} hari).`;
      } else {
        // Jika tidak diapit atau berada di luar wilayah haid/nifas, maka dihukumi Suci (tidak ditarik menjadi haid)
        current.status = 'Suci';
        current.reason = `Masa bersih (Hukum Jam'u tidak berlaku karena tidak diapit oleh darah ${context === 'nifas' ? 'Nifas' : 'Haid'} yang aktif/sah atau berada di luar Wilayah ${context === 'nifas' ? 'Nifas' : 'Haid'} > ${Batas_Wilayah} hari).`;
      }
    }
  }

  return corrected;
}
