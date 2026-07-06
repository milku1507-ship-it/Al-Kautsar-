import { EngineContext, FiqhRule } from '../types';
import { format } from 'date-fns';

interface PrayerInfo {
  name: string;
  startMinutes: number;
}

function getPrayerInfo(date: Date): PrayerInfo {
  const h = date.getHours();
  const m = date.getMinutes();
  const totalMinutes = h * 60 + m;

  if (totalMinutes >= 270 && totalMinutes < 345) return { name: 'Subuh', startMinutes: 270 };
  if (totalMinutes >= 720 && totalMinutes < 915) return { name: 'Dzuhur', startMinutes: 720 };
  if (totalMinutes >= 915 && totalMinutes < 1080) return { name: 'Ashar', startMinutes: 915 };
  if (totalMinutes >= 1080 && totalMinutes < 1155) return { name: 'Maghrib', startMinutes: 1080 };
  if (totalMinutes >= 1155 || totalMinutes < 270) return { name: 'Isya', startMinutes: 1155 };
  
  return { name: 'Luar Waktu', startMinutes: -1 };
}

export const PrayerRule: FiqhRule = {
  name: 'PrayerRule',
  execute: (context: EngineContext) => {
    const phases = context.phases;
    context.result.groupedQadho = context.result.groupedQadho || [];
    
    if (phases.length === 0) return context;

    // 1. Qadha at start of bleeding
    const firstPhase = phases[0];
    if (firstPhase.isBlood && context.request.hasPerformedPrayerBeforeBleeding === false) {
       const info = getPrayerInfo(firstPhase.startTime);
       if (info.name !== 'Luar Waktu') {
          const h = firstPhase.startTime.getHours();
          const m = firstPhase.startTime.getMinutes();
          const nowMin = h * 60 + m;
          let diff = nowMin - info.startMinutes;
          if (info.name === 'Isya' && nowMin < 270) diff = (nowMin + 1440) - info.startMinutes;
          
          if (diff >= 15) {
             context.result.groupedQadho.push({
                 startDay: 1,
                 endDay: 1,
                 startDate: format(firstPhase.startTime, "yyyy-MM-dd"),
                 endDate: format(firstPhase.startTime, "yyyy-MM-dd"),
                 message: `Qadha Sholat ${info.name} (Awal): Darah datang pada ${format(firstPhase.startTime, 'HH:mm')} dan Anda belum sholat padahal waktu sudah berlalu cukup untuk bersuci & sholat.`
             });
          }
       }
    }

    // 2. Qadha for transitions from Haid/Nifas to Suci/Istihadloh
    for (let i = 0; i < phases.length - 1; i++) {
        const current = phases[i];
        const next = phases[i + 1];
        
        const isCurrentHaidOrNifas = current.status === 'Haid' || current.status === 'Nifas';
        const isNextSuciOrIstihadhah = next.status === 'Suci' || next.status === 'Istihadloh';
        
        if (isCurrentHaidOrNifas && isNextSuciOrIstihadhah) {
            const info = getPrayerInfo(next.startTime);
            if (info.name !== 'Luar Waktu') {
               const timeStr = format(next.startTime, 'HH:mm');
               const dateStr = format(next.startTime, "yyyy-MM-dd");
               let msg = "";
               if (info.name === 'Ashar') {
                   msg = `Qadha Sholat Ashar & Dzuhur: Darah berhenti/berubah status pada ${timeStr} (Waktu Ashar). Wajib jama' qadha dengan Dzuhur.`;
               } else if (info.name === 'Isya') {
                   msg = `Qadha Sholat Isya & Maghrib: Darah berhenti/berubah status pada ${timeStr} (Waktu Isya). Wajib jama' qadha dengan Maghrib.`;
               } else {
                   msg = `Qadha Sholat ${info.name}: Darah berhenti/berubah status pada ${timeStr} (Waktu ${info.name}).`;
               }
               context.result.groupedQadho.push({
                   startDay: i + 1,
                   endDay: i + 1,
                   startDate: dateStr,
                   endDate: dateStr,
                   message: msg
               });
            }
        }
    }

    // 3. Qadha for Istihadhah phases
    phases.forEach((p, idx) => {
       if (p.status === 'Istihadloh') {
           const dateStr = format(p.startTime, "yyyy-MM-dd");
           context.result.groupedQadho!.push({
               startDay: idx + 1,
               endDay: idx + 1,
               startDate: dateStr,
               endDate: format(p.endTime, "yyyy-MM-dd"),
               message: `Qadha Masa Istihadloh: Anda wajib mengqadha seluruh sholat fardhu yang ditinggalkan selama fase yang dihukumi Istihadloh ini.`
           });
       }
    });
    
    return context;
  }
};
