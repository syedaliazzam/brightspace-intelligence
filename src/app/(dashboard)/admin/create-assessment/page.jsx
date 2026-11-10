import CreateAssessmentClient from "@/components/assessments/CreateAssessmentClient";

export default function AdminCreateAssessmentPage() {
  return <CreateAssessmentClient portal="admin" readOnly={true} />;
}

