import { useCallback, useMemo, useState } from 'react';
import { createDefaultState, resolveActiveScenarioId, type BuilderState } from '@/lib/finance';

type ContextState = BuilderState['context'];

type ContextSectionValue<Section extends keyof ContextState> = ContextState[Section];

type SectionUpdater<Section extends keyof ContextState> = (
  current: ContextSectionValue<Section>,
) => ContextSectionValue<Section>;

export interface UseBuilderStateResult {
  state: BuilderState;
  activeScenarioId?: string;
  setActiveScenarioId(id?: string): void;
  setForecast(forecast: BuilderState['forecast']): void;
  replaceState(next: BuilderState): void;
  setContextValue<K extends keyof ContextState>(key: K, value: ContextState[K]): void;
  mutateContext(updater: (context: ContextState) => ContextState): void;
  updateWorkingCapital<K extends keyof ContextState['workingCapital']>(
    key: K,
    value: ContextState['workingCapital'][K],
  ): void;
  updateCapex<K extends keyof ContextState['capex']>(
    key: K,
    value: ContextState['capex'][K],
  ): void;
  updateLeases<K extends keyof ContextState['leases']>(
    key: K,
    value: ContextState['leases'][K],
  ): void;
  updateTax<K extends keyof ContextState['tax']>(
    key: K,
    value: ContextState['tax'][K],
  ): void;
  updateWacc<K extends keyof ContextState['wacc']>(
    key: K,
    value: ContextState['wacc'][K],
  ): void;
  updateTerminal<K extends keyof ContextState['terminalValue']>(
    key: K,
    value: ContextState['terminalValue'][K],
  ): void;
  updateGordon<K extends keyof ContextState['terminalValue']['gordon']>(
    key: K,
    value: ContextState['terminalValue']['gordon'][K],
  ): void;
  updateExit<K extends keyof ContextState['terminalValue']['exitMultiple']>(
    key: K,
    value: ContextState['terminalValue']['exitMultiple'][K],
  ): void;
}

export function useBuilderState(): UseBuilderStateResult {
  const initial = useMemo(() => createDefaultState(), []);
  const [state, setState] = useState<BuilderState>(() => initial);
  const [activeScenarioId, setActiveScenario] = useState<string | undefined>(() =>
    resolveActiveScenarioId(initial),
  );

  const setActiveScenarioId = useCallback((id?: string) => {
    setActiveScenario(id);
    setState((prev) => ({
      ...prev,
      activeScenarioId: id,
    }));
  }, []);

  const replaceState = useCallback((next: BuilderState) => {
    setState(next);
    setActiveScenario(resolveActiveScenarioId(next));
  }, []);

  const setForecast = useCallback((forecast: BuilderState['forecast']) => {
    setState((prev) => ({
      ...prev,
      forecast,
    }));
  }, []);

  const mutateContext = useCallback((updater: (context: ContextState) => ContextState) => {
    setState((prev) => ({
      ...prev,
      context: updater(prev.context),
    }));
  }, []);

  const setContextValue = useCallback(
    <K extends keyof ContextState>(key: K, value: ContextState[K]) => {
      mutateContext((context) => ({
        ...context,
        [key]: value,
      }));
    },
    [mutateContext],
  );

  const updateContextSection = useCallback(
    <Section extends keyof ContextState>(
      section: Section,
      updater: SectionUpdater<Section>,
    ) => {
      mutateContext((context) => ({
        ...context,
        [section]: updater(context[section]),
      }));
    },
    [mutateContext],
  );

  const updateWorkingCapital = useCallback(
    <K extends keyof ContextState['workingCapital']>(
      key: K,
      value: ContextState['workingCapital'][K],
    ) =>
      updateContextSection('workingCapital', (section) => ({
        ...section,
        [key]: value,
      })),
    [updateContextSection],
  );

  const updateCapex = useCallback(
    <K extends keyof ContextState['capex']>(key: K, value: ContextState['capex'][K]) =>
      updateContextSection('capex', (section) => ({
        ...section,
        [key]: value,
      })),
    [updateContextSection],
  );

  const updateLeases = useCallback(
    <K extends keyof ContextState['leases']>(key: K, value: ContextState['leases'][K]) =>
      updateContextSection('leases', (section) => ({
        ...section,
        [key]: value,
      })),
    [updateContextSection],
  );

  const updateTax = useCallback(
    <K extends keyof ContextState['tax']>(key: K, value: ContextState['tax'][K]) =>
      updateContextSection('tax', (section) => ({
        ...section,
        [key]: value,
      })),
    [updateContextSection],
  );

  const updateWacc = useCallback(
    <K extends keyof ContextState['wacc']>(key: K, value: ContextState['wacc'][K]) =>
      updateContextSection('wacc', (section) => ({
        ...section,
        [key]: value,
      })),
    [updateContextSection],
  );

  const updateTerminal = useCallback(
    <K extends keyof ContextState['terminalValue']>(
      key: K,
      value: ContextState['terminalValue'][K],
    ) =>
      updateContextSection('terminalValue', (section) => ({
        ...section,
        [key]: value,
      })),
    [updateContextSection],
  );

  const updateGordon = useCallback(
    <K extends keyof ContextState['terminalValue']['gordon']>(
      key: K,
      value: ContextState['terminalValue']['gordon'][K],
    ) =>
      updateContextSection('terminalValue', (section) => ({
        ...section,
        gordon: {
          ...section.gordon,
          [key]: value,
        },
      })),
    [updateContextSection],
  );

  const updateExit = useCallback(
    <K extends keyof ContextState['terminalValue']['exitMultiple']>(
      key: K,
      value: ContextState['terminalValue']['exitMultiple'][K],
    ) =>
      updateContextSection('terminalValue', (section) => ({
        ...section,
        exitMultiple: {
          ...section.exitMultiple,
          [key]: value,
        },
      })),
    [updateContextSection],
  );

  return {
    state,
    activeScenarioId,
    setActiveScenarioId,
    setForecast,
    replaceState,
    setContextValue,
    mutateContext,
    updateWorkingCapital,
    updateCapex,
    updateLeases,
    updateTax,
    updateWacc,
    updateTerminal,
    updateGordon,
    updateExit,
  };
}

