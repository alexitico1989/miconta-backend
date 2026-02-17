import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarMes, validarAnio } from '../utils/validators';

const PORCENTAJES = {
  AFP:                 0.1,
  SALUD:               0.07,
  CESANTIA_TRABAJADOR: 0.006,
  CESANTIA_EMPLEADOR:  0.024,
  SIS:                 0.0077
};

const UTM_2026 = 65000;

const TABLA_IMPUESTO_UNICO = [
  { desde: 0,               hasta: 13.5 * UTM_2026, tasa: 0,     rebaja: 0 },
  { desde: 13.5 * UTM_2026, hasta: 30 * UTM_2026,   tasa: 0.04,  rebaja: 0.04 * 13.5 * UTM_2026 },
  { desde: 30 * UTM_2026,   hasta: 50 * UTM_2026,   tasa: 0.08,  rebaja: 0.08 * 30 * UTM_2026 - (0.04 * 13.5 * UTM_2026) },
  { desde: 50 * UTM_2026,   hasta: 70 * UTM_2026,   tasa: 0.135, rebaja: 0.135 * 50 * UTM_2026 - (0.08 * 30 * UTM_2026 - (0.04 * 13.5 * UTM_2026)) },
  { desde: 70 * UTM_2026,   hasta: 90 * UTM_2026,   tasa: 0.23,  rebaja: 0.23 * 70 * UTM_2026 },
  { desde: 90 * UTM_2026,   hasta: 120 * UTM_2026,  tasa: 0.304, rebaja: 0.304 * 90 * UTM_2026 },
  { desde: 120 * UTM_2026,  hasta: Infinity,          tasa: 0.35,  rebaja: 0.35 * 120 * UTM_2026 }
];

function calcularImpuestoUnico(baseImponible: number): number {
  for (const tramo of TABLA_IMPUESTO_UNICO) {
    if (baseImponible >= tramo.desde && baseImponible < tramo.hasta) {
      return Math.round(baseImponible * tramo.tasa - tramo.rebaja);
    }
  }
  return 0;
}

// GENERAR LIQUIDACIÓN
export const generarLiquidacion = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { trabajadorId, mes, anio, horasExtra, bonos, otrosDescuentos } = req.body;

    if (!trabajadorId || !mes || !anio) {
      return res.status(400).json({ error: 'Faltan campos requeridos: trabajadorId, mes, anio' });
    }

    const validacionMes = validarMes(mes);
    if (!validacionMes.valido) return res.status(400).json({ error: validacionMes.error });

    const validacionAnio = validarAnio(anio);
    if (!validacionAnio.valido) return res.status(400).json({ error: validacionAnio.error });

    if (horasExtra !== undefined && horasExtra < 0)
      return res.status(400).json({ error: 'Horas extra no puede ser negativo' });
    if (bonos !== undefined && bonos < 0)
      return res.status(400).json({ error: 'Bonos no puede ser negativo' });
    if (otrosDescuentos !== undefined && otrosDescuentos < 0)
      return res.status(400).json({ error: 'Otros descuentos no puede ser negativo' });

    const trabajador = await prisma.trabajador.findUnique({
      where: { id: trabajadorId },
      include: { negocio: true }
    });

    if (!trabajador) return res.status(404).json({ error: 'Trabajador no encontrado' });
    if (trabajador.negocio.usuarioId !== userId) return res.status(403).json({ error: 'No tienes permiso' });

    const liquidacionExistente = await prisma.liquidacion.findUnique({
      where: { trabajadorId_mes_anio: { trabajadorId, mes, anio } }
    });

    if (liquidacionExistente)
      return res.status(400).json({ error: 'Ya existe una liquidación para este periodo' });

    // CALCULAR HABERES
    const sueldoBase         = trabajador.sueldoBase;
    const cantidadHorasExtra = horasExtra || 0;
    const bonosValor         = bonos || 0;
    const valorHoraExtra     = Math.round((sueldoBase / 180) * 1.5);
    const montoHorasExtra    = cantidadHorasExtra * valorHoraExtra;
    const totalHaberes       = sueldoBase + montoHorasExtra + bonosValor;

    // DESCUENTOS — nombres exactos del schema Prisma
    const montoAfp       = Math.round(totalHaberes * PORCENTAJES.AFP);
    const montoSalud     = Math.round(totalHaberes * PORCENTAJES.SALUD);
    const montoCesantia  = Math.round(totalHaberes * PORCENTAJES.CESANTIA_TRABAJADOR);
    const baseImponible  = totalHaberes - montoAfp - montoSalud - montoCesantia;
    const impuestoUnico  = calcularImpuestoUnico(baseImponible);

    // Aporte empleador
    const cesantiaEmp    = Math.round(totalHaberes * PORCENTAJES.CESANTIA_EMPLEADOR);
    const sis            = Math.round(totalHaberes * PORCENTAJES.SIS);
    const costoEmpleador = totalHaberes + cesantiaEmp + sis;

    const totalDescuentos = montoAfp + montoSalud + montoCesantia + impuestoUnico + (otrosDescuentos || 0);
    const sueldoLiquido   = totalHaberes - totalDescuentos;

    // Determinar si salud va a saludFonasa o saludIsapre
    const esIsapre = trabajador.isapre != null;

    const liquidacion = await prisma.liquidacion.create({
      data: {
        trabajadorId,
        mes,
        anio,
        sueldoBase,
        horasExtraCantidad: cantidadHorasExtra,
        horasExtraMonto:    montoHorasExtra,
        bonos:              bonosValor,
        totalHaberes,
        afp:            montoAfp,
        ...(esIsapre ? { saludIsapre: montoSalud } : { saludFonasa: montoSalud }),
        seguroCesantia: montoCesantia,
        impuestoUnico,
        otrosDescuentos: otrosDescuentos || 0,
        totalDescuentos,
        sueldoLiquido,
        costoEmpleador,
      }
    });

    res.status(201).json({ message: 'Liquidación generada exitosamente', liquidacion });

  } catch (error) {
    console.error('Error en generarLiquidacion:', error);
    res.status(500).json({ error: 'Error al generar liquidación', detalle: error instanceof Error ? error.message : 'Error desconocido' });
  }
};

