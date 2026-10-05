const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');

const { connecterBD } = require('./src/db');

const app = express();

app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        maxAge: 5 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));


// Vérifie qu'un utilisateur est connecté
function verifierConnexion(req, res, next) {
    if (!req.session.utilisateur) {
        return res.status(401).json({
            erreur: 'Vous devez être connecté'
        });
    }

    next();
}


// Vérifie que l'utilisateur connecté est Administrateur
function verifierAdmin(req, res, next) {
    if (req.session.utilisateur.role !== 'Administrateur') {
        return res.status(403).json({
            erreur: 'Accès réservé à l’administrateur'
        });
    }

    next();
}


app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

connecterBD();


// ========================================
// CONNEXION
// ========================================

app.post('/api/connexion', async (req, res) => {
    try {
        const { email, mot_de_passe } = req.body;

        const pool = await connecterBD();

        const resultat = await pool.request()
            .input('email', email)
            .query(`
                SELECT *
                FROM Utilisateurs
                WHERE email = @email
                  AND actif = 1
            `);

        if (resultat.recordset.length === 0) {
            return res.status(401).json({
                erreur: 'Email ou mot de passe incorrect'
            });
        }

        const utilisateur = resultat.recordset[0];

        const motDePasseValide = await bcrypt.compare(
            mot_de_passe,
            utilisateur.mot_de_passe
        );

        if (!motDePasseValide) {
            return res.status(401).json({
                erreur: 'Email ou mot de passe incorrect'
            });
        }

        req.session.utilisateur = {
            id: utilisateur.id,
            nom: utilisateur.nom,
            email: utilisateur.email,
            role: utilisateur.role
        };

        res.json({
            message: 'Connexion réussie',
            utilisateur: {
                id: utilisateur.id,
                nom: utilisateur.nom,
                email: utilisateur.email,
                role: utilisateur.role
            }
        });

    } catch (erreur) {
        console.error(erreur);

        res.status(500).json({
            erreur: 'Erreur lors de la connexion'
        });
    }
});


// ========================================
// SESSION
// ========================================

app.get('/api/session', (req, res) => {
    res.json({
        utilisateur: req.session.utilisateur || null
    });
});


// ========================================
// DÉCONNEXION
// ========================================

app.post('/api/deconnexion', (req, res) => {
    req.session.destroy((erreur) => {
        if (erreur) {
            return res.status(500).json({
                erreur: 'Erreur lors de la déconnexion'
            });
        }

        res.json({
            message: 'Déconnexion réussie'
        });
    });
});


// ========================================
// ÉQUIPEMENTS
// ========================================


// RÉCUPÉRER LES ÉQUIPEMENTS
app.get('/api/equipements', verifierConnexion, async (req, res) => {
    try {
        const pool = await connecterBD();

       const resultat = await pool.request().query(`
    SELECT
        e.*,
        c.nom AS categorie,
        em.nom AS emplacement
    FROM Equipements e
    INNER JOIN Categories c
        ON e.categorie_id = c.id
    INNER JOIN Emplacements em
        ON e.emplacement_id = em.id
`);

        res.json(resultat.recordset);

    } catch (erreur) {
        console.error(erreur);

        res.status(500).json({
            erreur: 'Impossible de récupérer les équipements'
        });
    }
});


