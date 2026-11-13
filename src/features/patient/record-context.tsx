"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PatientRecord } from "@/data/record";

/** Provides the current patient's record (systems, conditions, events) to the workspace views. */
const RecordCtx = createContext<PatientRecord | null>(null);

export function RecordProvider({ record, children }: { record: PatientRecord; children: ReactNode }) {
  return <RecordCtx.Provider value={record}>{children}</RecordCtx.Provider>;
}

export function useRecord() {
  const record = useContext(RecordCtx);
  if (!record) throw new Error("useRecord must be used inside <RecordProvider>");
  return useMemo(
    () => ({
      record,
      systemById: (id: string) => record.systems.find((s) => s.id === id) ?? record.systems[0],
      conditionById: (id: string) => record.conditions.find((c) => c.id === id),
    }),
    [record],
  );
}
