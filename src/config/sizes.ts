// src/config/sizes.ts
// 🎛️ CONFIGURACIÓN CENTRAL DE SIZES
// Solo cambiar este array para activar/desactivar sizes disponibles

/**
 * Sizes actualmente en producción:
 * - Size 22: Thermoformer 1
 * - Size 25: Thermoformer 2
 * 
 * Para activar Size 27 y 30 en el futuro:
 * Cambiar: [22, 25] → [22, 25, 27, 30]
 */
export const ACTIVE_SIZES = [22, 25] as const;

/**
 * Todos los sizes soportados por el sistema
 * (para TypeScript types y validaciones)
 */
export const ALL_SIZES = [22, 25, 27, 30] as const;

export type Size = typeof ALL_SIZES[number];
export type ActiveSize = typeof ACTIVE_SIZES[number];
