"use strict";
// Préférences de notifications par utilisateur ; aucune modification des demandes/mouvements.
module.exports = (app, connecterBD, verifierConnexion) => {
  const prefix = (user) => "notification-unites:" + user + ":";
  const code = (status) =>
    ({ "En attente": "P", Acceptée: "A", Refusée: "R" })[status];
  async function autorisee(tx, key, user) {
    const parts = key.split(":"),
      id = Number(parts[1]);
    if (parts[0] === "i") {
      if (user.role !== "Administrateur") return false;
      return !!(
        await tx
          .request()
          .input("id", id)
          .query(
            "SELECT id FROM Mouvements WHERE id=@id AND (type_mouvement=N'Mise en réparation (employé)' OR type_mouvement LIKE N'%→ Disponible (employé%')",
          )
      ).recordset.length;
    }
    if (parts[0] === "s") {
      const s = (
        await tx
          .request()
          .input("id", id)
          .query("SELECT employe_id,statut FROM Signalements WHERE id=@id")
      ).recordset[0];
      return (
        !!s &&
        (user.role === "Administrateur" || s.employe_id === user.id) &&
        parts[2] === code(s.statut)
      );
    }
    const e = (
      await tx.request().input("id", id)
        .query(`SELECT e.etat,e.ajoute_par_id,v.id AS decision_id,v.type_mouvement FROM EquipementsUnitaires e
   OUTER APPLY(SELECT TOP 1 m.id,m.type_mouvement FROM Mouvements m WHERE
    (m.unite_id=e.id OR (m.unite_id IS NULL AND m.equipement_id=e.equipement_origine_id AND (SELECT COUNT(*) FROM UnitesEquipement ux WHERE ux.equipement_id=e.equipement_origine_id)=1))
    AND (m.type_mouvement IN(N'Validation',N'Validation refusée',N'En attente de validation → Disponible (administrateur)') OR m.type_mouvement LIKE N'%→ En attente de validation (administrateur)') ORDER BY m.id DESC) v WHERE e.id=@id`)
    ).recordset[0];
    if (!e || (user.role !== "Administrateur" && e.ajoute_par_id !== user.id))
      return false;
    const statut =
      e.type_mouvement === "Validation refusée"
        ? "Refusée"
        : e.etat === "En attente de validation"
          ? "En attente"
          : "Acceptée";
    const visible =
      e.etat === "En attente de validation" ||
      [
        "Validation",
        "Validation refusée",
        "En attente de validation → Disponible (administrateur)",
      ].includes(e.type_mouvement);
    return (
      visible &&
      parts[2] === code(statut) &&
      Number(parts[3]) === (e.decision_id || 0)
    );
  }
  app.get("/api/notifications/etats", verifierConnexion, async (req, res) => {
    if (!["Administrateur", "Employé"].includes(req.session.utilisateur.role))
      return res.status(403).json({ erreur: "Rôle non autorisé." });
    try {
      const p = await connecterBD(),
        pre = prefix(req.session.utilisateur.id);
      const rows = (
        await p
          .request()
          .input("prefix", pre + "%")
          .query("SELECT cle,valeur FROM Parametres WHERE cle LIKE @prefix")
      ).recordset;
      const etats = {};
      for (const row of rows) {
        try {
          etats[row.cle.slice(pre.length)] = JSON.parse(row.valeur);
        } catch {}
      }
      res.json(etats);
    } catch (e) {
      console.error(e);
      res
        .status(500)
        .json({ erreur: "Impossible de charger l’état des notifications." });
    }
  });
  app.put("/api/notifications/etat", verifierConnexion, async (req, res) => {
    const user = req.session.utilisateur,
      { cle, action } = req.body;
    if (!["Administrateur", "Employé"].includes(user.role))
      return res.status(403).json({ erreur: "Rôle non autorisé." });
    if (
      typeof cle !== "string" ||
      !/^(i:[1-9][0-9]*|s:[1-9][0-9]*:[PAR]|v:[1-9][0-9]*:[PAR]:[0-9]+)$/.test(
        cle,
      ) ||
      cle.length > 65 ||
      !["lire", "archiver", "retirer", "restaurer"].includes(action)
    )
      return res
        .status(400)
        .json({ erreur: "Notification ou action invalide." });
    let tx;
    try {
      const p = await connecterBD();
      tx = p.transaction();
      await tx.begin();
      if (!(await autorisee(tx, cle, user))) {
        await tx.rollback();
        tx = null;
        return res
          .status(403)
          .json({
            erreur:
              "Cette notification n’est pas accessible ou a changé. Actualisez la liste.",
          });
      }
      const key = prefix(user.id) + cle;
      const old = (
        await tx
          .request()
          .input("cle", key)
          .query(
            "SELECT id,valeur FROM Parametres WITH(UPDLOCK,HOLDLOCK) WHERE cle=@cle",
          )
      ).recordset[0];
      let etat = {};
      try {
        etat = JSON.parse(old?.valeur || "{}");
      } catch {}
      etat = { ...etat, lue: true };
      if (action === "archiver") {
        etat.archivee = true;
        etat.retiree = false;
      }
      if (action === "retirer") {
        etat.retiree = true;
        etat.archivee = false;
      }
      if (action === "restaurer") {
        etat.archivee = false;
        etat.retiree = false;
      }
      const r = tx
        .request()
        .input("cle", key)
        .input("valeur", JSON.stringify(etat));
      await r.query(
        old
          ? "UPDATE Parametres SET valeur=@valeur WHERE cle=@cle"
          : "INSERT INTO Parametres(cle,valeur,description) VALUES(@cle,@valeur,N'État de notification par utilisateur, sans suppression de demande ou historique')",
      );
      await tx.commit();
      tx = null;
      res.json({ cle, etat });
    } catch (e) {
      if (tx) await tx.rollback().catch(() => {});
      console.error(e);
      res
        .status(500)
        .json({
          erreur: "Impossible d’enregistrer l’état de la notification.",
        });
    }
  });
};
