import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface StreamEntry {
  id: string;
  label: string;
  detail?: string;
  tone?: 'info' | 'warn' | 'error' | 'success';
  timestamp: string;
}

interface StreamConsoleProps {
  entries: StreamEntry[];
  isOpen: boolean;
  onClose(): void;
  headerExtras?: ReactNode;
}

const toneMap: Record<NonNullable<StreamEntry['tone']>, string> = {
  info: 'text-slate-200',
  warn: 'text-yellow-300',
  error: 'text-rose-300',
  success: 'text-emerald-300',
};

export function StreamConsole({ entries, isOpen, onClose, headerExtras }: StreamConsoleProps) {
  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-6 right-6 z-30 flex w-[28rem] max-w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface/95 shadow-lg shadow-black/40 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-slate-300/70">Stream Mode</p>
              <p className="text-sm text-slate-100/80">Live valuation trace</p>
            </div>
            <div className="flex items-center gap-3">
              {headerExtras}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto px-5 py-4 text-sm">
            {entries.length === 0 ? (
              <p className="text-xs text-slate-400/80">No messages yet. Trigger a valuation to populate the stream.</p>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="space-y-1 rounded-2xl bg-white/5 p-3">
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.25em] text-slate-400/80">
                    <span>{entry.timestamp}</span>
                    <span className={toneMap[entry.tone ?? 'info']}>{entry.tone?.toUpperCase() ?? 'INFO'}</span>
                  </div>
                  <p className="text-sm text-slate-100">{entry.label}</p>
                  {entry.detail ? <p className="text-xs text-slate-300/80">{entry.detail}</p> : null}
                </div>
              ))
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
