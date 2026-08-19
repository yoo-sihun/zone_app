"use client";

import { useApp } from "@/lib/AppContext";
import SuspectsPanel from "./SuspectsPanel";
import FactorsPanel from "./FactorsPanel";
import ReportPanel from "./ReportPanel";
import ExpResultPanel from "./ExpResultPanel";

export default function MiscModal() {
  const { miscModal, closeMisc } = useApp();
  if (!miscModal.open) return null;

  return (
    <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) closeMisc(); }}>
      <div className="sheet">
        {miscModal.kind === "suspects" && <SuspectsPanel />}
        {miscModal.kind === "factors" && <FactorsPanel />}
        {miscModal.kind === "report" && <ReportPanel />}
        {miscModal.kind === "expResult" && <ExpResultPanel experimentId={miscModal.experimentId} />}
      </div>
    </div>
  );
}
