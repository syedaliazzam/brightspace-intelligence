import AssessmentTemplatesClient from "@/components/assessments/AssessmentTemplatesClient";

export default function CoordinatorAssessmentTemplatesPage() {
  return <AssessmentTemplatesClient portal="coordinator" readOnly={false} />;
}
