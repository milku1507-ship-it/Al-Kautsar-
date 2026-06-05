import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronLeft, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import logoImg from '../assets/logo.png';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
  description?: string;
  showBack?: boolean;
  children?: React.ReactNode;
  step?: number;
  totalSteps?: number;
}

export default function Header({ onMenuClick, title, description, showBack, children, step, totalSteps }: HeaderProps) {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="h-14 border-b border-border-main/40 flex items-center justify-between px-4 sm:px-6 bg-bg-side/75 backdrop-blur-md sticky top-0 z-40 transition-all relative">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {showBack ? (
          <button 
            type="button"
            onClick={() => navigate(-1)} 
            className="p-1.5 -ml-1 text-text-muted hover:text-accent bg-bg-main/50 hover:bg-bg-bottom border border-border-main/35 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer flex-shrink-0"
          >
            <ChevronLeft size={16} className="stroke-[2.5px]" />
          </button>
        ) : (
          <button 
            type="button"
            onClick={onMenuClick} 
            className="p-1.5 -ml-1 text-text-muted hover:text-accent bg-bg-main/50 hover:bg-bg-bottom border border-border-main/35 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer flex-shrink-0"
          >
            <Menu size={16} className="stroke-[2.5px]" />
          </button>
        )}
        <div className="flex-1 flex items-center gap-2 min-w-0 ml-1">
          <img 
            src={logoImg} 
            alt="Al-Kautsar Logo" 
            className="w-5.5 h-5.5 rounded-full object-cover border border-[#B91C1C]/20 shadow-xs shrink-0" 
            referrerPolicy="no-referrer" 
          />
          <span className="text-[#B91C1C] font-display font-black text-xs md:text-sm tracking-tight shrink-0">Al-Kautsar</span>
          <span className="text-border-main text-xs hidden sm:inline">•</span>
          <h2 className="text-xs md:text-sm font-display font-semibold tracking-tight text-text-contrast truncate">
            {title}
          </h2>
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
        {/* Dynamic PWA Online/Offline Indicator */}
        {isOnline ? (
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border border-[#10B981]/20 shadow-xs">
            <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Online</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-[#F59E0B]/20 shadow-xs">
            <span className="w-1 h-1 rounded-full bg-amber-500" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}
        {children}
      </div>

      {/* Pill-shaped progress bar sliding along the bottom edge - 4px */}
      {step !== undefined && totalSteps !== undefined && step <= totalSteps && (
        <div className="absolute bottom-0 left-0 right-0 h-[4px] bg-neutral-100 dark:bg-zinc-800/40">
          <div 
            className="h-full bg-gradient-to-r from-[#B91C1C] to-[#EF4444] transition-all duration-300 rounded-r-full"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      )}
    </header>
  );
}

