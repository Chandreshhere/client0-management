import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { classById } from "@/features/classes/model";
import { ClassRoster } from "@/features/classes/roster";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const cls = classById(id);
  return { title: cls ? `${cls.title} · roster` : "Class not found" };
}

/** Class or 1:1 session roster (doc §2D). Unknown ids 404. */
export default async function ClassRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cls = classById(id);
  if (!cls) notFound();
  return <ClassRoster cls={cls} />;
}
