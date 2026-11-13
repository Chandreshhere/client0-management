"use client";

import { useRole } from "@/components/shell/role-context";
import { AdminHome } from "./admin-home";
import { CoordinatorHome } from "./coordinator-home";
import { DoctorHome } from "./doctor-home";
import { FrontdeskHome } from "./frontdesk-home";
import { NutritionistHome } from "./nutritionist-home";
import { PatientHome } from "./patient-home";
import { YogaHome } from "./yoga-home";

/**
 * /dashboard renders a different home per workspace role (doc §2–3). The role comes from the
 * demo session (cookie-backed), so the server render already matches the client.
 */
export function Dashboard() {
  const { role } = useRole();
  switch (role) {
    case "doctor":
      return <DoctorHome />;
    case "nutritionist":
      return <NutritionistHome />;
    case "yoga":
      return <YogaHome />;
    case "frontdesk":
      return <FrontdeskHome />;
    case "coordinator":
      return <CoordinatorHome />;
    case "admin":
      return <AdminHome />;
    case "patient":
      return <PatientHome />;
  }
}
