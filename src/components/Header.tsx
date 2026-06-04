import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ChevronLeft } from 'lucide-react';
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
    <header className="h-20 md:h-24 border-b border-border-main flex items-center justify-between px-6 md:px-12 bg-bg-main/50 backdrop-blur-md sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        {showBack ? (
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:text-accent">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <button onClick={onMenuClick} className="p-2 -ml-2 text-slate-500 hover:text-accent">
            <Menu size={24} />
          </button>
        )}
        <div className="flex-1">
          <h2 className="text-lg md:text-xl font-serif tracking-tight">{title}</h2>
          {description && (
            <p className="text-[9px] md:text-[10px] text-slate-500 uppercase tracking-widest mt-1 hidden sm:block">
              {description}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-4 ml-4">
        {/* Dynamic PWA Online/Offline Indicator */}
        {isOnline ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Online</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Offline Ready</span>
          </div>
        )}
        {children}
      </div>
    </header>
  );
}
