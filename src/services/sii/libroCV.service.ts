// ============================================================
// libroCV.service.ts
// Generación y envío del Libro de Compras y Ventas (IECV)
// Obligatorio para todos los emisores electrónicos
// Debe enviarse al SII dentro de los primeros 15 días del mes siguiente
// ============================================================

import axios from 'axios'
import forge from 'node-forge'
import FormData from 'form-data'
import { parseStringPromise } from 'xml2js'
import { PrismaClient } from '@prisma/client'
import { obtenerToken, getUrlsSii } from './auth.service'
import { cargarCertificado } from './certificado.service'

const prisma = new PrismaClient()

// ============================================================
// TIPOS INTERNOS
// ============================================================

interface DetalleDocumento {
  tipoDocumento: string
  folio:         number
  fechaEmision:  Date
  rutReceptor:   string
  razonSocial:   string
  montoNeto:     number
  montoExento:   number
  montoIva:      number
  montoTotal:    number
}

// ============================================================
// GENERAR XML DEL LIBRO CV
// Formato IECV requerido por el SII
// ============================================================

function generarXmlLibroCV(params: {
  rutEmisor:    string
  tipo:         'compra' | 'venta'
  mes:          number
  anio:         number
  documentos:   DetalleDocumento[]
  resolucion:   { numero: string; fecha: string }
}): string {
  const { rutEmisor, tipo, mes, anio, documentos, resolucion } = params

  const tipoLibro    = tipo === 'venta' ? 'VENTA' : 'COMPRA'
  const periodoDesde = `${anio}-${String(mes).padStart(2, '0')}-01`
  const diasMes      = new Date(anio, mes, 0).getDate()
  const periodoHasta = `${anio}-${String(mes).padStart(2, '0')}-${diasMes}`
  const ahora        = new Date().toISOString().replace('T', 'T').substring(0, 19)

  // Calcular totales
  const totalNeto   = documentos.reduce((s, d) => s + d.montoNeto,   0)
  const totalExento = documentos.reduce((s, d) => s + d.montoExento, 0)
  const totalIva    = documentos.reduce((s, d) => s + d.montoIva,    0)
  const totalMonto  = documentos.reduce((s, d) => s + d.montoTotal,  0)

  // Generar detalles por tipo de documento
  const detallesXml = documentos.map(doc => `
    <Detalle>
      <TpoDoc>${doc.tipoDocumento}</TpoDoc>
      <NroDoc>${doc.folio}</NroDoc>
      <TasaImp>19</TasaImp>
      <FchDoc>${new Date(doc.fechaEmision).toISOString().substring(0, 10)}</FchDoc>
      <RUTDoc>${doc.rutReceptor}</RUTDoc>
      <RznSoc>${doc.razonSocial}</RznSoc>
      <MntExe>${doc.montoExento}</MntExe>
      <MntNeto>${doc.montoNeto}</MntNeto>
      <MntIVA>${doc.montoIva}</MntIVA>
      <MntTotal>${doc.montoTotal}</MntTotal>
    </Detalle>`).join('\n')

  const resumenXml = `
    <ResumenPeriodo>
      <TotDoc>${documentos.length}</TotDoc>
      <TotMntExe>${totalExento}</TotMntExe>
      <TotMntNeto>${totalNeto}</TotMntNeto>
      <TotMntIVA>${totalIva}</TotMntIVA>
      <TotMntTotal>${totalMonto}</TotMntTotal>
    </ResumenPeriodo>`

  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<LibroCompraVenta xmlns="http://www.sii.cl/SiiDte" version="1.0">
  <EnvioLibro ID="LibroCV_${tipo}_${anio}_${mes}">
    <Caratula version="1.0">
      <RutEmisorLibro>${rutEmisor}</RutEmisorLibro>
      <RutEnvia>${rutEmisor}</RutEnvia>
      <PeriodoTributario>${anio}-${String(mes).padStart(2, '0')}</PeriodoTributario>
      <FchResol>${resolucion.fecha}</FchResol>
      <NroResol>${resolucion.numero}</NroResol>
      <TipoOperacion>${tipoLibro}</TipoOperacion>
      <TipoLibro>MENSUAL</TipoLibro>
      <TipoEnvio>TOTAL</TipoEnvio>
      <FolioNotificacion>0</FolioNotificacion>
    </Caratula>
    <ResumenPeriodo>
      <TotDoc>${documentos.length}</TotDoc>
      <TotMntExe>${totalExento}</TotMntExe>
      <TotMntNeto>${totalNeto}</TotMntNeto>
      <TotMntIVA>${totalIva}</TotMntIVA>
      <TotMntTotal>${totalMonto}</TotMntTotal>
    </ResumenPeriodo>
    ${detallesXml}
  </EnvioLibro>
</LibroCompraVenta>`
}

// ============================================================
// FIRMAR EL XML DEL LIBRO CV
// ============================================================

function firmarXmlLibroCV(
  xml:        string,
  privateKey: forge.pki.PrivateKey,
  certificate: forge.pki.Certificate
): string {
  const md = forge.md.sha1.create()
  md.update(xml, 'utf8')
  const digestValue = forge.util.encode64(md.digest().bytes())

  const signedInfo =
    `<SignedInfo>` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#LibroCV">` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`

  const mdSign = forge.md.sha1.create()
  mdSign.update(signedInfo, 'utf8')
  const signatureValue = forge.util.encode64((privateKey as any).sign(mdSign))

  const certBase64 = forge.pki.certificateToPem(certificate)
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\n/g, '')

  return xml.replace(
    '</LibroCompraVenta>',
    `  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    ${signedInfo}
    <SignatureValue>${signatureValue}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certBase64}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>
