import { createServer } from "node:http";

import { app } from "./app";
import { environment } from "./config/env";
import { checkDatabaseConnection } from "./database/check-database-connection";
import { initializeRealtimeServer } from "./realtime/realtime.server";

const startServer = async (): Promise<void> => {
  try {
    await checkDatabaseConnection();

    console.log("Conexión con MySQL establecida correctamente");

    const httpServer = createServer(app);

    initializeRealtimeServer(httpServer);

    httpServer.listen(environment.PORT, () => {
      console.log(`sazora-api ejecutándose en el puerto ${environment.PORT}`);
      console.log("Socket.IO está disponible en /socket.io");
    });
  } catch (error) {
    console.error("No fue posible iniciar el servidor", error);
    process.exit(1);
  }
};

void startServer();
