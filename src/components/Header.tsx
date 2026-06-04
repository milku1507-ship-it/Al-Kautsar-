import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronLeft, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
  description?: string;
  showBack?: boolean;
  children?: React.ReactNode;
}

export default function Header({ onMenuClick, title, description, showBack, children }: HeaderProps) {
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
    <header className="h-20 md:h-22 border-b border-border-main/60 flex items-center justify-between px-6 md:px-12 bg-bg-side/75 backdrop-blur-xl sticky top-0 z-40 transition-all">
      <div className="flex items-center gap-4 flex-1">
        {showBack ? (
          <button 
            type="button"
            onClick={() => navigate(-1)} 
            className="p-2 md:p-2.5 -ml-2 text-text-muted hover:text-accent bg-bg-main/50 hover:bg-bg-bottom border border-border-main/35 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <ChevronLeft size={20} className="stroke-[2px]" />
          </button>
        ) : (
          <button 
            type="button"
            onClick={onMenuClick} 
            className="p-2 md:p-2.5 -ml-2 text-text-muted hover:text-accent bg-bg-main/50 hover:bg-bg-bottom border border-border-main/35 rounded-full shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Menu size={20} className="stroke-[2px]" />
          </button>
        )}
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[#B91C1C] font-display font-black text-lg md:text-xl tracking-tight">Al-Kautsar</span>
            <span className="text-border-main text-xs hidden sm:inline">•</span>
          </div>
          <h2 className="text-sm md:text-[15px] font-display font-semibold tracking-tight text-text-contrast line-clamp-1">
            {title}
          </h2>
          {description && (
            <span className="text-[10px] md:text-xs text-text-muted font-medium mt-0.5 sm:mt-0 hidden md:inline">
              ({description})
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4 ml-4">
        {/* Dynamic PWA Online/Offline Indicator */}
        {isOnline ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">Online</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="hidden sm:inline">Offline</span>
          </div>
        )}
        {children}
      </div>
    </header>
  );
}

