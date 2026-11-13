"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarPlus, ChatCircleText, Copy, DotsThree, Path, UsersThree } from "@phosphor-icons/react";
import { usePlan } from "@/components/shell/role-context";
import { LockBadge } from "@/components/shell/plan-switcher";
import { IconButton } from "@/components/ui/icon-button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { minPlanFor } from "@/data/plans";
import { hasRecord } from "@/data/record";
import { clinicNoOf, type RegistryPatient } from "./data";

/** Per-patient menu: open, journey, book, message, assign care team, copy clinic number. */
export function RowActions({ patient, onAssign, onOpenLocal }: { patient: RegistryPatient; onAssign: (id: string) => void; onOpenLocal: (id: string) => void }) {
  const { has } = usePlan();
  const { toast } = useToast();
  const no = clinicNoOf(patient);
  const recorded = !patient.local && hasRecord(patient.id);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(no);
      toast({ title: `Copied ${no}`, description: "Clinic number — kept separate from ABHA.", tone: "success" });
    } catch {
      toast({ title: "Couldn't reach the clipboard", description: `The clinic number is ${no}.`, tone: "warning" });
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
            Open record
          </DropdownItem>
        ) : (
          <DropdownItem asChild icon={<ArrowUpRight />} description={recorded ? "Body systems, timeline and care plan" : "Nothing recorded yet — summary"}>
            <Link href={`/patients/${patient.id}`}>{recorded ? "Open overview" : "Open summary"}</Link>
          </DropdownItem>
        )}
        {recorded ? (
          <DropdownItem asChild icon={<Path />} description="Documented links between events">
            <Link href={`/patients/${patient.id}/journey`}>Open journey</Link>
          </DropdownItem>
        ) : null}
        <DropdownItem asChild icon={<CalendarPlus />}>
          <Link href={`/schedule?new=1&patient=${patient.id}`}>Book appointment</Link>
        </DropdownItem>
        {has("messages") ? (
          <DropdownItem asChild icon={<ChatCircleText />}>
            <Link href={`/messages?new=1&patient=${patient.id}`}>Message</Link>
          </DropdownItem>
        ) : (
          <DropdownItem disabled icon={<ChatCircleText />} description={`Available on ${minPlanFor("messages").name} plan`}>
            <span className="flex items-center gap-2">Message <LockBadge /></span>
          </DropdownItem>
        )}
        {has("multi-role") ? (
          <DropdownItem icon={<UsersThree />} onSelect={() => onAssign(patient.id)}>
            Assign care team
          </DropdownItem>
        ) : (
          <DropdownItem disabled icon={<UsersThree />} description={`Available on ${minPlanFor("multi-role").name} plan`}>
            <span className="flex items-center gap-2">Assign care team <LockBadge /></span>
          </DropdownItem>
        )}
        <DropdownSeparator />
        <DropdownItem icon={<Copy />} onSelect={copy} description={<span className="font-mono">{no}</span>}>
          Copy clinic number
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}
