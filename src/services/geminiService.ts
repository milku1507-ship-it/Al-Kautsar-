import { FiqhAnalysisRequest, FiqhAnalysisResult } from "../types";
import { runEngine } from "./engine";
// import { analyzeFiqhLocal } from "./localAnalyzer";

export async function analyzeFiqh(data: FiqhAnalysisRequest): Promise<FiqhAnalysisResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Use the new rule engine!
      const result = runEngine(data);
      resolve(result);
    }, 800); 
  });
}
