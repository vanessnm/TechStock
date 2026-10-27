const express = require("express");
const path = require("path");
const bcrypt = require("bcrypt");
const session = require("express-session");

const { connecterBD } = require("./src/db");

const app = express();

app.use(express.json());

app.use(
  session({
    name: "techstock.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: 5 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

// Vérifie qu'un utilisateur est connecté
function verifierConnexion(req, res, next) {
  if (!req.session.utilisateur) {
    return res.status(401).json({
      erreur: "Vous devez être connecté",
    });
  }

  next();
}

// Vérifie que l'utilisateur connecté est Administrateur
function verifierAdmin(req, res, next) {
  if (req.session.utilisateur.role !== "Administrateur") {
    return res.status(403).json({
      erreur: "Accès réservé à l’administrateur",
    });
  }

  next();
}

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

connecterBD();

// ========================================
// CONNEXION
// ========================================

app.post("/api/connexion", async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;

    const pool = await connecterBD();

    const resultat = await pool.request().input("email", email).query(`
                SELECT *
                FROM Utilisateurs
                WHERE email = @email
                  AND actif = 1
            `);

    if (resultat.recordset.length === 0) {
      return res.status(401).json({
        erreur: "Email ou mot de passe incorrect",
      });
    }

    const utilisateur = resultat.recordset[0];

    const motDePasseValide = await bcrypt.compare(
      mot_de_passe,
      utilisateur.mot_de_passe,
    );

    if (!motDePasseValide) {
      return res.status(401).json({
        erreur: "Email ou mot de passe incorrect",
      });
    }

    req.session.utilisateur = {
      id: utilisateur.id,
      nom: utilisateur.nom,
      email: utilisateur.email,
      role: utilisateur.role,
    };

    res.json({
      message: "Connexion réussie",
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
      },
    });
  } catch (erreur) {
    console.error(erreur);

    res.status(500).json({
      erreur: "Erreur lors de la connexion",
    });
  }
});

// ========================================
// SESSION
// ========================================

app.get("/api/session", (req, res) => {
  res.json({
    utilisateur: req.session.utilisateur || null,
  });
});

// ========================================
// DÉCONNEXION
// ========================================

app.post("/api/deconnexion", (req, res) => {
  req.session.destroy((erreur) => {
    if (erreur) {
      return res.status(500).json({
        erreur: "Erreur lors de la déconnexion",
      });
    }

    res.json({
      message: "Déconnexion réussie",
    });
  });
});

// ========================================
// ÉQUIPEMENTS
// ========================================

require("./src/unites-crud")(
  app,
  connecterBD,
  verifierConnexion,
  verifierAdmin,
);

// ATTRIBUER UN ÉQUIPEMENT À UN EMPLOYÉ
app.put(
  "/api/equipements/:id/attribution",
  verifierConnexion,
  verifierAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { utilisateur_id } = req.body;

      if (!Number.isInteger(utilisateur_id) || utilisateur_id <= 0) {
        return res.status(400).json({
          erreur: "Un identifiant d’employé valide est obligatoire",
        });
      }

      const pool = await connecterBD();

      const employe = await pool
        .request()
        .input("utilisateur_id", utilisateur_id).query(`
                    SELECT id
                    FROM Utilisateurs
                    WHERE id = @utilisateur_id
                      AND role = 'Employé'
                      AND actif = 1
                `);

      if (employe.recordset.length === 0) {
        return res.status(404).json({
          erreur: "Employé actif introuvable",
        });
      }

      const transaction = pool.transaction();
      await transaction.begin();

      try {
        const resultat = await transaction
          .request()
          .input("id", id)
          .input("utilisateur_id", utilisateur_id).query(`
                        UPDATE EquipementsUnitaires
                        SET
                            etat = 'Attribué',
                            attribue_a_id = @utilisateur_id,
                            date_attribution = GETDATE()
                        WHERE id = @id
                          AND etat = 'Disponible'
                          AND attribue_a_id IS NULL
                    `);

        if (resultat.rowsAffected[0] === 0) {
          await transaction.rollback();

          return res.status(409).json({
            erreur: "Équipement indisponible pour attribution",
          });
        }

        await transaction
          .request()
          .input("equipement_id", id)
          .input("utilisateur_id", req.session.utilisateur.id)
          .input("type_mouvement", "Attribution")
          .input(
            "note",
            `Équipement attribué à l’utilisateur ${utilisateur_id}`,
          ).query(`
                        INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note,unite_id) VALUES((SELECT equipement_id FROM UnitesEquipement WHERE id=@equipement_id),@utilisateur_id,@type_mouvement,@note,@equipement_id)
                    `);

        await transaction.commit();

        res.json({
          message: "Équipement attribué avec succès",
        });
      } catch (erreur) {
        await transaction.rollback();
        throw erreur;
      }
    } catch (erreur) {
      console.error(erreur);

      res.status(500).json({
        erreur: "Impossible d’attribuer l’équipement",
      });
    }
  },
);

