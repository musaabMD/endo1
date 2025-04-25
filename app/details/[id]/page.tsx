import { patients } from "@/lib/data"
import PatientDetailsClient from "./patient-details-client"

// This is a server component
export default function PatientDetailsPage({ params }: { params: { id: string } }) {
  const patientId = params.id
  const patient = patients.find((p) => p.id === patientId)
  
  return <PatientDetailsClient patientId={patientId} patient={patient} />
}
