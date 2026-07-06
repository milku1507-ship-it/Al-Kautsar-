import { EngineContext, FiqhRule } from '../types';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export const BathingRule: FiqhRule = {
  name: 'BathingRule',
  execute: (context: EngineContext) => {
    const phases = context.phases;
    const instructions: string[] = [];

    for (let i = 0; i < phases.length - 1; i++) {
        const current = phases[i];
        const next = phases[i + 1];
        
        const isCurrentHaidOrNifas = current.status === 'Haid' || current.status === 'Nifas';
        const isNextSuciOrIstihadhah = next.status === 'Suci' || next.status === 'Istihadloh';
        
        if (isCurrentHaidOrNifas && isNextSuciOrIstihadhah) {
            instructions.push(
                `Wajib mandi besar (Mandi Wajib) pada ${format(next.startTime, 'dd MMM yyyy, HH:mm', { locale: id })} karena masa ${current.status} telah berakhir (berubah menjadi ${next.status === 'Suci' ? 'Bersih/Suci' : 'Istihadloh'}).`
            );
        }
    }
    
    context.result.purificationInstructions = instructions;
    context.debug.push(`BathingRule: Generated ${instructions.length} instructions.`);
    return context;
  }
};
