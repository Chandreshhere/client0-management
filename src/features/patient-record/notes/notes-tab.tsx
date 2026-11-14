"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BookOpenText, NotePencil, PencilSimpleLine } from "@phosphor-icons/react";
import type { Patient } from "@/data/types";
import { patientById } from "@/data/patients";
import { useRole } from "@/components/shell/role-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import type { RecordDocument } from "../data";
import { clinicalAccess, roleLabel } from "../access";
import { useRecord } from "../store";
import { NoRecordState, RecordFrame, RestrictedRecord } from "../record-frame";
import { DocumentPreview } from "../document-preview";
import { baseDocuments, recordOf, todaysMedicalVisit } from "../record-model";
import { BLANK_TITLE, useDraftBook } from "./use-drafts";
import { NotesContext, NoRecordContext } from "./notes-context";
import { NoteEditor } from "./note-editor";
import { draftSeedFor } from "./notes-data";

/**
 * Notes tab — the split view from doc §2B: relevant history on the left, today's structured
 * note on the right. `?new=1` opens a blank draft with the cursor in History. Works from any
 * patient's own record; a patient with nothing recorded yet can still be seen at a booked visit.
 */
export function NotesTab({ patientId }: { patientId: string }) {
  const patient = patientById(patientId)!;
  const { role, user } = useRole();
  const params = useSearchParams();
  const access = clinicalAccess(role, patientId);
  const record = recordOf(patientId);
  const visitToday = todaysMedicalVisit(patientId);
  // Without a record there is nothing to read — only a doctor seeing the patient today writes.
  const canWrite = access === "full" && (!!record || !!visitToday);
  const seed = useMemo(() => draftSeedFor(patientId, BLANK_TITLE), [patientId]);
  const api = useDraftBook(patientId, user.id, seed);
  const [focusToken, setFocusToken] = useState(0);
  const [pane, setPane] = useState<"note" | "context">(canWrite ? "note" : "context");

  const openBlank = () => {
    api.openBlank();
    setPane("note");
    setFocusToken((n) => n + 1);
  };

  // Entry point from the "+" menu: /patients/<id>/notes?new=1 (handled once drafts are loaded).
  const wantsNew = params.get("new") === "1";
  useEffect(() => {
    if (!api.hydrated || !wantsNew || !canWrite) return;
    openBlank();
    window.history.replaceState(null, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per ?new=1 visit
  }, [api.hydrated, wantsNew, canWrite]);

  return (
    <RecordFrame
      patient={patient}
      title="Consultation notes"
      description={
        canWrite
          ? "Relevant history beside today's note. Drafts save in this browser as you type; signed notes never change — corrections are added as addenda."
          : "Signed consultation notes and the context around them. Signed notes never change — corrections are added as addenda."
      }
      actions={
        canWrite ? (
          <Button variant="secondary" leading={<NotePencil />} onClick={openBlank}>
            New note
          </Button>
        ) : null
      }
    >
      {access === "none" ? (
        <RestrictedRecord role={role} tab="notes" />
      ) : !record && !canWrite ? (
        <NoRecordState patient={patient} tab="notes" />
      ) : (
        <NotesWorkspace patient={patient} hasRecord={!!record} canWrite={canWrite} pane={pane} onPane={setPane} api={api} focusToken={focusToken} roleName={roleLabel(role)} />
      )}
    </RecordFrame>
  );
}

function NotesWorkspace({
  patient,
  hasRecord,
  canWrite,
  pane,
  onPane,
  api,
  focusToken,
  roleName,
}: {
  patient: Patient;
  hasRecord: boolean;
  canWrite: boolean;
  pane: "note" | "context";
  onPane: (p: "note" | "context") => void;
  api: ReturnType<typeof useDraftBook>;
  focusToken: number;
  roleName: string;
}) {
  const uploads = useRecord((s) => s.uploads);
  const [docId, setDocId] = useState<string | null>(null);
  const allDocs: RecordDocument[] = [...uploads.filter((u) => u.patientId === patient.id), ...baseDocuments(patient.id)];
  const doc = allDocs.find((d) => d.id === docId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        ariaLabel="Show"
        className="@[1080px]:hidden"
        value={pane}
        onChange={onPane}
        items={[
          { value: "note", label: canWrite ? "Today's note" : "About notes", icon: <PencilSimpleLine /> },
          { value: "context", label: "History & context", icon: <BookOpenText /> },
        ]}
      />
      <div className="grid grid-cols-1 items-start gap-6 @[1080px]:grid-cols-[minmax(340px,392px)_minmax(0,1fr)]">
        <aside
          aria-label="Patient context"
          className={cn(
            "scrollbar-thin min-w-0 @[1080px]:sticky @[1080px]:top-[80px] @[1080px]:block @[1080px]:max-h-[calc(100dvh-96px)] @[1080px]:overflow-y-auto @[1080px]:rounded-card @[1080px]:pb-10",
            // Fade the bottom edge so it reads as a pane that scrolls on its own.
            "@[1080px]:[mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent)]",
            pane === "context" ? "block" : "hidden",
          )}
        >
          {hasRecord ? <NotesContext patient={patient} onOpenDoc={setDocId} canWrite={canWrite} /> : <NoRecordContext patient={patient} />}
        </aside>
        <div className={cn("min-w-0 @[1080px]:block", pane === "note" ? "block" : "hidden")}>
          {canWrite ? (
            <NoteEditor patient={patient} api={api} focusToken={focusToken} />
          ) : (
            <Card className="py-6">
              <EmptyState
                icon={<BookOpenText />}
                title="Consultation notes are written and signed by doctors"
                description={`As ${roleName.toLowerCase() === "patient" ? "the patient" : `the ${roleName.toLowerCase()}`}, you can read the signed notes and context on this page. Unsigned drafts stay private to their author.`}
                action={
                  <Button variant="secondary" className="@[1080px]:hidden" onClick={() => onPane("context")}>
                    Show history & context
                  </Button>
                }
              />
            </Card>
          )}
        </div>
      </div>
      <DocumentPreview doc={doc} patient={patient} side="left" beside onOpenChange={(o) => !o && setDocId(null)} />
    </div>
  );
}
