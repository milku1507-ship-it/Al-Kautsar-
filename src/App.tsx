import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Header from './components/Header';
import ArticleList from './components/articles/ArticleList';
import ArticleDetail from './components/articles/ArticleDetail';
import ArticleEditor from './components/articles/ArticleEditor';
import AdminAuth from './components/AdminAuth';
import { 
  Calendar, 
  ChevronRight, 
  ChevronLeft, 
  Clock, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  Droplet, 
  History,
  FileText,
  RefreshCw,
  Send,
  Save,
  Activity,
  Menu,
  X,
  Target,
  Baby,
  Trash2,
  Sun,
  Moon,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addDays, 
  startOfToday, 
  isSameDay, 
  parseISO, 
  eachDayOfInterval, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  addMonths, 
  subMonths,
  isBefore,
  isAfter
} from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from './lib/utils';
import { checkIfMumayyizah, countUniqueBloodAttributes } from './services/localAnalyzer';
import { 
  CalculationContext, 
  ExperienceStatus, 
  DayRecord, 
  UserHabit, 
  FiqhAnalysisRequest, 
  FiqhAnalysisResult,
  BloodColor,
  BloodTexture,
  BloodAroma
} from './types';
import { analyzeFiqh } from './services/geminiService';
import { calculateHijriAge } from './lib/hijriUtils';

