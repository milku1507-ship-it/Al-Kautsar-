import { BloodEvent, DayRecord } from '../types';
import { differenceInMinutes, startOfDay, addDays, format, parseISO } from 'date-fns';

export function convertEventsToDayRecords(events: BloodEvent[]): DayRecord[] {
  if (!events || events.length === 0) return [];

  // Sort events by time
  const sortedEvents = [...events].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  
  const records: Record<string, DayRecord> = {};
  
  let currentBlood: { color?: any, texture?: any, aroma?: any } | null = null;
  let lastEventTime: Date | null = null;

  for (const event of sortedEvents) {
    const eventTime = parseISO(event.datetime);
    
    // Process the interval between lastEventTime and eventTime
    if (lastEventTime && currentBlood) {
        let currentDay = startOfDay(lastEventTime);
        const endDay = startOfDay(eventTime);
        
        while (currentDay <= endDay) {
            const dateStr = format(currentDay, 'yyyy-MM-dd');
            if (!records[dateStr]) {
                records[dateStr] = {
                    date: currentDay.toISOString(),
                    status: 'bersih',
                    durationHours: 0,
                    durationMinutes: 0
                };
            }
            
            // Calculate overlap of this day with the [lastEventTime, eventTime] interval
            const dayStart = currentDay;
            const dayEnd = addDays(currentDay, 1);
            
            const overlapStart = lastEventTime > dayStart ? lastEventTime : dayStart;
            const overlapEnd = eventTime < dayEnd ? eventTime : dayEnd;
            
            if (overlapStart < overlapEnd) {
                const diffMins = differenceInMinutes(overlapEnd, overlapStart);
                const existingMins = (records[dateStr].durationHours || 0) * 60 + (records[dateStr].durationMinutes || 0);
                const totalMins = existingMins + diffMins;
                records[dateStr].durationHours = Math.floor(totalMins / 60);
                records[dateStr].durationMinutes = totalMins % 60;
                
                // Keep the property of the last updated blood in this day
                records[dateStr].color = currentBlood.color || records[dateStr].color;
                records[dateStr].texture = currentBlood.texture || records[dateStr].texture;
                records[dateStr].aroma = currentBlood.aroma || records[dateStr].aroma;
                records[dateStr].status = 'darah';
            }
            
            currentDay = addDays(currentDay, 1);
        }
    }
    
    // Update state based on event type
    if (event.eventType === 'START_BLOOD' || event.eventType === 'BLEED_AGAIN' || event.eventType === 'CHANGE_CHARACTERISTIC') {
        // If it's a change, keep previous properties if not specified (though they should be)
        currentBlood = {
            color: event.color || currentBlood?.color,
            texture: event.texture || currentBlood?.texture,
            aroma: event.aroma || currentBlood?.aroma
        };
        lastEventTime = eventTime;
    } else if (event.eventType === 'STOP_BLOOD' || event.eventType === 'CLEAN_PERIOD') {
        currentBlood = null;
        lastEventTime = eventTime;
    }
  }
  
  // Fill in any gaps with 'bersih'
  const dates = Object.keys(records).sort();
  if (dates.length > 0) {
      let current = startOfDay(parseISO(records[dates[0]].date));
      const end = startOfDay(parseISO(records[dates[dates.length - 1]].date));
      
      while (current <= end) {
          const dateStr = format(current, 'yyyy-MM-dd');
          if (!records[dateStr]) {
              records[dateStr] = {
                  date: current.toISOString(),
                  status: 'bersih',
                  durationHours: 0,
                  durationMinutes: 0
              };
          }
          current = addDays(current, 1);
      }
  }

  return Object.values(records).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
