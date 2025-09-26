import type { EngineKind } from '@dcf-builder/engine-loader';
import { motion } from 'framer-motion';

interface EngineBadgeProps {
  kind: EngineKind;
}

const labelMap: Record<EngineKind, { label: string; description: string }> = {
  wasm: {
    label: 'WASM Core',
    description: 'Rust accelerated',
  },
  ts: {
    label: 'TypeScript Core',
    description: 'Fallback runtime',
  },
};

export function EngineBadge({ kind }: EngineBadgeProps) {
  const entry = labelMap[kind];
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-200/80"
    >
      <span className="h-2 w-2 rounded-full bg-gradient-to-br from-[#0a84ff] to-[#5ac8fa]" />
      <div className="flex flex-col text-left uppercase">
        <span className="text-[0.7rem] font-semibold text-white">{entry.label}</span>
        <span className="text-[0.6rem] tracking-[0.25em] text-slate-200/70">{entry.description}</span>
      </div>
    </motion.div>
  );
}
