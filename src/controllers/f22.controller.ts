import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validarAnio } from '../utils/validators';

// Tabla impuesto Global Complementario 2026 (actualizar según normativa)
const UF_2026 = 37800;

const TABLA_IGC = [
  { desde: 0, hasta: 13.5 * UF_2026, tasa: 0, rebaja: 0 },
  { desde: 13.5 * UF_2026, hasta: 30 * UF_2026, tasa: 0.04, rebaja: 0.04 * 13.5 * UF_2026 },
  { desde: 30 * UF_2026, hasta: 50 * UF_2026, tasa: 0.08, rebaja: 0.08 * 30 * UF_2026 - (0.04 * 13.5 * UF_2026) },
  { desde: 50 * UF_2026, hasta: 70 * UF_2026, tasa: 0.135, rebaja: 0.135 * 50 * UF_2026 - (0.08 * 30 * UF_2026 - (0.04 * 13.5 * UF_2026)) },
  { desde: 70 * UF_2026, hasta: 90 * UF_2026, tasa: 0.23, rebaja: 0.23 * 70 * UF_2026 },
  { desde: 90 * UF_2026, hasta: 120 * UF_2026, tasa: 0.304, rebaja: 0.304 * 90 * UF_2026 },
  { desde: 120 * UF_2026, hasta: 150 * UF_2026, tasa: 0.35, rebaja: 0.35 * 120 * UF_2026 },
  { desde: 150 * UF_2026, hasta: Infinity, tasa: 0.40, rebaja: 0.40 * 150 * UF_2026 }
];

// CALCULAR IMPUESTO
function calcularImpuestoGlobalComplementario(rentaLiquida: number): number {
  for (const tramo of TABLA_IGC) {
    if (rentaLiquida >= tramo.desde && rentaLiquida < tramo.hasta) {
      const impuesto = rentaLiquida * tramo.tasa - tramo.rebaja;
      return Math.round(impuesto);
    }
  }
  return 0;
}

