import { EngineContext, FiqhRule } from '../types';

export const HabitRule: FiqhRule = {
  name: 'HabitRule',
  execute: (context: EngineContext) => {
    if (context.experience !== 'mutadah' || !context.request.habit) {
      context.debug.push("HabitRule: Not Mutadah or no habit data.");
      return context;
    }
    
    const habit = context.request.habit;
    context.debug.push(`HabitRule: Mutadah with retrospection [${habit.retrospection}].`);
    
    // We just ensure the habit is properly stored and logged.
    // The actual application of the habit duration will be done in IstihadhahRule.
    
    return context;
  }
};
