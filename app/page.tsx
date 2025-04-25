"use client"

import { useState } from "react"
import { Search, FileText, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { patients } from "@/lib/data"

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("")
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false)

  // Filter patients based on search term
  const filteredPatients = patients.filter(
    (patient) =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.id.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-teal-700 text-white p-6 shadow-md">
        <div className="container mx-auto text-center">
          <h1 className="text-3xl font-bold mb-1">Endo Clinic</h1>
          <p className="text-xl font-medium text-teal-100">Atallah Alruhaily - Consultant Endocrinologist</p>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle>Patient Directory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input
                type="text"
                placeholder="Search by name, ID, or diagnosis..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium">Patient List</h2>
              <Dialog open={isAddPatientOpen} onOpenChange={setIsAddPatientOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center gap-2">
                    <Plus size={16} /> Add New Patient
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Patient</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault()
                      // In a real app, you would add the patient to your database
                      alert("Patient would be added here. This is just a demo.")
                      setIsAddPatientOpen(false)
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="patient-name">Patient Name</Label>
                      <Input id="patient-name" placeholder="Enter patient name" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="patient-id">Patient ID</Label>
                      <Input id="patient-id" placeholder="Enter patient ID" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="diagnosis">Diagnosis</Label>
                      <Input id="diagnosis" placeholder="Enter diagnosis" required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" type="date" required />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsAddPatientOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add Patient</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-3 border-b">ID</th>
                    <th className="p-3 border-b">Name</th>
                    <th className="p-3 border-b">Diagnosis</th>
                    <th className="p-3 border-b">Date</th>
                    <th className="p-3 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 border-b">
                      <td className="p-3">{patient.id}</td>
                      <td className="p-3 font-medium">{patient.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
                          {patient.diagnosis}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-600">{new Date(patient.date).toLocaleDateString()}</td>
                      <td className="p-3">
                        <Link href={`/details/${patient.id}`}>
                          <Button variant="outline" size="sm" className="flex items-center gap-1">
                            <FileText size={16} />
                            Open File
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {filteredPatients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-gray-500">
                        No patients found matching your search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
