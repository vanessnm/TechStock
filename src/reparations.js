"use strict";
module.exports = function enregistrerReparations(
  app,
  connecterBD,
  verifierConnexion,
  verifierAdmin,
) {
  for (const fin of [false, true]) {
    app.put(
      "/api/equipements/:id/reparation" + (fin ? "/fin" : ""),
      verifierConnexion,
      async (req, res) => {
        const user = req.session.utilisateur;
        if (!["Administrateur", "Employé"].includes(user.role))
          return res.status(403).json({ erreur: "Action non autorisée." });
        const id = Number(req.params.id),
          note = req.body[fin ? "resolution" : "raison"] ?? "";
        if (
          !Number.isInteger(id) ||
          id <= 0 ||
          typeof note !== "string" ||
          note.trim().length > 500
        )
          return res
            .status(400)
            .json({
              erreur:
                "Identifiant ou commentaire invalide (500 caractères maximum).",
            });
        const employe = user.role === "Employé";
        if (employe && !fin && !note.trim())
          return res
            .status(400)
            .json({ erreur: "La description du problème est obligatoire." });
        let tx;
        try {
          const pool = await connecterBD();
          tx = pool.transaction();
          await tx.begin();
          const e = (
            await tx
              .request()
              .input("id", id)
              .query(
                "SELECT etat,attribue_a_id,date_attribution FROM EquipementsUnitaires WITH (UPDLOCK,HOLDLOCK) WHERE id=@id",
              )
          ).recordset[0];
          if (
            !e ||
            (fin
              ? e.etat !== "En réparation"
              : !["Disponible", "Attribué"].includes(e.etat))
          ) {
            await tx.rollback();
            tx = null;
            return res
              .status(409)
              .json({
                erreur:
                  "Cette transition n’est pas autorisée depuis le statut actuel.",
              });
          }
          if (employe) {
            if (fin && e.attribue_a_id != null && e.attribue_a_id !== user.id) {
              await tx.rollback();
              tx = null;
              return res
                .status(403)
                .json({
                  erreur:
                    "Cet équipement est attribué à un autre employé. Son détenteur ou un administrateur doit confirmer le retour.",
                });
            }
            if (fin && req.body.confirmer_retour !== true) {
              await tx.rollback();
              tx = null;
              return res
                .status(400)
                .json({
                  erreur:
                    "Je confirme vouloir changer le statut de cet équipement à « Disponible ».",
                });
            }
            if (
              !fin &&
              e.attribue_a_id != null &&
              e.attribue_a_id !== user.id
            ) {
              await tx.rollback();
              tx = null;
              return res
                .status(403)
                .json({
                  erreur: "Cet équipement est attribué à un autre employé.",
                });
            }
            const pending = (
              await tx
                .request()
                .input("id", id)
                .query(
                  "SELECT TOP 1 id FROM Signalements WITH (UPDLOCK,HOLDLOCK) WHERE (unite_id=@id OR (unite_id IS NULL AND equipement_id=(SELECT equipement_id FROM UnitesEquipement WHERE id=@id))) AND statut=N'En attente'",
                )
            ).recordset;
            if (pending.length) {
              await tx.rollback();
              tx = null;
              return res
                .status(409)
                .json({
                  erreur:
                    "Un signalement est en attente : un administrateur doit le traiter avant ce changement.",
                });
            }
          }
          await tx
            .request()
            .input("id", id)
            .input("etat", fin ? "Disponible" : "En réparation")
            .query(
              fin
                ? "UPDATE EquipementsUnitaires SET etat=@etat,attribue_a_id=NULL,date_attribution=NULL WHERE id=@id"
                : "UPDATE EquipementsUnitaires SET etat=@etat WHERE id=@id",
            );
          await tx
            .request()
            .input("id", id)
            .input("user", user.id)
            .input("note", note.trim())
            .input(
              "type",
              fin
                ? "En réparation → Disponible (" +
                    (employe ? "employé" : "administrateur") +
                    (e.attribue_a_id != null
                      ? "; attribution " + e.attribue_a_id
                      : "") +
                    ")"
                : employe
                  ? "Mise en réparation (employé)"
                  : "Mise en réparation",
            )
            .query(
              "INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note,unite_id) VALUES((SELECT equipement_id FROM UnitesEquipement WHERE id=@id),@user,@type,@note,@id)",
            );
          await tx.commit();
          tx = null;
          res.json({
            message: fin
              ? "Réparation terminée."
              : "Équipement mis en réparation.",
          });
        } catch (error) {
          if (tx) await tx.rollback().catch(() => {});
          console.error(error);
          res
            .status(500)
            .json({
              erreur: "Impossible d’enregistrer ce changement de statut.",
            });
        }
      },
    );
  }

  app.put(
    "/api/equipements/:id/disponibilite",
    verifierConnexion,
    async (req, res) => {
      const user = req.session.utilisateur,
        id = Number(req.params.id),
        commentaire = req.body.commentaire ?? "";
      if (!["Employé", "Administrateur"].includes(user.role))
        return res.status(403).json({ erreur: "Action non autorisée." });
      if (
        !Number.isInteger(id) ||
        id <= 0 ||
        typeof commentaire !== "string" ||
        commentaire.trim().length > 500
      )
        return res
          .status(400)
          .json({
            erreur:
              "Identifiant ou commentaire invalide (500 caractères maximum).",
          });
      if (user.role === "Employé" && req.body.confirmer_retour !== true)
        return res
          .status(400)
          .json({
            erreur:
              "Je confirme vouloir changer le statut de cet équipement à « Disponible ».",
          });
      let tx;
      try {
        const pool = await connecterBD();
        tx = pool.transaction();
        await tx.begin();
        const e = (
          await tx
            .request()
            .input("id", id)
            .query(
              "SELECT etat,attribue_a_id,date_attribution FROM EquipementsUnitaires WITH (UPDLOCK,HOLDLOCK) WHERE id=@id",
            )
        ).recordset[0];
        if (
          !e ||
          ![
            "Perdu / Volé",
            "Attribué",
            "En attente de retour",
            "En réparation",
            "À remplacer / Hors service",
          ].includes(e.etat)
        ) {
          await tx.rollback();
          tx = null;
          return res
            .status(409)
            .json({
              erreur:
                "Cet équipement ne peut pas être remis disponible depuis son statut actuel.",
            });
        }
        if (e.etat === "À remplacer / Hors service") {
          if (user.role !== "Administrateur") {
            await tx.rollback();
            tx = null;
            return res
              .status(403)
              .json({
                erreur: "La remise en service est réservée à l’administrateur.",
              });
          }
          if (req.body.confirmer_remise_service !== true) {
            await tx.rollback();
            tx = null;
            return res
              .status(400)
              .json({
                erreur: "Confirmer la remise en service de cet équipement.",
              });
          }
        }
        const retour = ["Attribué", "En attente de retour"].includes(e.etat);
        if (retour && req.body.confirmer_retour !== true) {
          await tx.rollback();
          tx = null;
          return res
            .status(400)
            .json({ erreur: "Confirmer que l’équipement a été retourné." });
        }
        if (user.role === "Employé") {
          if (retour && e.attribue_a_id !== user.id) {
            await tx.rollback();
            tx = null;
            return res
              .status(403)
              .json({
                erreur:
                  "Seul le détenteur actuel ou un administrateur peut confirmer ce retour.",
              });
          }
          if (
            !retour &&
            (e.attribue_a_id != null || e.date_attribution != null)
          ) {
            await tx.rollback();
            tx = null;
            return res
              .status(409)
              .json({
                erreur:
                  "Une attribution active doit être traitée par un administrateur.",
              });
          }
          const pending = (
            await tx
              .request()
              .input("id", id)
              .query(
                "SELECT TOP 1 id FROM Signalements WITH (UPDLOCK,HOLDLOCK) WHERE (unite_id=@id OR (unite_id IS NULL AND equipement_id=(SELECT equipement_id FROM UnitesEquipement WHERE id=@id))) AND statut=N'En attente'",
              )
          ).recordset;
          if (pending.length) {
            await tx.rollback();
            tx = null;
            return res
              .status(409)
              .json({
                erreur:
                  "Un signalement est en attente de décision administrative.",
              });
          }
        }
        await tx
          .request()
          .input("id", id)
          .query(
            "UPDATE EquipementsUnitaires SET etat=N'Disponible',attribue_a_id=NULL,date_attribution=NULL WHERE id=@id",
          );
        const type =
          e.etat +
          " → Disponible (" +
          (user.role === "Employé" ? "employé" : "administrateur") +
          (e.attribue_a_id != null ? "; attribution " + e.attribue_a_id : "") +
          ")";
        await tx
          .request()
          .input("id", id)
          .input("user", user.id)
          .input("type", type)
          .input("note", commentaire.trim())
          .query(
            "INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note,unite_id) VALUES((SELECT equipement_id FROM UnitesEquipement WHERE id=@id),@user,@type,@note,@id)",
          );
        await tx.commit();
        tx = null;
        res.json({
          message: retour
            ? "Retour confirmé : attribution retirée et équipement disponible."
            : "Équipement remis disponible.",
        });
      } catch (error) {
        if (tx) await tx.rollback().catch(() => {});
        console.error(error);
        res
          .status(500)
          .json({
            erreur: "Impossible de remettre cet équipement disponible.",
          });
      }
    },
  );

  app.get(
    "/api/notifications/reparations",
    verifierConnexion,
    verifierAdmin,
    async (req, res) => {
      try {
        const pool = await connecterBD();
        const rows = await pool.request()
          .query(`SELECT m.id,m.date_mouvement,m.note,m.type_mouvement,COALESCE(e.nom,ancien.nom)+CASE WHEN e.id IS NULL THEN N' · historique de la fiche, unité non déterminée' ELSE N' · '+COALESCE(e.numero_serie,e.code_interne) END AS equipement_nom,u.nom AS employe_nom
        FROM Mouvements m LEFT JOIN EquipementsUnitaires e ON e.id=m.unite_id JOIN Equipements ancien ON ancien.id=m.equipement_id JOIN Utilisateurs u ON u.id=m.utilisateur_id
        WHERE m.type_mouvement=N'Mise en réparation (employé)' OR m.type_mouvement LIKE N'%→ Disponible (employé%' ORDER BY m.id DESC`);
        res.json(rows.recordset);
      } catch (error) {
        console.error(error);
        res
          .status(500)
          .json({
            erreur: "Impossible de charger les notifications de réparation.",
          });
      }
    },
  );
};
