import CreateAssessmentClient from "@/components/assessments/CreateAssessmentClient";

export default function AdminTermAssessmentsPage() {
  return <CreateAssessmentClient portal="admin" readOnly={true} />;
}

