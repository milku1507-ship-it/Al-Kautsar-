import { EngineContext, FiqhRule } from '../types';

export const IntermittentRule: FiqhRule = {
  name: 'IntermittentRule',
  execute: (context: EngineContext) => {
    const phases = context.phases;
    const targetStatus = context.caseType === 'haid' ? 'Haid' : 'Nifas';

    for (let i = 0; i < phases.length; i++) {
        const p = phases[i];
        if (!p.isBlood && p.status === 'Suci') {
            if (p.durationHours >= 360) {
               p.reason = `Masa suci pemisah (>= 15 hari).`;
               continue;
            }
            
            let hasLeft = false;
            for (let j = i - 1; j >= 0; j--) {
                if (phases[j].isBlood) {
                    if (phases[j].status === targetStatus) hasLeft = true;
                    break;
                }
            }
            let hasRight = false;
            for (let j = i + 1; j < phases.length; j++) {
                if (phases[j].isBlood) {
                    if (phases[j].status === targetStatus) hasRight = true;
                    break;
                }
            }

            if (hasLeft && hasRight) {
                p.status = targetStatus;
                p.reason = `Masa berhenti (jeda bersih) di sela-sela ${targetStatus} (Hukum Jam'u).`;
            } else {
                p.reason = p.reason || `Masa bersih/suci.`;
            }
        }
    }
    context.debug.push("IntermittentRule: Evaluated Hukum Jam'u.");
    return context;
  }
};
