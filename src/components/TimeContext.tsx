import React from 'react';
import { HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  hasPerformedPrayerBeforeBleeding: boolean;
  onChange: (val: boolean) => void;
}

export default function TimeContext({ hasPerformedPrayerBeforeBleeding, onChange }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-xs">
        <h3 className="text-sm font-bold text-text-contrast mb-2">Kewajiban Shalat</h3>
        <p className="text-xs text-text-muted mb-6 leading-relaxed">
          Pilih pernyataan yang paling sesuai dengan kondisi Anda saat darah pertama kali keluar (di awal masa haid/nifas ini).
        </p>

        <div className="space-y-4">
          <label className="flex gap-4 p-4 border border-border-main rounded-xl cursor-pointer hover:border-accent/40 transition-all bg-bg-main/50">
            <input 
              type="radio" 
              name="prayer" 
              className="mt-1 accent-accent"
              checked={hasPerformedPrayerBeforeBleeding === true}
              onChange={() => onChange(true)}
            />
            <div>
              <span className="text-sm font-bold text-text-contrast block">Sudah Mengerjakan Shalat</span>
              <span className="text-[11px] text-text-muted mt-1.5 block leading-relaxed">
                Saat darah pertama keluar, saya <strong>sudah</strong> melaksanakan shalat fardhu pada waktu tersebut.
              </span>
            </div>
          </label>
          
          <label className="flex gap-4 p-4 border border-border-main rounded-xl cursor-pointer hover:border-accent/40 transition-all bg-bg-main/50">
            <input 
              type="radio" 
              name="prayer" 
              className="mt-1 accent-accent"
              checked={hasPerformedPrayerBeforeBleeding === false}
              onChange={() => onChange(false)}
            />
            <div>
              <span className="text-sm font-bold text-text-contrast block">Belum Mengerjakan Shalat</span>
              <span className="text-[11px] text-text-muted mt-1.5 block leading-relaxed">
                Saat darah pertama keluar, saya <strong>belum</strong> melaksanakan shalat fardhu padahal waktu shalat sudah masuk.
              </span>
            </div>
          </label>
        </div>
        
        <div className="mt-6 flex gap-3 p-4 bg-blue-50/50 dark:bg-blue-500/5 rounded-xl border border-blue-100 dark:border-blue-500/10">
          <HelpCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-blue-900/70 dark:text-blue-200/70">
            <strong>Info:</strong> Jika Anda belum shalat saat darah datang padahal ada cukup waktu (sekitar 15 menit) untuk bersuci dan shalat, maka shalat tersebut berstatus hutang dan wajib diqodho ketika Anda sudah suci.
          </p>
        </div>
      </div>
    </div>
  );
}
