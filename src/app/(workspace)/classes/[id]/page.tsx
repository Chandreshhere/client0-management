import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { classById, isLoggedId } from "@/features/classes/model";
import { ClassRoster, LoggedClassRoster } from "@/features/classes/roster";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const cls = classById(id);
  return { title: cls ? cls.title : isLoggedId(id) ? "Logged session" : "Session not found" };
}

/**
 * One session: precautions to acknowledge, attendance, progress notes, flags (spec F7/F8).
 * Sessions logged in the browser (c-local-…) are looked up client-side; other unknown ids 404.
 */
export default async function ClassRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cls = classById(id);
  if (cls) return <ClassRoster cls={cls} />;
  if (isLoggedId(id)) return <LoggedClassRoster id={id} />;
  notFound();
}
