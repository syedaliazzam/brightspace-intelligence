import EcceAssessmentsPage from "@/components/ecce/EcceAssessmentsPage";

export default function TeacherEcceAssessmentRecordsPage() {
  return (
    <EcceAssessmentsPage
      portal="teacher"
      title="ECCE Assessment Records"
      description="Review submitted ECCE assessment records for your assigned students."
      showTeacherForm={false}
    />
  );
}
