import React, { useState } from 'react';
import { BloodEvent, EventType, BloodColor, BloodTexture, BloodAroma } from '../types';
import { Plus, Trash2, Clock, Droplet, CheckCircle2, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Props {
  events: BloodEvent[];
  onChange: (events: BloodEvent[]) => void;
}

export default function TimelineEventList({ events, onChange }: Props) {
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newEvent, setNewEvent] = useState<Partial<BloodEvent>>({
    eventType: 'START_BLOOD',
    color: 'merah',
    texture: 'cair',
    aroma: 'tidak_busuk'
  });

  const handleAdd = () => {
    if (!newEvent.datetime || !newEvent.eventType) return;
    
    const id = Math.random().toString(36).substring(7);
    const added: BloodEvent = {
      id,
      datetime: newEvent.datetime,
      eventType: newEvent.eventType as EventType,
      color: newEvent.color as BloodColor,
      texture: newEvent.texture as BloodTexture,
      aroma: newEvent.aroma as BloodAroma,
    };
    
    onChange([...events, added]);
    setIsModalOpen(false);
    setNewEvent({
      eventType: 'START_BLOOD',
      color: 'merah',
      texture: 'cair',
      aroma: 'tidak_busuk'
    });
  };

  const removeEvent = (id: string) => {
    onChange(events.filter(e => e.id !== id));
  };

  const sortedEvents = [...events].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const formatEventName = (type: string) => {
    switch (type) {
      case 'START_BLOOD': return 'Darah Mulai Keluar';
      case 'STOP_BLOOD': return 'Darah Berhenti';
      case 'CHANGE_CHARACTERISTIC': return 'Berubah Sifat (Warna/Tekstur/Aroma)';
      case 'CLEAN_PERIOD': return 'Masa Bersih';
      case 'BLEED_AGAIN': return 'Darah Keluar Lagi';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-text-contrast">Timeline Darah</h3>
        <div className="flex items-center gap-2">
          {events.length > 0 && (
            <button
              onClick={() => {
                if (!isResetConfirming) {
                  setIsResetConfirming(true);
                  setTimeout(() => setIsResetConfirming(false), 3000);
                  return;
                }
                setIsResetConfirming(false);
                onChange([]);
              }}
              className="bg-red-500/10 text-red-600 dark:text-red-400 px-3 md:px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-red-500/20 active:scale-95 transition-all"
            >
              <Trash2 className="w-4 h-4" /> {isResetConfirming ? "Yakin?" : "Reset"}
            </button>
          )}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-accent text-white px-3 md:px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        </div>
      </div>

      <div className="bg-bg-card border border-border-main rounded-2xl p-4 md:p-6 shadow-xs">
        {sortedEvents.length === 0 ? (
          <div className="text-center py-10">
            <Clock className="w-10 h-10 mx-auto text-text-muted mb-3 opacity-30" />
            <p className="text-sm text-text-muted font-semibold">Belum ada event darah yang dicatat.</p>
            <p className="text-xs text-text-muted/70 mt-1 max-w-xs mx-auto">Klik tombol "Tambah Event" untuk mulai mencatat kapan darah keluar, berubah sifat, atau berhenti.</p>
          </div>
        ) : (
          <div className="relative border-l-2 border-border-main ml-3 md:ml-6 space-y-6 pb-4">
            {sortedEvents.map((event, index) => (
              <div key={event.id} className="relative pl-6 md:pl-8">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-bg-card bg-accent shadow-sm" />
                
                <div className="bg-white dark:bg-bg-side border border-border-main rounded-xl p-4 shadow-sm relative group hover:border-accent/40 transition-colors">
                  <button 
                    onClick={() => removeEvent(event.id)}
                    className="absolute top-3 right-3 text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  
                  <div className="text-[10px] font-bold text-accent mb-1 flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(event.datetime), 'dd MMM yyyy, HH:mm', { locale: id })}
                  </div>
                  
                  <h4 className="text-sm font-bold text-text-contrast mb-2">{formatEventName(event.eventType)}</h4>
                  
                  {['START_BLOOD', 'CHANGE_CHARACTERISTIC', 'BLEED_AGAIN'].includes(event.eventType) && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {event.color && (
                        <span className="px-2 py-1 bg-neutral-100 dark:bg-zinc-800 text-text-main text-[10px] font-semibold rounded-md border border-border-main flex items-center gap-1.5">
                          <Droplet className="w-3 h-3 text-[#B91C1C]" />
                          Warna: <span className="capitalize text-text-contrast">{event.color}</span>
                        </span>
                      )}
                      {event.texture && (
                        <span className="px-2 py-1 bg-neutral-100 dark:bg-zinc-800 text-text-main text-[10px] font-semibold rounded-md border border-border-main">
                          Tekstur: <span className="capitalize text-text-contrast">{event.texture}</span>
                        </span>
                      )}
                      {event.aroma && (
                        <span className="px-2 py-1 bg-neutral-100 dark:bg-zinc-800 text-text-main text-[10px] font-semibold rounded-md border border-border-main">
                          Aroma: <span className="capitalize text-text-contrast">{event.aroma.replace('_', ' ')}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-bg-main border border-border-main rounded-2xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden"
            >
              <div className="p-5 border-b border-border-main/50 bg-bg-card">
                <h3 className="font-bold text-text-contrast text-lg">Catat Event Darah</h3>
              </div>
              
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase">Waktu Kejadian</label>
                  <input 
                    type="datetime-local" 
                    value={newEvent.datetime || ''}
                    onChange={(e) => setNewEvent({...newEvent, datetime: e.target.value})}
                    className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-3 text-sm text-text-contrast focus:border-accent focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-muted uppercase">Jenis Event</label>
                  <select 
                    value={newEvent.eventType}
                    onChange={(e) => setNewEvent({...newEvent, eventType: e.target.value as EventType})}
                    className="w-full bg-bg-card border border-border-main rounded-xl px-4 py-3 text-sm text-text-contrast focus:border-accent focus:outline-none appearance-none"
                  >
                    <option value="START_BLOOD">Darah Mulai Keluar</option>
                    <option value="CHANGE_CHARACTERISTIC">Berubah Sifat Darah</option>
                    <option value="STOP_BLOOD">Darah Berhenti</option>
                    <option value="CLEAN_PERIOD">Masa Bersih</option>
                    <option value="BLEED_AGAIN">Darah Keluar Lagi</option>
                  </select>
                </div>

                {['START_BLOOD', 'CHANGE_CHARACTERISTIC', 'BLEED_AGAIN'].includes(newEvent.eventType as string) && (
                  <div className="space-y-4 pt-2 border-t border-border-main/50">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Warna</label>
                        <select 
                          value={newEvent.color}
                          onChange={(e) => setNewEvent({...newEvent, color: e.target.value as BloodColor})}
                          className="w-full bg-bg-card border border-border-main rounded-lg px-2 py-2 text-xs text-text-contrast focus:border-accent focus:outline-none"
                        >
                          <option value="hitam">Hitam</option>
                          <option value="merah">Merah</option>
                          <option value="coklat">Coklat</option>
                          <option value="kuning">Kuning</option>
                          <option value="keruh">Keruh</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Tekstur</label>
                        <select 
                          value={newEvent.texture}
                          onChange={(e) => setNewEvent({...newEvent, texture: e.target.value as BloodTexture})}
                          className="w-full bg-bg-card border border-border-main rounded-lg px-2 py-2 text-xs text-text-contrast focus:border-accent focus:outline-none"
                        >
                          <option value="kental">Kental</option>
                          <option value="cair">Cair</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-muted uppercase">Aroma</label>
                        <select 
                          value={newEvent.aroma}
                          onChange={(e) => setNewEvent({...newEvent, aroma: e.target.value as BloodAroma})}
                          className="w-full bg-bg-card border border-border-main rounded-lg px-2 py-2 text-xs text-text-contrast focus:border-accent focus:outline-none"
                        >
                          <option value="busuk">Busuk</option>
                          <option value="tidak_busuk">Tdk Busuk</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-border-main/50 bg-bg-card flex gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 rounded-xl border border-border-main text-sm font-semibold text-text-main hover:bg-neutral-50 dark:hover:bg-white/5 transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleAdd}
                  disabled={!newEvent.datetime}
                  className="flex-1 py-3 rounded-xl bg-accent text-white text-sm font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  Simpan Event
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
