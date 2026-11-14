"use client";

import { useCallback } from "react";
import type { YogaClass } from "@/data/types";
import { patientById } from "@/data/patients";
import { staffById } from "@/data/staff";
import { formatDate, pluralize } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { raiseFlag } from "@/features/tasks/flags";
import { NOW_ISO } from "@/features/tasks/time";
import { precautionText } from "./model";
import { classActions } from "./store";
import type { ClearanceDecision } from "./clearance-review";

type Enrolment = YogaClass["enrolled"][number];

export const sessionContext = (cls: YogaClass) => `${cls.title} · ${formatDate(cls.start, { weekday: "short", day: "numeric", month: "short" })}`;

/**
 * Records an instructor's decision on a changed or expired precaution. Acknowledging applies to
 * every session for that patient; holding applies to this session only and, for an expired
 * approval, flags the doctor (same day) to renew it.
 */
export function usePrecautionDecision() {
  const { user } = useRole();
  const { toast } = useToast();
  return useCallback(
    (cls: YogaClass, e: Enrolment, d: ClearanceDecision, stillOpen: number) => {
      const patient = patientById(e.patientId);
      const decision = { kind: d.kind, note: d.note, by: user.id, at: NOW_ISO };
      if (d.kind === "acknowledged") classActions.acknowledge(e.patientId, decision);
      else classActions.hold(cls.id, e.patientId, decision);
      let flagged = "";
      if (d.requestRenewal) {
        const { ownerId } = raiseFlag({
          patientId: e.patientId,
          text: `Precaution approval expired — please renew: “${precautionText(e.precaution) ?? "session precautions"}”. Held from ${sessionContext(cls)} until it's renewed.`,
          urgency: "same-day",
          byId: user.id,
          context: sessionContext(cls),
        });
        flagged = ` ${staffById(ownerId)?.name ?? "The doctor"} was flagged to renew it.`;
      }
      toast({
        title: d.kind === "acknowledged" ? `Acknowledged for ${patient?.name}` : `${patient?.name} held from this session`,
        description: `${stillOpen ? `${pluralize(stillOpen, "precaution")} still to acknowledge before the session can start.` : "Nothing left to acknowledge — the session can start."}${flagged} Saved in this browser session.`,
        tone: stillOpen ? "neutral" : "success",
      });
    },
    [toast, user.id],
  );
}