// AJOUTER UN ÉQUIPEMENT
app.post('/api/equipements', verifierConnexion, async (req, res) => {
    try {
        const {
            nom,
            description,
            numero_serie,
            categorie_id,
            quantite,
            prix,
            emplacement_id,
            seuil_minimum
        } = req.body;
        const etatNouvelEquipement =
    req.session.utilisateur.role === 'Administrateur'
        ? 'Disponible'
        : 'En attente de validation';

        const pool = await connecterBD();

        await pool.request()
            .input('ajoute_par_id', req.session.utilisateur.id)
            .input('nom', nom)
            .input('description', description)
            .input('numero_serie', numero_serie)
            .input('categorie_id', categorie_id)
            .input('quantite', quantite)
            .input('prix', prix)
            .input('etat', etatNouvelEquipement)
            .input('emplacement_id', emplacement_id)
            .input('seuil_minimum', seuil_minimum)
            .query(`
                INSERT INTO Equipements
                (
                    nom,
                    ajoute_par_id,
                    description,
                    numero_serie,
                    categorie_id,
                    quantite,
                    prix,
                    etat,
                    emplacement_id,
                    seuil_minimum
                )
                VALUES
                (
                    @nom,
                    @ajoute_par_id,
                    @description,
                    @numero_serie,
                    @categorie_id,
                    @quantite,
                    @prix,
                    @etat,
                    @emplacement_id,
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

// VALIDER UN ÉQUIPEMENT AJOUTÉ PAR UN EMPLOYÉ

app.put(
    '/api/equipements/:id/validation',
    verifierConnexion,
    verifierAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            const pool = await connecterBD();

            const resultat = await pool.request()
                .input('id', id)
                .input('valide_par_id', req.session.utilisateur.id)
                .query(`
                    UPDATE Equipements
                    SET
                        etat = 'Disponible',
                        valide_par_id = @valide_par_id,
                        date_validation = GETDATE()
                    WHERE id = @id
                      AND etat = 'En attente de validation'
                `);

            if (resultat.rowsAffected[0] === 0) {
                return res.status(404).json({
                    erreur: 'Équipement en attente de validation introuvable'
                });
            }

            await pool.request()
                .input('equipement_id', id)
                .input('utilisateur_id', req.session.utilisateur.id)
                .input('type_mouvement', 'Validation')
                .input('note', 'Équipement validé par un administrateur')
                .query(`
                    INSERT INTO Mouvements
                    (
                        equipement_id,
                        utilisateur_id,
                        type_mouvement,
                        note
                    )
                    VALUES
                    (
                        @equipement_id,
                        @utilisateur_id,
                        @type_mouvement,
                        @note
                    )
                `);

            res.json({
                message: 'Équipement validé avec succès'
            });

        } catch (erreur) {
            console.error(erreur);

            res.status(500).json({
                erreur: 'Impossible de valider l’équipement'
            });
        }
    }
);

// SIGNALER LE RETOUR D'UN ÉQUIPEMENT

app.put(
    '/api/equipements/:id/retour',
    verifierConnexion,
    async (req, res) => {
        try {
            const { id } = req.params;

            const pool = await connecterBD();

            // L'employé peut seulement signaler le retour
            // d'un équipement qui lui est actuellement attribué
            const resultat = await pool.request()
                .input('id', id)
                .input('utilisateur_id', req.session.utilisateur.id)
                .query(`
                    UPDATE Equipements
                    SET etat = 'En attente de retour'
                    WHERE id = @id
                      AND etat = 'Attribué'
                      AND attribue_a_id = @utilisateur_id
                `);

            if (resultat.rowsAffected[0] === 0) {
                return res.status(404).json({
                    erreur: 'Équipement attribué à cet employé introuvable'
                });
            }

            // Enregistre le signalement dans l'historique
            await pool.request()
                .input('equipement_id', id)
                .input('utilisateur_id', req.session.utilisateur.id)
                .input('type_mouvement', 'Retour signalé')
                .input('note', 'Retour de l’équipement signalé par l’employé')
                .query(`
                    INSERT INTO Mouvements
                    (
                        equipement_id,
                        utilisateur_id,
                        type_mouvement,
                        note
                    )
                    VALUES
                    (
                        @equipement_id,
                        @utilisateur_id,
                        @type_mouvement,
                        @note
                    )
                `);

            res.json({
                message: 'Retour signalé avec succès'
            });

        } catch (erreur) {
            console.error(erreur);

            res.status(500).json({
                erreur: 'Impossible de signaler le retour'
            });
        }
    }
);

// CONFIRMER LE RETOUR D'UN ÉQUIPEMENT

app.put(
    '/api/equipements/:id/retour/confirmation',
    verifierConnexion,
    verifierAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            const pool = await connecterBD();

            // Confirme uniquement un retour déjà signalé
            const resultat = await pool.request()
                .input('id', id)
                .query(`
                    UPDATE Equipements
                    SET
                        etat = 'Disponible',
                        attribue_a_id = NULL,
                        date_attribution = NULL
                    WHERE id = @id
                      AND etat = 'En attente de retour'
                `);

            if (resultat.rowsAffected[0] === 0) {
                return res.status(404).json({
                    erreur: 'Équipement en attente de retour introuvable'
                });
            }

            // Enregistre la confirmation dans l'historique
            await pool.request()
                .input('equipement_id', id)
                .input('utilisateur_id', req.session.utilisateur.id)
                .input('type_mouvement', 'Retour confirmé')
                .input('note', 'Retour de l’équipement confirmé par un administrateur')
                .query(`
                    INSERT INTO Mouvements
                    (
                        equipement_id,
                        utilisateur_id,
                        type_mouvement,
                        note
                    )
                    VALUES
                    (
                        @equipement_id,
                        @utilisateur_id,
                        @type_mouvement,
                        @note
                    )
                `);

            res.json({
                message: 'Retour confirmé avec succès'
            });

        } catch (erreur) {
            console.error(erreur);

            res.status(500).json({
                erreur: 'Impossible de confirmer le retour'
            });
        }
    }
);

// METTRE UN ÉQUIPEMENT EN RÉPARATION

app.put(
    '/api/equipements/:id/reparation',
    verifierConnexion,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { raison } = req.body;

            // La raison du problème est obligatoire
            if (!raison || raison.trim() === '') {
                return res.status(400).json({
                    erreur: 'La raison de la réparation est obligatoire'
                });
            }

            const pool = await connecterBD();

            const resultat = await pool.request()
                .input('id', id)
                .query(`
                    UPDATE Equipements
                    SET etat = 'En réparation'
                    WHERE id = @id
                      AND etat NOT IN (
                          'En attente de validation',
                          'En attente de retour',
                          'À remplacer / Hors service',
                          'Perdu / Volé'
                      )
                `);

            if (resultat.rowsAffected[0] === 0) {
                return res.status(404).json({
                    erreur: 'Équipement pouvant être mis en réparation introuvable'
                });
            }

            // Enregistre la mise en réparation dans l'historique
            await pool.request()
                .input('equipement_id', id)
                .input('utilisateur_id', req.session.utilisateur.id)
                .input('type_mouvement', 'Mise en réparation')
                .input('note', raison.trim())
                .query(`
                    INSERT INTO Mouvements
                    (
                        equipement_id,
                        utilisateur_id,
                        type_mouvement,
                        note
                    )
                    VALUES
                    (
                        @equipement_id,
                        @utilisateur_id,
                        @type_mouvement,
                        @note
                    )
                `);

            res.json({
                message: 'Équipement mis en réparation avec succès'
            });

        } catch (erreur) {
            console.error(erreur);

            res.status(500).json({
                erreur: 'Impossible de mettre l’équipement en réparation'
            });
        }
    }
);

// TERMINER LA RÉPARATION D'UN ÉQUIPEMENT

app.put(
    '/api/equipements/:id/reparation/fin',
    verifierConnexion,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { resolution } = req.body;

            // La note de résolution est obligatoire
            if (!resolution || resolution.trim() === '') {
                return res.status(400).json({
                    erreur: 'La note de résolution est obligatoire'
                });
            }

            const pool = await connecterBD();

            // Seul un équipement actuellement en réparation
            // peut redevenir disponible
            const resultat = await pool.request()
                .input('id', id)
                .query(`
                    UPDATE Equipements
                    SET etat = 'Disponible'
                    WHERE id = @id
                      AND etat = 'En réparation'
                `);

            if (resultat.rowsAffected[0] === 0) {
                return res.status(404).json({
                    erreur: 'Équipement en réparation introuvable'
                });
            }

            // Enregistre la fin de la réparation dans l'historique
            await pool.request()
                .input('equipement_id', id)
                .input('utilisateur_id', req.session.utilisateur.id)
                .input('type_mouvement', 'Fin de réparation')
                .input('note', resolution.trim())
                .query(`
                    INSERT INTO Mouvements
                    (
                        equipement_id,
                        utilisateur_id,
                        type_mouvement,
                        note
                    )
                    VALUES
                    (
                        @equipement_id,
                        @utilisateur_id,
                        @type_mouvement,
                        @note
                    )
                `);

            res.json({
                message: 'Réparation terminée avec succès'
            });

        } catch (erreur) {
            console.error(erreur);

            res.status(500).json({
                erreur: 'Impossible de terminer la réparation'
            });
        }
    }
);


// MODIFIER UN ÉQUIPEMENT
app.put('/api/equipements/:id', verifierConnexion, async (req, res) => {
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
            emplacement_id,
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
            .input('emplacement_id', emplacement_id)
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
                    emplacement_id = @emplacement_id,
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

// ATTRIBUER UN ÉQUIPEMENT À UN EMPLOYÉ

app.put(
    '/api/equipements/:id/attribution',
    verifierConnexion,
    verifierAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;
            const { utilisateur_id } = req.body;

            const pool = await connecterBD();

            // Vérifie que l'employé existe et que son compte est actif
            const employe = await pool.request()
                .input('utilisateur_id', utilisateur_id)
                .query(`
                    SELECT id
                    FROM Utilisateurs
                    WHERE id = @utilisateur_id
                      AND role = 'Employé'
                      AND actif = 1
                `);

            if (employe.recordset.length === 0) {
                return res.status(404).json({
                    erreur: 'Employé actif introuvable'
                });
            }

            // Attribue uniquement un équipement actuellement disponible
            const resultat = await pool.request()
                .input('id', id)
                .input('utilisateur_id', utilisateur_id)
                .query(`
                    UPDATE Equipements
                    SET
                        etat = 'Attribué',
                        attribue_a_id = @utilisateur_id,
                        date_attribution = GETDATE()
                    WHERE id = @id
                      AND etat = 'Disponible'
                `);

            if (resultat.rowsAffected[0] === 0) {
                return res.status(404).json({
                    erreur: 'Équipement disponible introuvable'
                });
            }

            // Enregistre l'attribution dans l'historique
            await pool.request()
                .input('equipement_id', id)
                .input('utilisateur_id', req.session.utilisateur.id)
                .input('type_mouvement', 'Attribution')
                .input(
                    'note',
                    `Équipement attribué à l'utilisateur ${utilisateur_id}`
                )
                .query(`
                    INSERT INTO Mouvements
                    (
                        equipement_id,
                        utilisateur_id,
                        type_mouvement,
                        note
                    )
                    VALUES
                    (
                        @equipement_id,
                        @utilisateur_id,
                        @type_mouvement,
                        @note
                    )
                `);

            res.json({
                message: 'Équipement attribué avec succès'
            });

        } catch (erreur) {
            console.error(erreur);

            res.status(500).json({
                erreur: 'Impossible d’attribuer l’équipement'
            });
        }
    }
);

