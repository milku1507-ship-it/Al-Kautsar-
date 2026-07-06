import { EngineContext, FiqhRule } from '../types';

export const IstihadhahRule: FiqhRule = {
  name: 'IstihadhahRule',
  execute: (context: EngineContext) => {
    const phases = context.phases;
    
    // Default assignments
    phases.forEach(p => {
       p.status = p.isBlood ? 'Istihadloh' : 'Suci';
    });
    
    if (context.flags.isFasad) {
       context.debug.push("IstihadhahRule: Fasad mode, all blood is Istihadloh.");
       return context;
    }

    if (context.caseType === 'haid') {
       if (context.totalSpanHours <= 360) { // 15 days
           if (context.totalBloodHours < 24) {
               context.flags.isFasad = true;
               context.debug.push("IstihadhahRule: Total blood < 24h, Fasad.");
           } else {
               phases.forEach(p => { if (p.isBlood) p.status = 'Haid'; });
               context.debug.push("IstihadhahRule: Span <= 15 days, all blood is Haid.");
           }
       } else {
           if (context.flags.isTamyizValid) {
               phases.forEach(p => {
                  if (p.isBlood) p.status = p.isStrong ? 'Haid' : 'Istihadloh';
               });
               context.debug.push("IstihadhahRule: Tamyiz applied.");
           } else if (context.experience === 'mutadah' && context.request.habit) {
               const habit = context.request.habit;
               const habitHours = (habit.durasiHari || 0) * 24 + (habit.durasiJam || 0);
               let allowedHaidHours = habitHours > 0 ? habitHours : 24;
               
               if (habit.retrospection === 'ingat_awal_dan_durasi' || habit.retrospection === 'ingat_durasi_saja') {
                   let accumulatedSpan = 0;
                   phases.forEach(p => {
                       if (accumulatedSpan < allowedHaidHours) {
                           if (p.isBlood) p.status = 'Haid';
                       } else {
                           if (p.isBlood) p.status = 'Istihadloh';
                       }
                       accumulatedSpan += p.durationHours;
                   });
                   context.debug.push(`IstihadhahRule: Adat applied (${allowedHaidHours} hours).`);
               } else {
                   phases.forEach(p => { if (p.isBlood) p.status = 'Ihtiyath'; });
                   context.debug.push("IstihadhahRule: Mutahayyirah, applied Ihtiyath.");
               }
           } else {
               let accumulatedSpan = 0;
               phases.forEach(p => {
                   if (accumulatedSpan < 24) {
                       if (p.isBlood) p.status = 'Haid';
                   } else {
                       if (p.isBlood) p.status = 'Istihadloh';
                   }
                   accumulatedSpan += p.durationHours;
               });
               context.debug.push("IstihadhahRule: Mubtadiah applied (24h Haid).");
           }
       }
    } else if (context.caseType === 'nifas') {
       if (context.totalSpanHours <= 1440) { // 60 days
           phases.forEach(p => { if (p.isBlood) p.status = 'Nifas'; });
           context.debug.push("IstihadhahRule: Span <= 60 days, all blood is Nifas.");
       } else {
           let nifasLimitHours = 960; // 40 days
           if (context.experience === 'mutadah' && context.request.habit?.durasiHari) {
               nifasLimitHours = context.request.habit.durasiHari * 24;
           }
           let accumulatedSpan = 0;
           phases.forEach(p => {
               if (accumulatedSpan < nifasLimitHours) {
                   if (p.isBlood) p.status = 'Nifas';
               } else {
                   if (p.isBlood) p.status = 'Istihadloh';
               }
               accumulatedSpan += p.durationHours;
           });
           context.debug.push(`IstihadhahRule: Nifas Istihadhah applied (Limit: ${nifasLimitHours}h).`);
       }
    }
    return context;
  }
};
