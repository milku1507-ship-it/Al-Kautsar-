import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, Link, useLocation, useSearchParams, useNavigate } from 'react-router-dom';
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
  Sparkles,
  Compass,
  ShieldCheck,
  ChevronDown
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
import TimelineEventList from './components/TimelineEventList';
import AdatHistory from './components/AdatHistory';
import TimeContext from './components/TimeContext';
import { id } from 'date-fns/locale';
import { cn } from './lib/utils';
import { checkIfMumayyizah, countUniqueBloodAttributes } from './services/localAnalyzer';
import { 
  CalculationContext, 
  ExperienceStatus, 
  DayRecord, BloodEvent, EventType, 
  UserHabit, 
  FiqhAnalysisRequest, 
  FiqhAnalysisResult,
  BloodColor,
  BloodTexture,
  BloodAroma
} from './types';
import { analyzeFiqh } from './services/geminiService';
import { calculateHijriAge } from './lib/hijriUtils';

interface CustomOption {
  value: string | number;
  label: string;
}

interface CustomSelectProps {
  value: string | number | undefined;
  onChange: (val: any) => void;
  options: CustomOption[];
  label?: string;
}

function CustomSelect({ value, onChange, options, label }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      {label && <label className="text-[11px] font-semibold text-text-muted tracking-tight mb-1.5 block uppercase">{label}</label>}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-bg-card hover:bg-neutral-50/50 dark:hover:bg-white/5 border border-border-main/80 hover:border-accent/40 py-3 px-3.5 rounded-xl text-xs font-semibold text-text-contrast text-left transition-all focus:outline-none focus:border-accent active:scale-99 shadow-xs"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform duration-200 shrink-0", isOpen && "rotate-180")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 left-0 right-0 mt-1.5 max-h-56 overflow-y-auto bg-white dark:bg-bg-side border border-border-main/85 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.06)] py-1.5 custom-scrollbar"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 text-xs font-semibold transition-all hover:bg-neutral-50 dark:hover:bg-white/5",
                    isSelected ? "text-accent bg-[#FFF5F5] dark:bg-accent/10" : "text-text-main"
                  )}
                >
                  {opt.label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface InteractiveFieldPickerProps {
  value: string | number | undefined;
  onChange: (val: any) => void;
  options: CustomOption[];
  placeholder?: string;
}

function InteractiveFieldPicker({ value, onChange, options, placeholder }: InteractiveFieldPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div className="relative w-full" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-bg-card hover:bg-neutral-50/50 dark:hover:bg-white/5 border border-border-main/80 hover:border-[#B91C1C]/40 py-3 px-3.5 rounded-xl text-xs font-semibold text-text-contrast text-left transition-all focus:outline-none focus:border-[#B91C1C] active:scale-[0.99] shadow-inner-sm cursor-pointer"
      >
        <span className={cn("truncate", !selectedOption && "text-text-muted font-normal")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform duration-200 shrink-0", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute z-50 left-0 right-0 mt-2 max-h-56 overflow-y-auto bg-white dark:bg-bg-side border border-border-main rounded-xl shadow-xl py-1 px-1.5 custom-scrollbar"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-3.5 py-2.5 my-0.5 text-xs font-semibold rounded-lg transition-all hover:bg-neutral-50 dark:hover:bg-white/5 flex items-center justify-between cursor-pointer",
                    isSelected ? "text-[#B91C1C] bg-[#FFF5F5] dark:bg-[#B91C1C]/10" : "text-text-main"
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#B91C1C]" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
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
  const [context, setContext] = useState<CalculationContext | ''>('');
  const [experience, setExperience] = useState<ExperienceStatus | ''>('');
  const [laborDate, setLaborDate] = useState<string>('');
  const [isRamadhan, setIsRamadhan] = useState(false);
  const [isFirstMonthIstihadloh, setIsFirstMonthIstihadloh] = useState(true);
  const [monthIndex, setMonthIndex] = useState(0);
  const [hasPerformedPrayerBeforeBleeding, setHasPerformedPrayerBeforeBleeding] = useState(true);

  // Step 2: Kalender Darah
  const [events, setEvents] = useState<BloodEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date(2026, 4, 1)); // Mei 2026

  const [lastClickedDate, setLastClickedDate] = useState<Date | null>(null);

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const resetCalendar = () => {
    setRecords([]); setEvents([]);
    setLastClickedDate(null);
    setSelectedDate(null);
    setShowResetConfirm(false);
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
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 1. Sync URL parameters to state (for device back button support in Android TWA / PWA)
  useEffect(() => {
    if (location.pathname !== '/') {
      if (isSidebarOpen) setIsSidebarOpen(false);
      return;
    }

    const urlStep = parseInt(searchParams.get('step') || '1', 10);
    const urlModal = searchParams.get('modal') || '';
    const urlMenu = searchParams.get('menu') || '';

    // Step boundary check (1 to 5)
    if (urlStep >= 1 && urlStep <= 5 && urlStep !== step) {
      setStep(urlStep);
    }
    
    const tDetail = urlModal === 'detail';
    if (tDetail !== isDetailOpen) {
      setIsDetailOpen(tDetail);
    }

    const tTimeline = urlModal === 'timeline';
    if (tTimeline !== isTimelineOpen) {
      setIsTimelineOpen(tTimeline);
    }

    const tQodlo = urlModal === 'qodlo';
    if (tQodlo !== isQodloOpen) {
      setIsQodloOpen(tQodlo);
    }

    const tSidebar = urlMenu === 'open';
    if (tSidebar !== isSidebarOpen) {
      setIsSidebarOpen(tSidebar);
    }
  }, [searchParams, location.pathname]);

  // 2. Sync state changes back to URL parameters
  useEffect(() => {
    if (location.pathname !== '/') return;

    const urlStep = parseInt(searchParams.get('step') || '1', 10);
    const urlModal = searchParams.get('modal') || '';
    const urlMenu = searchParams.get('menu') || '';

    const hasModalInUrl = !!urlModal;
    const hasModalInState = isDetailOpen || isTimelineOpen || isQodloOpen;

    const hasMenuInUrl = urlMenu === 'open';
    const hasMenuInState = isSidebarOpen;

    // We removed manual closes detection here because it conflicts with explicit user navigation.
    // Manual closes (clicking X, clicking backdrop) should just call navigate(-1) directly.

    const params = new URLSearchParams(searchParams);
    let changed = false;
    let shouldReplace = false;

    if (urlStep !== step && step >= 1 && step <= 5) {
      params.set('step', step.toString());
      params.delete('modal');
      params.delete('menu');
      changed = true;
      // If resetting to step 1 from a finished analysis, replace history entry
      if (step === 1 && urlStep === 5) {
        shouldReplace = true;
      }
    }

    const targetModal = isDetailOpen ? 'detail' : (isTimelineOpen ? 'timeline' : (isQodloOpen ? 'qodlo' : ''));
    if (urlModal !== targetModal && targetModal) {
      params.set('modal', targetModal);
      changed = true;
    }

    const targetMenu = isSidebarOpen ? 'open' : '';
    if (urlMenu !== targetMenu) {
      if (targetMenu) {
        params.set('menu', targetMenu);
      } else {
        params.delete('menu');
        shouldReplace = true; // Replace when hiding menu so we don't build up history on explicit navigation
      }
      changed = true;
    }

    if (changed) {
      navigate({ search: params.toString() }, { replace: shouldReplace });
    }
  }, [step, isDetailOpen, isTimelineOpen, isQodloOpen, isSidebarOpen, location.pathname, navigate, searchParams]);

  // Manual close handlers
  const closeSidebarManual = () => {
    if (searchParams.get('menu') === 'open') {
      navigate(-1);
    } else {
      setIsSidebarOpen(false);
    }
  };

  const closeModalManual = () => {
    if (searchParams.get('modal')) {
      navigate(-1);
    } else {
      setIsDetailOpen(false);
      setIsTimelineOpen(false);
      setIsQodloOpen(false);
    }
  };

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');


  // Step 4: Konteks Waktu
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
        aroma: template?.aroma || exists?.aroma || 'tidak_busuk' as BloodAroma,
        durationHours: template?.durationHours !== undefined ? template?.durationHours : (exists?.durationHours !== undefined ? exists.durationHours : 24),
        durationMinutes: template?.durationMinutes !== undefined ? template?.durationMinutes : (exists?.durationMinutes !== undefined ? exists.durationMinutes : 0)
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


  const [isResetConfirming, setIsResetConfirming] = useState(false);

  const handleResetForm = () => {
    if (!isResetConfirming) {
      setIsResetConfirming(true);
      setTimeout(() => setIsResetConfirming(false), 3000);
      return;
    }
    setIsResetConfirming(false);
    setSlideDirection('backward');
    setStep(1);
    setResult(null);
    setRecords([]); 
    setEvents([]);
    setBirthDateMasehi('');
    setLaborDate('');
    setContext('haid');
    setExperience('mubtadiah');
    setHabit({ retrospection: 'ingat_awal_dan_durasi' });
    setHasPerformedPrayerBeforeBleeding(true);
    setIsDetailOpen(false); 
    setIsTimelineOpen(false); 
    setIsQodloOpen(false);
  };

  const handleAnalyze = async () => {
    setIsLoading(true);
    try {
      const data: FiqhAnalysisRequest = {
        ageYears, ageMonths, ageDays,
        context: context as any, experience: experience as any,
        events, habit,
        laborDate,
        hasPerformedPrayerBeforeBleeding
      };
      
      const res = await analyzeFiqh(data);
      setResult(res);
      setSlideDirection('forward');
      setStep(5);
    } catch (error: any) {
      console.error(error);
      alert(error.message || "Terjadi kesalahan saat menganalisis data.");
    } finally {
      setIsLoading(false);
    }
  };

  const isCurrentStepValid = useMemo(() => {
    if (step === 1) {
      return !!birthDateMasehi && (context !== 'nifas' || !!laborDate) && (experience === 'mubtadiah' || experience === 'mutadah');
    }
    if (step === 2) {
      return true; // validate adat later if needed
    }
    if (step === 3) {
      return events.length > 0;
    }
    if (step === 4) {
      return true; // Just a checkbox
    }
    return true;
  }, [step, birthDateMasehi, context, laborDate, experience, events]);

  const handleNext = () => {
    const nextStep = allSteps.find(s => s.id > step && !s.hideFor?.includes(experience));
    if (nextStep) {
      setSlideDirection('forward');
      setStep(nextStep.id);
    }
  };

  const handleBack = () => {
    const prevSteps = allSteps.filter(s => s.id < step && !s.hideFor?.includes(experience));
    const prevStep = prevSteps[prevSteps.length - 1];
    if (prevStep) {
      setSlideDirection('backward');
      setStep(prevStep.id);
    }
  };

  const renderWizardProgress = () => {
    if (step > 4) return null;
    
    const filteredSteps = steps;
    const currentIdx = filteredSteps.findIndex(s => s.id === step);
    const totalStepsCount = filteredSteps.length;
    
    return (
      <div className="border-b border-border-main/40 bg-bg-side px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] animate-in fade-in duration-300">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <span className="text-[12px] font-bold text-text-muted tracking-tight font-display shrink-0">Progres Langkah</span>
          <div className="flex-1 sm:w-48 flex gap-1.5 h-1.5 bg-neutral-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0">
            {Array.from({ length: totalStepsCount }).map((_, idx) => {
              const isActive = idx <= currentIdx;
              const isCurrent = idx === currentIdx;
              const sObj = filteredSteps[idx];
              return (
                <button
                  key={idx} 
                  type="button"
                  onClick={() => {
                    if (sObj && sObj.id !== step) {
                      setSlideDirection(sObj.id > step ? 'forward' : 'backward');
                      setStep(sObj.id);
                    }
                  }}
                  title={sObj?.name}
                  className={cn(
                    "h-full flex-1 rounded-full transition-all duration-300 cursor-pointer first:rounded-l-full last:rounded-r-full",
                    isCurrent ? "bg-accent scale-x-102" :
                    isActive ? "bg-accent/75" : "bg-neutral-200 dark:bg-zinc-700"
                  )}
                />
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-bold text-accent bg-[#FFF5F5] dark:bg-accent/15 border border-accent/20 px-3.5 py-1 rounded-full shadow-xs">
            {allSteps.find(s => s.id === step)?.name} (Langkah {currentIdx + 1} dari {totalStepsCount})
          </span>
        </div>
      </div>
    );
  };

  const renderStickyBottomNav = () => {
    const isNextDisabled = !isCurrentStepValid;

    return (
      <div className="border-t border-border-main/50 bg-bg-side/80 backdrop-blur-md px-6 py-4 flex items-center justify-between gap-4 shadow-[0_-4px_24px_rgba(0,0,0,0.04)] pb-safe z-30">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 1}
          className={cn(
            "h-[52px] px-6 rounded-full text-[13px] font-bold tracking-tight transition-all flex items-center gap-2 cursor-pointer border active:scale-95 duration-200",
            step === 1 
              ? "opacity-35 border-border-main text-text-muted cursor-not-allowed" 
              : "border-border-main bg-transparent hover:border-accent text-text-contrast hover:bg-bg-main"
          )}
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" /> <span>Kembali</span>
        </button>

        <button
          type="button"
          disabled={isNextDisabled || isLoading}
          onClick={() => {
            if (step === 4) {
              handleAnalyze();
            } else {
              handleNext();
            }
          }}
          className={cn(
            "h-[52px] flex-1 max-w-[280px] rounded-full text-[14px] font-semibold tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 duration-200",
            isNextDisabled 
              ? "bg-neutral-200 dark:bg-zinc-800 text-neutral-400 dark:text-zinc-500 border border-neutral-300 dark:border-zinc-700 cursor-not-allowed shadow-none" 
              : "bg-gradient-to-r from-[#B91C1C] to-[#991B1B] text-white hover:brightness-110 shadow-accent/20"
          )}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" /> <span>Menganalisis...</span>
            </>
          ) : (
            <>
              <span>{step === 4 ? "Hitung Fiqh" : "Lanjut"}</span> 
              <ChevronRight className="w-4 h-4 stroke-[2.5]" />
            </>
          )}
        </button>
      </div>
    );
  };


  const allSteps = [
    { id: 1, name: "Profil Dasar", description: "Masukkan data tanggal lahir, kondisi & status pengalaman" },
    { id: 2, name: "Riwayat Adat", description: "Atur ingatan kebiasaan siklus", hideFor: ['mubtadiah'] },
    { id: 3, name: "Timeline Darah", description: "Catat setiap perubahan kondisi darah" },
    { id: 4, name: "Konteks Waktu", description: "Informasi kewajiban shalat sebelum darah keluar" },
    { id: 5, name: "Hasil Analisis", description: "Output kesimpulan hukum & kewajiban qodho" }
  ];


  const steps = allSteps.filter(s => {
    if (s.hideFor?.includes(experience as string)) return false;
    if (s.id === 5) return false;
    return true;
  });
  const currentStep = allSteps.find(s => s.id === step) || allSteps[0];

  const renderStepNav = () => {
    const getStepIcon = (id: number) => {
      switch (id) {
        case 1: return <Compass className="w-4.5 h-4.5" />;
        case 2: return <Calendar className="w-4.5 h-4.5" />;
        case 3: return <History className="w-4.5 h-4.5" />;
        case 4: return <Clock className="w-4.5 h-4.5" />;
        case 5: return <ShieldCheck className="w-4.5 h-4.5" />;
        default: return <Compass className="w-4.5 h-4.5" />;
      }
    };

    return (
      <div className="space-y-2.5">
        {steps.map((s, idx) => {
          const isActive = step === s.id;
          const isPassed = step > s.id;
          return (
            <button 
              key={s.id} 
              onClick={() => {
                if (location.pathname !== '/') {
                  navigate('/');
                }
                if (s.id !== step) {
                  setSlideDirection(s.id > step ? 'forward' : 'backward');
                  setStep(s.id);
                }
                setIsSidebarOpen(false);
              }}
              className={cn(
                "flex items-center gap-3.5 transition-all duration-200 w-full px-4 py-3 rounded-xl text-sm font-medium",
                isActive 
                  ? "bg-[#FFF5F5] dark:bg-accent/10 border-l-4 border-l-[#B91C1C] text-[#B91C1C] shadow-xs font-semibold"
                  : "text-text-muted hover:text-text-contrast hover:bg-bg-main"
              )}
            >
              <div className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors",
                isActive ? "bg-[#B91C1C]/10 text-[#B91C1C]" : (isPassed ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-100 dark:bg-zinc-800 text-text-muted")
              )}>
                {isPassed ? <CheckCircle2 className="w-3.5 h-3.5" /> : getStepIcon(s.id)}
              </div>
              <span className="text-[13px] tracking-tight">{s.name}</span>
            </button>
          );
        })}
      </div>
    );
  };

  const renderStep1Redesign = () => (
    <div className="space-y-6 md:space-y-8 flex flex-col justify-center min-h-[40vh] py-2">
      <div className="text-center space-y-2">
        <h2 className="text-xl md:text-2xl font-display font-bold tracking-tight text-text-contrast">
          Profil & Kondisi Awal
        </h2>
        <p className="text-sm text-text-muted">
          Langkah pertama menentukan kerangka hukum berdasarkan usia fardu Anda.
        </p>
      </div>

      <div className="max-w-3xl mx-auto w-full space-y-6 md:space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Tanggal Lahir (Kiri) */}
          <div className="bg-bg-card p-6 md:p-8 rounded-2xl border border-border-main/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:scale-[0.98] active:scale-[0.97] transition-all duration-300 space-y-6 focus-within:border-accent">
            <h3 className="text-sm font-semibold tracking-tight text-text-contrast font-display">Tanggal Lahir</h3>
            
            <div className="relative border-b border-border-main/80 focus-within:border-accent transition-all duration-300 pb-1.5 pt-4">
              <input 
                type="date"
                id="birth_date_input"
                placeholder=" "
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
                className="peer block w-full bg-transparent border-0 px-0 py-1 text-sm text-text-contrast font-semibold focus:outline-none focus:ring-0 cursor-pointer"
              />
              <label 
                htmlFor="birth_date_input"
                className="absolute top-0 text-xs text-text-muted transition-all duration-300 origin-0 transform -translate-y-4 scale-75 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-4 peer-focus:scale-75 peer-focus:-translate-y-4 peer-focus:text-accent font-semibold"
              >
                Pilih Tanggal Lahir Anda
              </label>
            </div>

            {birthDateMasehi ? (
              <div className="p-3.5 bg-[#FFF5F5] dark:bg-accent/10 border border-accent/20 rounded-xl text-xs text-text-contrast font-medium">
                 Usia Hijriah Anda: <span className="font-bold text-accent">{ageYears} Tahun, {ageMonths} Bulan, {ageDays} Hari</span>
              </div>
            ) : (
              <p className="text-xs text-text-muted italic leading-relaxed">Dibutuhkan untuk kalibrasi usia Qomariyah Anda secara syar'u.</p>
            )}
            
            {birthDateMasehi && ageYears < 9 && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-xs text-red-600 dark:text-red-400 font-semibold italic">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>Usia minimal untuk Haid adalah 9 tahun Qomariyah kurang 16 hari.</span>
              </div>
            )}
          </div>

          {/* Kondisi Awal (Kanan) */}
          <div className="bg-bg-card p-6 md:p-8 rounded-2xl border border-border-main/60 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:scale-[0.98] active:scale-[0.97] transition-all duration-300 space-y-4">
            <h3 className="text-sm font-semibold tracking-tight text-text-contrast font-display">Kondisi Awal</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={() => {
                  setContext('haid');
                  setLaborDate('');
                }}
                className={cn(
                  "py-5 px-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-3 cursor-pointer",
                  context === 'haid' 
                    ? "border-[#B91C1C] bg-[#FFF5F5] dark:bg-accent/10 text-[#B91C1C] font-semibold shadow-xs" 
                    : "border-border-main bg-bg-main/50 hover:border-accent/40 text-text-muted"
                )}
              >
                <Droplet className="w-7 h-7" />
                <span className="text-xs font-semibold">Haid</span>
              </button>

              <button 
                type="button"
                onClick={() => setContext('nifas')}
                className={cn(
                  "py-5 px-4 rounded-xl border transition-all flex flex-col items-center justify-center gap-3 cursor-pointer",
                  context === 'nifas' 
                    ? "border-[#B91C1C] bg-[#FFF5F5] dark:bg-accent/10 text-[#B91C1C] font-semibold shadow-xs" 
                    : "border-border-main bg-bg-main/50 hover:border-accent/40 text-text-muted"
                )}
              >
                <Droplet className="w-7 h-7 rotate-180" />
                <span className="text-xs font-semibold">Nifas</span>
              </button>
            </div>

            <AnimatePresence>
              {context === 'nifas' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="pt-4 border-t border-border-main/40 space-y-4 overflow-hidden"
                >
                  <div className="p-4 bg-[#FFF5F5] dark:bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                    <h4 className="text-xs font-bold text-accent font-display">Data Tambahan Nifas</h4>
                    
                    <div className="relative border-b border-border-main/80 focus-within:border-accent transition-all duration-300 pb-1.5 pt-4">
                      <input 
                        type="datetime-local" 
                        id="labor_date_input"
                        placeholder=" "
                        value={laborDate} 
                        onChange={e => setLaborDate(e.target.value)}
                        className="peer block w-full bg-transparent border-0 px-0 py-1 text-xs text-text-contrast font-bold focus:outline-none focus:ring-0 cursor-pointer"
                      />
                      <label 
                        htmlFor="labor_date_input"
                        className="absolute top-0 text-[10px] text-text-muted transition-all duration-300 origin-0 transform -translate-y-4 scale-75 peer-placeholder-shown:scale-100 peer-placeholder-shown:translate-y-4 peer-focus:scale-75 peer-focus:-translate-y-4 peer-focus:text-accent font-semibold"
                      >
                        Tanggal dan Jam Persalinan
                      </label>
                    </div>

                    <div className="pt-2">
                      <p className="text-xs mb-2 font-semibold text-text-contrast">Sudah pernah haid sebelumnya?</p>
                      <div className="flex gap-2">
                        <button 
                          type="button"
                          onClick={() => setHabit({...habit, pernahHaid: false})}
                          className={cn(
                            "flex-1 py-2 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                            habit.pernahHaid === false ? "bg-[#B91C1C] text-white border-[#B91C1C]" : "bg-bg-card text-text-muted border-border-main hover:border-accent/30"
                          )}
                        >
                          Belum Pernah
                        </button>
                        <button 
                          type="button"
                          onClick={() => setHabit({...habit, pernahHaid: true})}
                          className={cn(
                            "flex-1 py-2 px-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
                            habit.pernahHaid === true ? "bg-[#B91C1C] text-white border-[#B91C1C]" : "bg-bg-card text-text-muted border-border-main hover:border-accent/30"
                          )}
                        >
                          Sudah Pernah
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Status Pengalaman (Tengah) */}
        <div className="space-y-4 pt-4 border-t border-border-main/50">
          <h3 className="text-sm font-semibold text-text-contrast font-display text-center">Status Pengalaman</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            <button
              type="button"
              onClick={() => setExperience('mubtadiah')}
              className={cn(
                "p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 text-center cursor-pointer relative shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:scale-[0.98] duration-300",
                experience === 'mubtadiah'
                  ? "border-[#B91C1C] bg-[#FFF5F5] dark:bg-accent/10"
                  : "border-border-main bg-bg-card hover:border-accent/40"
              )}
            >
              {experience === 'mubtadiah' && (
                <div className="absolute top-4 right-4 bg-[#B91C1C] text-white p-1 rounded-full">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-transform",
                experience === 'mubtadiah' ? "bg-accent/10 text-accent scale-110" : "bg-neutral-100 dark:bg-zinc-800 text-text-muted"
              )}>
                <Baby className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#B91C1C]">Mubtadi'ah</h4>
                <span className="text-[10px] text-text-muted font-semibold block mt-0.5">Pemula</span>
                <p className="text-xs text-text-muted mt-2 leading-relaxed max-w-xs">
                  Baru pertama kali mengalami haid / nifas sepanjang hidup Anda dan belum memiliki siklus adat tetap.
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setExperience('mutadah')}
              className={cn(
                "p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 text-center cursor-pointer relative shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:scale-[0.98] duration-300",
                experience === 'mutadah'
                  ? "border-[#B91C1C] bg-[#FFF5F5] dark:bg-accent/10"
                  : "border-border-main bg-bg-card hover:border-accent/40"
              )}
            >
              {experience === 'mutadah' && (
                <div className="absolute top-4 right-4 bg-[#B91C1C] text-white p-1 rounded-full">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center mb-1 transition-transform",
                experience === 'mutadah' ? "bg-accent/10 text-accent scale-110" : "bg-neutral-100 dark:bg-zinc-800 text-text-muted"
              )}>
                <History className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-widest text-[#B91C1C]">Mu'tadah</h4>
                <span className="text-[10px] text-text-muted font-semibold block mt-0.5">Berpengalaman</span>
                <p className="text-xs text-text-muted mt-2 leading-relaxed max-w-xs">
                  Sudah sering atau pernah mengalami haid / nifas sebelumnya dan memiliki rujukan siklus adat tetap.
                </p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5Redesign = () => <TimelineEventList events={events} onChange={setEvents} />;
  const renderStep3 = () => <AdatHistory habit={habit} onChange={setHabit} />;
  const renderStep4Redesign = () => <TimeContext hasPerformedPrayerBeforeBleeding={hasPerformedPrayerBeforeBleeding} onChange={setHasPerformedPrayerBeforeBleeding} />;
  const renderResult = () => (
    <div className="space-y-10 pb-24 max-w-4xl mx-auto">
      {/* DRAWER: KESIMPULAN DETAIL */}
      <AnimatePresence>
        {isDetailOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-md z-[100] cursor-pointer"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white dark:bg-bg-side border-t border-border-main rounded-t-[2rem] z-[101] overflow-hidden flex flex-col shadow-2xl"
            >
               <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto my-3.5 shrink-0" />
               
               <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-10 custom-scrollbar">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-accent">Rincian Analisis Fiqih</h3>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed" style={{ textWrap: 'balance' }}>{result?.shortCategory}</p>
                    </div>
                    <button 
                      onClick={() => setIsDetailOpen(false)}
                      className="p-1.5 hover:bg-bg-main rounded-full text-text-muted hover:text-text-contrast transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    <section className="space-y-2.5">
                      <div className="text-xs font-bold text-text-contrast flex items-center gap-2">
                        <FileText className="w-4 h-4 text-accent" /> Kesimpulan Detail
                      </div>
                      <div className="p-5 bg-[#FAFAFA] dark:bg-bg-card rounded-xl border border-border-main font-sans text-xs md:text-[13px] leading-relaxed text-text-main font-medium whitespace-pre-line border-l-4 border-l-accent shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                        {result?.analysis}
                      </div>
                    </section>

                    {result?.categoryReason && (
                      <section className="space-y-2.5">
                        <div className="text-xs font-bold text-text-contrast flex items-center gap-2">
                          <Info className="w-4 h-4 text-accent" /> Alasan Penentuan Golongan
                        </div>
                        <div className="p-5 bg-[#FAFAFA] dark:bg-bg-card rounded-xl border border-border-main font-sans text-xs md:text-[13px] leading-relaxed text-text-main font-semibold border-l-4 border-l-accent shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                          {result.categoryReason}
                        </div>
                      </section>
                    )}

                    {result?.specialNotes && result.specialNotes.length > 0 && (
                      <section className="space-y-2.5">
                        <div className="text-xs font-bold text-text-contrast flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-accent" /> Catatan Strategis
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {result.specialNotes.map((note, i) => (
                            <div key={i} className="p-4 bg-[#FAFAFA] dark:bg-bg-card border border-border-main rounded-xl flex gap-3 shadow-none">
                               <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0 animate-pulse" />
                               <p className="text-xs text-text-main font-medium leading-relaxed">{note}</p>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
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
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white dark:bg-bg-side border-t border-border-main rounded-t-[2rem] z-[101] overflow-hidden flex flex-col shadow-2xl"
            >
               <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto my-3.5 shrink-0" />
               <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-10 custom-scrollbar">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-accent">Lini Masa Status</h3>
                      <p className="text-xs text-text-muted mt-1 leading-relaxed">Status hukum pendarahan hari demi hari</p>
                    </div>
                    <button onClick={() => setIsTimelineOpen(false)} className="p-1.5 hover:bg-bg-main rounded-full text-text-muted hover:text-text-contrast cursor-pointer"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="space-y-3">
                    {result?.groupedTimeline?.map((group, i) => (
                      <div key={i} className="flex flex-col gap-2.5 p-4.5 bg-bg-card border border-border-main/55 rounded-xl hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors">
                        <div className="flex items-center gap-3">
                           <div className="px-3 py-1 bg-[#FAFAFA] dark:bg-bg-main border border-border-main rounded-lg text-xs font-semibold text-text-muted">
                             {group.startDate && group.endDate 
                                ? (group.startDate === group.endDate 
                                    ? `Tgl ${format(parseISO(group.startDate), 'd MMMM', { locale: id })}`
                                    : `Tgl ${format(parseISO(group.startDate), 'd MMMM', { locale: id })} Sampai ${format(parseISO(group.endDate), 'd MMMM', { locale: id })}`)
                                : (group.startDay === group.endDay ? `Hari Ke-${group.startDay}` : `Hari Ke-${group.startDay} s/d ${group.endDay}`)}
                           </div>
                           <div className={cn(
                              "px-2.5 py-0.5 rounded text-[10px] font-bold border border-transparent",
                              group.status === 'Haid' ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/15" :
                              group.status === 'Nifas' ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/15" :
                              group.status === 'Suci' ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15" :
                              group.status === 'Ihtiyath' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/15" :
                              "bg-neutral-100 dark:bg-neutral-800 text-text-muted border-neutral-200" 
                           )}>
                             {group.status === 'Istihadloh' ? 'Istihaḍah' : group.status}
                           </div>
                        </div>
                        <p className="text-xs text-text-muted italic leading-relaxed pl-2 border-l-2 border-border-main/75 ml-1.5">
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
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-white dark:bg-bg-side border-t border-border-main rounded-t-[2rem] z-[101] overflow-hidden flex flex-col shadow-2xl"
            >
               <div className="w-12 h-1 bg-neutral-300 dark:bg-neutral-700 rounded-full mx-auto my-3.5 shrink-0" />
               <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-10 custom-scrollbar">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-accent">Daftar Kewajiban Qadha</h3>
                      <p className="text-xs text-text-muted mt-1 font-medium leading-relaxed">Shalat & puasa fardhu yang wajib Anda ganti</p>
                    </div>
                    <button onClick={() => setIsQodloOpen(false)} className="p-1.5 hover:bg-bg-main rounded-full text-text-muted cursor-pointer"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="space-y-3">
                    {result?.totalQodloPuasa !== undefined && result.totalQodloPuasa > 0 && (
                      <div className="p-4.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3.5 mb-2">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-600 shrink-0">
                             <Target className="w-5 h-5" />
                          </div>
                          <div>
                              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Hutang Puasa</div>
                              <div className="text-xl font-bold text-text-contrast">{result.totalQodloPuasa} <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium ml-0.5">Hari</span></div>
                          </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                      {result?.groupedQadho
                        ?.filter(group => !group.message.includes("Darah Istihadloh (Fasad)"))
                        ?.map((group, i) => (
                        <div key={i} className="flex gap-3.5 items-start p-4 bg-red-500/5 dark:bg-red-500/10 border border-red-500/15 rounded-xl group hover:border-red-500/35 transition-all shadow-sm">
                          <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center shrink-0 text-red-500">
                            <AlertCircle className="w-5 h-5" />
                          </div>
                          <div className="space-y-1.5 my-0.5">
                            <div className="flex items-center gap-2">
                                <div className="text-[11px] font-bold text-red-600 dark:text-red-400">
                                    {group.startDate && group.endDate 
                                       ? (group.startDate === group.endDate 
                                           ? `Tgl ${format(parseISO(group.startDate), 'd MMMM', { locale: id })}`
                                           : `Tgl ${format(parseISO(group.startDate), 'd MMMM', { locale: id })} Sampai ${format(parseISO(group.endDate), 'd MMMM', { locale: id })}`)
                                       : (group.startDay === group.endDay ? `Hari Ke-${group.startDay}` : `Hari Ke-${group.startDay} s/d Ke-${group.endDay}`)}
                                </div>
                                <span className="px-1.5 py-0.2 bg-red-500/10 border border-red-500/10 rounded text-[9px] font-semibold text-red-500">
                                    Penting
                                </span>
                            </div>
                            <p className="text-xs text-text-main leading-relaxed font-semibold">{group.message}</p>
                          </div>
                        </div>
                      ))}
                      {(!result?.groupedQadho || result.groupedQadho.length === 0) && (
                         <div className="p-8 bg-white dark:bg-bg-card border border-border-main/50 rounded-2xl text-center space-y-3 shadow-none">
                           <CheckCircle2 className="w-10 h-10 text-emerald-500/35 mx-auto animate-pulse" />
                           <p className="text-xs text-text-muted italic">Tidak ada kewajiban qadha shalat yang terdeteksi.</p>
                         </div>
                      )}
                    </div>
                  </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 gap-8">
        {/* HEADLINE RESULT CARD */}
        <div className="space-y-5">
          <div className="bg-white dark:bg-bg-side p-8 md:p-14 rounded-2xl border border-border-main/55 shadow-[0_8px_30px_rgb(0,0,0,0.02)] relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] -mr-32 -mt-32 rounded-full" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 blur-[80px] -ml-24 -mb-24 rounded-full" />
            
            <div className="relative text-center space-y-5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-accent/10 border border-accent/15 rounded-full text-accent text-xs font-semibold">
                <Activity className="w-3.5 h-3.5" /> Kesimpulan Status Darah
              </div>
              
              <h2 className={cn(
                "font-bold text-text-contrast tracking-tight leading-tight max-w-3xl mx-auto font-display",
                (result?.shortCategory?.length || 0) > 80 ? "text-lg md:text-2xl" : 
                (result?.shortCategory?.length || 0) > 40 ? "text-xl md:text-3xl" : "text-2xl md:text-4.5xl"
              )} style={{ textWrap: 'balance' }}>
                {result?.shortCategory}
              </h2>

              <p className="text-xs text-text-muted font-medium">
                Analisis Berdasarkan Pola Karakteristik & Adat Kebiasaan
              </p>

              {result?.categoryReason && (
                <div className="max-w-2xl mx-auto p-5 md:p-6 bg-[#FFF5F5] dark:bg-bg-card border-l-4 border-l-accent border-r border-t border-b border-border-main rounded-r-xl rounded-l-md text-left space-y-2.5 transition-colors shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                  <div className="text-xs text-accent font-bold flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-accent" /> Alasan Penentuan Golongan
                  </div>
                  <p className="text-text-main text-xs md:text-[13px] leading-relaxed font-semibold font-sans">{result.categoryReason}</p>
                </div>
              )}

              <div className="pt-6 flex flex-wrap gap-3.5 items-center justify-center">
                <button 
                  onClick={() => setIsDetailOpen(true)}
                  className="inline-flex items-center gap-3 py-3.5 px-6 bg-white dark:bg-bg-side border border-border-main/80 rounded-xl hover:border-accent hover:text-accent transition-all group/btn shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-xs font-bold cursor-pointer"
                >
                  <FileText className="w-5 h-5 text-accent animate-pulse" />
                   <div className="text-left">
                      <div className="text-xs font-bold text-text-contrast">Baca Penjelasan Detail</div>
                      <div className="text-[10px] text-text-muted font-medium">Lihat rincian analisis fardhu & rincian dalil</div>
                   </div>
                   <ChevronRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ACTION BUTTONS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-slide-up">
          <button 
            onClick={() => setIsTimelineOpen(true)}
            className="group flex flex-col p-6 bg-white dark:bg-bg-side border border-border-main/55 rounded-2xl hover:border-accent transition-all text-left shadow-[0_4px_16px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_20px_rgba(185,28,28,0.03)] cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center text-accent mb-4.5 group-hover:scale-105 transition-transform">
               <Calendar className="w-5.5 h-5.5" />
            </div>
            <h3 className="text-[15px] font-bold text-text-contrast mb-1.5">Lihat Lini Masa Kalender</h3>
            <p className="text-xs text-text-muted leading-relaxed font-semibold italic">Lihat deskripsi status hukum darah hari demi hari secara ringkas.</p>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-accent opacity-0 group-hover:opacity-100 transition-opacity">
               Buka Lini Masa <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>

          <button 
            onClick={() => setIsQodloOpen(true)}
            className="group flex flex-col p-6 bg-white dark:bg-bg-side border border-border-main/55 rounded-2xl hover:border-accent transition-all text-left shadow-[0_4px_16px_rgba(0,0,0,0.01)] hover:shadow-[0_4px_20px_rgba(185,28,28,0.03)] cursor-pointer"
          >
            <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 mb-4.5 group-hover:scale-105 transition-transform">
               <Target className="w-5.5 h-5.5" />
            </div>
            <h3 className="text-[15px] font-bold text-text-contrast mb-1.5">Lihat Kewajiban Qadha</h3>
            <p className="text-xs text-text-muted leading-relaxed font-semibold italic">
               {result?.qadhoObligations.length === 0 && result.totalQodloPuasa === 0 
                ? "Alhamdulillah, tidak ada kewajiban qadha yang terdeteksi." 
                : "Lihat rincian shalat dan puasa yang wajib Anda qadha."}
            </p>
            <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
               Buka Daftar Qadha <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </button>
        </div>
      </div>

      <button 
        onClick={handleResetForm}
        className="w-full py-4.5 bg-white dark:bg-bg-side border border-border-main text-text-contrast rounded-full text-xs font-bold hover:border-accent hover:bg-[#FFF5F5] dark:hover:bg-white/5 transition-all flex items-center justify-center gap-3 shadow-sm active:scale-[0.98] cursor-pointer"
      >
        <RefreshCw className={cn("w-4.5 h-4.5", isResetConfirming ? "animate-spin-fast" : "animate-spin-slow")} /> 
        {isResetConfirming ? "Klik lagi untuk Hapus Data" : "Mulai Analisis Baru"}
      </button>
    </div>
  );

  const renderActiveStep = () => {
    const initialX = slideDirection === 'forward' ? "100%" : "-100%";
    const exitX = slideDirection === 'forward' ? "-100%" : "100%";

    const renderHalamanWrapper = (content: React.ReactNode, title: string, description: string | undefined, stepNum: number, showBottomNav = true) => {
      return (
        <motion.div
          key={stepNum}
          initial={{ x: initialX }}
          animate={{ x: 0 }}
          exit={{ x: exitX }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="halaman bg-bg-main"
        >
          <div className="halaman-header">
            <Header 
              onMenuClick={() => setIsSidebarOpen(true)}
              title={title}
              description={description}
              showBack={stepNum > 1}
              step={stepNum <= 4 ? stepNum : undefined}
              totalSteps={4}
            >
              <button 
                type="button"
                onClick={toggleTheme}
                className="p-1 px-[5px] border border-border-main text-slate-500 hover:text-text-contrast rounded hover:bg-bg-card transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>

              {stepNum === 5 && (
                <button 
                  type="button"
                  className="px-3 py-1 bg-accent/10 text-accent border border-accent/20 text-[9px] uppercase font-bold tracking-widest rounded flex items-center gap-1.5 cursor-pointer ml-1"
                  onClick={() => window.print()}
                >
                  <Save className="w-3 h-3" /> <span className="hidden sm:inline">PDF</span>
                </button>
              )}
            </Header>
          </div>

          <div className="halaman-konten custom-scrollbar min-h-0">
            <div className="max-w-4xl mx-auto w-full md:px-4">
              {content}
            </div>
          </div>

          {showBottomNav && (
            <div className="halaman-footer">
              {renderStickyBottomNav()}
            </div>
          )}
        </motion.div>
      );
    };


    if (step === 1) return renderHalamanWrapper(renderStep1Redesign(), "Profil Dasar", "Masukkan data tanggal lahir, kondisi & status pengalaman", 1, true);
    if (step === 2) return renderHalamanWrapper(renderStep3(), "Riwayat Adat", "Atur ingatan kebiasaan siklus", 2, true);
    if (step === 3) return renderHalamanWrapper(renderStep5Redesign(), "Timeline Darah", "Catat setiap perubahan kondisi darah", 3, true);
    if (step === 4) return renderHalamanWrapper(renderStep4Redesign(), "Konteks Waktu", "Informasi kewajiban shalat sebelum darah keluar", 4, true);
    if (step === 5) return renderHalamanWrapper(renderResult(), "Hasil Analisis", "Output kesimpulan hukum & kewajiban qodho", 5, false);
    return null;
  };

  return (
    <div className="app-wrapper h-screen w-full bg-bg-main text-text-main font-sans flex flex-col overflow-hidden">
      {/* LEFT SIDEBAR (Adaptive Drawer) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 border-r border-border-main flex flex-col h-full bg-bg-side transition-transform duration-300 shadow-2xl",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-8 border-b border-border-main flex flex-col justify-between shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo.png?v=3" 
                alt="Al-Kautsar Logo" 
                className="w-12 h-12 rounded-2xl object-cover object-top border border-[#B91C1C]/25 shadow-md shrink-0 bg-white" 
                referrerPolicy="no-referrer" 
              />
              <div>
                <h1 className="text-xl font-display font-black text-accent tracking-normal leading-tight">Al-Kautsar</h1>
                <p className="text-[9px] tracking-[0.08em] text-text-muted font-black uppercase mt-0.5 font-display">Fiqh Darah AI</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={closeSidebarManual}
              className="p-2 -mr-2 text-text-muted hover:text-accent hover:bg-bg-bottom border border-border-main/35 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col custom-scrollbar">
          <nav className="flex-1 px-8 py-10 space-y-8">
            <div className="mb-4 border-b border-border-main pb-4">
               <p className="text-xs text-slate-500 font-bold font-display opacity-85">Menu Utama</p>
            </div>
            
            {renderStepNav()}
            
            <button 
              type="button"
              onClick={() => {
                navigate('/articles');
              }}
              className={cn(
                "flex items-center gap-3 transition-colors text-left w-full cursor-pointer",
                location.pathname.startsWith('/articles') ? "text-accent" : "text-slate-500 hover:text-text-contrast"
              )}
            >
              <FileText className="w-5 h-5" />
              <span className="text-xs font-semibold tracking-wide font-display">Artikel Fiqh</span>
            </button>

            <div className="mt-auto">
              <AdminAuth />
            </div>

            <div className="pt-10 border-t border-border-main space-y-6">
              <div className="text-xs text-text-muted font-bold tracking-wide font-display">Profil Real-time</div>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-bg-card p-3 rounded-xl border border-border-main/50">
                  <div className="text-[10px] text-text-muted font-semibold font-display mb-1">Konteks</div>
                  <div className="text-[11px] text-text-contrast flex justify-between items-center font-medium">
                    <span>{context === 'haid' ? 'Haid' : context === 'nifas' ? 'Nifas' : '-'}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full", context === 'haid' ? "bg-red-500 animate-pulse" : context === 'nifas' ? "bg-purple-500 animate-pulse" : "bg-neutral-300")} />
                  </div>
                </div>
                <div className="bg-bg-card p-3 rounded-xl border border-border-main/50">
                  <div className="text-[10px] text-text-muted font-semibold font-display mb-1">Status Pengalaman</div>
                  <div className="text-[11px] text-text-contrast font-medium truncate">
                    {experience === 'mubtadiah' ? 'Mubtadi\'ah' : experience === 'mutadah' ? 'Mu\'tadah' : '-'}
                  </div>
                </div>
              </div>
            </div>
          </nav>

          <div className="p-8 bg-bg-bottom border-t border-border-main">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs text-text-contrast tracking-wide font-bold font-display">Mazhab Syafi'i</span>
            </div>
            <p className="text-[10px] leading-relaxed italic text-text-muted font-serif opacity-80">
              Uyunul Masa-il Linnisa & Panduan Tamyiz Terpadu
            </p>
            
            {/* PWA offline tip */}
            <div className="mt-4 pt-4 border-t border-border-main/50">
              <div className="flex items-center gap-1.5 text-[10px] text-teal-600 dark:text-teal-400 tracking-wide mb-1 font-bold">
                <Sparkles size={11} className="text-teal-500" />
                <span>PWA Offline Aktif</span>
              </div>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Dapat diinstal di Layar Utama HP / Desktop Anda dan digunakan 100% tanpa internet (Offline).
              </p>
            </div>
          </div>
        </div>

      </aside>

      {/* Backdrop overlay for sidebar drawer */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
          onClick={closeSidebarManual}
        />
      )}

      {/* MAIN INTERACTION AREA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-bg-main relative">
        {location.pathname !== '/' && (
          <Header 
            onMenuClick={() => setIsSidebarOpen(true)}
            title={location.pathname.startsWith('/articles') ? 'Artikel Fiqh' : currentStep.name}
            description={!location.pathname.startsWith('/articles') ? currentStep.description : undefined}
            showBack={location.pathname !== '/'}
            step={location.pathname.startsWith('/articles') ? undefined : (step <= 4 ? step : undefined)}
            totalSteps={4}
          >
            <button 
                type="button"
                onClick={toggleTheme}
                className="p-2 md:p-2.5 border border-border-main text-slate-500 hover:text-text-contrast rounded hover:bg-bg-card transition-colors cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {step === 5 && !location.pathname.startsWith('/articles') && (
                <button 
                  type="button"
                  className="px-4 md:px-6 py-2 md:py-2.5 bg-accent/10 text-accent border border-accent/30 text-[9px] md:text-[10px] uppercase font-bold tracking-widest rounded flex items-center gap-2 cursor-pointer"
                  onClick={() => window.print()}
                >
                  <Save className="w-3 h-3" /> <span className="hidden sm:inline">PDF</span>
                </button>
              )}
          </Header>
        )}

        <Routes>
          <Route path="/articles" element={<div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar"><ArticleList /></div>} />
          <Route path="/articles/:id" element={<div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar"><ArticleDetail /></div>} />
          <Route path="/articles/new" element={<div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar"><ArticleEditor /></div>} />
          <Route path="/articles/edit/:id" element={<div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar"><ArticleEditor /></div>} />
          
          <Route path="/" element={
            <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative">
              <AnimatePresence mode="wait" initial={false}>
                {renderActiveStep()}
              </AnimatePresence>
            </div>
          } />
        </Routes>
      </main>

      {/* RIGHT PANEL - Adaptive (Bottom or Sidebar) */}
      {step < 5 && false && (
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
