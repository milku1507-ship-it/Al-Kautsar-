import { Engine } from './FiqhEngine';
import { ValidationRule } from './rules/01_ValidationRule';
import { AgeRule } from './rules/02_AgeRule';
import { TimelineRule } from './rules/03_TimelineRule';
import { TamyizRule } from './rules/04_TamyizRule';
import { HabitRule } from './rules/05_HabitRule';
import { IstihadhahRule } from './rules/06_IstihadhahRule';
import { IntermittentRule } from './rules/07_IntermittentRule';
import { BathingRule } from './rules/08_BathingRule';
import { PrayerRule } from './rules/09_PrayerRule';
import { ResultRule } from './rules/10_ResultRule';
import { FiqhAnalysisRequest, FiqhAnalysisResult } from '../../types';

export function runEngine(request: FiqhAnalysisRequest): FiqhAnalysisResult {
  const engine = new Engine()
    .addRule(ValidationRule)
    .addRule(AgeRule)
    .addRule(TimelineRule)
    .addRule(TamyizRule)
    .addRule(HabitRule)
    .addRule(IstihadhahRule)
    .addRule(IntermittentRule)
    .addRule(BathingRule)
    .addRule(PrayerRule)
    .addRule(ResultRule);
    
  return engine.process(request);
}
