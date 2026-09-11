import { app } from "./app";
import { environment } from "./config/env";
import { checkDatabaseConnection } from "./database/check-database-connection";

const startServer = async (): Promise<void> => {
  try {
    await checkDatabaseConnection();

    console.log("Conexión con MySQL establecida correctamente");

    app.listen(environment.PORT, () => {
      console.log(`sazora-api ejecutándose en el puerto ${environment.PORT}`);
    });
  } catch (error) {
    console.error("No fue posible conectar con MySQL", error);
    process.exit(1);
  }
};

void startServer();

/*
El servidor solo abrirá el puerto después de comprobar MySQL. Si la configuración es incorrecta, terminará con código 1, que representa un arranque fallido.
*/
