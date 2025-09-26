import { AnimatePresence, motion } from 'framer-motion';
import { UiCashflow, randomId } from '@/lib/finance';

interface CashflowEditorProps {
  cashflows: UiCashflow[];
  onChange(cashflows: UiCashflow[]): void;
}

export function CashflowEditor({ cashflows, onChange }: CashflowEditorProps) {
  const addRow = () => {
    const last = cashflows[cashflows.length - 1];
    const nextDate = last ? shiftDate(last.date, 12) : new Date().toISOString().slice(0, 10);
    onChange([...cashflows, { id: randomId(), date: nextDate, amount: 0 }]);
  };

  const updateRow = (id: string, patch: Partial<UiCashflow>) => {
    onChange(cashflows.map((cf) => (cf.id === id ? { ...cf, ...patch } : cf)));
  };

  const removeRow = (id: string) => {
    if (cashflows.length <= 1) {
      return;
    }
    onChange(cashflows.filter((cf) => cf.id !== id));
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-glass">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Cashflow Schedule</h3>
          <p className="text-sm text-slate-300/80">Amounts in USD millions</p>
        </div>
        <button
          type="button"
          onClick={addRow}
          className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/20"
        >
          Add Row
        </button>
      </div>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {cashflows.map((cf) => (
            <motion.div
              key={cf.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
            >
              <label className="text-sm text-slate-200/70">
                Date
                <input
                  type="date"
                  value={cf.date}
                  onChange={(event) => updateRow(cf.id, { date: event.target.value })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-base text-white outline-none focus:border-accent-blue"
                />
              </label>
              <label className="text-sm text-slate-200/70">
                Amount (M)
                <input
                  type="number"
                  inputMode="decimal"
                  value={Number.isFinite(cf.amount) ? cf.amount : 0}
                  onChange={(event) => updateRow(cf.id, { amount: Number(event.target.value) })}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-base text-white outline-none focus:border-accent-blue"
                />
              </label>
              <button
                type="button"
                onClick={() => removeRow(cf.id)}
                className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/20"
              >
                Remove
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

function shiftDate(iso: string, months: number): string {
  const date = new Date(iso + 'T00:00:00Z');
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}
