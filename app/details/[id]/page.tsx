import { patients } from "@/lib/data"
import PatientDetailsClient from "./patient-details-client"

// This is a server component
export default async function PatientDetailsPage({ params }: { params: { id: string } }) {
  // In Next.js 15, params need to be awaited properly
  const unwrappedParams = await Promise.resolve(params)
  const patientId = unwrappedParams.id
  const patient = patients.find((p) => p.id === patientId)
  
  return <PatientDetailsClient patientId={patientId} patient={patient} />
}
