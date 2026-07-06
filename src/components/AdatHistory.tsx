import React from 'react';
import { UserHabit, HabitRetrospection } from '../types';
import { cn } from '../lib/utils';
import { HelpCircle } from 'lucide-react';

interface Props {
  habit: UserHabit;
  onChange: (habit: UserHabit) => void;
}

export default function AdatHistory({ habit, onChange }: Props) {
  const updateHabit = (updates: Partial<UserHabit>) => {
    onChange({ ...habit, ...updates });
  };

  return (
    <div className="space-y-6">
      <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-xs">
        <h3 className="text-sm font-bold text-text-contrast mb-4">Ingatan Adat (Kebiasaan)</h3>
        <p className="text-xs text-text-muted mb-6 leading-relaxed">
          Sebagai Mu'tadah, hukum fikih Anda sangat bergantung pada apa yang masih Anda ingat tentang kebiasaan siklus bulan-bulan sebelumnya.
        </p>

        <div className="space-y-4">
          <label className="flex gap-3 p-4 border border-border-main rounded-xl cursor-pointer hover:border-accent/40 transition-all bg-bg-main/50">
            <input 
              type="radio" 
              name="retrospection" 
              className="mt-0.5 accent-accent"
              checked={habit.retrospection === 'ingat_awal_dan_durasi'}
              onChange={() => updateHabit({ retrospection: 'ingat_awal_dan_durasi' })}
            />
            <div>
              <span className="text-sm font-bold text-text-contrast block">Ingat Awal dan Durasi</span>
              <span className="text-xs text-text-muted mt-1 block">Saya ingat kapan biasanya darah keluar (misal tanggal 1) dan durasinya (misal 6 hari).</span>
            </div>
          </label>
          
          <label className="flex gap-3 p-4 border border-border-main rounded-xl cursor-pointer hover:border-accent/40 transition-all bg-bg-main/50">
            <input 
              type="radio" 
              name="retrospection" 
              className="mt-0.5 accent-accent"
              checked={habit.retrospection === 'ingat_durasi_saja'}
              onChange={() => updateHabit({ retrospection: 'ingat_durasi_saja' })}
            />
            <div>
              <span className="text-sm font-bold text-text-contrast block">Ingat Durasi Saja</span>
              <span className="text-xs text-text-muted mt-1 block">Saya hanya ingat durasinya (misal 6 hari) tapi lupa tanggal mulainya.</span>
            </div>
          </label>
          
          <label className="flex gap-3 p-4 border border-border-main rounded-xl cursor-pointer hover:border-accent/40 transition-all bg-bg-main/50">
            <input 
              type="radio" 
              name="retrospection" 
              className="mt-0.5 accent-accent"
              checked={habit.retrospection === 'ingat_awal_saja'}
              onChange={() => updateHabit({ retrospection: 'ingat_awal_saja' })}
            />
            <div>
              <span className="text-sm font-bold text-text-contrast block">Ingat Awal Saja</span>
              <span className="text-xs text-text-muted mt-1 block">Saya hanya ingat tanggal mulai keluar darah, tapi lupa durasinya.</span>
            </div>
          </label>

          <label className="flex gap-3 p-4 border border-border-main rounded-xl cursor-pointer hover:border-accent/40 transition-all bg-bg-main/50">
            <input 
              type="radio" 
              name="retrospection" 
              className="mt-0.5 accent-accent"
              checked={habit.retrospection === 'lupa_semua'}
              onChange={() => updateHabit({ retrospection: 'lupa_semua' })}
            />
            <div>
              <span className="text-sm font-bold text-[#B91C1C] block">Lupa Semuanya (Mutahayyirah)</span>
              <span className="text-xs text-text-muted mt-1 block">Saya benar-benar lupa tanggal mulai maupun durasinya.</span>
            </div>
          </label>
        </div>
      </div>

      {/* Dynamic forms based on selection */}
      {habit.retrospection !== 'lupa_semua' && (
        <div className="bg-bg-card border border-border-main rounded-2xl p-6 shadow-xs animate-in fade-in slide-in-from-bottom-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">Detail Adat</h4>
          
          <div className="space-y-4">
            {(habit.retrospection === 'ingat_awal_dan_durasi' || habit.retrospection === 'ingat_durasi_saja') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted">Durasi (Hari)</label>
                  <input 
                    type="number" 
                    min="1" max="15"
                    value={habit.durasiHari || ''}
                    onChange={e => updateHabit({ durasiHari: parseInt(e.target.value) || 0 })}
                    className="w-full bg-bg-main border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-contrast focus:border-accent focus:outline-none"
                    placeholder="Misal: 7"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted">Durasi (Jam)</label>
                  <input 
                    type="number" 
                    min="0" max="23"
                    value={habit.durasiJam || ''}
                    onChange={e => updateHabit({ durasiJam: parseInt(e.target.value) || 0 })}
                    className="w-full bg-bg-main border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-contrast focus:border-accent focus:outline-none"
                    placeholder="Misal: 0"
                  />
                </div>
              </div>
            )}

            {(habit.retrospection === 'ingat_awal_dan_durasi' || habit.retrospection === 'ingat_awal_saja') && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted">Tanggal Mulai Biasa</label>
                  <input 
                    type="number" 
                    min="1" max="31"
                    value={habit.tanggalMulai || ''}
                    onChange={e => updateHabit({ tanggalMulai: parseInt(e.target.value) || 0 })}
                    className="w-full bg-bg-main border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-contrast focus:border-accent focus:outline-none"
                    placeholder="Tanggal (1-31)"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-text-muted">Jam Mulai Biasa</label>
                  <input 
                    type="time" 
                    value={habit.jamMulai || ''}
                    onChange={e => updateHabit({ jamMulai: e.target.value })}
                    className="w-full bg-bg-main border border-border-main rounded-xl px-4 py-2.5 text-sm text-text-contrast focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
