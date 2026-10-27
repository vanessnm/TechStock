const sql = require("mssql");
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

if (!config.database)
  throw new Error("DB_DATABASE doit être défini dans le fichier .env.");

async function connecterBD() {
  try {
    const pool = await sql.connect(config);
    const target = await pool.request().query("SELECT DB_NAME() AS nom");
    if (target.recordset[0].nom !== config.database)
      throw new Error("La base connectée ne correspond pas à DB_DATABASE.");
    return pool;
  } catch (erreur) {
    console.error("Erreur de connexion à TechStock :", erreur.message);
    throw erreur;
  }
}

module.exports = {
  sql,
  connecterBD,
};