</LibroCompraVenta>`
  )
}

// ============================================================
// GENERAR LIBRO CV (sin enviar)
// Recopila los DTEs del período y genera el XML
// ============================================================

export async function generarLibroCV(
  negocioId: string,
  tipo:      'compra' | 'venta',
  mes:       number,
  anio:      number
): Promise<{ libroId: string; xmlLibro: string; resumen: any }> {
  const negocio = await prisma.negocio.findUnique({
    where:   { id: negocioId },
    include: { configuracionSii: true },
  })
  if (!negocio) throw new Error('Negocio no encontrado')

  const ambiente = negocio.ambienteSii

  // Verificar que no exista ya un libro para este período
  const libroExistente = await prisma.libroCV.findUnique({
    where: { negocioId_tipo_mes_anio_ambiente: { negocioId, tipo, mes, anio, ambiente } },
  })

  // Fechas del período
  const fechaInicio = new Date(anio, mes - 1, 1)
  const fechaFin    = new Date(anio, mes, 0, 23, 59, 59)

  // Obtener DTEs del período según tipo
  const estadosValidos = ['aceptado_sii', 'enviado_sii', 'aceptado_receptor']
  const documentos = await prisma.documentoSii.findMany({
    where: {
      negocioId,
      ambiente,
      estado:       { in: estadosValidos },
      fechaEmision: { gte: fechaInicio, lte: fechaFin },
    },
    orderBy: { fechaEmision: 'asc' },
  })

  if (documentos.length === 0) {
    throw new Error(`No hay documentos ${tipo === 'venta' ? 'emitidos' : 'recibidos'} para el período ${mes}/${anio}`)
  }

  // Mapear a estructura del libro
  const detalles: DetalleDocumento[] = documentos.map(doc => ({
    tipoDocumento: doc.tipoDocumento,
    folio:         doc.folio,
    fechaEmision:  doc.fechaEmision,
    rutReceptor:   doc.receptorRut,
    razonSocial:   doc.receptorNombre,
    montoNeto:     doc.montoNeto,
    montoExento:   doc.montoExento,
    montoIva:      doc.montoIva,
    montoTotal:    doc.montoTotal,
  }))

  // Datos de resolución
  const resolucion = {
    numero: negocio.configuracionSii?.resolucionNumero || '0',
    fecha:  negocio.configuracionSii?.resolucionFecha
      ? negocio.configuracionSii.resolucionFecha.toISOString().substring(0, 10)
      : new Date().toISOString().substring(0, 10),
  }

  // Generar XML
  const xmlLibro = generarXmlLibroCV({
    rutEmisor:  negocio.rutNegocio,
    tipo,
    mes,
    anio,
    documentos: detalles,
    resolucion,
  })

  // Calcular totales para guardar
  const totalNeto   = detalles.reduce((s, d) => s + d.montoNeto,   0)
  const totalExento = detalles.reduce((s, d) => s + d.montoExento, 0)
  const totalIva    = detalles.reduce((s, d) => s + d.montoIva,    0)
  const totalMonto  = detalles.reduce((s, d) => s + d.montoTotal,  0)

  // Guardar o actualizar el libro en BD
  const libro = libroExistente
    ? await prisma.libroCV.update({
        where: { id: libroExistente.id },
        data: {
          estado:           'generado',
          totalDocumentos:  detalles.length,
          totalNeto,
          totalExento,
          totalIva,
          totalMonto,
          xmlLibro,
          fechaGeneracion:  new Date(),
        },
      })
    : await prisma.libroCV.create({
        data: {
          negocioId,
          tipo,
          mes,
          anio,
          ambiente,
          estado:           'generado',
          totalDocumentos:  detalles.length,
          totalNeto,
          totalExento,
          totalIva,
          totalMonto,
          xmlLibro,
          fechaGeneracion:  new Date(),
        },
      })

  return {
    libroId:  libro.id,
    xmlLibro,
    resumen: {
      tipo,
      periodo:         `${mes}/${anio}`,
      totalDocumentos: detalles.length,
      totalNeto,
      totalExento,
      totalIva,
      totalMonto,
    },
  }
}

// ============================================================
// ENVIAR LIBRO CV AL SII
// ============================================================

export async function enviarLibroCV(
  negocioId: string,
  libroId:   string
): Promise<{ trackId: string }> {
  const libro = await prisma.libroCV.findUnique({ where: { id: libroId } })
  if (!libro)          throw new Error('Libro no encontrado')
  if (!libro.xmlLibro) throw new Error('El libro no tiene XML generado. Genera el libro primero.')

  const negocio = await prisma.negocio.findUnique({
    where:  { id: negocioId },
    select: { rutNegocio: true, ambienteSii: true },
  })
  if (!negocio) throw new Error('Negocio no encontrado')

  const ambiente = negocio.ambienteSii as 'certificacion' | 'produccion'
  const token    = await obtenerToken(negocioId)
  const urls     = await getUrlsSii(negocioId)

  // Firmar el XML
  const { privateKey, certificate } = await cargarCertificado(negocioId)
  const xmlFirmado = firmarXmlLibroCV(libro.xmlLibro, privateKey, certificate)

  const [rutSinDv, dv] = negocio.rutNegocio.split('-')

  const form = new FormData()
  form.append('rutSender',  rutSinDv)
  form.append('dvSender',   dv)
  form.append('rutCompany', rutSinDv)
  form.append('dvCompany',  dv)
  form.append('archivo',    Buffer.from(xmlFirmado, 'utf8'), {
    filename:    `libro_${libro.tipo}_${libro.anio}_${libro.mes}.xml`,
    contentType: 'text/xml',
  })

  const inicio    = Date.now()
  let trackId     = ''
  let exitoso     = false
  let estadoResp  = ''
  let errorMsg    = ''

  try {
    // El SII tiene un endpoint específico para libros CV
    const urlLibro = urls.envio.replace('/dte/services/', '/LibroCV/')

    const response = await axios.post(urlLibro, form, {
      headers: {
        ...form.getHeaders(),
        Cookie: `TOKEN=${token}`,
      },
      timeout: 30000,
    })

    const parsed = await parseStringPromise(response.data)
    trackId      = parsed?.RECEPCIONLIBRO?.TRACKID?.[0] || ''
    estadoResp   = parsed?.RECEPCIONLIBRO?.STATUS?.[0]  || ''

    if (estadoResp === '0' && trackId) {
      exitoso = true
      await prisma.libroCV.update({
        where: { id: libroId },
        data: {
          estado:     'enviado',
          trackId,
          xmlLibro:   xmlFirmado,
          fechaEnvio: new Date(),
        },
      })
    } else {
      errorMsg = `SII rechazó el libro. Status: ${estadoResp}`
      await prisma.libroCV.update({
        where: { id: libroId },
        data:  { estado: 'pendiente', respuesta: errorMsg },
      })
      throw new Error(errorMsg)
    }
  } catch (error: any) {
    errorMsg = error.message
    throw error
  } finally {
    await prisma.logDte.create({
      data: {
        negocioId,
        operacion:       'envio_libro_cv',
        exitoso,
        codigoRespuesta: estadoResp,
        mensajeError:    errorMsg || null,
        duracionMs:      Date.now() - inicio,
        ambiente,
        requestResumen:  `Libro ${libro.tipo} ${libro.mes}/${libro.anio} - ${libro.totalDocumentos} docs`,
        responseResumen: trackId ? `TrackId: ${trackId}` : estadoResp,
      },
    })
  }

  return { trackId }
}

// ============================================================
// GENERAR Y ENVIAR EN UN SOLO PASO
// ============================================================

export async function generarYEnviarLibroCV(
  negocioId: string,
  tipo:      'compra' | 'venta',
  mes:       number,
  anio:      number
): Promise<{ trackId: string; resumen: any }> {
  const { libroId, resumen } = await generarLibroCV(negocioId, tipo, mes, anio)
  const { trackId }          = await enviarLibroCV(negocioId, libroId)
  return { trackId, resumen }
}

// ============================================================
// OBTENER ESTADO DE LIBROS CV DEL NEGOCIO
// ============================================================

export async function getEstadoLibrosCV(
  negocioId: string,
  anio?:     number
): Promise<any[]> {
  const where: any = { negocioId }
  if (anio) where.anio = anio

  return prisma.libroCV.findMany({
    where,
    orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { tipo: 'asc' }],
    select: {
      id:              true,
      tipo:            true,
      mes:             true,
      anio:            true,
      estado:          true,
      totalDocumentos: true,
      totalNeto:       true,
      totalIva:        true,
      totalMonto:      true,
      trackId:         true,
      fechaGeneracion: true,
      fechaEnvio:      true,
      ambiente:        true,
    },
  })
}