import { EngineContext, FiqhRule, Phase } from '../types';

export const TamyizRule: FiqhRule = {
  name: 'TamyizRule',
  execute: (context: EngineContext) => {
    // Tamyiz only applies if span > 15 days (360 hours) in Haid, 
    // or > 60 days (1440 hours) in Nifas (Wait, nifas has tamyiz too, but let's stick to standard).
    // Actually, we can just calculate if Tamyiz conditions are met, regardless of span.
    
    const phases = context.phases;
    
    // 1. Must have at least two distinct blood types (at least one strong, at least one weak)
    const strongPhases = phases.filter(p => p.isBlood && p.isStrong);
    const weakPhases = phases.filter(p => p.isBlood && !p.isStrong);
    
    if (strongPhases.length === 0 || weakPhases.length === 0) {
       context.flags.isTamyizValid = false;
       context.flags.tamyizReason = "Tidak ada variasi sifat darah kuat dan lemah.";
       context.debug.push("Tamyiz failed: No strong/weak variation.");
       return context;
    }

    // Group adjacent strong phases and adjacent weak phases to form sessions
    const sessions: { type: 'strong'|'weak', durationHours: number, startHour: number, endHour: number }[] = [];
    
    let currentSession: any = null;
    let runningHour = 0;
    
    for (const p of phases) {
       const type = p.isStrong ? 'strong' : 'weak';
       
       if (currentSession && currentSession.type === type) {
          currentSession.durationHours += p.durationHours;
          currentSession.endHour = runningHour + p.durationHours;
       } else {
          if (currentSession) sessions.push(currentSession);
          currentSession = {
             type,
             durationHours: p.durationHours,
             startHour: runningHour,
             endHour: runningHour + p.durationHours
          };
       }
       runningHour += p.durationHours;
    }
    if (currentSession) sessions.push(currentSession);
    
    // Check constraints
    const strongSessions = sessions.filter(s => s.type === 'strong');
    
    for (const s of strongSessions) {
       // Minimal darah kuat 24 jam (1 hari 1 malam)
       if (s.durationHours < 24) {
          context.flags.isTamyizValid = false;
          context.flags.tamyizReason = "Darah kuat kurang dari 24 jam.";
          context.debug.push("Tamyiz failed: Strong blood < 24h.");
          return context;
       }
       // Maksimal darah kuat 15 hari (360 jam)
       if (s.durationHours > 360) {
          context.flags.isTamyizValid = false;
          context.flags.tamyizReason = "Darah kuat melebihi 15 hari.";
          context.debug.push("Tamyiz failed: Strong blood > 15 days.");
          return context;
       }
    }
    
    // Check gap between two strong sessions
    for (let i = 0; i < sessions.length; i++) {
       if (sessions[i].type === 'strong') {
          for (let j = i + 1; j < sessions.length; j++) {
             if (sessions[j].type === 'strong') {
                const intermediate = sessions.slice(i, j + 1);
                const totalSpan = intermediate.reduce((acc, s) => acc + s.durationHours, 0);
                
                if (totalSpan > 360) { // If total span > 15 days
                   // Then the weak gap MUST be >= 15 days (360 hours)
                   let weakHours = 0;
                   for (let k = i + 1; k < j; k++) {
                      if (sessions[k].type === 'weak') {
                         weakHours += sessions[k].durationHours;
                      }
                   }
                   if (weakHours < 360) {
                      context.flags.isTamyizValid = false;
                      context.flags.tamyizReason = "Pemisah darah lemah antara dua darah kuat kurang dari 15 hari (masa suci minimal).";
                      context.debug.push("Tamyiz failed: Weak gap between strongs < 15 days when span > 15 days.");
                      return context;
                   }
                }
                break; // Only check the next adjacent strong session
             }
          }
       }
    }

    context.flags.isTamyizValid = true;
    context.debug.push("Tamyiz logic evaluated to TRUE.");
    return context;
  }
};
