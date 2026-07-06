import { EngineContext, FiqhRule } from '../types';

export const ValidationRule: FiqhRule = {
  name: 'ValidationRule',
  execute: (context: EngineContext) => {
    const { request } = context;
    
    if (!request.events || request.events.length === 0) {
      context.validation.isValid = false;
      context.validation.errors.push("Tidak ada data event timeline darah yang dimasukkan.");
      return context;
    }

    if (request.context === 'nifas' && !request.laborDate) {
      context.validation.isValid = false;
      context.validation.errors.push("Tanggal persalinan wajib diisi untuk analisis kasus Nifas.");
      return context;
    }

    // Sort events by datetime
    request.events.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    // Check if the first event is START_BLOOD
    if (request.events[0].eventType !== 'START_BLOOD') {
       // In the original, it's possible to start without it? No, timeline usually starts with start_blood
       // For safety, let's just warn or let TimelineRule handle it.
       context.debug.push("Warning: Event pertama bukan START_BLOOD.");
    }
    
    context.debug.push("Validation passed.");
    return context;
  }
};
