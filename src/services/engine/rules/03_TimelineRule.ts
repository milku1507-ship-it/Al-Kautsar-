import { EngineContext, FiqhRule, Phase } from '../types';
import { differenceInMinutes, parseISO } from 'date-fns';

const COLOR_RANK: Record<string, number> = { hitam: 1, merah: 2, coklat: 3, kuning: 4, keruh: 5 };
const TEXTURE_RANK: Record<string, number> = { kental: 0, cair: 1 };
const AROMA_RANK: Record<string, number> = { busuk: 0, tidak_busuk: 1 };

function getStrengthScore(color: string = 'merah', texture: string = 'cair', aroma: string = 'tidak_busuk'): number {
  return (COLOR_RANK[color] || 2) * 10 + (TEXTURE_RANK[texture] || 1) * 2 + (AROMA_RANK[aroma] || 1);
}

export const TimelineRule: FiqhRule = {
  name: 'TimelineRule',
  execute: (context: EngineContext) => {
    const events = context.request.events;
    const phases: Phase[] = [];
    
    let currentPhase: Partial<Phase> | null = null;
    let totalBloodHours = 0;
    
    for (let i = 0; i < events.length; i++) {
       const event = events[i];
       const date = parseISO(event.datetime);
       
       if (currentPhase) {
          currentPhase.endTime = date;
          const mins = differenceInMinutes(date, currentPhase.startTime as Date);
          currentPhase.durationHours = mins / 60;
          
          if (currentPhase.durationHours > 0) {
             phases.push(currentPhase as Phase);
             if (currentPhase.isBlood) {
                totalBloodHours += currentPhase.durationHours;
             }
          }
       }
       
       if (event.eventType === 'STOP_BLOOD' || event.eventType === 'CLEAN_PERIOD') {
          if (i < events.length - 1) {
             currentPhase = {
                id: `phase_${i}`,
                startTime: date,
                isBlood: false,
                status: 'Suci'
             };
          } else {
             currentPhase = null;
          }
       } else {
          currentPhase = {
             id: `phase_${i}`,
             startTime: date,
             isBlood: true,
             color: event.color,
             texture: event.texture,
             aroma: event.aroma,
             strengthScore: getStrengthScore(event.color, event.texture, event.aroma)
          };
       }
    }

    // Determine strongest blood
    let minScore = 999;
    phases.forEach(p => {
       if (p.isBlood && p.strengthScore !== undefined && p.strengthScore < minScore) {
          minScore = p.strengthScore;
       }
    });

    phases.forEach(p => {
       if (p.isBlood && p.strengthScore === minScore) {
          p.isStrong = true;
       } else {
          p.isStrong = false;
       }
    });
    
    // Check if intermittent
    let bloodPhaseCount = 0;
    phases.forEach(p => { if (p.isBlood) bloodPhaseCount++; });
    context.flags.isIntermittent = bloodPhaseCount > 1;

    context.phases = phases;
    context.totalBloodHours = totalBloodHours;
    
    if (phases.length > 0) {
       const firstStart = phases[0].startTime;
       const lastEnd = phases[phases.length - 1].endTime;
       context.totalSpanHours = differenceInMinutes(lastEnd, firstStart) / 60;
    } else {
       context.totalSpanHours = 0;
    }
    
    context.debug.push(`Timeline formed: ${phases.length} phases. Span: ${context.totalSpanHours.toFixed(1)}h, Blood: ${totalBloodHours.toFixed(1)}h. Intermittent: ${context.flags.isIntermittent}`);
    return context;
  }
};
