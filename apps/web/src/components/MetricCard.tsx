import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  sublabel?: string;
  icon?: ReactNode;
  accent?: 'blue' | 'teal';
}

const accentMap = {
  blue: 'from-[#0a84ff]/60 to-[#5ac8fa]/40',
  teal: 'from-[#34d399]/50 to-[#10b981]/30',
} as const;

export function MetricCard({ label, value, sublabel, icon, accent = 'blue' }: MetricCardProps) {
  return (
    <motion.div
      whileHover={{ translateY: -4 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className="relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 text-slate-100 shadow-glass"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accentMap[accent]} opacity-60`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-sm uppercase tracking-[0.2em] text-slate-300/70">{label}</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
          {sublabel ? <div className="mt-1 text-sm text-slate-200/70">{sublabel}</div> : null}
        </div>
        {icon ? <div className="text-3xl text-slate-100/80">{icon}</div> : null}
      </div>
    </motion.div>
  );
}
