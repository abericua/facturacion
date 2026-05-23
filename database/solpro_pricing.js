/**
 * solpro_pricing.js
 * Módulo de Lógica Unificada para Precios SOLPRO
 * Versión 1.0.0
 */

/**
 * Calcula las bandas de tipo de cambio del día.
 * @param {number} dolarMercado
 * @returns {{ bandaPiso: number, bandaTecho: number }}
 */
function calcularBandas(dolarMercado) {
    return {
        bandaPiso: dolarMercado + 150,
        bandaTecho: dolarMercado + 350
    };
}

/**
 * Aplica el Efecto 90 (redondeo SOLPRO).
 * @param {number} valor
 * @param {'GS'|'USD'} moneda
 * @param {'maquina'|'insumo'} tipo - solo para USD
 * @returns {number}
 */
function redondeoSolpro(valor, moneda, tipo) {
    if (moneda === 'GS') {
        if (valor < 500000) {
            return (Math.ceil(valor / 10000) * 10000) - 1000;
        } else {
            return (Math.ceil(valor / 100000) * 100000) - 10000;
        }
    } else if (moneda === 'USD') {
        if (tipo === 'maquina' || valor >= 100) {
            return (Math.ceil(valor / 100) * 100) - 10;
        } else {
            return (Math.ceil(valor / 10) * 10) - 1;
        }
    }
    return valor;
}

/**
 * Precio de contado. Base / (1 - margen).
 * Prohibido aplicar descuentos sobre este precio.
 * @param {number} costo
 * @param {'USD'|'GS'} monedaCosto
 * @param {number} margenPct
 * @param {number} bandaPiso
 * @returns {number} precio en GS
 */
function calcularPrecioContado(costo, monedaCosto, margenPct, bandaPiso) {
    const factor = 1 - (margenPct / 100);
    const precioBruto = costo / factor;
    
    let baseGs = 0;
    if (monedaCosto === 'USD') {
        const precioRounded = redondeoSolpro(precioBruto, 'USD', precioBruto >= 100 ? 'maquina' : 'insumo');
        baseGs = precioRounded * bandaPiso;
    } else {
        baseGs = precioBruto;
    }
    return redondeoSolpro(baseGs, 'GS');
}

/**
 * Precio QR/Digital = Contado / 0.96
 * El 4% cubre comisión procesadora.
 * @param {number} precioContado
 * @returns {number} precio en GS
 */
function calcularPrecioQR(precioContado) {
    const bruto = precioContado / 0.96;
    return redondeoSolpro(bruto, 'GS');
}

/**
 * Precio crédito. Solo Línea Industrial.
 * Calculado con banda_techo.
 * @param {number} costo
 * @param {'USD'|'GS'} monedaCosto
 * @param {number} margenPct
 * @param {number} bandaTecho
 * @param {'INDUSTRIAL'|'COMERCIAL'} linea
 * @returns {{ bloqueado: boolean, precio?: number, mensaje?: string }}
 */
function calcularPrecioCredito(costo, monedaCosto, margenPct, bandaTecho, linea) {
    if (linea.toUpperCase() !== 'INDUSTRIAL') {
        return { bloqueado: true, mensaje: 'SOLO CONTADO/QR' };
    }
    const factor = 1 - (margenPct / 100);
    const precioBruto = costo / factor;
    
    let baseGs = 0;
    if (monedaCosto === 'USD') {
        const precioRounded = redondeoSolpro(precioBruto, 'USD', precioBruto >= 100 ? 'maquina' : 'insumo');
        baseGs = precioRounded * bandaTecho;
    } else {
        baseGs = precioBruto;
    }
    return {
        bloqueado: false,
        precio: redondeoSolpro(baseGs, 'GS')
    };
}

/**
 * Profit real sin buffers de banda.
 * Para análisis interno exclusivamente.
 * @param {number} precioVenta
 * @param {number} costo
 * @param {'USD'|'GS'} monedaCosto
 * @param {number} dolarMercado - puro, sin banda
 * @returns {number} profit en GS
 */
function calcularProfit(precioVenta, costo, monedaCosto, dolarMercado) {
    const costoGs = monedaCosto === 'USD' ? (costo * dolarMercado) : costo;
    return precioVenta - costoGs;
}

/**
 * Combos mixtos USD + GS.
 * Items USD → multiplicar por banda_piso.
 * Items GS → valor nominal.
 * @param {Array<{costo: number, moneda: string}>} items
 * @param {number} bandaPiso
 * @returns {number} total en GS
 */
function calcularComboMixto(items, bandaPiso) {
    let total = 0;
    for (const item of items) {
        if (item.moneda === 'USD') {
            total += (item.costo * bandaPiso);
        } else {
            total += item.costo;
        }
    }
    return redondeoSolpro(total, 'GS');
}

/**
 * Detecta si un precio aplicado está dentro,
 * por encima o por debajo del margen esperado.
 * @param {number} precioAplicado
 * @param {number} precioEsperado
 * @returns {'ok'|'por_encima'|'por_debajo'|'descuento_no_autorizado'}
 */
function detectarAlerta(precioAplicado, precioEsperado) {
    if (precioAplicado === precioEsperado) return 'ok';
    if (precioAplicado > precioEsperado) return 'por_encima';
    // Tolerancia menor
    if (precioAplicado >= (precioEsperado * 0.95)) return 'por_debajo';
    return 'descuento_no_autorizado';
}

/**
 * Calcula stock disponible considerando reservas.
 * @param {number} stockActual
 * @param {number} stockReservado
 * @returns {number}
 */
function calcularStockDisponible(stockActual, stockReservado) {
    return stockActual - stockReservado;
}

module.exports = {
    calcularBandas,
    redondeoSolpro,
    calcularPrecioContado,
    calcularPrecioQR,
    calcularPrecioCredito,
    calcularProfit,
    calcularComboMixto,
    detectarAlerta,
    calcularStockDisponible
};
