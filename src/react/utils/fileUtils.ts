/**
 * Descarga archivo con instrucciones para moverlo a BarTender
 * Esta es la solución más práctica ya que los navegadores no permiten
 * escribir directamente en carpetas específicas del sistema
 */
export async function saveToBarTenderInput(blob: Blob, filename: string): Promise<void> {
  // Crear el nombre del archivo con prefijo indicativo
  const bartenderFilename = `BARTENDER_${filename}`;
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", bartenderFilename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  // Mostrar notificación con instrucciones
  showBarTenderInstruction(bartenderFilename);
}

/**
 * Muestra instrucciones al usuario sobre dónde mover el archivo
 */
function showBarTenderInstruction(filename: string): void {
  // Crear un div de notificación temporal
  const notification = document.createElement("div");
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1a472a;
    color: white;
    padding: 16px;
    border-radius: 8px;
    border: 2px solid #22c55e;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 400px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.4;
  `;
  
  notification.innerHTML = `
    <div style="display: flex; align-items: start; gap: 8px;">
      <div style="color: #22c55e; font-size: 18px;">📁</div>
      <div>
        <div style="font-weight: bold; margin-bottom: 8px;">File downloaded</div>
        <div style="margin-bottom: 8px;">
          <strong>File:</strong> ${filename}
        </div>
        <div style="margin-bottom: 8px;">
          <strong>Move to:</strong><br>
          <code style="background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 3px;">
            C:\\BarTender\\input\\
          </code>
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          This message will close automatically in 8 seconds
        </div>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" 
              style="background: none; border: none; color: white; cursor: pointer; font-size: 16px; padding: 0; margin-left: auto;">
        ✕
      </button>
    </div>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remover después de 8 segundos
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 8000);
}

/**
 * Versión alternativa que usa la función principal
 */
export async function saveToBarTenderInputDirect(blob: Blob, filename: string): Promise<void> {
  await saveToBarTenderInput(blob, filename);
}