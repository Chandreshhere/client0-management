import type { Role } from "@/data/types";

/** Server- and client-safe role guard (kept out of "use client" modules). */
export const ROLES: Role[] = ["admin", "doctor", "nutritionist", "yoga", "frontdesk", "coordinator", "patient"];
export const isRole = (v: string | undefined): v is Role => !!v && (ROLES as string[]).includes(v);
