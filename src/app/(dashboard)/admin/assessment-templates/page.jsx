import AssessmentTemplatesClient from "@/components/assessments/AssessmentTemplatesClient";

export default function AdminAssessmentTemplatesPage() {
  return <AssessmentTemplatesClient portal="admin" readOnly={true} />;
}

