// Shared in-memory dev state — avoids a DB query on every command execution
export const devState = {
  maintenanceMode: false,
  maintenanceMessage: "ZeroTwo está en mantenimiento. Vuelve pronto. 🔧",
};
