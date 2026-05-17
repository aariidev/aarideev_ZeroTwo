import { logger } from "./logger.js";

interface MaintenanceConfig {
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

class DevStateManager {
  private state: MaintenanceConfig = {
    maintenanceMode: false,
    maintenanceMessage: "ZeroTwo está en mantenimiento. Vuelve pronto. 🔧",
  };

  public get current() {
    return Object.freeze({ ...this.state });
  }

  public setMaintenance(mode: boolean, message?: string): void {
    const oldMode = this.state.maintenanceMode;
    this.state.maintenanceMode = mode;

    if (message) {
      this.state.maintenanceMessage = message;
    }

    if (oldMode !== mode) {
      if (mode) {
        logger.warn(
          { message: this.state.maintenanceMessage },
          "🚨 RECALIBRACIÓN DEL SISTEMA: El modo mantenimiento ha sido ACTIVADO.",
        );
      } else {
        logger.info(
          "✅ SISTEMA ONLINE: El modo mantenimiento ha sido DESACTIVADO. Todos los parásitos pueden iniciar conexión.",
        );
      }
    }
  }

  public setMessage(message: string): void {
    if (!message.trim()) {
      logger.error("Intento de establecer un mensaje de mantenimiento vacío.");
      return;
    }
    this.state.maintenanceMessage = message;
  }
}

export const devState = new DevStateManager();
