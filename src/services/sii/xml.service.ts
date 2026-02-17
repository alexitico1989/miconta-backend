// ============================================================
// xml.service.ts
// Generación del XML DTE según especificaciones SII Chile
// Incluye firma electrónica y timbre (TED)
// Ref: https://www.sii.cl/factura_electronica/factura_mercado/instructivo_emision.pdf
// ============================================================

import forge from 'node-forge'
import crypto from 'crypto'
import { cargarCertificado } from './certificado.service'
import { obtenerSiguienteFolio, TipoDte } from './caf.service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ============================================================
// TIPOS
// ============================================================

export interface ItemDte {
  numeroLinea:    number
  nombre:         string
  descripcion?:   string
  cantidad:       number
  unidadMedida:   string
  precioUnitario: number
  descuentoPct?:  number
  descuentoMonto?: number
  exento?:        boolean
}

export interface DatosEmision {
  negocioId:        string
  tipoDocumento:    TipoDte
  fechaEmision:     Date
  // Receptor
  receptorRut:      string
  receptorNombre:   string
  receptorDireccion?: string
  receptorComuna?:  string
  receptorGiro?:    string
  receptorEmail?:   string
  // Items
  items:            ItemDte[]
  // Opcionales
  metodoPago?:      string   // 'CONTADO' | 'CREDITO' | 'SINESPECIE'
  fechaVencimiento?: Date
  // Referencia a documento previo (para notas)
  referenciaFolio?:    number
  referenciaTipo?:     string
  referenciaRazon?:    string
  codigoReferencia?:   string
}

export interface DteGenerado {
  folio:            number
  xmlFirmado:       string
  timbreElectronico: string
  montoNeto:        number
  montoExento:      number
  montoIva:         number
  montoTotal:       number
}

// ============================================================
// CALCULAR MONTOS
// ============================================================

function calcularMontos(items: ItemDte[], tasaIva: number = 19): {
  neto:   number
  exento: number
  iva:    number
  total:  number
} {
  let neto   = 0
  let exento = 0

  for (const item of items) {
    let montoItem = item.cantidad * item.precioUnitario

    if (item.descuentoPct) {
      montoItem -= Math.round(montoItem * item.descuentoPct / 100)
    } else if (item.descuentoMonto) {
      montoItem -= item.descuentoMonto
    }

    if (item.exento) {
      exento += montoItem
    } else {
      neto += montoItem
    }
  }

  const iva   = Math.round(neto * tasaIva / 100)
  const total = neto + exento + iva

  return { neto, exento, iva, total }
}

// ============================================================
// GENERAR XML DEL DOCUMENTO (sin firma)
// ============================================================

