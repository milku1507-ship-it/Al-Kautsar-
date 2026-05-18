import { FiqhAnalysisRequest, FiqhAnalysisResult } from "../types";
import { analyzeFiqhLocal } from "./localAnalyzer";

export async function analyzeFiqh(data: FiqhAnalysisRequest): Promise<FiqhAnalysisResult> {
  // Seluruh analisis sekarang dilakukan secara lokal (Offline First)
  // Tidak memerlukan Gemini API atau LLM eksternal.
  return new Promise((resolve) => {
    setTimeout(() => {
      const result = analyzeFiqhLocal(data);
      resolve(result);
    }, 800); // Simulasi pemrosesan cepat untuk UX
  });
}
