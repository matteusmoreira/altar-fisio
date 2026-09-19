import jsPDF from "jspdf"
import html2canvas from "html2canvas"

export interface DownloadPdfOptions {
  fileName?: string
  scale?: number
}

/**
 * Captura um elemento HTML e gera o download direto de um arquivo PDF no padrão A4.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  options: DownloadPdfOptions = {}
): Promise<void> {
  const { fileName = "documento.pdf", scale = 2 } = options

  const tempId = element.id || `pdf-print-${Date.now()}`
  const originalId = element.id
  if (!originalId) {
    element.id = tempId
  }

  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    onclone: (clonedDoc) => {
      const clonedElement = clonedDoc.getElementById(tempId)
      if (clonedElement) {
        clonedElement.style.position = "static"
        clonedElement.style.left = "auto"
        clonedElement.style.top = "auto"
        clonedElement.style.zIndex = "1"
        clonedElement.style.display = "block"
        clonedElement.style.visibility = "visible"
      }
    },
  })

  const imgData = canvas.toDataURL("image/jpeg", 0.98)
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pdfWidth = pdf.internal.pageSize.getWidth() // 210mm
  const pdfHeight = pdf.internal.pageSize.getHeight() // 297mm

  const imgWidth = pdfWidth
  const imgHeight = (canvas.height * pdfWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST")
  heightLeft -= pdfHeight

  while (heightLeft > 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST")
    heightLeft -= pdfHeight
  }

  pdf.save(fileName)
}