// OBTENER/CALCULAR F22
export const getF22 = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const anio = req.params.anio as string;

    const anioNum = parseInt(anio);

    const validacionAnio = validarAnio(anioNum);
    if (!validacionAnio.valido) {
      return res.status(400).json({
        error: validacionAnio.error
      });
    }

    // Obtener negocio
    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    // Buscar si ya existe declaración
    let declaracion = await prisma.declaracionF22.findUnique({
      where: {
        negocioId_anio: {
          negocioId: negocio.id,
          anio: anioNum
        }
      }
    });

    // Si no existe, calcularla
    if (!declaracion) {
      // Obtener todos los F29 del año
      const f29s = await prisma.declaracionF29.findMany({
        where: {
          negocioId: negocio.id,
          anio: anioNum
        },
        orderBy: {
          mes: 'asc'
        }
      });

      if (f29s.length === 0) {
        return res.status(404).json({
          error: `No hay F29 declarados para el año ${anioNum}`
        });
      }

      // Sumar ingresos totales del año (ventas afectas + exentas)
      const ingresosTotal = f29s.reduce((sum, f29) => {
        return sum + f29.ventasAfectas + f29.ventasExentas;
      }, 0);

      // Sumar PPM pagado en el año
      const ppmPagado = f29s.reduce((sum, f29) => sum + f29.ppm, 0);

      // Para almacén simple: renta líquida = ingresos (sin gastos deducibles)
      // En Pro-PYME simplificado no se deducen gastos
      const gastosDeducibles = 0;
      const rentaLiquida = ingresosTotal - gastosDeducibles;

      // Calcular impuesto según tabla
      const impuestoDeterminado = calcularImpuestoGlobalComplementario(rentaLiquida);

      // Resultado final (impuesto - PPM pagado)
      const impuestoAPagar = impuestoDeterminado - ppmPagado;

      // Crear declaración
      declaracion = await prisma.declaracionF22.create({
        data: {
          negocioId: negocio.id,
          anio: anioNum,
          ingresosTotal,
          gastosDeducibles,
          rentaLiquida,
          impuestoDeterminado,
          ppmPagado,
          creditosImputables: 0,
          impuestoAPagar,
          estado: 'borrador'
        }
      });
    }

    res.json({
      declaracion,
      resumen: {
        anio: anioNum,
        ingresosTotal: declaracion.ingresosTotal,
        rentaLiquida: declaracion.rentaLiquida,
        impuestoDeterminado: declaracion.impuestoDeterminado,
        ppmPagado: declaracion.ppmPagado,
        resultado: {
          monto: Math.abs(declaracion.impuestoAPagar),
          tipo: declaracion.impuestoAPagar > 0 ? 'A pagar' : 'Devolución'
        }
      },
      detalle: {
        f29Presentados: await prisma.declaracionF29.count({
          where: {
            negocioId: negocio.id,
            anio: anioNum,
            estado: 'presentado'
          }
        }),
        totalF29: 12,
        pendientes: 12 - await prisma.declaracionF29.count({
          where: {
            negocioId: negocio.id,
            anio: anioNum,
            estado: 'presentado'
          }
        })
      }
    });

  } catch (error) {
    console.error('Error en getF22:', error);
    res.status(500).json({
      error: 'Error al obtener F22',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// LISTAR F22 (historial)
export const listarF22 = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;

    // Obtener negocio
    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    // Obtener declaraciones
    const declaraciones = await prisma.declaracionF22.findMany({
      where: {
        negocioId: negocio.id
      },
      orderBy: {
        anio: 'desc'
      }
    });

    res.json({
      declaraciones,
      total: declaraciones.length
    });

  } catch (error) {
    console.error('Error en listarF22:', error);
    res.status(500).json({
      error: 'Error al listar F22',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// MARCAR F22 COMO PRESENTADO
export const marcarPresentadoF22 = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const id = req.params.id as string;
    const { folio } = req.body;

    // Verificar declaración
    const declaracion = await prisma.declaracionF22.findUnique({
      where: { id },
      include: {
        negocio: true
      }
    });

    if (!declaracion) {
      return res.status(404).json({
        error: 'Declaración no encontrada'
      });
    }

    if (declaracion.negocio.usuarioId !== userId) {
      return res.status(403).json({
        error: 'No tienes permiso'
      });
    }

    // Actualizar estado
    const declaracionActualizada = await prisma.declaracionF22.update({
      where: { id },
      data: {
        estado: 'presentado',
        fechaPresentacion: new Date(),
        folio: folio || null
      }
    });

    res.json({
      message: 'F22 marcado como presentado',
      declaracion: declaracionActualizada
    });

  } catch (error) {
    console.error('Error en marcarPresentadoF22:', error);
    res.status(500).json({
      error: 'Error al marcar F22 como presentado',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

// VALIDAR F22 (verificar que estén todos los F29)
export const validarF22 = async (req: Request, res: Response) => {
  try {
    const userId = req.userId!;
    const anio = req.params.anio as string;

    const anioNum = parseInt(anio);

    const validacionAnio = validarAnio(anioNum);
    if (!validacionAnio.valido) {
      return res.status(400).json({
        error: validacionAnio.error
      });
    }

    // Obtener negocio
    const negocio = await prisma.negocio.findUnique({
      where: { usuarioId: userId }
    });

    if (!negocio) {
      return res.status(404).json({
        error: 'Negocio no encontrado'
      });
    }

    // Verificar F29s
    const f29s = await prisma.declaracionF29.findMany({
      where: {
        negocioId: negocio.id,
        anio: anioNum
      },
      orderBy: {
        mes: 'asc'
      }
    });

    const mesesPresentados = f29s.filter(f => f.estado === 'presentado').map(f => f.mes);
    const mesesFaltantes = [];

    for (let mes = 1; mes <= 12; mes++) {
      if (!mesesPresentados.includes(mes)) {
        mesesFaltantes.push(mes);
      }
    }

    const valido = mesesFaltantes.length === 0;

    res.json({
      valido,
      f29Presentados: f29s.filter(f => f.estado === 'presentado').length,
      f29Borradores: f29s.filter(f => f.estado === 'borrador').length,
      mesesFaltantes,
      mensaje: valido 
        ? 'Todos los F29 están presentados. Puedes generar el F22.' 
        : `Faltan ${mesesFaltantes.length} F29 por presentar: ${mesesFaltantes.join(', ')}`
    });

  } catch (error) {
    console.error('Error en validarF22:', error);
    res.status(500).json({
      error: 'Error al validar F22',
      detalle: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};