import { EngineContext, FiqhRule } from '../types';

export const AgeRule: FiqhRule = {
  name: 'AgeRule',
  execute: (context: EngineContext) => {
    const { request } = context;
    
    // Nifas doesn't require age validation generally, but let's just do it for haid 
    // or set a flag if invalid. The user rules say: if age is invalid, all blood is Fasad/Istihadloh.
    
    const totalDays = (request.ageYears * 354.367) + (request.ageMonths * 29.53) + request.ageDays;
    const minimumDays = (9 * 354.367) - 16;
    
    if (request.context === 'haid' && totalDays < minimumDays) {
       context.flags.isDanq = true; // Wait, actually it's just Fasad / Belum Cukup Usia
       context.debug.push("Usia belum cukup. Semua darah dianggap Fasad.");
       // We can either fail validation, or we can just proceed and mark everything as Istihadhah.
       // The instruction says: "Jika belum cukup umur -> Fasad/Istihadloh".
       // We will set a flag so the result rule can just stamp it as Fasad.
       context.flags.isFasad = true;
       context.result.shortCategory = "Istihadloh (Belum Cukup Umur)";
       context.result.category = "Darah Keluar Sebelum Usia Haid";
       context.result.analysis = "Usia Anda belum genap batas minimal usia haid (9 tahun Hijriyah kurang 16 hari), sehingga seluruh pendarahan yang keluar belum bisa dihukumi sebagai darah haid melainkan darah penyakit (Istihadloh).";
       
       // Force validation to false to stop pipeline since output is fully determined?
       // Let's do that for now to bypass complex logic if it's 100% istihadloh.
       context.validation.isValid = false; 
       context.validation.errors.push(context.result.analysis);
    } else {
       context.debug.push("Usia mencukupi.");
    }
    
    return context;
  }
};
