import { createPool } from "mysql2/promise";

import { environment } from "../config/env";

const databasePool = createPool({
  host: environment.DB_HOST,
  port: environment.DB_PORT,
  database: environment.DB_NAME,
  user: environment.DB_USER,
  password: environment.DB_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export { databasePool };

/*
Las opciones significan:
- waitForConnections: espera si todas las conexiones están ocupadas.
- connectionLimit: permite hasta diez conexiones abiertas.
- queueLimit con valor 0 no establece un límite artificial para las solicitudes en espera.
- databasePool: será la instancia compartida por todos los módulos.
El pool usa sazora_app, no root, gracias a las variables de .env.
*/
