import React from 'react';
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
      <div className="flex gap-2 md:gap-4 ml-4">
        {children}
      </div>
    </header>
  );
}
