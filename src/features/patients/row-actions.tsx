"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarPlus, ChatCircleText, Copy, DotsThree, GitMerge, Path, UsersThree } from "@phosphor-icons/react";
import { IconButton } from "@/components/ui/icon-button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { hasRecord } from "@/data/record";
import { clinicNoOf, type FlagId, type RegistryLens, type RegistryPatient } from "./data";

/**
 * Per-patient menu. Only what this role can do on this plan is listed: clinical roles open the
 * record and journey; Admin and Reception open the demographic details; booking needs the
 * calendar (Clinic+), messaging the patient app (Pro); the admin reviews possible duplicates.
 */
export function RowActions({
  patient,
  flags,
  lens,
  onAssign,
  onOpenLocal,
  onReview,
}: {
  patient: RegistryPatient;
  flags: FlagId[];
  lens: RegistryLens;
  onAssign: (id: string) => void;
  onOpenLocal: (id: string) => void;
  onReview: (id: string) => void;
}) {
  const { toast } = useToast();
  const no = clinicNoOf(patient);
  const recorded = !patient.local && hasRecord(patient.id);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(no);
      toast({ title: `Copied ${no}`, description: "Clinic ID — kept separate from ABHA.", tone: "success" });
    } catch {
      toast({ title: "Couldn't reach the clipboard", description: `The clinic ID is ${no}.`, tone: "warning" });
    }
  };

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <IconButton label={`Actions for ${patient.name}`} variant="ghost" size="sm" className="data-[state=open]:bg-sunken">
          <DotsThree weight="bold" />
        </IconButton>
      </DropdownTrigger>
      <DropdownContent className="w-[264px]">
        <DropdownLabel className="truncate">{patient.name}</DropdownLabel>
        {patient.local ? (
          <DropdownItem icon={<ArrowUpRight />} onSelect={() => onOpenLocal(patient.id)} description="Registered in this session">
            Open details
          </DropdownItem>
        ) : lens.clinical ? (
          <DropdownItem asChild icon={<ArrowUpRight />} description={recorded ? "Summary, notes, reports and timeline" : "Nothing recorded yet — summary"}>
            <Link href={`/patients/${patient.id}`}>Open record</Link>
          </DropdownItem>
        ) : (
          <DropdownItem asChild icon={<ArrowUpRight />} description="Contact details, care team and visits">
            <Link href={`/patients/${patient.id}`}>Open details</Link>
          </DropdownItem>
        )}
        {recorded && lens.clinical ? (
          <DropdownItem asChild icon={<Path />} description="Every event in date order">
            <Link href={`/patients/${patient.id}/journey`}>Open timeline</Link>
          </DropdownItem>
        ) : null}
        {lens.canBook ? (
          <DropdownItem asChild icon={<CalendarPlus />}>
            <Link href={`/schedule?new=1&patient=${patient.id}`}>Book appointment</Link>
          </DropdownItem>
        ) : null}
        {lens.canMessage && !patient.local ? (
          <DropdownItem asChild icon={<ChatCircleText />}>
            <Link href={`/messages?new=1&patient=${patient.id}`}>Message</Link>
          </DropdownItem>
        ) : null}
        {lens.canAssignTeam ? (
          <DropdownItem icon={<UsersThree />} onSelect={() => onAssign(patient.id)}>
            Assign care team
          </DropdownItem>
        ) : null}
        {lens.canMerge && flags.includes("duplicate") ? (
          <DropdownItem icon={<GitMerge />} onSelect={() => onReview(patient.id)} description="Compare, then merge or keep separate">
            Review possible duplicate
          </DropdownItem>
        ) : null}
        <DropdownSeparator />
        <DropdownItem icon={<Copy />} onSelect={copy} description={<span className="font-mono">{no}</span>}>
          Copy clinic ID
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
