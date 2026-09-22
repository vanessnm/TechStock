const express = require('express');
const path = require('path');

const { connecterBD } = require('./src/db');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

app.post('/api/equipements', async (req, res) => {
    try {
        const {
            nom,
            description,
            numero_serie,
            categorie_id,
            quantite,
            prix,
            etat,
            emplacement,
            seuil_minimum
        } = req.body;

        const pool = await connecterBD();

        await pool.request()
            .input('nom', nom)
            .input('description', description)
            .input('numero_serie', numero_serie)
            .input('categorie_id', categorie_id)
            .input('quantite', quantite)
            .input('prix', prix)
            .input('etat', etat)
            .input('emplacement', emplacement)
            .input('seuil_minimum', seuil_minimum)
            .query(`
                INSERT INTO Equipements
                (
                    nom,
                    description,
                    numero_serie,
                    categorie_id,
                    quantite,
                    prix,
                    etat,
                    emplacement,
                    seuil_minimum
                )
                VALUES
                (
                    @nom,
                    @description,
                    @numero_serie,
                    @categorie_id,
                    @quantite,
                    @prix,
                    @etat,
                    @emplacement,
                    @seuil_minimum
                )
            `);

        res.status(201).json({
            message: 'Équipement ajouté avec succès'
        });

    } catch (erreur) {
        console.error(erreur);

        res.status(500).json({
            erreur: 'Impossible d’ajouter l’équipement'
        });
    }
});

app.put('/api/equipements/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const {
            nom,
            description,
            numero_serie,
            categorie_id,
            quantite,
            prix,
            etat,
            emplacement,
            seuil_minimum
        } = req.body;

        const pool = await connecterBD();

        const resultat = await pool.request()
            .input('id', id)
            .input('nom', nom)
            .input('description', description)
            .input('numero_serie', numero_serie)
            .input('categorie_id', categorie_id)
            .input('quantite', quantite)
            .input('prix', prix)
            .input('etat', etat)
            .input('emplacement', emplacement)
            .input('seuil_minimum', seuil_minimum)
            .query(`
                UPDATE Equipements
                SET
                    nom = @nom,
                    description = @description,
                    numero_serie = @numero_serie,
                    categorie_id = @categorie_id,
                    quantite = @quantite,
                    prix = @prix,
                    etat = @etat,
                    emplacement = @emplacement,
                    seuil_minimum = @seuil_minimum
                WHERE id = @id
            `);

        if (resultat.rowsAffected[0] === 0) {
            return res.status(404).json({
                erreur: 'Équipement introuvable'
            });
        }

        res.json({
            message: 'Équipement modifié avec succès'
        });

    } catch (erreur) {
        console.error(erreur);

        res.status(500).json({
            erreur: 'Impossible de modifier l’équipement'
        });
    }
});

app.delete('/api/equipements/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const pool = await connecterBD();

        const resultat = await pool.request()
            .input('id', id)
            .query(`
                DELETE FROM Equipements
                WHERE id = @id
            `);

        if (resultat.rowsAffected[0] === 0) {
            return res.status(404).json({
                erreur: 'Équipement introuvable'
            });
        }

        res.json({
            message: 'Équipement supprimé avec succès'
        });

    } catch (erreur) {
        console.error(erreur);

        res.status(500).json({
            erreur: 'Impossible de supprimer l’équipement'
        });
    }
});

app.listen(3000, () => {
    console.log('Serveur TechStock démarré sur http://localhost:3000');
});
