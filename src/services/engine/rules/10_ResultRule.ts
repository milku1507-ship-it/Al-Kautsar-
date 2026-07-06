import { EngineContext, FiqhRule } from '../types';
import { format } from 'date-fns';

function groupTimeline(timeline: { day: number; date?: string; status: string; reason: string }[]) {
  if (timeline.length === 0) return [];
  const groups: { startDay: number; endDay: number; startDate?: string; endDate?: string; status: any; reason: string }[] = [];
  let currentGroup = { ...timeline[0], startDay: timeline[0].day, endDay: timeline[0].day, startDate: timeline[0].date, endDate: timeline[0].date };

  for (let i = 1; i < timeline.length; i++) {
    const item = timeline[i];
    if (item.status === currentGroup.status) {
      currentGroup.endDay = item.day;
      currentGroup.endDate = item.date;
    } else {
      groups.push({
        startDay: currentGroup.startDay,
        endDay: currentGroup.endDay,
        startDate: currentGroup.startDate,
        endDate: currentGroup.endDate,
        status: currentGroup.status as any,
        reason: currentGroup.reason
      });
      currentGroup = { ...item, startDay: item.day, endDay: item.day, startDate: item.date, endDate: item.date };
    }
  }
  groups.push({
    startDay: currentGroup.startDay,
    endDay: currentGroup.endDay,
    startDate: currentGroup.startDate,
    endDate: currentGroup.endDate,
    status: currentGroup.status as any,
    reason: currentGroup.reason
  });
  return groups;
}

export const ResultRule: FiqhRule = {
  name: 'ResultRule',
  execute: (context: EngineContext) => {
    const phases = context.phases;
    
    // Status Timeline Mapping
    const statusTimeline = phases.map((p, idx) => ({
       day: idx + 1,
       date: format(p.startTime, 'yyyy-MM-dd HH:mm'),
       status: p.status as any,
       reason: p.reason || `Durasi: ${p.durationHours.toFixed(1)} jam. Warna: ${p.color || '-'}.`
    }));
    
    context.result.statusTimeline = statusTimeline;
    context.result.groupedTimeline = groupTimeline(statusTimeline);

    // Category and Basis
    let shortCat = "Analisis Selesai";
    let cat = "Berdasarkan Aturan Fikih";
    let analysis = "";

    if (context.flags.isFasad) {
       shortCat = "Darah Fasad (Istihadloh)";
       cat = "Tidak Memenuhi Syarat Haid";
       analysis = "Pendarahan tidak memenuhi batas minimal haid (24 jam) atau usia belum mencukupi. Seluruh darah dihukumi sebagai darah penyakit (Istihadloh).";
    } else if (context.caseType === 'haid') {
       if (context.totalSpanHours <= 360) {
           shortCat = "Haid Normal";
           cat = "Pendarahan <= 15 Hari";
           analysis = "Seluruh pendarahan berada dalam batas maksimal haid (15 hari).";
       } else {
           if (context.flags.isTamyizValid) {
               shortCat = "Istihadloh (Tamyiz)";
               cat = "Mumayyizah";
               analysis = "Pendarahan melampaui 15 hari, namun Anda dapat membedakan sifat darah (Tamyiz). Darah kuat dihukumi Haid, darah lemah dihukumi Istihadloh.";
           } else if (context.experience === 'mutadah') {
               shortCat = "Istihadloh (Adat)";
               cat = "Mu'tadah Ghoiru Mumayyizah";
               analysis = "Pendarahan melampaui 15 hari dan syarat Tamyiz tidak terpenuhi. Hukum dikembalikan pada kebiasaan (Adat) haid Anda sebelumnya.";
           } else {
               shortCat = "Istihadloh (Mubtadiah)";
               cat = "Mubtadiah Ghoiru Mumayyizah";
               analysis = "Pendarahan melampaui 15 hari pada wanita yang baru pertama kali haid tanpa syarat Tamyiz yang sah. Haid dikembalikan pada batas minimal (24 jam).";
           }
       }
    } else {
       if (context.totalSpanHours <= 1440) {
           shortCat = "Nifas Normal";
           cat = "Pendarahan <= 60 Hari";
           analysis = "Seluruh pendarahan berada dalam batas maksimal nifas (60 hari).";
       } else {
           shortCat = "Istihadloh Nifas";
           cat = "Pendarahan Melampaui 60 Hari";
           analysis = "Pendarahan melampaui batas maksimal nifas. Masa nifas dikembalikan pada kebiasaan atau batas standar, selebihnya adalah Istihadloh.";
       }
    }

    if (context.flags.isIntermittent) {
        analysis += " Terdapat jeda bersih di sela-sela darah yang diselesaikan dengan Hukum Jam'u.";
    }

    context.result.shortCategory = shortCat;
    context.result.category = cat;
    context.result.analysis = analysis;
    context.result.legalBasis = "Kitab Risalatul Mahidl & Taqrirotus Sadidah";

    return context;
  }
};
