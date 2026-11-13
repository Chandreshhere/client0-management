"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { ReferralStage } from "@/data/types";
import { STAFF, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { DISCIPLINE_LABEL } from "@/data/appointments";
import { formatTime } from "@/lib/format";
import { useToast } from "@/components/ui/toast";
import { useRole } from "@/components/shell/role-context";
import { createTask, updateTask } from "@/features/tasks/store";
import { TODAY_KEY, dayPhrase, isoAt } from "@/features/tasks/time";
import { COVER_FOR } from "./data";
import { referralState } from "./meta";
import { advanceReferral, patchReferral, type CareReferral } from "./store";

const STALL_PHRASE: Record<ReferralStage, string> = {
  requested: "not requested",
  accepted: "not accepted",
  booked: "not booked",
  completed: "completion not recorded",
  acknowledged: "not acknowledged",
};

/** Referral actions with honest outcomes: everything is local to this browser session. */
export function useReferralActions() {
  const { user, role } = useRole();
  const { toast } = useToast();
  const router = useRouter();

  const advance = useCallback(
    (r: CareReferral, stage: ReferralStage, extra?: { bookedFor?: string; room?: string }) => {
      const patient = patientById(r.patientId)?.name ?? "Patient";
      const from = staffById(r.fromId)?.name ?? "the referrer";
      const note =
        stage === "booked" && extra?.bookedFor
          ? `Booked for ${dayPhrase(extra.bookedFor)} ${formatTime(extra.bookedFor)}${extra.room ? ` · ${extra.room}` : ""}.`
          : stage === "acknowledged"
            ? "Outcome reviewed — loop closed."
            : undefined;
      advanceReferral(r, stage, user.id, { ...extra, text: note });

      let linked = "";
      if (stage === "accepted" && r.linkedTaskId) {
        updateTask(r.linkedTaskId, { status: "done" }, { actorId: user.id, kind: "status", text: "Done — referral accepted on the referrals board." });
        linked = " The linked “Accept referral” task was marked done.";
      }

      const copy: Record<ReferralStage, { title: string; description: string }> = {
        requested: { title: "Referral requested", description: "Saved in this browser session." },
        accepted: { title: "Referral accepted", description: `${patient} → ${DISCIPLINE_LABEL[r.toDiscipline]}. Saved in this browser session — ${from} wasn't notified.${linked}` },
        booked: {
          title: extra?.bookedFor ? `Booked ${dayPhrase(extra.bookedFor)}, ${formatTime(extra.bookedFor)}` : "Booked",
          description: `Held in this browser session only — no confirmation was sent to ${patient} and the diary wasn't changed.`,
        },
        completed: { title: "Marked completed", description: `Now waiting for ${from} to acknowledge. Saved in this browser session.` },
        acknowledged: { title: "Loop closed", description: `You acknowledged the outcome for ${patient}. Saved in this browser session.` },
      };
      toast({ ...copy[stage], tone: stage === "acknowledged" || stage === "accepted" ? "success" : "neutral" });
    },
    [toast, user.id],
  );

  const chase = useCallback(
    (r: CareReferral) => {
      const st = referralState(r);
      const patient = patientById(r.patientId)?.name ?? "Patient";
      const waitingOn = staffById(st.waitingOn ?? undefined)?.name ?? "the care team";
      const ownerId = role === "patient" ? "s-farhan" : user.id;
      createTask(
        {
          title: `Chase referral: ${patient} → ${DISCIPLINE_LABEL[r.toDiscipline]}${st.pending ? ` — ${STALL_PHRASE[st.pending]}` : ""}`,
          patientId: r.patientId,
          ownerId,
          due: isoAt(TODAY_KEY, "17:00"),
          priority: r.priority === "urgent" || r.priority === "high" ? "high" : "normal",
          source: `Referral stalled · waiting on ${waitingOn}`,
          discipline: "operations",
        },
        user.id,
      );
      toast({
        title: "Follow-up task created",
        description: `Assigned to you, due today 17:00. Saved in this browser session — ${waitingOn} wasn't messaged.`,
        tone: "success",
        action: { label: "Open tasks", onClick: () => router.push("/tasks") },
      });
    },
    [role, router, toast, user.id],
  );

  /** Who would take over while the person the referral waits on is on leave. */
  const coverFor = useCallback((r: CareReferral) => {
    const st = referralState(r);
    const waiting = staffById(st.waitingOn ?? undefined);
    if (!waiting || waiting.status !== "on-leave") return null;
    const cover = COVER_FOR[waiting.id] ? staffById(COVER_FOR[waiting.id]) : STAFF.find((s) => s.discipline === waiting.discipline && s.id !== waiting.id && s.status !== "on-leave");
    return cover ? { waiting, cover } : null;
  }, []);

  const reassign = useCallback(
    (r: CareReferral) => {
      const pair = coverFor(r);
      if (!pair) return;
      const st = referralState(r);
      const field = st.pending === "acknowledged" ? "fromId" : "toId";
      patchReferral(r.id, { [field]: pair.cover.id }, { actorId: user.id, text: `${pair.waiting.name} is on leave (${pair.waiting.workingHours.toLowerCase()}) — reassigned to ${pair.cover.name}.` });
      toast({ title: `Reassigned to ${pair.cover.name}`, description: `Covering while ${pair.waiting.name} is on leave. Saved in this browser session — nobody was notified.` });
    },
    [coverFor, toast, user.id],
  );

  const canReassign = role === "coordinator" || role === "admin";

  return { advance, chase, reassign, coverFor, canReassign, user, role };
}
