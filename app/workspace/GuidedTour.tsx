import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import Selector from "./Selector";
import { roles, type Role } from "./navigation";
export default function GuidedTour({
  role,
  onRole,
  onClose,
}: {
  role: Role;
  onRole: (r: Role) => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0),
    dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const steps = [
    [
      "Make it your workspace",
      "Your role adjusts suggestions and explanation depth. Every tool stays available, and you can switch roles in the header at any time.",
    ],
    [
      "Find your starting point",
      "Use Browse to choose a region or body system. Search finds named structures, reviewed conditions and lessons. Medical and Dental each open their own anatomy.",
    ],
    [
      "Make the anatomy clear",
      "The expanded dock keeps Anatomy, Skeleton, Wireframe and X-ray illustration visible. Drag to orbit, choose Pan to move, or use a named camera view. Fit body brings the model back into view.",
    ],
    [
      "Select, then understand",
      "Click a structure to highlight it and open Details. Focus selection brings it closer; Isolate removes surrounding anatomy. Restore brings hidden structures back. Closing Details keeps your selection.",
    ],
    [
      role === "student"
        ? "Learn one objective at a time"
        : role === "doctor"
          ? "Explain with the right visual"
          : "Follow your curiosity",
      role === "student"
        ? "In Learn, choose a lesson, inspect its linked anatomy, then answer its check. Practice is also available directly. “Show me why” returns to the relevant anatomy."
        : role === "doctor"
          ? "Explain contains published clinical explanations. Choose a stage and Present to show plain-language captions. Reference anatomy and schematic diagrams are labelled separately."
          : "Choose a system in Browse, select a structure and read what is available. Related learning and conditions appear only when reviewed content is available.",
    ],
    [
      "Pick up where you left off",
      "My Library keeps your due questions, mistakes, bookmarks and backups on this device. Continue resumes an unfinished task explicitly. Export backups before clearing browser data. This tour creates no learning records.",
    ],
  ];
  return (
    <dialog ref={dialog} className="tour-dialog" aria-labelledby="tour-title" onCancel={onClose}>
      <div className="tour-top">
        <span>Quick tour · {step + 1} of 6</span>
        <button aria-label="Skip tour" onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <progress value={step + 1} max={6} aria-label="Tour progress" />
      <h2 id="tour-title">{steps[step][0]}</h2>
      <p>{steps[step][1]}</p>
      {step === 0 && (
        <div className="tour-roles" role="group" aria-label="Your role">
          {roles.map((r) => (
            <button key={r.id} aria-pressed={role === r.id} onClick={() => onRole(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      <footer>
        <button onClick={onClose}>Skip tour</button>
        <div>
          <button disabled={step === 0} onClick={() => setStep((n) => n - 1)}>
            <ArrowLeft size={16} />
            Back
          </button>
          <button
            className="tour-next"
            onClick={() => (step === 5 ? onClose() : setStep((n) => n + 1))}
          >
            {step === 5 ? "Start exploring" : "Next"}
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>
    </dialog>
  );
}
