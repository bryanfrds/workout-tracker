import { Suspense } from "react";
import PlanView from "@/components/PlanView";

export default function PlanPage() {
  return (
    <Suspense>
      <PlanView />
    </Suspense>
  );
}
