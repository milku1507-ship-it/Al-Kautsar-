import { EngineContext, FiqhRule } from './types';
import { FiqhAnalysisRequest, FiqhAnalysisResult } from '../../types';

export class Engine {
  private rules: FiqhRule[] = [];

  addRule(rule: FiqhRule) {
    this.rules.push(rule);
    return this;
  }

  process(request: FiqhAnalysisRequest): FiqhAnalysisResult {
    let context: EngineContext = {
      request,
      result: {
        statusTimeline: [],
        purificationInstructions: [],
        qadhoObligations: [],
        specialNotes: []
      },
      debug: [],
      caseType: request.context,
      experience: request.experience,
      phases: [],
      totalSpanHours: 0,
      totalBloodHours: 0,
      validation: {
        isValid: true,
        errors: []
      },
      flags: {
        isTamyizValid: false,
        isFasad: false,
        isDanq: false
      }
    };

    for (const rule of this.rules) {
      context.debug.push(`[Rule] Executing ${rule.name}...`);
      context = rule.execute(context);
      
      if (!context.validation.isValid) {
        context.debug.push(`[Rule] ${rule.name} failed validation. Stopping execution.`);
        context.result.analysis = context.validation.errors.join('\\n');
        context.result.category = "Error";
        context.result.shortCategory = "Error";
        context.result.legalBasis = "Data tidak valid";
        break;
      }
    }

    // Default formatting if result wasn't populated by final rule
    const finalResult = context.result as FiqhAnalysisResult;
    if (!finalResult.analysis) {
        finalResult.analysis = "Proses selesai.";
        finalResult.category = "Selesai";
        finalResult.shortCategory = "Selesai";
        finalResult.legalBasis = "Data berhasil diproses";
    }
    
    // Inject debug info into specialNotes if in dev mode
    // (Or we can just expose it in result directly)
    if (process.env.NODE_ENV === 'development') {
        finalResult.specialNotes = [
            ...(finalResult.specialNotes || []),
            "DEBUG PIPELINE:",
            ...context.debug
        ];
    }

    return finalResult;
  }
}