// OBTENER LIQUIDACIONES
export const getLiquidaciones = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { mes, anio, trabajadorId, limit, offset } = req.query;

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } });
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });

    const where: any = { trabajador: { negocioId: negocio.id } };

    if (mes) {
      const mesNum = parseInt(mes as string);
      const v = validarMes(mesNum);
      if (!v.valido) return res.status(400).json({ error: v.error });
      where.mes = mesNum;
    }

    if (anio) {
      const anioNum = parseInt(anio as string);
      const v = validarAnio(anioNum);
      if (!v.valido) return res.status(400).json({ error: v.error });
      where.anio = anioNum;
    }

    if (trabajadorId) where.trabajadorId = trabajadorId as string;

    const take = limit  ? parseInt(limit as string)  : 50;
    const skip = offset ? parseInt(offset as string) : 0;

    const [liquidaciones, total] = await Promise.all([
      prisma.liquidacion.findMany({
        where,
        include: { trabajador: true },
        orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
        take,
        skip
      }),
      prisma.liquidacion.count({ where })
    ]);

    res.json({
      liquidaciones,
      paginacion: { total, limit: take, offset: skip, hasMore: skip + liquidaciones.length < total }
    });

  } catch (error) {
    console.error('Error en getLiquidaciones:', error);
    res.status(500).json({ error: 'Error al obtener liquidaciones', detalle: error instanceof Error ? error.message : 'Error desconocido' });
  }
};

// GENERAR ARCHIVO PREVIRED TXT
export const generarArchivoPrevired = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const { mes, anio } = req.body;

    if (!mes || !anio) return res.status(400).json({ error: 'Mes y año son requeridos' });

    const validacionMes = validarMes(mes);
    if (!validacionMes.valido) return res.status(400).json({ error: validacionMes.error });

    const validacionAnio = validarAnio(anio);
    if (!validacionAnio.valido) return res.status(400).json({ error: validacionAnio.error });

    const negocio = await prisma.negocio.findUnique({ where: { usuarioId: userId } });
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' });

    // Select explícito con los campos reales del schema
    const liquidaciones = await prisma.liquidacion.findMany({
      where: {
        mes,
        anio,
        trabajador: { negocioId: negocio.id, activo: true }
      },
      select: {
        totalHaberes:   true,
        afp:            true,
        saludFonasa:    true,
        saludIsapre:    true,
        seguroCesantia: true,
        impuestoUnico:  true,
        trabajador: {
          select: {
            rut:             true,
            nombre:          true,
            apellidoPaterno: true,
            apellidoMaterno: true,
          }
        }
      }
    });

    if (liquidaciones.length === 0)
      return res.status(404).json({ error: 'No hay liquidaciones para este periodo' });

    let contenidoTxt = '';
    contenidoTxt += `1|${negocio.rutNegocio || ''}|${mes}|${anio}|\n`;

    liquidaciones.forEach(liq => {
      const montoSalud = (liq.saludFonasa ?? 0) + (liq.saludIsapre ?? 0);
      contenidoTxt += [
        '2',
        liq.trabajador.rut,
        liq.trabajador.nombre,
        liq.trabajador.apellidoPaterno,
        liq.trabajador.apellidoMaterno || '',
        liq.totalHaberes,
        liq.afp,
        montoSalud,
        liq.seguroCesantia,
        liq.impuestoUnico
      ].join('|') + '\n';
    });

    const totalHaberes = liquidaciones.reduce((sum, l) => sum + l.totalHaberes, 0);
    const totalAFP     = liquidaciones.reduce((sum, l) => sum + l.afp, 0);
    const totalSalud   = liquidaciones.reduce((sum, l) => sum + (l.saludFonasa ?? 0) + (l.saludIsapre ?? 0), 0);

    contenidoTxt += `3|${liquidaciones.length}|${totalHaberes}|${totalAFP}|${totalSalud}|\n`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="previred_${mes}_${anio}.txt"`);
    res.send(contenidoTxt);

  } catch (error) {
    console.error('Error en generarArchivoPrevired:', error);
    res.status(500).json({ error: 'Error al generar archivo Previred', detalle: error instanceof Error ? error.message : 'Error desconocido' });
  }
};

// MARCAR LIQUIDACIÓN COMO PAGADA
export const marcarComoPagada = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id     = req.params.id as string;
    const { fechaPago } = req.body;

    const liquidacion = await prisma.liquidacion.findUnique({
      where: { id },
      include: { trabajador: { include: { negocio: true } } }
    });

    if (!liquidacion) return res.status(404).json({ error: 'Liquidación no encontrada' });
    if (liquidacion.trabajador.negocio.usuarioId !== userId) return res.status(403).json({ error: 'No tienes permiso' });

    const liquidacionActualizada = await prisma.liquidacion.update({
      where: { id },
      data: { pagado: true, fechaPago: fechaPago ? new Date(fechaPago) : new Date() }
    });

    res.json({ message: 'Liquidación marcada como pagada', liquidacion: liquidacionActualizada });

  } catch (error) {
    console.error('Error en marcarComoPagada:', error);
    res.status(500).json({ error: 'Error al marcar liquidación como pagada', detalle: error instanceof Error ? error.message : 'Error desconocido' });
  }
};