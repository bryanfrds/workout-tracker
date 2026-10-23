import { Suspense } from "react";
import PlanEditor from "@/components/PlanEditor";

export default function EditPlanPage() {
  return (
    <Suspense>
      <PlanEditor />
    </Suspense>
  );
}
