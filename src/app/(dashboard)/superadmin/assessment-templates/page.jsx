import AssessmentTemplatesClient from "@/components/assessments/AssessmentTemplatesClient";

export default function SuperadminAssessmentTemplatesPage() {
  return <AssessmentTemplatesClient portal="superadmin" readOnly={false} />;
}

