# 🎛️ Configuración de Sizes

## ¿Cómo activar/desactivar sizes?

### **Ubicación del archivo**
```
src/config/sizes.ts
```

### **Configuración actual**
```typescript
export const ACTIVE_SIZES = [22, 25] as const;
```

**Estado actual:**
- ✅ **Size 22**: Activo (Thermoformer 1)
- ✅ **Size 25**: Activo (Thermoformer 2) 
- 🔒 **Size 27**: Desactivado temporalmente
- 🔒 **Size 30**: Desactivado temporalmente

---

## 🚀 Para activar sizes en el futuro

### **Paso 1:** Editar configuración
```typescript
// Cambiar de:
export const ACTIVE_SIZES = [22, 25] as const;

// A (ejemplo para activar todos):
export const ACTIVE_SIZES = [22, 25, 27, 30] as const;
```

### **Paso 2:** Reiniciar la aplicación
```bash
npm run dev
```

### **¡Eso es todo!** 
Los nuevos sizes aparecerán automáticamente en:
- Página principal de ISO (`/iso`)
- Rutas dinámicas (`/iso/27`, `/iso/30`)
- Validaciones y mensajes de error

---

## 🔧 Casos de uso comunes

### **Solo activar Size 27 (manteniendo 22 y 25)**
```typescript
export const ACTIVE_SIZES = [22, 25, 27] as const;
```

### **Cambiar sizes completamente (ejemplo: solo 27 y 30)**
```typescript
export const ACTIVE_SIZES = [27, 30] as const;
```

### **Activar todos los sizes**
```typescript
export const ACTIVE_SIZES = [22, 25, 27, 30] as const;
```

---

## 🛡️ Seguridad

- ✅ **No rompe nada existente**: Los sizes desactivados simplemente no aparecen en la UI
- ✅ **Validación automática**: URLs directas a sizes desactivados muestran error amigable
- ✅ **TypeScript seguro**: Los types se actualizan automáticamente
- ✅ **Reversible**: Cambiar de vuelta es instantáneo

---

## 📝 Notas técnicas

- **Máximo 2 sizes activos**: Solo tienes 2 thermoformers, así que max. 2 sizes simultáneos
- **Base de datos**: No requiere cambios en DB, solo en la configuración del frontend
- **ISOs existentes**: Los ISOs ya creados con sizes desactivados siguen siendo válidos

---

*Última actualización: Septiembre 11, 2025*
