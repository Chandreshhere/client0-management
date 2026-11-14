"use client";

import { useState } from "react";
import { STAFF, staffById } from "@/data/staff";
import { patientById } from "@/data/patients";
import { Dialog, ModalContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { staffOptions } from "@/features/tasks/people";
import { COVER_FOR } from "./data";
import { DISCIPLINE_WORD } from "./meta";
import { useAssignmentActions } from "./use-referral-actions";
import type { CareReferral } from "./store";

/** Move an assignment nobody opened to another nutritionist or instructor. */
export function ReassignModal({ referral, onClose }: { referral: CareReferral | null; onClose: () => void }) {
  return <Dialog open={!!referral} onOpenChange={(o) => !o && onClose()}>{referral ? <Body key={referral.id} referral={referral} onClose={onClose} /> : null}</Dialog>;
}

function Body({ referral, onClose }: { referral: CareReferral; onClose: () => void }) {
  const { reassign } = useAssignmentActions();
  const current = staffById(referral.toId);
  const cover = COVER_FOR[referral.toId];
  const fallback = STAFF.find((s) => s.discipline === referral.toDiscipline && s.id !== referral.toId && s.status !== "on-leave")?.id;
  const [toId, setToId] = useState(cover ?? fallback ?? "");
  const patient = patientById(referral.patientId)?.name ?? "the patient";

  return (
    <ModalContent
      title="Reassign"
      description={`${patient} → ${DISCIPLINE_WORD[referral.toDiscipline]} · ${current?.name ?? "The recipient"} hasn't opened it.`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="dark"
            disabled={!toId}
            onClick={() => {
              reassign(referral, toId);
              onClose();
            }}
          >
            Reassign
          </Button>
        </>
      }
    >
      <Field label={referral.toDiscipline === "movement" ? "New instructor" : "New nutritionist"} hint="It moves to their pending list and the 48-hour window starts again.">
        {(p) => <Select {...p} value={toId} onValueChange={setToId} placeholder="Choose who" options={staffOptions((s) => s.discipline === referral.toDiscipline && s.id !== referral.toId)} />}
      </Field>
    </ModalContent>
  );
}
