import { EngineContext, FiqhRule } from '../types';
import { format } from 'date-fns';

export const ResultRule: FiqhRule = {
  name: 'ResultRule',
  execute: (context: EngineContext) => {
    context.result.statusTimeline = context.phases.map((p, idx) => ({
       day: idx + 1,
       date: format(p.startTime, 'yyyy-MM-dd'),
       status: p.isBlood ? 'Haid' : 'Suci',
       reason: `Durasi: ${p.durationHours.toFixed(1)} jam. Warna: ${p.color || '-'}. Kuat: ${p.isStrong ? 'Ya' : 'Tidak'}`
    }));
    
    context.result.analysis = `Pipeline Test: Total Jam = ${context.totalSpanHours.toFixed(1)}, Tamyiz Valid = ${context.flags.isTamyizValid} (${context.flags.tamyizReason || 'Memenuhi Syarat'}).`;
    context.result.category = "Refactor In Progress";
    context.result.shortCategory = "WIP";
    context.result.legalBasis = "Aturan Fikih belum diaktifkan sepenuhnya.";
    
    context.debug.push("ResultRule completed.");
    return context;
  }
};