function generarXmlDocumento(
  datos: DatosEmision,
  folio: number,
  emisor: {
    rut:       string
    razon:     string
    giro:      string
    direccion: string
    comuna:    string
    ciudad:    string
    email:     string
    resolucion: string
    fechaResolucion: string
  },
  montos: { neto: number; exento: number; iva: number; total: number }
): string {
  const fecha = datos.fechaEmision.toISOString().split('T')[0]

  // Líneas de detalle
  const detalles = datos.items.map((item, idx) => {
    const montoItem = item.cantidad * item.precioUnitario
    return `
    <Detalle>
      <NroLinDet>${idx + 1}</NroLinDet>
      <NmbItem>${escapeXml(item.nombre)}</NmbItem>
      ${item.descripcion ? `<DscItem>${escapeXml(item.descripcion)}</DscItem>` : ''}
      <QtyItem>${item.cantidad}</QtyItem>
      <UnmdItem>${item.unidadMedida}</UnmdItem>
      <PrcItem>${item.precioUnitario}</PrcItem>
      ${item.descuentoPct ? `<DescuentoPct>${item.descuentoPct}</DescuentoPct>` : ''}
      ${item.descuentoMonto ? `<DescuentoMonto>${item.descuentoMonto}</DescuentoMonto>` : ''}
      ${item.exento ? '<IndExe>1</IndExe>' : ''}
      <MontoItem>${montoItem}</MontoItem>
    </Detalle>`
  }).join('')

  // Referencia a documento previo (para notas crédito/débito)
  const referencia = datos.referenciaFolio ? `
    <Referencia>
      <NroLinRef>1</NroLinRef>
      <TpoDocRef>${datos.referenciaTipo}</TpoDocRef>
      <FolioRef>${datos.referenciaFolio}</FolioRef>
      <FchRef>${fecha}</FchRef>
      ${datos.codigoReferencia ? `<CodRef>${datos.codigoReferencia}</CodRef>` : ''}
      ${datos.referenciaRazon ? `<RazonRef>${escapeXml(datos.referenciaRazon)}</RazonRef>` : ''}
    </Referencia>` : ''

  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0">
  <Documento ID="T${datos.tipoDocumento}F${folio}">
    <Encabezado>
      <IdDoc>
        <TipoDTE>${datos.tipoDocumento}</TipoDTE>
        <Folio>${folio}</Folio>
        <FchEmis>${fecha}</FchEmis>
        ${datos.metodoPago ? `<FmaPago>${datos.metodoPago === 'credito' ? '2' : '1'}</FmaPago>` : '<FmaPago>1</FmaPago>'}
        ${datos.fechaVencimiento ? `<FchVenc>${datos.fechaVencimiento.toISOString().split('T')[0]}</FchVenc>` : ''}
      </IdDoc>
      <Emisor>
        <RUTEmisor>${emisor.rut}</RUTEmisor>
        <RznSoc>${escapeXml(emisor.razon)}</RznSoc>
        <GiroEmis>${escapeXml(emisor.giro)}</GiroEmis>
        <DirOrigen>${escapeXml(emisor.direccion)}</DirOrigen>
        <CmnaOrigen>${escapeXml(emisor.comuna)}</CmnaOrigen>
        <CiudadOrigen>${escapeXml(emisor.ciudad)}</CiudadOrigen>
      </Emisor>
      <Receptor>
        <RUTRecep>${datos.receptorRut}</RUTRecep>
        <RznSocRecep>${escapeXml(datos.receptorNombre)}</RznSocRecep>
        ${datos.receptorGiro ? `<GiroRecep>${escapeXml(datos.receptorGiro)}</GiroRecep>` : ''}
        ${datos.receptorDireccion ? `<DirRecep>${escapeXml(datos.receptorDireccion)}</DirRecep>` : ''}
        ${datos.receptorComuna ? `<CmnaRecep>${escapeXml(datos.receptorComuna)}</CmnaRecep>` : ''}
        ${datos.receptorEmail ? `<MailRecep>${datos.receptorEmail}</MailRecep>` : ''}
      </Receptor>
      <Totales>
        ${montos.neto > 0 ? `<MntNeto>${montos.neto}</MntNeto>` : ''}
        ${montos.exento > 0 ? `<MntExe>${montos.exento}</MntExe>` : ''}
        ${montos.neto > 0 ? `<TasaIVA>19</TasaIVA><IVA>${montos.iva}</IVA>` : ''}
        <MntTotal>${montos.total}</MntTotal>
      </Totales>
    </Encabezado>
    ${detalles}
    ${referencia}
  </Documento>
</DTE>`
}

// ============================================================
// CALCULAR TIMBRE ELECTRÓNICO (TED)
// El TED es un resumen del DTE firmado con la llave del CAF
// Se imprime como código PDF417 en el documento físico
// ============================================================

function calcularTed(
  datos: DatosEmision,
  folio: number,
  montos: { neto: number; exento: number; iva: number; total: number },
  emisorRut: string,
  cafPrivateKey: string
): string {
  const fecha = datos.fechaEmision.toISOString().split('T')[0]

  // El DD (Datos del Documento) es lo que firma el CAF
  const dd = `<DD>` +
    `<RE>${emisorRut}</RE>` +
    `<TD>${datos.tipoDocumento}</TD>` +
    `<F>${folio}</F>` +
    `<FE>${fecha}</FE>` +
    `<RR>${datos.receptorRut}</RR>` +
    `<RSR>${datos.receptorNombre.substring(0, 40)}</RSR>` +
    `<MNT>${montos.total}</MNT>` +
    `<IT1>${escapeXml(datos.items[0]?.nombre?.substring(0, 40) || '')}</IT1>` +
    `<CAF version="1.0">` +
    // Aquí va el contenido del CAF — se extrae del XML del CAF
    `</CAF>` +
    `<TSTED>${new Date().toISOString().replace('T', ' ').substring(0, 19)}</TSTED>` +
    `</DD>`

  // Firmar el DD con la llave privada del CAF
  // La llave viene en formato específico del SII (base64 RSA)
  try {
    const sign = crypto.createSign('SHA1')
    sign.update(dd)

    // La llave privada del CAF viene en formato específico SII
    // Se debe convertir a PEM para usarla con crypto
    const pemKey = `-----BEGIN RSA PRIVATE KEY-----\n${cafPrivateKey}\n-----END RSA PRIVATE KEY-----`
    const firma = sign.sign(pemKey, 'base64')

    return `<TED version="1.0">` +
      dd +
      `<FRMA algoritmo="SHA1withRSA">${firma}</FRMA>` +
      `</TED>`
  } catch (error) {
    // Si falla la firma del TED, lanzar error claro
    throw new Error('Error al calcular el Timbre Electrónico (TED). Verifica el CAF.')
  }
}

// ============================================================
// FIRMAR EL XML COMPLETO DEL DTE
// Firma XMLDSig sobre el elemento Documento
// ============================================================

function firmarXmlDte(
  xmlDte: string,
  privateKey: forge.pki.PrivateKey,
  certificate: forge.pki.Certificate,
  idDocumento: string
): string {
  // Calcular digest SHA1 del contenido del Documento
  const md = forge.md.sha1.create()
  md.update(xmlDte, 'utf8')
  const digestValue = forge.util.encode64(md.digest().bytes())

  // Firmar el digest con la llave privada del contribuyente
  const mdSign = forge.md.sha1.create()
  mdSign.update(
    `<SignedInfo>` +
    `<CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>` +
    `<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>` +
    `<Reference URI="#${idDocumento}">` +
    `<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>` +
    `<DigestValue>${digestValue}</DigestValue>` +
    `</Reference>` +
    `</SignedInfo>`,
    'utf8'
  )
  const signatureValue = forge.util.encode64(
    (privateKey as any).sign(mdSign)
  )

  // Certificado en base64
  const certPem = forge.pki.certificateToPem(certificate)
  const certBase64 = certPem
    .replace('-----BEGIN CERTIFICATE-----', '')
    .replace('-----END CERTIFICATE-----', '')
    .replace(/\n/g, '')

  // Agregar firma al XML
  const firma = `
  <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
    <SignedInfo>
      <CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
      <SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"/>
      <Reference URI="#${idDocumento}">
        <DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"/>
        <DigestValue>${digestValue}</DigestValue>
      </Reference>
    </SignedInfo>
    <SignatureValue>${signatureValue}</SignatureValue>
    <KeyInfo>
      <X509Data>
        <X509Certificate>${certBase64}</X509Certificate>
      </X509Data>
    </KeyInfo>
  </Signature>`

  // Insertar la firma justo antes del cierre </DTE>
  return xmlDte.replace('</DTE>', `${firma}\n</DTE>`)
}

// ============================================================
// FUNCIÓN PRINCIPAL: GENERAR Y FIRMAR UN DTE
// ============================================================

export async function generarDte(datos: DatosEmision): Promise<DteGenerado> {
  const negocio = await prisma.negocio.findUnique({
    where: { id: datos.negocioId },
    include: { configuracionSii: true },
  })

  if (!negocio) throw new Error('Negocio no encontrado')

  const ambiente = negocio.ambienteSii as 'certificacion' | 'produccion'

  // 1. Obtener siguiente folio del CAF
  const { folio, privateKey: cafPrivateKey, xmlCaf } = await obtenerSiguienteFolio(
    datos.negocioId,
    datos.tipoDocumento,
    ambiente
  )

  // 2. Cargar certificado del contribuyente
  const { privateKey, certificate } = await cargarCertificado(datos.negocioId)

  // 3. Calcular montos
  const montos = calcularMontos(datos.items)

  // 4. Datos del emisor
  const emisor = {
    rut:             negocio.rutNegocio,
    razon:           negocio.nombreNegocio,
    giro:            negocio.giro || '',
    direccion:       negocio.direccion || '',
    comuna:          negocio.comuna || '',
    ciudad:          negocio.region || '',
    email:           negocio.emailSii || '',
    resolucion:      negocio.configuracionSii?.resolucionNumero || '0',
    fechaResolucion: negocio.configuracionSii?.resolucionFecha?.toISOString().split('T')[0] || '',
  }

  // 5. Calcular TED (timbre electrónico)
  const ted = calcularTed(datos, folio, montos, negocio.rutNegocio, cafPrivateKey)

  // 6. Generar XML base del documento
  let xmlBase = generarXmlDocumento(datos, folio, emisor, montos)

  // 7. Insertar TED en el XML (antes del cierre de </Documento>)
  xmlBase = xmlBase.replace(
    '</Documento>',
    `  <TED>${ted}</TED>\n  </Documento>`
  )

  // 8. Firmar el XML completo con el certificado del contribuyente
  const xmlFirmado = firmarXmlDte(
    xmlBase,
    privateKey,
    certificate,
    `T${datos.tipoDocumento}F${folio}`
  )

  return {
    folio,
    xmlFirmado,
    timbreElectronico: ted,
    montoNeto:         montos.neto,
    montoExento:       montos.exento,
    montoIva:          montos.iva,
    montoTotal:        montos.total,
  }
}

// ============================================================
// HELPER: Escape XML
// ============================================================

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}