// SIGNALER LE RETOUR D'UN ÉQUIPEMENT

app.put("/api/equipements/:id/retour", verifierConnexion, async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await connecterBD();

    // L'employé peut seulement signaler le retour
    // d'un équipement qui lui est actuellement attribué
    const resultat = await pool
      .request()
      .input("id", id)
      .input("utilisateur_id", req.session.utilisateur.id).query(`
                    UPDATE EquipementsUnitaires
                    SET etat = 'En attente de retour'
                    WHERE id = @id
                      AND etat = 'Attribué'
                      AND attribue_a_id = @utilisateur_id
                `);

    if (resultat.rowsAffected[0] === 0) {
      return res.status(404).json({
        erreur: "Équipement attribué à cet employé introuvable",
      });
    }

    // Enregistre le signalement dans l'historique
    await pool
      .request()
      .input("equipement_id", id)
      .input("utilisateur_id", req.session.utilisateur.id)
      .input("type_mouvement", "Retour signalé")
      .input("note", "Retour de l’équipement signalé par l’employé").query(`
                    INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note,unite_id) VALUES((SELECT equipement_id FROM UnitesEquipement WHERE id=@equipement_id),@utilisateur_id,@type_mouvement,@note,@equipement_id)
                `);

    res.json({
      message: "Retour signalé avec succès",
    });
  } catch (erreur) {
    console.error(erreur);

    res.status(500).json({
      erreur: "Impossible de signaler le retour",
    });
  }
});

// CONFIRMER LE RETOUR D'UN ÉQUIPEMENT

app.put(
  "/api/equipements/:id/retour/confirmation",
  verifierConnexion,
  verifierAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const commentaire = req.body.commentaire ?? "";
      if (typeof commentaire !== "string") {
        return res
          .status(400)
          .json({ erreur: "Le commentaire doit être un texte" });
      }

      const pool = await connecterBD();

      // Confirme uniquement un retour déjà signalé
      const resultat = await pool.request().input("id", id).query(`
                    UPDATE EquipementsUnitaires
                    SET
                        etat = 'Disponible',
                        attribue_a_id = NULL,
                        date_attribution = NULL
                    WHERE id = @id
                      AND etat = 'En attente de retour'
                `);

      if (resultat.rowsAffected[0] === 0) {
        return res.status(404).json({
          erreur: "Équipement en attente de retour introuvable",
        });
      }

      // Enregistre la confirmation dans l'historique
      await pool
        .request()
        .input("equipement_id", id)
        .input("utilisateur_id", req.session.utilisateur.id)
        .input("type_mouvement", "Retour confirmé")
        .input("note", commentaire.trim()).query(`
                    INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note,unite_id) VALUES((SELECT equipement_id FROM UnitesEquipement WHERE id=@equipement_id),@utilisateur_id,@type_mouvement,@note,@equipement_id)
                `);

      res.json({
        message: "Retour confirmé avec succès",
      });
    } catch (erreur) {
      console.error(erreur);

      res.status(500).json({
        erreur: "Impossible de confirmer le retour",
      });
    }
  },
);

// Les routes de réparation sont enregistrées dans src/reparations.js.

// METTRE UN ÉQUIPEMENT HORS SERVICE / À REMPLACER

