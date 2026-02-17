// ============================================================
// pdf.service.ts
// Generación del PDF representación impresa del DTE
// El SII exige que todo DTE tenga una representación impresa
// con el Timbre Electrónico (código de barras PDF417)
// ============================================================

import { PrismaClient } from '@prisma/client'
import PDFDocument from 'pdfkit'

const prisma = new PrismaClient()

// ============================================================
// TIPOS
// ============================================================

interface DatosNegocio {
  nombreNegocio:  string
  rutNegocio:     string
  giro:           string | null
  direccion:      string | null
  comuna:         string | null
  region:         string | null
  logoUrl:        string | null
  colorPrimario:  string | null
  piePagina:      string | null
  resolucionNum:  string | null
  resolucionFecha: string | null
}

interface DatosDte {
  tipoDocumento:    string
  folio:            number
  fechaEmision:     Date
  receptorRut:      string
  receptorNombre:   string
  receptorDireccion: string | null
  receptorComuna:   string | null
  receptorGiro:     string | null
  montoNeto:        number
  montoExento:      number
  montoIva:         number
  montoTotal:       number
  timbreElectronico: string | null
  detalles: Array<{
    nombreItem:     string
    cantidad:       number
    precioUnitario: number
    montoItem:      number
    montoIva:       number
    descuentoMonto: number
  }>
}

const TIPO_LABEL: Record<string, string> = {
  '33': 'FACTURA ELECTRÓNICA',
  '34': 'FACTURA NO AFECTA O EXENTA ELECTRÓNICA',
  '39': 'BOLETA ELECTRÓNICA',
  '41': 'BOLETA NO AFECTA O EXENTA ELECTRÓNICA',
  '52': 'GUÍA DE DESPACHO ELECTRÓNICA',
  '56': 'NOTA DE DÉBITO ELECTRÓNICA',
  '61': 'NOTA DE CRÉDITO ELECTRÓNICA',
}

// ============================================================
// FORMATEAR MONEDA CLP
// ============================================================

