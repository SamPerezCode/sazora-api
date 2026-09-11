import { databasePool } from "./pool";

const checkDatabaseConnection = async (): Promise<void> => {
  await databasePool.query("SELECT 1");
};

export { checkDatabaseConnection };

/*
SELECT 1 es una consulta mínima: no accede a tablas ni modifica información. Si responde, confirma que el servidor, las credenciales y sazora_db están disponibles.
*/