app.put(
  "/api/equipements/:id/hors-service",
  verifierConnexion,
  verifierAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const raison = req.body.raison ?? "";

      // Le commentaire est facultatif pour un administrateur.
      if (
        typeof raison !== "string" ||
        (req.session.utilisateur.role !== "Administrateur" &&
          raison.trim() === "")
      ) {
        return res.status(400).json({
          erreur: "La raison est obligatoire",
        });
      }

      const pool = await connecterBD();

      // L'équipement reste dans la base,
      // seul son état est modifié
      const resultat = await pool.request().input("id", id).query(`
                    UPDATE EquipementsUnitaires
                    SET
                        etat = 'À remplacer / Hors service',
                        attribue_a_id = NULL,
                        date_attribution = NULL
                    WHERE id = @id
                      AND etat NOT IN (
                          'En attente de validation',
                          'À remplacer / Hors service',
                          'Perdu / Volé'
                      )
                `);

      if (resultat.rowsAffected[0] === 0) {
        return res.status(404).json({
          erreur: "Équipement pouvant être mis hors service introuvable",
        });
      }

      // Conserve la raison et l'administrateur
      // dans l'historique
      await pool
        .request()
        .input("equipement_id", id)
        .input("utilisateur_id", req.session.utilisateur.id)
        .input("type_mouvement", "Hors service")
        .input("note", raison.trim()).query(`
                    INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note,unite_id) VALUES((SELECT equipement_id FROM UnitesEquipement WHERE id=@equipement_id),@utilisateur_id,@type_mouvement,@note,@equipement_id)
                `);

      res.json({
        message: "Équipement mis hors service avec succès",
      });
    } catch (erreur) {
      console.error(erreur);

      res.status(500).json({
        erreur: "Impossible de mettre l’équipement hors service",
      });
    }
  },
);

// DÉCLARER UN ÉQUIPEMENT PERDU / VOLÉ

app.put(
  "/api/equipements/:id/perdu-vole",
  verifierConnexion,
  verifierAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;
      const note = req.body.note ?? "";

      // Le commentaire est facultatif pour un administrateur.
      if (
        typeof note !== "string" ||
        (req.session.utilisateur.role !== "Administrateur" &&
          note.trim() === "")
      ) {
        return res.status(400).json({
          erreur: "Une note est obligatoire",
        });
      }

      const pool = await connecterBD();

      const resultat = await pool.request().input("id", id).query(`
                    UPDATE EquipementsUnitaires
                    SET
                        etat = 'Perdu / Volé',
                        attribue_a_id = NULL,
                        date_attribution = NULL
                    WHERE id = @id
                      AND etat NOT IN (
                          'En attente de validation',
                          'À remplacer / Hors service',
                          'Perdu / Volé'
                      )
                `);

      if (resultat.rowsAffected[0] === 0) {
        return res.status(404).json({
          erreur: "Équipement pouvant être déclaré perdu ou volé introuvable",
        });
      }

      // Enregistre la déclaration dans l'historique
      await pool
        .request()
        .input("equipement_id", id)
        .input("utilisateur_id", req.session.utilisateur.id)
        .input("type_mouvement", "Perdu / Volé")
        .input("note", note.trim()).query(`
                    INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note,unite_id) VALUES((SELECT equipement_id FROM UnitesEquipement WHERE id=@equipement_id),@utilisateur_id,@type_mouvement,@note,@equipement_id)
                `);

      res.json({
        message: "Équipement déclaré perdu ou volé avec succès",
      });
    } catch (erreur) {
      console.error(erreur);

      res.status(500).json({
        erreur: "Impossible de déclarer l’équipement perdu ou volé",
      });
    }
  },
);

// UTILISATEURS
// ========================================

// CRÉER UN EMPLOYÉ
app.post(
  "/api/utilisateurs",
  verifierConnexion,
  verifierAdmin,
  async (req, res) => {
    try {
      const { nom, email, mot_de_passe } = req.body;

      const saltRounds = 10;

      const motDePasseHash = await bcrypt.hash(mot_de_passe, saltRounds);

      const pool = await connecterBD();

      await pool
        .request()
        .input("nom", nom)
        .input("email", email)
        .input("mot_de_passe", motDePasseHash)
        .input("role", "Employé").query(`
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
        message: "Employé créé avec succès",
      });
    } catch (erreur) {
      console.error(erreur);

      res.status(500).json({
        erreur: "Impossible de créer l’employé",
      });
    }
  },
);

// RÉCUPÉRER LES UTILISATEURS
app.get(
  "/api/utilisateurs",
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
        erreur: "Impossible de récupérer les utilisateurs",
      });
    }
  },
);

// ========================================
// SERVEUR
// ========================================

require("./src/validations-equipements")(
  app,
  connecterBD,
  verifierConnexion,
  verifierAdmin,
);
require("./src/statuts-admin")(
  app,
  connecterBD,
  verifierConnexion,
  verifierAdmin,
);
require("./src/reparations")(
  app,
  connecterBD,
  verifierConnexion,
  verifierAdmin,
);
require("./src/signalements")(
  app,
  connecterBD,
  verifierConnexion,
  verifierAdmin,
);
require("./src/notifications-etats")(app, connecterBD, verifierConnexion);

app.listen(Number(process.env.PORT || 3000), () => {
  console.log(
    "Serveur TechStock démarré sur http://localhost:" +
      Number(process.env.PORT || 3000),
  );
});
