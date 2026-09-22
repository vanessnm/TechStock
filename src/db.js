const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function connecterBD() {
    try {
        const pool = await sql.connect(config);
        console.log('Connexion à TechStock réussie');
        return pool;
    } catch (erreur) {
        console.error('Erreur de connexion à TechStock :', erreur.message);
        throw erreur;
    }
}

module.exports = {
    sql,
    connecterBD
};