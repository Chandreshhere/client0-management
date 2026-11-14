"use client";

import { useCallback } from "react";
import { staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { formatTime } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { dayPhrase } from "@/features/tasks/time";
import { assignmentInfo } from "./meta";
import { markSeen, reassign as reassignTo, remind as remindStore, type CareReferral } from "./store";

/**
 * Assignment actions with honest outcomes — everything stays in this browser session.
 * Who can do what (spec F5, rules 2 and 5):
 *   recipient (nutritionist / instructor) → opens it, which marks it seen;
 *   assigning doctor → reminds while it waits, reassigns once it's back after 48 h;
 *   care coordinator (Pro) → the same follow-up across the clinic.
 */
export function useAssignmentActions() {
  const { user, role, has } = useRole();
  const { toast } = useToast();

  const isRecipient = useCallback((r: CareReferral) => r.toId === user.id, [user.id]);
  /** remind / reassign: the doctor who assigned it, or a coordinator (Pro) */
  const canFollowUp = useCallback((r: CareReferral) => r.fromId === user.id || (role === "coordinator" && has("coordinator")), [user.id, role, has]);

  /** Opening by the recipient marks it seen (once). */
  const open = useCallback(
    (r: CareReferral) => {
      if (!isRecipient(r) || !markSeen(r, user.id)) return;
      const from = staffById(r.fromId)?.name ?? "the doctor";
      toast({ title: "Marked as seen", description: `${from} can see you've opened it. Saved in this browser session.`, tone: "success" });
    },
    [isRecipient, toast, user.id],
  );

  const remind = useCallback(
    (r: CareReferral) => {
      remindStore(r);
      const to = staffById(r.toId)?.name ?? "the recipient";
      const info = assignmentInfo(r);
      toast({
        title: `Reminder recorded for ${to}`,
        description: `${info.status === "new" ? `It comes back to you ${dayPhrase(info.returnsAt)} at ${formatTime(info.returnsAt)} if still not opened. ` : ""}Saved in this browser session — nothing was sent.`,
      });
    },
    [toast],
  );

  const reassign = useCallback(
    (r: CareReferral, toId: string) => {
      reassignTo(r, toId, user.id);
      const to = staffById(toId)?.name ?? "them";
      const patient = patientById(r.patientId)?.name ?? "the patient";
      toast({
        title: `Reassigned to ${to}`,
        description: `${patient} is in ${to.split(" ")[0]}'s pending list; the 48-hour window starts again. Saved in this browser session — nobody was notified.`,
        tone: "success",
      });
    },
    [toast, user.id],
  );

  return { open, remind, reassign, isRecipient, canFollowUp, user, role, has };
}
