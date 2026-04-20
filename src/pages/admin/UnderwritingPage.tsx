import { useAdminCtx } from './AdminContext'
import { UnderwritingSection } from './DashboardPage'

export default function UnderwritingPage() {
  const {
    rulebooks, uwTab, setUwTab,
    rbCostConsult, setRbCostConsult,
    rbCostMed, setRbCostMed,
    rbCostExam, setRbCostExam,
    rbIncome, setRbIncome,
    rbThresholdReview, setRbThresholdReview,
    rbThresholdReject, setRbThresholdReject,
    rbInstructions, setRbInstructions,
    rbVersionName, setRbVersionName,
    rbSaving, handleSaveRulebook,
    rbCompare, setRbCompare,
    handleActivateRulebook,
    simAge, setSimAge,
    simSex, setSimSex,
    simConditions, setSimConditions,
    simHospitalized, setSimHospitalized,
    simTreatment, setSimTreatment,
    simMeds, setSimMeds,
    simSmoking, setSimSmoking,
    simEps, setSimEps,
    simRulebookId, setSimRulebookId,
    simRunning, handleSimulate, simResult,
  } = useAdminCtx()

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Underwriting</h1>
        <p className="text-sm text-slate-500 mt-1">Configura el motor actuarial y simula evaluaciones de riesgo.</p>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <UnderwritingSection
          rulebooks={rulebooks}
          uwTab={uwTab} onUwTabChange={setUwTab}
          rbCostConsult={rbCostConsult} onRbCostConsultChange={setRbCostConsult}
          rbCostMed={rbCostMed} onRbCostMedChange={setRbCostMed}
          rbCostExam={rbCostExam} onRbCostExamChange={setRbCostExam}
          rbIncome={rbIncome} onRbIncomeChange={setRbIncome}
          rbThresholdReview={rbThresholdReview} onRbThresholdReviewChange={setRbThresholdReview}
          rbThresholdReject={rbThresholdReject} onRbThresholdRejectChange={setRbThresholdReject}
          rbInstructions={rbInstructions} onRbInstructionsChange={setRbInstructions}
          rbVersionName={rbVersionName} onRbVersionNameChange={setRbVersionName}
          rbSaving={rbSaving} onSaveRulebook={handleSaveRulebook}
          rbCompare={rbCompare} onRbCompareChange={setRbCompare}
          onActivateRulebook={handleActivateRulebook}
          simAge={simAge} onSimAgeChange={setSimAge}
          simSex={simSex} onSimSexChange={setSimSex}
          simConditions={simConditions} onSimConditionsChange={setSimConditions}
          simHospitalized={simHospitalized} onSimHospitalizedChange={setSimHospitalized}
          simTreatment={simTreatment} onSimTreatmentChange={setSimTreatment}
          simMeds={simMeds} onSimMedsChange={setSimMeds}
          simSmoking={simSmoking} onSimSmokingChange={setSimSmoking}
          simEps={simEps} onSimEpsChange={setSimEps}
          simRulebookId={simRulebookId} onSimRulebookIdChange={setSimRulebookId}
          simRunning={simRunning} onSimulate={handleSimulate}
          simResult={simResult}
        />
      </div>
    </div>
  )
}