// SUPPRIMER UN ÉQUIPEMENT
// Cette route sera remplacée plus tard par la logique
// Hors service + historique des mouvements.
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


// ========================================
// UTILISATEURS
// ========================================


// CRÉER UN EMPLOYÉ
app.post(
    '/api/utilisateurs',
    verifierConnexion,
    verifierAdmin,
    async (req, res) => {
        try {
            const { nom, email, mot_de_passe } = req.body;

            const saltRounds = 10;

            const motDePasseHash = await bcrypt.hash(
                mot_de_passe,
                saltRounds
            );

            const pool = await connecterBD();

            await pool.request()
                .input('nom', nom)
                .input('email', email)
                .input('mot_de_passe', motDePasseHash)
                .input('role', 'Employé')
                .query(`
                    INSERT INTO Utilisateurs
                    (
                        nom,
                        email,
                        mot_de_passe,
                        role,
                        actif
                    )
                    VALUES
                    (
                        @nom,
                        @email,
                        @mot_de_passe,
                        @role,
                        1
                    )
                `);

            res.status(201).json({
                message: 'Employé créé avec succès'
            });

        } catch (erreur) {
            console.error(erreur);

            res.status(500).json({
                erreur: 'Impossible de créer l’employé'
            });
        }
    }
);


// RÉCUPÉRER LES UTILISATEURS
app.get(
    '/api/utilisateurs',
    verifierConnexion,
    verifierAdmin,
    async (req, res) => {
        try {
            const pool = await connecterBD();

            const resultat = await pool.request().query(`
                SELECT
                    id,
                    nom,
                    email,
                    role,
                    actif
                FROM Utilisateurs
            `);

            res.json(resultat.recordset);

        } catch (erreur) {
            console.error(erreur);

            res.status(500).json({
                erreur: 'Impossible de récupérer les utilisateurs'
            });
        }
    }
);


// ========================================
// SERVEUR
// ========================================

app.listen(3000, () => {
    console.log('Serveur TechStock démarré sur http://localhost:3000');
});