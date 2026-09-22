const express = require('express');
const path = require('path');

const { connecterBD } = require('./src/db');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

connecterBD();

app.get('/api/equipements', async (req, res) => {
    try {
        const pool = await connecterBD();

        const resultat = await pool.request().query(`
            SELECT 
                e.*,
                c.nom AS categorie
            FROM Equipements e
            INNER JOIN Categories c
                ON e.categorie_id = c.id
        `);

        res.json(resultat.recordset);
    } catch (erreur) {
        console.error(erreur);
        res.status(500).json({
            erreur: 'Impossible de récupérer les équipements'
        });
    }
});

app.listen(3000, () => {
    console.log('Serveur TechStock démarré sur http://localhost:3000');
});