function formatCLP(n: number): string {
  return new Intl.NumberFormat('es-CL', {
    style:    'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(n)
}

// ============================================================
// GENERAR PDF EN MEMORIA (Buffer)
// ============================================================

export async function generarPdfDte(documentoSiiId: string): Promise<Buffer> {
  // Cargar documento con sus detalles
  const documento = await prisma.documentoSii.findUnique({
    where:   { id: documentoSiiId },
    include: {
      negocio: {
        include: { configuracionSii: true },
      },
      transaccion: {
        include: {
          detalles: true,
        },
      },
    },
  })

  if (!documento) throw new Error('Documento SII no encontrado')

  const negocio = documento.negocio
  const config  = negocio.configuracionSii

  const datosNegocio: DatosNegocio = {
    nombreNegocio:   negocio.nombreNegocio,
    rutNegocio:      negocio.rutNegocio,
    giro:            negocio.giro,
    direccion:       negocio.direccion,
    comuna:          negocio.comuna,
    region:          negocio.region,
    logoUrl:         config?.logoUrl    || null,
    colorPrimario:   config?.colorPrimario || '#1E40AF',
    piePagina:       config?.piePagina  || null,
    resolucionNum:   config?.resolucionNumero || '0',
    resolucionFecha: config?.resolucionFecha
      ? config.resolucionFecha.toISOString().substring(0, 10)
      : null,
  }

  // Obtener detalles — desde la transacción vinculada o reconstruir desde montos
  const detalles = documento.transaccion?.detalles?.map(d => ({
    nombreItem:     d.nombreItem,
    cantidad:       d.cantidad,
    precioUnitario: d.precioUnitario,
    montoItem:      d.montoItem,
    montoIva:       d.montoIva,
    descuentoMonto: d.descuentoMonto,
  })) || [{
    nombreItem:     'Servicios prestados',
    cantidad:       1,
    precioUnitario: documento.montoNeto,
    montoItem:      documento.montoNeto,
    montoIva:       documento.montoIva,
    descuentoMonto: 0,
  }]

  const datosDte: DatosDte = {
    tipoDocumento:     documento.tipoDocumento,
    folio:             documento.folio,
    fechaEmision:      documento.fechaEmision,
    receptorRut:       documento.receptorRut,
    receptorNombre:    documento.receptorNombre,
    receptorDireccion: documento.receptorDireccion,
    receptorComuna:    documento.receptorComuna,
    receptorGiro:      documento.receptorGiro,
    montoNeto:         documento.montoNeto,
    montoExento:       documento.montoExento,
    montoIva:          documento.montoIva,
    montoTotal:        documento.montoTotal,
    timbreElectronico: documento.timbreElectronico,
    detalles,
  }

  return buildPdf(datosNegocio, datosDte)
}

// ============================================================
// CONSTRUIR EL PDF
// ============================================================

function buildPdf(negocio: DatosNegocio, dte: DatosDte): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ size: 'A4', margin: 40 })
    const chunks: Buffer[] = []

    doc.on('data',  chunk => chunks.push(chunk))
    doc.on('end',   ()    => resolve(Buffer.concat(chunks)))
    doc.on('error', err   => reject(err))

    const colorPrimario = negocio.colorPrimario || '#1E40AF'
    const pageWidth     = 595 - 80 // A4 - márgenes

    // ─── ENCABEZADO ──────────────────────────────────────────

    // Bloque izquierdo: datos del emisor
    doc.fontSize(14).font('Helvetica-Bold').fillColor(colorPrimario)
       .text(negocio.nombreNegocio, 40, 40, { width: 280 })

    doc.fontSize(9).font('Helvetica').fillColor('#333333')
       .text(`RUT: ${negocio.rutNegocio}`, 40, doc.y + 4)

    if (negocio.giro) {
      doc.text(`Giro: ${negocio.giro}`, 40, doc.y + 2)
    }
    if (negocio.direccion) {
      doc.text(`${negocio.direccion}${negocio.comuna ? ', ' + negocio.comuna : ''}`, 40, doc.y + 2)
    }
    if (negocio.region) {
      doc.text(negocio.region, 40, doc.y + 2)
    }

    // Bloque derecho: tipo de documento + folio (recuadro obligatorio SII)
    const boxX     = 360
    const boxY     = 40
    const boxWidth = 195

    doc.rect(boxX, boxY, boxWidth, 80)
       .lineWidth(2)
       .strokeColor(colorPrimario)
       .stroke()

    doc.fontSize(10).font('Helvetica-Bold').fillColor(colorPrimario)
       .text(
         TIPO_LABEL[dte.tipoDocumento] || `Tipo ${dte.tipoDocumento}`,
         boxX + 8, boxY + 10,
         { width: boxWidth - 16, align: 'center' }
       )

    doc.fontSize(9).font('Helvetica').fillColor('#333333')
       .text('R.U.T. Emisor', boxX + 8, boxY + 34, { width: boxWidth - 16, align: 'center' })
       .text(negocio.rutNegocio, boxX + 8, doc.y + 2, { width: boxWidth - 16, align: 'center' })

    doc.fontSize(14).font('Helvetica-Bold').fillColor(colorPrimario)
       .text(`N° ${dte.folio}`, boxX + 8, doc.y + 4, { width: boxWidth - 16, align: 'center' })

    // Resolución SII
    if (negocio.resolucionNum && negocio.resolucionNum !== '0') {
      doc.fontSize(7).font('Helvetica').fillColor('#666666')
         .text(
           `SII Res. N°${negocio.resolucionNum} / ${negocio.resolucionFecha || ''}`,
           boxX + 4, boxY + 68,
           { width: boxWidth - 8, align: 'center' }
         )
    }

    // Línea separadora
    const separadorY = Math.max(doc.y, boxY + 90) + 10
    doc.moveTo(40, separadorY).lineTo(555, separadorY)
       .lineWidth(0.5).strokeColor('#CCCCCC').stroke()

    // ─── DATOS DEL RECEPTOR ──────────────────────────────────

    const receptorY = separadorY + 12

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#333333')
       .text('Señor(es):', 40, receptorY)
    doc.font('Helvetica')
       .text(dte.receptorNombre, 110, receptorY)

    if (dte.receptorRut && dte.receptorRut !== '66666666-6') {
      doc.font('Helvetica-Bold').text('RUT:', 40, doc.y + 4)
      doc.font('Helvetica').text(dte.receptorRut, 110, doc.y - 13)
    }

    if (dte.receptorGiro) {
      doc.font('Helvetica-Bold').text('Giro:', 40, doc.y + 4)
      doc.font('Helvetica').text(dte.receptorGiro, 110, doc.y - 13)
    }

    if (dte.receptorDireccion) {
      const dir = `${dte.receptorDireccion}${dte.receptorComuna ? ', ' + dte.receptorComuna : ''}`
      doc.font('Helvetica-Bold').text('Dirección:', 40, doc.y + 4)
      doc.font('Helvetica').text(dir, 110, doc.y - 13)
    }

    // Fecha
    const fechaStr = new Date(dte.fechaEmision).toLocaleDateString('es-CL', {
      day: '2-digit', month: 'long', year: 'numeric'
    })
    doc.font('Helvetica-Bold').text('Fecha:', 380, receptorY)
    doc.font('Helvetica').text(fechaStr, 420, receptorY)

    // Línea separadora
    const tablaY = doc.y + 16
    doc.moveTo(40, tablaY).lineTo(555, tablaY)
       .lineWidth(0.5).strokeColor('#CCCCCC').stroke()

    // ─── TABLA DE DETALLES ────────────────────────────────────

    const headerY = tablaY + 8

    // Cabeceras
    doc.fontSize(8).font('Helvetica-Bold').fillColor(colorPrimario)
       .text('CANT.',   40,  headerY, { width: 45,  align: 'right' })
       .text('DETALLE', 95,  headerY, { width: 240, align: 'left'  })
       .text('P. UNIT', 340, headerY, { width: 80,  align: 'right' })
       .text('DESCTO',  425, headerY, { width: 60,  align: 'right' })
       .text('TOTAL',   490, headerY, { width: 65,  align: 'right' })

    doc.moveTo(40, doc.y + 4).lineTo(555, doc.y + 4)
       .lineWidth(0.5).strokeColor('#CCCCCC').stroke()

    let filaY = doc.y + 8

    // Filas de detalle
    dte.detalles.forEach((item, idx) => {
      const bgColor = idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF'
      doc.rect(40, filaY - 4, 515, 18).fillColor(bgColor).fill()

      doc.fillColor('#333333').fontSize(8).font('Helvetica')
         .text(String(item.cantidad),     40,  filaY, { width: 45,  align: 'right'  })
         .text(item.nombreItem,           95,  filaY, { width: 240, align: 'left'   })
         .text(formatCLP(item.precioUnitario), 340, filaY, { width: 80,  align: 'right' })
         .text(item.descuentoMonto > 0 ? formatCLP(item.descuentoMonto) : '-', 425, filaY, { width: 60, align: 'right' })
         .text(formatCLP(item.montoItem), 490, filaY, { width: 65,  align: 'right'  })

      filaY += 20
    })

    doc.moveTo(40, filaY).lineTo(555, filaY)
       .lineWidth(0.5).strokeColor('#CCCCCC').stroke()

    // ─── TOTALES ─────────────────────────────────────────────

    const totalesX = 380
    let totalesY   = filaY + 12

    const agregarTotal = (label: string, monto: number, bold = false) => {
      doc.fontSize(9)
         .font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor(bold ? colorPrimario : '#333333')
         .text(label,            totalesX, totalesY, { width: 110, align: 'right' })
         .text(formatCLP(monto), 495,      totalesY, { width: 60,  align: 'right' })
      totalesY += 16
    }

    if (dte.montoNeto > 0)   agregarTotal('Neto:',           dte.montoNeto)
    if (dte.montoExento > 0) agregarTotal('Exento:',         dte.montoExento)
    if (dte.montoIva > 0)    agregarTotal('IVA (19%):',      dte.montoIva)
                             agregarTotal('TOTAL:',           dte.montoTotal, true)

    // ─── TIMBRE ELECTRÓNICO (TED) ─────────────────────────────
    // El SII exige el TED en la representación impresa
    // Se muestra como texto ya que PDF417 requiere lib adicional

    if (dte.timbreElectronico) {
      const timbreY = totalesY + 20

      doc.moveTo(40, timbreY).lineTo(555, timbreY)
         .lineWidth(0.5).strokeColor('#CCCCCC').stroke()

      doc.fontSize(7).font('Helvetica').fillColor('#666666')
         .text('Timbre Electrónico SII', 40, timbreY + 8)
         .text('Resolución SII N° 45 del 01-09-2003', 40, timbreY + 18)

      // Mostrar TED resumido (los primeros 100 chars)
      doc.fontSize(6).font('Courier').fillColor('#999999')
         .text(
           dte.timbreElectronico.substring(0, 200) + '...',
           40, timbreY + 30,
           { width: 515 }
         )
    }

    // ─── PIE DE PÁGINA ────────────────────────────────────────

    const pieY = 760
    doc.moveTo(40, pieY).lineTo(555, pieY)
       .lineWidth(0.5).strokeColor('#CCCCCC').stroke()

    const textoPie = negocio.piePagina
      || 'Documento tributario electrónico generado por MiConta — www.miconta.cl'

    doc.fontSize(7).font('Helvetica').fillColor('#999999')
       .text(textoPie, 40, pieY + 6, { width: 515, align: 'center' })

    doc.end()
  })
}

// ============================================================
// GUARDAR PDF EN BD Y RETORNAR URL (si se usa almacenamiento externo)
// Por ahora retorna el buffer directamente para descargar
// ============================================================

export async function generarYGuardarPdf(documentoSiiId: string): Promise<Buffer> {
  const buffer = await generarPdfDte(documentoSiiId)

  // Aquí podrías subir a S3/Cloudflare R2 y guardar la URL en BD
  // Por ahora solo marcamos que el PDF fue generado
  await prisma.documentoSii.update({
    where: { id: documentoSiiId },
    data:  { pdfUrl: `generated:${documentoSiiId}` },
  })

  return buffer
}