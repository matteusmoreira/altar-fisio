import type { ClinicPackage, ClinicService } from "@/types"

export const getPackageModalityLabel = (pkg: ClinicPackage, services: ClinicService[]) => {
  const service = services.find((item) => item.id === pkg.serviceId)
  const modality = service?.modality ?? pkg.modality

  return modality === "turma" ? `Turma até ${service?.maxCapacity ?? 4}` : "Individual"
}