export default function App() {
  const location = useLocation();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<FiqhAnalysisResult | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [isQodloOpen, setIsQodloOpen] = useState(false);

  // Step 1: Profil Dasar
  const [birthDateMasehi, setBirthDateMasehi] = useState('');
  const [ageYears, setAgeYears] = useState(20);
  const [ageMonths, setAgeMonths] = useState(0);
  const [ageDays, setAgeDays] = useState(0);
  const [context, setContext] = useState<CalculationContext>('haid');
  const [experience, setExperience] = useState<ExperienceStatus>('mutadah');
  const [laborDate, setLaborDate] = useState<string>('');
  const [isRamadhan, setIsRamadhan] = useState(false);
  const [isFirstMonthIstihadloh, setIsFirstMonthIstihadloh] = useState(true);
  const [monthIndex, setMonthIndex] = useState(0);

  // Step 2: Kalender Darah
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 4, 1)); // Mei 2026

  const [lastClickedDate, setLastClickedDate] = useState<Date | null>(null);

  const resetCalendar = () => {
    if (window.confirm("Apakah Anda yakin ingin mereset seluruh kalender? Semua data darah akan dihapus.")) {
      setRecords([]);
      setLastClickedDate(null);
      setSelectedDate(null);
    }
  };

  // Step 3: Riwayat Adat
  const [habit, setHabit] = useState<UserHabit>({
    retrospection: 'ingat_semua',
    duration: 7,
    lastCycleStart: ''
  });

  const [adatInput, setAdatInput] = useState('');

  // Theme Support
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const isMumayyizah = useMemo(() => checkIfMumayyizah(records), [records]);
  const uniqueBloodCount = useMemo(() => countUniqueBloodAttributes(records), [records]);

  // Step 4: Konteks Waktu
  const [startTime, setStartTime] = useState('00:00');
  const [stopTime, setStopTime] = useState('00:00');
  const [hasPerformed, setHasPerformed] = useState(false);

  const addDayRecord = (date: Date, template?: Partial<DayRecord>) => {
    const dateStr = date.toISOString();
    setRecords(prev => {
      const exists = prev.find(r => isSameDay(parseISO(r.date), date));
      if (exists && !template) return prev.filter(r => !isSameDay(parseISO(r.date), date));
      
      const newRecord = { 
        date: dateStr, 
        status: 'darah' as const,
        color: template?.color || exists?.color || 'merah' as BloodColor,
        texture: template?.texture || exists?.texture || 'cair' as BloodTexture,
        aroma: template?.aroma || exists?.aroma || 'tidak_busuk' as BloodAroma
      };

      if (exists) {
        return prev.map(r => isSameDay(parseISO(r.date), date) ? newRecord : r);
      }
      return [...prev, newRecord];
    });
  };

  const removeDayRecord = (date: Date) => {
    setRecords(prev => prev.filter(r => !isSameDay(parseISO(r.date), date)));
  };

  const updateDayRecord = (date: Date, updates: Partial<DayRecord>) => {
    setRecords(prev => prev.map(r => 
      isSameDay(parseISO(r.date), date) ? { ...r, ...updates } : r
    ));
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const data: FiqhAnalysisRequest = {
        ageYears, ageMonths, ageDays,
        context, experience,
        records, habit,
        startTime, stopTime,
        laborDate,
        isRamadhan,
        hasPerformedPrayerBeforeBleeding: hasPerformed,
        isFirstMonthIstihadloh,
        calculationMonthIndex: monthIndex
      };
      const res = await analyzeFiqh(data);
      setResult(res);
      setStep(5);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Terjadi kesalahan saat menganalisis data.");
    } finally {
      setIsLoading(false);
    }
  };

  const allSteps = [
    { id: 1, name: "Profil Dasar", description: "Masukkan data awal & kondisi" },
    { id: 2, name: "Kalender Darah", description: "Tentukan karakteristik darah harian" },
    { id: 3, name: "Riwayat Adat", description: "Atur ingatan kebiasaan siklus", hideFor: ['mubtadiah'] },
    { id: 4, name: "Konteks Waktu", description: "Detail waktu sholat & berhenti" },
    { id: 5, name: "Hasil Analisis", description: "Output hukum & qodho" },
  ];

  const steps = allSteps.filter(s => {
    if (s.id === 3) {
      if (context === 'nifas') return true;
      if (experience === 'mubtadiah') return false;
    }
    return true;
  });
  const currentStep = allSteps.find(s => s.id === step) || allSteps[0];

  const renderStepNav = () => (
    <div className="space-y-6">
      {steps.filter(s => s.id < 5).map((s, idx) => (
        <button 
          key={s.id} 
          onClick={() => {
            setStep(s.id);
            setIsSidebarOpen(false);
          }}
          className={cn(
          "flex items-center gap-3 transition-colors w-full",
          step === s.id ? "text-accent" : (step > s.id ? "text-text-contrast/80" : "text-slate-500")
        )}>
          <div className={cn(
            "w-6 h-6 rounded-full border flex items-center justify-center text-[10px] font-bold",
            step === s.id ? "border-accent" : (step > s.id ? "border-text-contrast/40" : "border-slate-700")
          )}>
            {(idx + 1).toString().padStart(2, '0')}
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider">{s.name}</span>
        </button>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">TANGGAL LAHIR</h3>
        <input 
            type="date"
            value={birthDateMasehi}
            onChange={e => {
                const date = e.target.value;
                setBirthDateMasehi(date);
                if (date) {
                    const age = calculateHijriAge(date);
                    setAgeYears(age.years);
                    setAgeMonths(age.months);
                    setAgeDays(age.days);
                }
            }}
            max={new Date().toISOString().split('T')[0]}
            className="w-full bg-bg-card border border-border-main p-2.5 md:p-3 rounded-lg text-sm text-text-contrast focus:outline-none focus:border-accent"
        />
        <div className="p-3 bg-accent/10 border border-accent/20 rounded-lg text-sm text-text-contrast font-bold italic">
           Usia Hijriyah Anda: {ageYears} Tahun, {ageMonths} Bulan, {ageDays} Hari
        </div>
        
        {ageYears < 9 && (
          <div className="p-3 bg-red-950/20 border border-red-900/50 rounded-lg flex gap-3 text-[10px] text-red-400 italic">
            <AlertCircle className="w-3 h-3 flex-shrink-0" />
            <span>Usia minimal untuk Haid adalah 9 tahun Qomariyah kurang 16 hari.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Kondisi Awal</h3>
          <div className="flex gap-3">
            <button 
              onClick={() => setContext('haid')}
              className={cn(
                "flex-1 py-4 md:py-6 px-3 md:px-4 rounded-xl border transition-all flex flex-col items-center gap-2 md:gap-3",
                context === 'haid' ? "border-red-500 bg-red-950/20 text-red-400" : "border-border-main bg-bg-card hover:border-red-900/50"
              )}
            >
              <Droplet className="w-5 h-5 md:w-6 md:h-6" />
              <span className="text-xs font-black uppercase tracking-widest">Haid</span>
            </button>
            <button 
              onClick={() => setContext('nifas')}
              className={cn(
                "flex-1 py-4 md:py-6 px-3 md:px-4 rounded-xl border transition-all flex flex-col items-center gap-2 md:gap-3",
                context === 'nifas' ? "border-purple-500 bg-purple-950/20 text-purple-400" : "border-border-main bg-bg-card hover:border-purple-900/50"
              )}
            >
              <Droplet className="w-5 h-5 md:w-6 md:h-6" />
              <span className="text-xs font-black uppercase tracking-widest">Nifas</span>
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Status Pengalaman</h3>
          <div className="flex gap-3">
            <button 
              onClick={() => setExperience('mubtadiah')}
              className={cn(
                "flex-1 py-4 md:py-6 px-3 md:px-4 rounded-xl border transition-all flex flex-col items-center gap-2 md:gap-3",
                experience === 'mubtadiah' ? "border-blue-500 bg-blue-950/20 text-blue-400" : "border-border-main bg-bg-card hover:border-blue-900/50"
              )}
            >
              <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
              <span className="text-xs font-black uppercase tracking-widest">Mubtadi'ah</span>
            </button>
            <button 
              onClick={() => setExperience('mutadah')}
              className={cn(
                "flex-1 py-4 md:py-6 px-3 md:px-4 rounded-xl border transition-all flex flex-col items-center gap-2 md:gap-3",
                experience === 'mutadah' ? "border-green-500 bg-green-950/20 text-green-400" : "border-border-main bg-bg-card hover:border-green-900/50"
              )}
            >
              <History className="w-5 h-5 md:w-6 md:h-6" />
              <span className="text-xs font-black uppercase tracking-widest">Mu'tadah</span>
            </button>
          </div>
          
          <AnimatePresence>
            {context === 'nifas' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="pt-4 border-t border-border-main space-y-4 overflow-hidden"
              >
                <div className="p-4 bg-blue-950/20 border border-blue-900/50 rounded-xl space-y-4">
                  <h4 className="text-xs font-black text-blue-400 uppercase tracking-widest">Informasi Tambahan Nifas</h4>
                  <div className="space-y-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Waktu Persalinan</h3>
                    <div className="space-y-2">
                      <label className="text-[10px] text-slate-400 uppercase">Input Tanggal & Jam PERSALINAN</label>
                      <input 
                        type="datetime-local" 
                        value={laborDate} 
                        onChange={e => setLaborDate(e.target.value)}
                        className="w-full bg-bg-card border border-border-main p-3 rounded-xl text-sm text-text-contrast focus:outline-none focus:border-accent"
                      />
                      <p className="text-[9px] text-slate-500 italic">Dibutuhkan untuk menghitung batas maksimal nifas 60 hari.</p>
                    </div>

                    <div className="pt-4 border-t border-border-main/20">
                      <p className="text-[10px] text-slate-400 mb-3 uppercase font-bold text-blue-400">Pernah Haidl Sebelumnya?</p>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => setHabit({...habit, pernahHaid: false})}
                          className={cn(
                            "flex-1 py-3 px-2 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all",
                            habit.pernahHaid === false ? "bg-red-500 text-white border-red-500" : "bg-bg-card text-slate-500 border-border-main"
                          )}
                        >
                          Belum Pernah
                        </button>
                        <button 
                          onClick={() => setHabit({...habit, pernahHaid: true})}
                          className={cn(
                            "flex-1 py-3 px-2 rounded-lg border text-[9px] font-bold uppercase tracking-widest transition-all",
                            habit.pernahHaid === true ? "bg-emerald-500 text-white border-emerald-500" : "bg-bg-card text-slate-500 border-border-main"
                          )}
                        >
                          Sudah Pernah
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="md:col-span-2 pt-6 border-t border-border-main">
            <button 
                onClick={() => setIsRamadhan(!isRamadhan)}
                className={cn(
                    "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                    isRamadhan ? "bg-emerald-950/20 border-emerald-500 text-emerald-400" : "bg-bg-card border-border-main text-slate-500"
                )}
            >
                <div className="flex items-center gap-3">
                    <Target className={cn("w-5 h-5", isRamadhan ? "text-emerald-500" : "text-slate-500")} />
                    <div className="text-left">
                        <div className="text-xs font-black uppercase tracking-widest leading-none">Bulan Ramadhan / Puasa Wajib</div>
                        <div className="text-[9px] lowercase opacity-60 mt-1">Aktifkan untuk kalkulasi qodlo puasa otomatis</div>
                    </div>
                </div>
                <div className={cn(
                    "w-10 h-5 rounded-full relative transition-colors",
                    isRamadhan ? "bg-emerald-500" : "bg-slate-800"
                )}>
                    <div className={cn(
                        "absolute top-1 w-3 h-3 bg-white rounded-full transition-transform",
                        isRamadhan ? "translate-x-6" : "translate-x-1"
                    )} />
                </div>
            </button>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => {
    const monthStart = startOfMonth(currentCalendarDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Senin
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const prevMonth = () => {
      const nextDate = subMonths(currentCalendarDate, 1);
      if (nextDate.getFullYear() === 2026) setCurrentCalendarDate(nextDate);
    };

    const nextMonth = () => {
      const nextDate = addMonths(currentCalendarDate, 1);
      if (nextDate.getFullYear() === 2026) setCurrentCalendarDate(nextDate);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-card p-4 rounded-xl border border-border-main">
          <div className="flex items-center gap-4">
            <button 
              onClick={prevMonth}
              disabled={currentCalendarDate.getMonth() === 0}
              className="p-2 hover:bg-slate-800 rounded-lg disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-base font-black uppercase tracking-widest min-w-[120px] text-center">
              {format(currentCalendarDate, 'MMMM yyyy', { locale: id })}
            </h3>
            <button 
              onClick={nextMonth}
              disabled={currentCalendarDate.getMonth() === 11}
              className="p-2 hover:bg-slate-800 rounded-lg disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={resetCalendar}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-950/20 text-red-500 border border-red-900/30 rounded-lg text-[10px] font-bold uppercase hover:bg-red-900/30 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" /> Reset Kalender
          </button>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border-main border border-border-main rounded-lg overflow-hidden translate-z-0">
          {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Aha'].map((d, idx) => (
            <div key={`${d}-${idx}`} className="bg-bg-card p-2 text-center text-[9px] font-black text-slate-500 uppercase">
              {d}
            </div>
          ))}
          {calendarDays.map((d, i) => {
            const dateStr = d.toISOString().split('T')[0];
            const record = records.find(r => isSameDay(parseISO(r.date), d));
            const isCurrentMonth = isSameMonth(d, monthStart);
            const isLaborDay = laborDate && isSameDay(d, parseISO(laborDate));
            const isAnchor = lastClickedDate && isSameDay(d, lastClickedDate);

            return (
              <button
                key={i}
                onClick={() => {
                  const isSameAsLast = lastClickedDate && isSameDay(d, lastClickedDate);
                  
                  if (lastClickedDate && !isSameAsLast) {
                    // LOGIKA RENTANG OTOMATIS
                    const start = lastClickedDate;
                    const end = d;
                    const interval = eachDayOfInterval({
                      start: start < end ? start : end,
                      end: start < end ? end : start
                    });
                    
                    const anchorRecord = records.find(r => isSameDay(parseISO(r.date), lastClickedDate));
                    const template = anchorRecord ? { 
                      color: anchorRecord.color, 
                      texture: anchorRecord.texture, 
                      aroma: anchorRecord.aroma 
                    } : undefined;

                    interval.forEach(date => {
                        if (anchorRecord) addDayRecord(date, template);
                        else removeDayRecord(date);
                    });
                    
                    setLastClickedDate(null);
                  } else {
                    // Toggle harian: Bersih -> Darah -> Bersih
                    if (record) {
                        removeDayRecord(d);
                        setLastClickedDate(null);
                    } else {
                        addDayRecord(d);
                        setLastClickedDate(d);
                    }
                  }
                  
                  setSelectedDate(d);
                }}
                className={cn(
                  "aspect-square p-1 relative transition-all text-left flex flex-col group",
                  !isCurrentMonth ? "bg-bg-main/50 opacity-30" : "bg-bg-main hover:bg-bg-card",
                  record && "bg-red-950/20 border-2 border-red-500/30",
                  isLaborDay && "bg-purple-950/30 border-2 border-purple-500/50",
                  isAnchor && "ring-2 ring-accent ring-inset"
                )}
              >
                <span className={cn(
                  "text-[10px] font-bold", 
                  record ? "text-text-contrast" : (isLaborDay ? "text-purple-400" : "text-slate-600")
                )}>
                  {format(d, 'd')}
                </span>
                
                {isLaborDay && (
                  <div className="absolute top-1 right-1">
                    <Baby className="w-3 h-3 text-purple-500" />
                  </div>
                )}

                {isAnchor && !isLaborDay && (
                  <div className="absolute top-1 right-1 flex gap-0.5">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-ping" />
                    <div className="w-1.5 h-1.5 bg-accent rounded-full absolute" />
                  </div>
                )}

                {record && (
                  <div className="absolute inset-x-1 bottom-1 flex flex-col gap-0.5 pointer-events-none">
                    <div className={cn(
                      "w-full h-1 rounded-full",
                      record.color === 'hitam' ? "bg-black" :
                      record.color === 'merah' ? "bg-red-600" :
                      record.color === 'coklat' ? "bg-amber-900" :
                      record.color === 'kuning' ? "bg-yellow-400" : "bg-slate-500"
                    )} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 items-center justify-center p-4 bg-bg-card/50 rounded-xl border border-border-main/50">
            <div className="flex items-center gap-1.5 grayscale opacity-50">
                <div className="w-2 h-2 bg-slate-800 rounded-sm" />
                <span className="text-[9px] uppercase font-bold text-slate-500">Suci</span>
            </div>
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-red-600 rounded-sm" />
                <span className="text-[9px] uppercase font-bold text-slate-500">Berdarah</span>
            </div>
            <p className="text-[9px] text-slate-400 italic w-full text-center mt-2 leading-relaxed">
                <span className="text-accent font-bold">Cara Cepat:</span> Tap satu tanggal sebagai awal, lalu tap tanggal lain untuk mengisi semua hari di antaranya secara otomatis.
            </p>
        </div>

        {selectedDate && records.find(r => isSameDay(parseISO(r.date), selectedDate)) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-bg-card rounded-xl border border-border-main space-y-6"
          >
            <div className="flex justify-between items-center border-b border-border-main pb-4">
              <h3 className="text-base font-black uppercase tracking-widest text-accent">
                Detail Karakteristik: {format(selectedDate, 'd MMMM yyyy', { locale: id })}
              </h3>
              <button onClick={() => setSelectedDate(null)} className="text-xs uppercase font-black text-slate-500 hover:text-text-contrast">Tutup</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-slate-500">Warna (Hierarki Tamyiz)</label>
                <select 
                  className="w-full bg-bg-main border border-border-main p-2 rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  value={records.find(r => isSameDay(parseISO(r.date), selectedDate))?.color}
                  onChange={(e) => updateDayRecord(selectedDate, { color: e.target.value as BloodColor })}
                >
                  <option value="hitam">Hitam (Paling Kuat)</option>
                  <option value="merah">Merah</option>
                  <option value="coklat">Coklat</option>
                  <option value="kuning">Kuning</option>
                  <option value="keruh">Keruh (Paling Lemah)</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-slate-500">Tekstur</label>
                <select 
                  className="w-full bg-bg-main border border-border-main p-2 rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  value={records.find(r => isSameDay(parseISO(r.date), selectedDate))?.texture}
                  onChange={(e) => updateDayRecord(selectedDate, { texture: e.target.value as BloodTexture })}
                >
                  <option value="kental">Kental (Lebih Kuat)</option>
                  <option value="cair">Cair</option>
                </select>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black uppercase text-slate-500">Aroma</label>
                <select 
                  className="w-full bg-bg-main border border-border-main p-2 rounded-lg text-xs text-white focus:outline-none focus:border-accent"
                  value={records.find(r => isSameDay(parseISO(r.date), selectedDate))?.aroma}
                  onChange={(e) => updateDayRecord(selectedDate, { aroma: e.target.value as BloodAroma })}
                >
                  <option value="busuk">Beraroma Busuk (Kuat)</option>
                  <option value="tidak_busuk">Tidak Beraroma</option>
                </select>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  const renderDetectionBanner = () => {
    if (uniqueBloodCount === 1) {
      return (
        <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex flex-col md:flex-row items-center gap-6 mb-8">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-1">Terdeteksi: Ghoiru Mumayyizah</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
              Sistem mendeteksi Anda memasukkan darah dengan satu sifat/karakteristik yang sama secara terus-menerus. Dalam kondisi ini (Gagal Tamyiz), hukum fiqh akan mutlak menggunakan **Kebiasaan (Adat)** Anda sebelumnya sebagai acuan. Mohon isi data riwayat adat Anda dengan teliti di bawah ini.
            </p>
          </div>
        </div>
      );
    }
    if (uniqueBloodCount > 1) {
      return (
        <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex flex-col md:flex-row items-center gap-6 mb-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-sm font-bold text-emerald-500 uppercase tracking-widest mb-1">Terdeteksi: Mumayyizah</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-lg">
              Sistem mendeteksi Anda memasukkan lebih dari satu sifat darah. Jika syarat pendarahannya terpenuhi, hukum akan memprioritaskan karakter darah (**Tamyiz**). Namun, silakan tetap lengkapi data Adat di bawah ini sebagai rujukan (fallback) apabila syarat Tamyiz Anda batal.
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderStep3 = () => {
    // 1. ATURAN MUTLAK MUBTADIAH (Tidak Punya Adat)
    if (experience === 'mubtadiah') {
      if (context === 'nifas') {
        // Pengecualian Khusus Nifas (Golongan N2): 
        // Tidak tanya Adat Nifas, TAPI wajib tanya Riwayat Haidl (Pernah Haid / Belum Pernah)
        return (
          <div className="space-y-8">
            {renderDetectionBanner()}
            <div className="space-y-6 p-6 bg-blue-950/10 border border-blue-900/50 rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
                <Droplet className="w-4 h-4" /> Riwayat Adat Haidl (Mustahadloh Nifas)
              </h3>
              
              <div className="space-y-4">
                <p className="text-[10px] text-slate-500 uppercase font-black">Apakah Anda sudah pernah mengalami Haidl sebelumnya?</p>
                <div className="flex gap-4">
                  <button 
                    onClick={() => setHabit({...habit, pernahHaid: false})}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                      habit.pernahHaid === false ? "bg-bg-card text-blue-400 border-blue-900" : "bg-bg-card text-slate-500 border-border-main"
                    )}
                  >
                    Belum Pernah
                  </button>
                  <button 
                    onClick={() => setHabit({...habit, pernahHaid: true})}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all",
                      habit.pernahHaid === true ? "bg-blue-500 text-white border-blue-500" : "bg-bg-card text-slate-500 border-border-main"
                    )}
                  >
                    Sudah Pernah
                  </button>
                </div>
              </div>

              {habit.pernahHaid && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-slate-500">Kebiasaan Haidl (Hari)</label>
                    <input 
                      type="number" 
                      value={habit.duration || ''}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        setHabit({ ...habit, duration: val, durations: [val] });
                      }}
                      className="w-full bg-bg-card border border-blue-900/30 p-4 rounded-xl text-xl text-blue-400 focus:outline-none focus:border-blue-500 text-center"
                      placeholder="7"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-slate-500">Kebiasaan Suci (Hari)</label>
                    <input 
                      type="number" 
                      value={habit.habitSuci || ''}
                      onChange={e => setHabit({...habit, habitSuci: parseInt(e.target.value) || 0})}
                      className="w-full bg-bg-card border border-blue-900/30 p-4 rounded-xl text-xl text-blue-400 focus:outline-none focus:border-blue-500 text-center"
                      placeholder="25"
                    />
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        );
      }
      
      return (
        <div className="space-y-8">
          {renderDetectionBanner()}
          <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-slate-800/30 flex items-center justify-center text-slate-500 mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <p className="text-sm font-black uppercase tracking-widest text-slate-500">Status: Mubtadi'ah</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
              Sebagai pemula yang baru pertama kali mengalami haid, Anda tidak memiliki riwayat adat untuk diinput. Silakan lanjut ke tahap berikutnya.
            </p>
          </div>
        </div>
      );
    }

    // 2. ATURAN MUTLAK MU'TADAH (Sudah Punya Adat)
    // Kondisi 2A: Terdeteksi MUMAYYIZAH (isMumayyizah === true)
    if (isMumayyizah) {
      return (
        <div className="space-y-8">
          {renderDetectionBanner()}
          <div className="space-y-6">
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <p className="text-xs text-slate-400 leading-relaxed italic">
                Karena darah Anda memiliki **Tamyiz**, hukum memprioritaskan karakter darah daripada kebiasaan. Input angka ini hanya sebagai cadangan apabila syarat Tamyiz nantinya gagal.
              </p>
            </div>

            <div className={cn("grid gap-6", context === 'nifas' ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                  Durasi Kebiasaan {context === 'nifas' ? 'Nifas' : 'Haid'} (Hari)
                </h3>
                <input 
                  type="number" 
                  value={(context === 'nifas' ? habit.durationNifas : habit.duration) || ''}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0;
                    if (context === 'nifas') {
                      setHabit({...habit, durationNifas: val, durationsNifas: [val]});
                    } else {
                      setHabit({...habit, duration: val, durations: [val], retrospection: 'ingat_durasi'});
                    }
                  }}
                  className="w-full bg-bg-card border border-border-main p-6 rounded-2xl text-3xl font-black text-center text-text-contrast focus:outline-none focus:border-accent"
                  placeholder="Contoh: 7"
                />
              </div>

              {context === 'nifas' && (
                <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Durasi Kebiasaan Haid (Hari)</h3>
                  <input 
                    type="number" 
                    value={habit.duration || ''}
                    onChange={e => setHabit({...habit, duration: parseInt(e.target.value) || 0, durations: [parseInt(e.target.value) || 0]})}
                    className="w-full bg-bg-card border border-border-main p-6 rounded-2xl text-3xl font-black text-center text-text-contrast focus:outline-none focus:border-accent"
                    placeholder="Contoh: 7"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    // Kondisi 2B: Terdeteksi GHOIRU MUMAYYIZAH (isMumayyizah === false)
    if (context === 'nifas') {
      const nifasRetrospectionOptions = [
        { id: 'ingat_semua', label: 'Ingat Durasi & Waktu Mulai Nifas' },
        { id: 'ingat_durasi', label: 'Ingat Durasi, Lupa Waktu Mulai (N6)' },
        { id: 'ingat_waktu', label: 'Ingat Waktu Mulai, Lupa Durasi (N7)' },
        { id: 'lupa_semua', label: 'Lupa Semuanya (N5 - Nasiyah)' },
      ];

      return (
        <div className="space-y-8">
          {renderDetectionBanner()}
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-4 text-center">
            <p className="text-xs text-slate-400 leading-relaxed italic">
              Karena Anda **gagal Tamyiz** (darah satu warna), hukum mutlak dikembalikan kepada detail ingatan kebiasaan Anda sebelumnya.
            </p>
          </div>
          
          <div className="space-y-6 p-6 bg-emerald-950/10 border border-emerald-900/50 rounded-2xl">
            <h3 className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
              <History className="w-4 h-4" /> Riwayat Adat Nifas (Persalinan Sebelumnya)
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {nifasRetrospectionOptions.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setHabit({...habit, retrospection: item.id as any})}
                     className={cn(
                      "py-3 px-4 rounded-xl border text-xs font-black uppercase tracking-wider transition-all text-left",
                    habit.retrospection === item.id 
                      ? "bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20" 
                      : "bg-bg-card text-emerald-500 border-emerald-900/40 hover:border-emerald-500/50"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {habit.retrospection !== 'lupa_semua' && habit.retrospection !== 'ingat_waktu' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="flex justify-between items-end">
                  <p className="text-xs text-slate-500 uppercase font-black">Durasi Nifas (Hari)</p>
                  <p className="text-[9px] text-slate-500 italic">Satu kali nifas sudah bisa jadi pedoman.</p>
                </div>
                <input 
                  type="text" 
                  placeholder="Contoh: 40, 45  atau  40"
                  value={habit.durationsNifas?.join(', ') || ''}
                  onChange={e => {
                    const val = e.target.value;
                    const nums = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                    setHabit({ ...habit, durationsNifas: nums, durationNifas: nums[nums.length - 1] });
                  }}
                  className="w-full bg-bg-card border border-emerald-900/30 p-4 rounded-xl text-lg text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </motion.div>
            )}

            {habit.retrospection === 'ingat_waktu' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-3">
                <div className="flex gap-3">
                  <Clock className="w-4 h-4 text-emerald-500 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest">Hanya Ingat Waktu Mulai (N7)</p>
                    <p className="text-[10px] text-slate-500 italic mt-1 leading-relaxed">
                      Hari Pertama (Waktu Mulai) dihukumi YAKIN NIFAS. Hari ke-2 sampai ke-60 dihukumi IHTIYATH.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {habit.pernahHaid && (
            <div className="space-y-6 p-6 bg-blue-950/10 border border-blue-900/50 rounded-2xl">
              <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
                <Droplet className="w-4 h-4" /> Riwayat Adat Haidl (Siklus Normal Anda)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase text-slate-500">Kebiasaan Haidl (Hari)</label>
                  <input 
                    type="number" 
                    value={habit.duration || ''}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setHabit({ ...habit, duration: val, durations: [val] });
                    }}
                    className="w-full bg-bg-card border border-blue-900/30 p-4 rounded-xl text-lg text-blue-400 focus:outline-none focus:border-blue-500 text-center"
                    placeholder="7"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase text-slate-500">Kebiasaan Suci (Hari)</label>
                  <input 
                    type="number" 
                    value={habit.habitSuci || ''}
                    onChange={e => setHabit({...habit, habitSuci: parseInt(e.target.value) || 0})}
                    className="w-full bg-bg-card border border-blue-900/30 p-4 rounded-xl text-xl text-blue-400 focus:outline-none focus:border-blue-500 text-center"
                    placeholder="Contoh: 25"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (!habit.habitType) {
      return (
        <div className="space-y-6 md:space-y-8">
          {renderDetectionBanner()}
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-4 text-center">
            <p className="text-xs text-slate-400 leading-relaxed italic">
              Karena Anda **gagal Tamyiz** (darah satu warna), hukum mutlak dikembalikan kepada detail ingatan kebiasaan Anda sebelumnya.
            </p>
          </div>
          <div className="space-y-4 text-center py-10">
            <h3 className="text-base font-black uppercase tracking-widest text-slate-500 mb-2">Sifat Kebiasaan Haid</h3>
            <p className="text-[10px] text-slate-500 italic max-w-lg mx-auto mb-8">
              Catatan: Adat haidl yang dijadikan acuan bisa diambil dari kebiasaan haidl yang normal, maupun dari pengadatan haidl lewat tamyiz pada bulan-bulan sebelumnya.
            </p>
            <p className="text-slate-400 text-sm mb-12">Apakah durasi kebiasaan haidl Anda sebelumnya selalu tetap (sama) atau berubah-ubah?</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <button 
                onClick={() => {
                  setHabit({ ...habit, habitType: 'TETAP' });
                  setAdatInput(habit.duration ? habit.duration.toString() : '');
                }}
                className="p-8 rounded-2xl border-2 border-border-main bg-bg-card hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group flex flex-col items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="text-left text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-emerald-500">Adat Tetap</div>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase">Tidak Berubah</div>
                </div>
              </button>
              <button 
                onClick={() => {
                  setHabit({ ...habit, habitType: 'BERUBAH' });
                  setAdatInput(habit.durations ? habit.durations.join(', ') : '');
                }}
                className="p-8 rounded-2xl border-2 border-border-main bg-bg-card hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group flex flex-col items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                  <RefreshCw className="w-6 h-6" />
                </div>
                <div className="text-left text-center">
                  <div className="text-xs font-bold uppercase tracking-widest text-amber-500">Adat Berubah</div>
                  <div className="text-[10px] text-slate-500 mt-1 uppercase">Berubah-ubah</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      );
    }

    const retrospectionOptions = habit.habitType === 'TETAP'
      ? [
          { 
            id: 'ingat_semua', 
            label: context === 'nifas' ? 'Ingat Durasi & Waktu Mulai Nifas' : 'Ingat Durasi & Waktu Mulai',
            desc: 'Anda tahu persis durasi (misal: 7 hari) dan waktu/jam mulai haid tersebut.' 
          },
          { 
            id: 'ingat_durasi', 
            label: context === 'nifas' ? 'Hanya Ingat Durasi Nifas, Lupa Waktu Mulai' : 'Hanya Ingat Durasi',
            desc: 'Anda ingat jumlah harinya (misal: 7 hari), tapi lupa jam atau tanggal mulainya.' 
          },
          { 
            id: 'ingat_waktu', 
            label: context === 'nifas' ? 'Hanya Ingat Waktu Mulai Nifas, Lupa Durasi' : 'Hanya Ingat Waktu Mulai',
            desc: 'Anda ingat kapan haid mulai, tapi benar-benar lupa durasinya (Dohlul Waqti).' 
          },
          { 
            id: 'lupa_semua', 
            label: 'Lupa Semuanya (Mutahayyiroh)', 
            desc: 'Lupa angka harinya dan lupa kapan biasanya haid mulai (Mutlaqoh).' 
          },
        ]
      : [
          { 
            id: 'ingat_semua', 
            label: 'Ingat Urutan Putaran / Ingat Bulan Terakhir',
            desc: 'Pilih ini jika Anda ingat urutan haid secara pasti, atau minimal ingat jumlah haid persis di bulan terakhir.',
            onClick: () => setHabit({ ...habit, retrospection: 'ingat_semua' as any, lupaUrutan: false })
          },
          { 
            id: 'ingat_angka_lupa_urutan', 
            label: 'Ingat Angka, Tapi Lupa Urutan / Bulan Terakhir',
            desc: 'Pilih ini jika Anda ingat angka-angkanya (misal 3, 5, dan 7), tapi lupa sekarang giliran yang mana.',
            onClick: () => setHabit({ ...habit, retrospection: 'ingat_angka_lupa_urutan' as any, lupaUrutan: true })
          },
          { 
            id: 'lupa_semua', 
            label: 'Lupa Semuanya (Mutahayyiroh)',
            desc: 'Pilih ini jika Anda sama sekali tidak ingat angka durasi haid Anda.',
            onClick: () => setHabit({ ...habit, retrospection: 'lupa_semua' as any, durations: [] })
          },
        ];

    return (
      <div className="space-y-6 md:space-y-8">
        {renderDetectionBanner()}
        <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-4 text-center">
          <p className="text-xs text-slate-400 leading-relaxed italic">
            Karena Anda **gagal Tamyiz** (darah satu warna), hukum mutlak dikembalikan kepada detail ingatan kebiasaan Anda sebelumnya.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setHabit({ ...habit, habitType: undefined, retrospection: 'ingat_semua', lupaUrutan: false })}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-text-contrast transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> Kembali ke Pilihan Sifat Adat
          </button>
          
          <div className="group relative">
            <Info className="w-4 h-4 text-slate-500 cursor-help" />
            <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-bg-side border border-border-main rounded-lg text-[10px] text-slate-400 italic shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
              Catatan: Adat haidl yang dijadikan acuan bisa diambil dari kebiasaan haidl yang normal, maupun dari pengadatan haidl lewat tamyiz pada bulan-bulan sebelumnya.
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 flex items-center justify-between">
            <span>Retrospeksi Ingatan</span>
            <span className={cn(
              "text-[10px] px-2 py-0.5 rounded border",
              habit.habitType === 'TETAP' ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10" : "border-amber-500/30 text-amber-400 bg-amber-500/10"
            )}>
              Adat {habit.habitType}
            </span>
          </h3>
          <div className="grid grid-cols-1 gap-3 md:gap-4">
            {retrospectionOptions.map((item) => (
              <button
                key={item.id}
                onClick={item.onClick || (() => {
                  setHabit({ ...habit, retrospection: item.id as any });
                  setAdatInput('');
                })}
                className={cn(
                  "p-5 md:p-6 rounded-xl border border-border-main text-left transition-all flex flex-col gap-1",
                  habit.retrospection === item.id ? "bg-bg-card border-accent text-accent" : "bg-bg-main text-slate-400 hover:border-slate-700 hover:text-text-contrast"
                )}
              >
                <span className="text-xs font-black uppercase tracking-wider">{item.label}</span>
                <span className="text-[10px] opacity-60 font-normal leading-relaxed">{item.desc}</span>
              </button>
            ))}
          </div>

          {(habit.habitType === 'BERUBAH' && habit.retrospection !== 'lupa_semua') && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 mt-8">
              <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                {habit.retrospection === 'ingat_semua' ? 'Urutan Durasi Haidl (Pisahkan Koma)' : 'Daftar Angka Durasi Haidl (Pisahkan Koma)'}
              </h3>
              <input 
                type="text" 
                placeholder="Contoh: 3, 5, 7"
                value={adatInput}
                onChange={e => {
                  const val = e.target.value;
                  setAdatInput(val);
                  const nums = val.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
                  setHabit({ ...habit, durations: nums, duration: nums[nums.length - 1] });
                }}
                className="w-full bg-bg-card border border-border-main p-4 rounded-xl text-lg text-text-contrast focus:outline-none focus:border-accent"
              />
            </motion.div>
          )}

          {habit.habitType === 'TETAP' && habit.retrospection === 'ingat_durasi' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 mt-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Durasi Kebiasaan (Hari)</label>
                  <input 
                    type="number" 
                    value={habit.duration || ''}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setHabit({...habit, duration: val, durations: [val]});
                    }}
                    className="w-full bg-bg-card border border-border-main p-4 rounded-xl text-lg text-text-contrast focus:outline-none focus:border-accent"
                    placeholder="Contoh: 5"
                  />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Rentang Waktu Kebiasaan (Hari)</label>
                  <input 
                    type="number" 
                    value={habit.timeRange || ''}
                    onChange={e => setHabit({...habit, timeRange: parseInt(e.target.value) || 0})}
                    className="w-full bg-bg-card border border-border-main p-4 rounded-xl text-lg text-text-contrast focus:outline-none focus:border-accent"
                    placeholder="Contoh: 10"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Hari Yang Diyakini Pasti Suci (Tanggal Masa Adat)</label>
                <input 
                  type="number" 
                  value={habit.knownPureDay || ''}
                  onChange={e => setHabit({...habit, knownPureDay: parseInt(e.target.value) || 0})}
                  className="w-full bg-bg-card border border-border-main p-4 rounded-xl text-lg text-text-contrast focus:outline-none focus:border-accent"
                  placeholder="Contoh: 1"
                />
                <p className="text-[10px] text-slate-500 italic">Masukkan tanggal relatif dalam siklus di mana Anda yakin 100% sedang suci.</p>
              </div>
            </motion.div>
          )}

          {habit.habitType === 'TETAP' && habit.retrospection === 'ingat_semua' && (
             <div className="mt-8 space-y-4">
               <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Durasi Haidl Kebiasaan (Hari)</h3>
               <input 
                type="number" 
                placeholder="Contoh: 7"
                value={habit.duration || ''}
                onChange={e => {
                  const val = parseInt(e.target.value) || 0;
                  setHabit({ ...habit, duration: val, durations: [val] });
                }}
                className="w-full bg-bg-card border border-border-main p-4 rounded-xl text-lg text-text-contrast focus:outline-none focus:border-accent"
              />
             </div>
          )}

          {habit.habitType === 'TETAP' && habit.retrospection === 'ingat_waktu' && (
            <div className="p-4 bg-bg-card border border-accent/20 rounded-xl mt-8">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-accent shrink-0" />
                <p className="text-[10px] text-slate-400 leading-relaxed italic">
                  Anda memilih "**Hanya Ingat Waktu Mulai**". Sistem akan menetapkan hari pertama (D1) pada kalender sebagai masa yakin haidl, dan hari ke-2 s/d 15 sebagai masa **IHTIYATH** (berhati-hati).
                </p>
              </div>
            </div>
          )}

          {habit.retrospection === 'lupa_semua' && (
            <div className="space-y-4 mt-8">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-[10px] text-amber-500/80 leading-relaxed italic">
                  Status: **Mutahayyiroh Mutlaqoh**. Karena lupa kadar dan waktu, hukum fikih mewajibkan Anda untuk **IHTIYATH** (berhati-hati) di setiap waktu: Wajib sholat & puasa, tapi juga wajib mandi untuk setiap sholat fardhu.
                </p>
              </div>
              
              <button 
                onClick={() => setHabit({ ...habit, ingatWaktuBerhenti: !habit.ingatWaktuBerhenti })}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-xl border transition-all",
                  habit.ingatWaktuBerhenti ? "bg-accent/10 border-accent text-accent" : "bg-bg-card border-border-main text-slate-500"
                )}
              >
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5" />
                  <div className="text-left">
                    <div className="text-[10px] font-bold uppercase tracking-widest">Ingat Waktu Berhenti?</div>
                    <div className="text-[9px] lowercase opacity-60">Pilih jika Anda ingat jam biasanya darah berhenti (Inqo')</div>
                  </div>
                </div>
                <div className={cn(
                  "w-8 h-4 rounded-full relative transition-colors",
                  habit.ingatWaktuBerhenti ? "bg-accent" : "bg-slate-700"
                )}>
                  <div className={cn(
                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform",
                    habit.ingatWaktuBerhenti ? "translate-x-4" : "translate-x-1"
                  )} />
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const bleedingRange = useMemo(() => {
    if (records.length === 0) return 0;
    const dates = records.map(r => parseISO(r.date).getTime());
    const min = Math.min(...dates);
    const max = Math.max(...dates);
    return Math.floor((max - min) / (1000 * 60 * 60 * 24)) + 1;
  }, [records]);

  const showIstihadlohToggle = useMemo(() => {
    if (context === 'haid' && bleedingRange > 15) return true;
    if (context === 'nifas' && bleedingRange > 60) return true;
    return false;
  }, [context, bleedingRange]);

  const renderStep4 = () => (
    <div className="space-y-6 md:space-y-8">
      {showIstihadlohToggle && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Konfigurasi Istihadloh</h3>
            
            <button 
                onClick={() => setIsFirstMonthIstihadloh(!isFirstMonthIstihadloh)}
                className={cn(
                    "w-full flex items-center gap-3 p-5 rounded-2xl border transition-all",
                    isFirstMonthIstihadloh ? "bg-blue-950/20 border-blue-500 text-blue-400" : "bg-bg-card border-border-main text-slate-500"
                )}
            >
                <div className={cn(
                    "w-6 h-6 rounded-lg border flex items-center justify-center",
                    isFirstMonthIstihadloh ? "bg-blue-500 border-blue-500" : "border-slate-700"
                )}>
                {isFirstMonthIstihadloh && <CheckCircle2 className="w-4 h-4 text-bg-main" />}
                </div>
                <div className="text-left">
                    <div className="text-sm font-black uppercase tracking-widest leading-none">Bulan Pertama Istihadloh</div>
                    <div className="text-[10px] lowercase opacity-60 mt-2">Centang jika ini bulan pertama Anda mengalami pendarahan panjang (lebih 15 hari)</div>
                </div>
            </button>
            
            {!isFirstMonthIstihadloh && (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-5 bg-bg-card border border-border-main rounded-2xl">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Bulan Ke-berapa Istihadloh Berlangsung?</div>
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setMonthIndex(Math.max(0, monthIndex - 1))}
                            className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-xl hover:bg-slate-700 font-bold transition-colors"
                        >
                            -
                        </button>
                        <div className="px-6 py-2 bg-bg-main border border-border-main rounded-xl min-w-[100px] text-center font-black text-lg text-accent">
                            Bulan {monthIndex + 1}
                        </div>
                        <button 
                            onClick={() => setMonthIndex(monthIndex + 1)}
                            className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-xl hover:bg-slate-700 font-bold transition-colors"
                        >
                            +
                        </button>
                    </div>
                </motion.div>
            )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-12">
        <div className="space-y-4 text-center p-6 md:p-8 bg-bg-card rounded-2xl border border-border-main">
          <Clock className="w-6 h-6 md:w-8 md:h-8 text-accent mx-auto mb-2" />
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Waktu Darah Mulai</h3>
            <input 
              type="time" 
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
              className="w-full bg-bg-main border border-border-main p-3 md:p-4 rounded-xl text-xl md:text-2xl text-center text-text-contrast focus:outline-none focus:border-accent"
            />
          <p className="text-[9px] md:text-[10px] text-slate-400 leading-relaxed italic">
            Audit kewajiban sholat awal.
          </p>
          
          <button 
            onClick={() => setHasPerformed(!hasPerformed)}
            className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg border transition-all mt-4",
                hasPerformed ? "bg-accent/10 border-accent/30 text-accent" : "bg-bg-main border-border-main text-slate-500"
            )}
          >
            <div className={cn(
                "w-4 h-4 rounded border flex items-center justify-center",
                hasPerformed ? "bg-accent border-accent" : "border-slate-700"
            )}>
                {hasPerformed && <CheckCircle2 className="w-3 h-3 text-bg-main" />}
            </div>
            <span className="text-xs font-black uppercase tracking-tight">Saya sudah sholat fardlu di waktu ini</span>
          </button>
        </div>
        <div className="space-y-4 text-center p-6 md:p-8 bg-bg-card rounded-2xl border border-border-main">
          <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center mx-auto mb-2">
            <div className="w-1.5 h-6 md:w-2 md:h-8 bg-accent/20 rounded-full relative">
              <div className="absolute bottom-0 left-0 w-full h-1/2 bg-accent rounded-full" />
            </div>
          </div>
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Waktu Darah Berhenti</h3>
          <input 
            type="time" 
            value={stopTime}
            onChange={e => setStopTime(e.target.value)}
            className="w-full bg-bg-main border border-border-main p-3 md:p-4 rounded-xl text-xl md:text-2xl text-center text-text-contrast focus:outline-none focus:border-accent"
          />
          <p className="text-[9px] md:text-[10px] text-slate-400 leading-relaxed italic">
            Audit kewajiban qodho akhir.
          </p>
        </div>
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="space-y-12 pb-24">
      {/* DRAWER: KESIMPULAN DETAIL */}
      <AnimatePresence>
        {isDetailOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] cursor-pointer"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-bg-main border-t border-border-main rounded-t-[2.5rem] z-[101] overflow-hidden flex flex-col shadow-2xl"
            >
               <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-4 shrink-0" />
               
               <div className="flex-1 overflow-y-auto px-8 md:px-12 pb-12 custom-scrollbar">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-2xl font-serif italic text-accent">Rincian Analisis Fiqih</h3>
                      <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-widest mt-1 font-black leading-relaxed" style={{ textWrap: 'balance' }}>{result?.shortCategory}</p>
                    </div>
                    <button 
                      onClick={() => setIsDetailOpen(false)}
                      className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors"
                    >
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="space-y-10">
                    <section className="space-y-4">
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" /> Kesimpulan Detail
                      </div>
                      <div className="p-6 md:p-8 bg-bg-card rounded-2xl border border-border-main font-serif italic text-sm md:text-base leading-relaxed text-slate-300 whitespace-pre-line border-l-4 border-l-accent">
                        {result?.analysis}
                      </div>
                    </section>

                    {result?.specialNotes && result.specialNotes.length > 0 && (
                      <section className="space-y-4">
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5" /> Catatan Strategis
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {result.specialNotes.map((note, i) => (
                            <div key={i} className="p-4 bg-bg-card border border-border-main rounded-xl flex gap-3 italic">
                               <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                               <p className="text-[11px] text-slate-400 leading-relaxed">{note}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}

                    <section className="p-6 bg-bg-bottom rounded-2xl border border-border-main">
                      <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Landasan Fiqh (Maraji'):</h4>
                      <p className="text-xs text-slate-500 italic leading-relaxed font-serif">{result?.legalBasis}</p>
                    </section>
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DRAWER: LINI MASA (TIMELINE) */}
      <AnimatePresence>
        {isTimelineOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsTimelineOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] cursor-pointer"
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-bg-main border-t border-border-main rounded-t-[2.5rem] z-[101] overflow-hidden flex flex-col shadow-2xl"
            >
               <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-4 shrink-0" />
               <div className="flex-1 overflow-y-auto px-8 md:px-12 pb-12 custom-scrollbar">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-2xl font-serif italic text-accent">Lini Masa Status (Kalender ringkasan)</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-black">Gabungan Berdasarkan Status Hukum</p>
                    </div>
                    <button onClick={() => setIsTimelineOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="space-y-4">
                    {result?.groupedTimeline?.map((group, i) => (
                      <div key={i} className="flex flex-col gap-2 p-5 bg-bg-card border border-border-main rounded-2xl hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-4">
                           <div className="px-4 py-1.5 bg-bg-main border border-border-main rounded-lg text-[10px] font-mono text-slate-400">
                             {group.startDay === group.endDay ? `Hari ke-${group.startDay}` : `Hari ke-${group.startDay} s/d ${group.endDay}`}
                           </div>
                           <div className={cn(
                              "px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-widest",
                              group.status === 'Haid' ? "bg-red-900/40 text-red-400 border border-red-500/20" :
                              group.status === 'Nifas' ? "bg-purple-900/40 text-purple-400 border border-purple-500/20" :
                              group.status === 'Suci' ? "bg-emerald-900/40 text-emerald-400 border border-emerald-500/20" :
                              group.status === 'Ihtiyath' ? "bg-amber-600/40 text-amber-300 border border-amber-500/30" :
                              "bg-slate-800 text-slate-400 border border-slate-700" 
                           )}>
                             {group.status === 'Istihadloh' ? 'Istihaḍah' : group.status}
                           </div>
                        </div>
                        <p className="text-xs text-slate-400 italic leading-relaxed pl-2 border-l-2 border-border-main ml-2">
                           {group.reason}
                        </p>
                      </div>
                    ))}
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* DRAWER: KEWAJIBAN QODLO */}
      <AnimatePresence>
        {isQodloOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsQodloOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] cursor-pointer"
            />
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-bg-main border-t border-border-main rounded-t-[2.5rem] z-[101] overflow-hidden flex flex-col shadow-2xl"
            >
               <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-4 shrink-0" />
               <div className="flex-1 overflow-y-auto px-8 md:px-12 pb-12 custom-scrollbar">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <h3 className="text-2xl font-serif italic text-accent">Daftar Kewajiban Qodlo</h3>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-black">Sholat & Puasa yang Wajib Diganti</p>
                    </div>
                    <button onClick={() => setIsQodloOpen(false)} className="p-2 hover:bg-slate-800 rounded-full text-slate-500"><X className="w-6 h-6" /></button>
                  </div>

                  <div className="space-y-4">
                    {result?.totalQodloPuasa !== undefined && result.totalQodloPuasa > 0 && (
                      <div className="p-6 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl flex items-center gap-6 mb-4">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0">
                             <Target className="w-6 h-6" />
                          </div>
                          <div>
                              <div className="text-xs font-black text-emerald-400 uppercase tracking-widest">Hutang Puasa</div>
                              <div className="text-3xl font-black text-text-contrast">{result.totalQodloPuasa} <span className="text-sm uppercase text-emerald-600 font-bold ml-1">Hari</span></div>
                          </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {result?.groupedQadho?.map((group, i) => (
                        <div key={i} className="flex gap-4 items-start p-5 bg-red-950/20 border border-red-500/30 rounded-2xl group hover:border-red-500 transition-colors shadow-lg shadow-red-950/20">
                          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-6 h-6 text-red-500" />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="text-[12px] font-black text-red-400 uppercase tracking-[0.2em] leading-none">
                                    {group.startDay === group.endDay ? `Hari ke-${group.startDay}` : `Hari ke-${group.startDay} s/d ke-${group.endDay}`}
                                </div>
                                <div className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded text-[8px] font-black uppercase text-red-500">
                                    Penting
                                </div>
                            </div>
                            <p className="text-[12px] text-slate-200 leading-relaxed font-medium">{group.message}</p>
                          </div>
                        </div>
                      ))}
                      {(!result?.groupedQadho || result.groupedQadho.length === 0) && (
                         <div className="p-10 bg-bg-card border border-border-main/50 rounded-[2rem] text-center space-y-4">
                           <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto" />
                           <p className="text-xs text-slate-500 italic">Tidak ada kewajiban qodlo sholat yang terdeteksi.</p>
                         </div>
                      )}
                    </div>
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-12">
        {/* HEADLINE RESULT CARD */}
        <div className="space-y-6">
          <div className="bg-bg-card p-10 md:p-16 rounded-[2.5rem] border border-border-main shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 blur-[80px] -ml-24 -mb-24 rounded-full" />
            
            <div className="relative text-center space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-accent text-[10px] font-black uppercase tracking-[0.2em]">
                <Activity className="w-3 h-3" /> Kesimpulan Status Darah
              </div>
              
              <h2 className={cn(
                "font-black text-text-contrast uppercase tracking-tighter leading-tight max-w-3xl mx-auto",
                (result?.shortCategory?.length || 0) > 80 ? "text-xl md:text-3xl" : 
                (result?.shortCategory?.length || 0) > 40 ? "text-2xl md:text-4xl" : "text-3xl md:text-5xl"
              )} style={{ textWrap: 'balance' }}>
                {result?.shortCategory}
              </h2>

              <p className="text-[10px] md:text-xs text-slate-500 uppercase tracking-[0.3em] font-medium opacity-60">
                Analisis Berdasarkan Pola Karakteristik & Adat
              </p>

              <div className="pt-8 flex flex-wrap gap-4 items-center justify-center">
                <button 
                  onClick={() => setIsDetailOpen(true)}
                  className="inline-flex items-center gap-4 py-4 px-8 bg-bg-main border border-border-main rounded-2xl hover:border-accent hover:text-accent transition-all group/btn shadow-xl shadow-black/20"
                >
                  <FileText className="w-5 h-5 text-accent" />
                   <div className="text-left">
                      <div className="text-xs font-black uppercase tracking-widest">Baca Penjelasan Detail</div>
                      <div className="text-[9px] lowercase opacity-60">Lihat rincian analisis fiqih & dalil</div>
                   </div>
                   <ChevronRight className="w-4 h-4 ml-4 group-hover/btn:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <button 
            onClick={() => setIsTimelineOpen(true)}
            className="group flex flex-col p-8 bg-bg-card border border-border-main rounded-[2.5rem] hover:border-accent transition-all text-left shadow-xl hover:shadow-accent/5"
          >
            <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-6 group-hover:scale-110 transition-transform">
               <Calendar className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-text-contrast mb-2">Lihat Lini Masa Kalender</h3>
            <p className="text-xs text-slate-500 leading-relaxed italic">Lihat deskripsi status hukum darah hari demi hari secara ringkas.</p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent opacity-0 group-hover:opacity-100 transition-opacity">
               Buka Lini Masa <ChevronRight className="w-3 h-3" />
            </div>
          </button>

          <button 
            onClick={() => setIsQodloOpen(true)}
            className="group flex flex-col p-8 bg-bg-card border border-border-main rounded-[2.5rem] hover:border-accent transition-all text-left shadow-xl hover:shadow-accent/5"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-6 group-hover:scale-110 transition-transform">
               <Target className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black uppercase tracking-widest text-text-contrast mb-2">Lihat Kewajiban Qodlo</h3>
            <p className="text-xs text-slate-500 leading-relaxed italic">
               {result?.qadhoObligations.length === 0 && result.totalQodloPuasa === 0 
                ? "Alhamdulillah, tidak ada kewajiban qodlo yang terdeteksi." 
                : "Lihat rincian sholat dan puasa yang wajib Anda qodlo."}
            </p>
            <div className="mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
               Buka Daftar Qodlo <ChevronRight className="w-3 h-3" />
            </div>
          </button>
        </div>

        {/* PANDUAN RINGKAS (STILL DESERVES A SPOT ON MAIN PAGE) */}
        <div className="bg-bg-card p-10 rounded-[2.5rem] border border-border-main shadow-lg space-y-8">
           <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Langkah Selanjutnya</h3>
              <Droplet className="w-4 h-4 text-accent/40" />
           </div>
           
           <div className="p-6 bg-accent/10 border border-accent/20 rounded-2xl">
              <p className="text-xs text-text-contrast leading-relaxed font-medium">
                {isFirstMonthIstihadloh 
                  ? "Masa Penantian 15 Hari telah berakhir. Mulai hari ini, Anda WAJIB MANDI BESAR (Janabah) dan status Anda resmi menjadi wanita Mustahadloh (Suci). Anda WAJIB melaksanakan sholat fardlu dan puasa tepat waktu (dengan tata cara bersuci khusus Mustahadloh). Jika ibadah di hari-hari ini terlanjur Anda tinggalkan, maka wajib diqodlo."
                  : "Mandi wajib (janabah) disesuaikan dengan kategori Anda (tepat di saat karakter darah berubah untuk Mumayyizah, atau setelah hari adat selesai untuk Ghoiru Mumayyizah)." 
                }
              </p>
           </div>
        </div>
      </div>

      <button 
        onClick={() => { setStep(1); setResult(null); setRecords([]); setIsDetailOpen(false); setIsTimelineOpen(false); setIsQodloOpen(false); }}
        className="w-full py-6 bg-bg-card border border-border-main text-text-contrast rounded-[2rem] font-black uppercase tracking-[0.4em] text-xs hover:bg-bg-side hover:border-accent transition-all flex items-center justify-center gap-4 shadow-xl active:scale-95"
      >
        <RefreshCw className="w-5 h-5" /> Mulai Analisis Baru
      </button>
    </div>
  );

  return (
    <div className="h-screen w-full bg-bg-main text-text-main font-sans flex flex-col md:flex-row overflow-hidden">
      {/* MOBILE HEADER */}
      <header className="md:hidden h-16 border-b border-border-main flex items-center justify-between px-6 bg-bg-side z-50">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-serif italic text-accent tracking-tighter">Al-Kautsar</h1>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-400 hover:text-text-contrast"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* LEFT SIDEBAR (Adaptive) */}
      <aside className={cn(
        "fixed inset-0 z-40 md:relative md:flex md:w-72 border-r border-border-main flex flex-col h-full bg-bg-side transition-transform duration-300 md:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 border-b border-border-main hidden md:block">
          <h1 className="text-3xl font-serif italic text-accent tracking-tighter">Al-Kautsar</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black opacity-70">Fiqh Darah AI</p>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
          <nav className="flex-1 px-8 py-10 space-y-8">
            <div className="md:hidden mb-8 border-b border-border-main pb-4">
               <p className="text-xs uppercase tracking-[0.3em] text-slate-500 font-black opacity-70">Navigation</p>
            </div>
            
            {!location.pathname.startsWith('/articles') && renderStepNav()}
            
            <Link 
              to="/articles"
              onClick={() => setIsSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 transition-colors",
                location.pathname === '/articles' ? "text-accent" : "text-slate-500 hover:text-text-contrast"
              )}
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Artikel Fiqh</span>
            </Link>

            <div className="mt-auto">
              <AdminAuth />
            </div>

            <div className="pt-10 border-t border-border-main space-y-6">
              <div className="text-xs text-slate-500 uppercase font-black tracking-widest">Live Profile</div>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-bg-card p-3 rounded border border-border-main/50">
                  <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Context</div>
                  <div className="text-[10px] font-mono text-text-contrast flex justify-between items-center">
                    <span>{context.toUpperCase()}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", context === 'haid' ? "bg-red-500" : "bg-purple-500")} />
                  </div>
                </div>
                <div className="bg-bg-card p-3 rounded border border-border-main/50">
                  <div className="text-[9px] text-slate-500 uppercase font-bold mb-1">Experience</div>
                  <div className="text-[10px] font-mono text-text-contrast truncate">{experience.toUpperCase()}</div>
                </div>
              </div>
            </div>
          </nav>

          <div className="p-8 bg-bg-bottom border-t border-border-main">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Mazhab Syafi'i</span>
            </div>
            <p className="text-[9px] leading-relaxed italic text-slate-500 font-serif opacity-80 uppercase tracking-tighter">
              Uyunul Masa-il Linnisa & Panduan Tamyiz Terpadu
            </p>
          </div>
        </div>

        {/* Close overlay for mobile */}
        {isSidebarOpen && (
          <div 
            className="md:hidden absolute inset-0 -z-10 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </aside>

      {/* MAIN INTERACTION AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-bg-main relative">
        <Header 
          onMenuClick={() => setIsSidebarOpen(true)}
          title={location.pathname.startsWith('/articles') ? 'Artikel Fiqh' : currentStep.name}
          description={!location.pathname.startsWith('/articles') ? currentStep.description : undefined}
          showBack={location.pathname !== '/'}
        >
          <button 
              onClick={toggleTheme}
              className="p-2 md:p-2.5 border border-border-main text-slate-500 hover:text-text-contrast rounded hover:bg-bg-card transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {step > 1 && step < 5 && !location.pathname.startsWith('/articles') && (
              <button 
                onClick={() => {
                  const prevStep = allSteps
                    .filter(s => s.id < step && !s.hideFor?.includes(experience))
                    .pop();
                  if (prevStep) setStep(prevStep.id);
                }}
                className="p-2 md:px-6 md:py-2.5 border border-border-main text-[10px] uppercase font-bold tracking-widest rounded hover:bg-slate-800 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-3 h-3" /> <span className="hidden sm:inline">Back</span>
              </button>
            )}
            
            {step < 5 && !location.pathname.startsWith('/articles') ? (
              <button 
                disabled={isLoading}
                onClick={step === 4 ? handleAnalyze : () => {
                  const nextStep = allSteps.find(s => s.id > step && !s.hideFor?.includes(experience));
                  if (nextStep) setStep(nextStep.id);
                  setIsSidebarOpen(false);
                }}
                className={cn(
                  "px-4 md:px-8 py-2 md:py-2.5 text-[9px] md:text-[10px] uppercase font-black tracking-[0.2em] rounded flex items-center gap-3 transition-all",
                  step === 4 ? "bg-accent text-bg-main shadow-lg shadow-accent/20" : "bg-bg-card border border-border-main text-text-contrast"
                )}
              >
                {isLoading && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span className="whitespace-nowrap">{step === 4 ? "Analyze" : "Continue"}</span>
                {!isLoading && <ChevronRight className="w-3 h-3" />}
              </button>
            ) : !location.pathname.startsWith('/articles') && (
              <button 
                className="px-4 md:px-6 py-2 md:py-2.5 bg-accent/10 text-accent border border-accent/30 text-[9px] md:text-[10px] uppercase font-bold tracking-widest rounded flex items-center gap-2"
                onClick={() => window.print()}
              >
                <Save className="w-3 h-3" /> <span className="hidden sm:inline">PDF</span>
              </button>
            )}
        </Header>

        <section className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
          <Routes>
            <Route path="/articles" element={<ArticleList />} />
            <Route path="/articles/:id" element={<ArticleDetail />} />
            <Route path="/articles/new" element={<ArticleEditor />} />
            <Route path="/articles/edit/:id" element={<ArticleEditor />} />
            <Route path="/" element={
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="max-w-4xl mx-auto md:mx-0"
                >
                  {step === 1 && renderStep1()}
                  {step === 2 && renderStep2()}
                  {step === 3 && renderStep3()}
                  {step === 4 && renderStep4()}
                  {step === 5 && renderResult()}
                </motion.div>
              </AnimatePresence>
            } />
          </Routes>
        </section>
      </main>

      {/* RIGHT PANEL - Adaptive (Bottom or Sidebar) */}
      {step < 5 && (
        <aside className="w-80 border-l border-border-main bg-bg-side flex flex-col hidden lg:flex overflow-hidden">
          <div className="p-8 border-b border-border-main bg-bg-main/30">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Status Real-time</h3>
            <div className="p-4 bg-bg-card border border-border-main rounded-xl space-y-3">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-accent" />
                <span className="text-[11px] font-bold text-text-contrast uppercase tracking-wider">Deteksi Berjalan</span>
              </div>
              <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-accent" 
                  initial={{ width: 0 }}
                  animate={{ width: `${(step / 4) * 100}%` }}
                />
              </div>
              <p className="text-[9px] text-slate-500 leading-relaxed italic">
                Sistem sedang memproses input untuk mengidentifikasi kategori Mustahadloh.
              </p>
            </div>
          </div>

          <div className="flex-1 p-8 space-y-8 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <div className="text-xs text-slate-500 uppercase font-black tracking-widest opacity-60">Data Input</div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 uppercase tracking-tighter">Hari Ditandai</span>
                  <span className="text-text-contrast font-mono">{records.length} Hari</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500 uppercase tracking-tighter">Usia Hijriyah</span>
                  <span className="text-text-contrast font-mono">{ageYears}th {ageMonths}bln</span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-xs text-slate-500 uppercase font-black tracking-widest opacity-60">Metadata Fiqh</div>
              <div className="bg-bg-card p-4 rounded-lg border border-border-main/50 space-y-4">
                <div className="space-y-1">
                  <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Metode Analisis</div>
                  <div className="text-[10px] text-accent italic font-serif">7 Kategori Istihadloh</div>
                </div>
                <div className="space-y-2">
                  <div className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Legitimacy</div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] text-slate-300">Uyunul Masa-il Approved</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-bg-bottom mt-auto border-t border-border-main">
             <div className="text-[9px] text-slate-600 uppercase tracking-[0.2em] font-bold">Safe Workspace</div>
             <p className="text-[8px] text-slate-700 mt-2">Semua data diproses di browser Anda.</p>
          </div>
        </aside>
      )}
    </div>
  );
}
