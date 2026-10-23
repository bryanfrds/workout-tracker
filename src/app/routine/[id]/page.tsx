import { Suspense } from "react";
import RoutineEditor from "@/components/RoutineEditor";

export default function EditRoutinePage() {
  return (
    <Suspense>
      <RoutineEditor />
    </Suspense>
  );
}
