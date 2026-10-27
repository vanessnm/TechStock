"use strict";
// Les paramètres de connexion et les contrôles de session restent ceux de l'application.
module.exports = function enregistrerSignalements(app, connecterBD, verifierConnexion, verifierAdmin) {
  const types = ['Perdu / Volé', 'À remplacer / Hors service', 'En réparation'];
  const etats = ['Disponible', 'Attribué', 'En réparation', 'En attente de retour'];
  const texte = (value) => typeof value === 'string' && value.trim().length <= 500;
  app.get('/api/signalements', verifierConnexion, async (req, res) => {
    try {
      const pool = await connecterBD();
      const result = await pool.request()
        .input('admin', req.session.utilisateur.role === 'Administrateur' ? 1 : 0)
        .input('user', req.session.utilisateur.id)
        .query(`SELECT s.*, e.nom AS equipement_nom, u.nom AS employe_nom,
          a.nom AS administrateur_nom
          FROM Signalements s JOIN Equipements e ON e.id=s.equipement_id
          JOIN Utilisateurs u ON u.id=s.employe_id
          LEFT JOIN Utilisateurs a ON a.id=s.traite_par_id
          WHERE @admin=1 OR s.employe_id=@user
          ORDER BY s.date_signalement DESC, s.id DESC`);
      res.json(result.recordset);
    } catch (error) { console.error(error); res.status(500).json({erreur:'Impossible de charger les signalements'}); }
  });
  app.post('/api/signalements', verifierConnexion, async (req, res) => {
    if (req.session.utilisateur.role !== 'Employé') return res.status(403).json({erreur:'Seul un employé peut soumettre un signalement.'});
    const {equipement_id, type_signalement, description} = req.body;
    if (!Number.isInteger(equipement_id) || equipement_id<=0 || (!types.includes(type_signalement) || type_signalement === 'En réparation') || !texte(description) || !description.trim())
      return res.status(400).json({erreur:'Équipement, type et description (1 à 500 caractères) obligatoires.'});
    let tx;
    try {
      const pool = await connecterBD(); tx=pool.transaction(); await tx.begin();
      const e=(await tx.request().input('id',equipement_id).query('SELECT etat FROM Equipements WITH (UPDLOCK,HOLDLOCK) WHERE id=@id')).recordset[0];
      if (!e || !(type_signalement === 'En réparation' ? ['Disponible', 'Attribué'] : etats).includes(e.etat)) { await tx.rollback(); tx=null; return res.status(409).json({erreur:'Cet équipement ne peut pas être signalé dans son état actuel.'}); }
      await tx.request().input('equipement',equipement_id).input('employe',req.session.utilisateur.id)
        .input('type',type_signalement).input('description',description.trim()).input('etat',e.etat)
        .query(`INSERT INTO Signalements(equipement_id,employe_id,type_signalement,description,etat_initial)
          VALUES(@equipement,@employe,@type,@description,@etat)`);
      await tx.request().input('equipement',equipement_id).input('employe',req.session.utilisateur.id).input('note',description.trim())
        .query(`INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note)
          VALUES(@equipement,@employe,N'Signalement soumis',@note)`);
      await tx.commit(); tx=null;
      res.status(201).json({message:'Signalement soumis. Le statut de l’équipement reste inchangé.'});
    } catch(error) {
      if(tx) await tx.rollback().catch(()=>{});
      if(error.number===2601 || error.number===2627) return res.status(409).json({erreur:'Vous avez déjà une demande de ce type en attente pour cet équipement.'});
      if(error.number===547 && type_signalement==='En réparation') return res.status(503).json({erreur:'Les demandes de réparation nécessitent la mise à jour SQL 002_signalements_reparation.sql. Aucun statut n’a été modifié.'});
      console.error(error); res.status(500).json({erreur:'Impossible de soumettre le signalement'});
    }
  });
  app.put('/api/signalements/:id/decision', verifierConnexion, verifierAdmin, async (req,res) => {
    const id=Number(req.params.id), {decision}=req.body, commentaire=req.body.commentaire ?? '';
    if(!Number.isInteger(id)||id<=0||!['Acceptée','Refusée'].includes(decision)||!texte(commentaire))
      return res.status(400).json({erreur:'Décision ou commentaire incorrect (500 caractères maximum).'});
    if(decision==='Refusée'&&!commentaire.trim()) return res.status(400).json({erreur:'Motif du refus (obligatoire)'});
    let tx;
    try {
      const pool=await connecterBD(); tx=pool.transaction(); await tx.begin();
      const s=(await tx.request().input('id',id).query('SELECT * FROM Signalements WITH (UPDLOCK,HOLDLOCK) WHERE id=@id')).recordset[0];
      if(!s||s.statut!=='En attente'){await tx.rollback();tx=null;return res.status(409).json({erreur:'Demande introuvable ou déjà traitée.'});}
      if(s.employe_id===req.session.utilisateur.id){await tx.rollback();tx=null;return res.status(403).json({erreur:'Vous ne pouvez pas traiter votre propre demande.'});}
      if(decision==='Acceptée') {
        if(!types.includes(s.type_signalement)){await tx.rollback();tx=null;return res.status(409).json({erreur:'Type de signalement non pris en charge.'});}
        const update=await tx.request().input('equipement',s.equipement_id).input('initial',s.etat_initial).input('etat',s.type_signalement)
          .query(`UPDATE Equipements SET etat=@etat,
            attribue_a_id=CASE WHEN @etat=N'En réparation' THEN attribue_a_id ELSE NULL END,
            date_attribution=CASE WHEN @etat=N'En réparation' THEN date_attribution ELSE NULL END
            WHERE id=@equipement AND etat=@initial
            AND etat IN (N'Disponible',N'Attribué',N'En réparation',N'En attente de retour')
            AND (@etat<>N'En réparation' OR etat IN (N'Disponible',N'Attribué'))`);
        if(!update.rowsAffected[0]){await tx.rollback();tx=null;return res.status(409).json({erreur:'Le statut de l’équipement a changé. Vérifiez l’inventaire avant de décider ; la demande reste en attente.'});}
      }
      await tx.request().input('id',id).input('decision',decision).input('commentaire',commentaire.trim()).input('admin',req.session.utilisateur.id)
        .query(`UPDATE Signalements SET statut=@decision, commentaire=@commentaire,
          traite_par_id=@admin, date_decision=SYSUTCDATETIME() WHERE id=@id`);
      await tx.request().input('equipement',s.equipement_id).input('admin',req.session.utilisateur.id)
        .input('type',decision==='Acceptée'?'Signalement accepté':'Signalement refusé').input('note',commentaire.trim())
        .query('INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note) VALUES(@equipement,@admin,@type,@note)');
      await tx.commit();tx=null;res.json({message:'Demande '+decision.toLocaleLowerCase('fr')+'.'});
    } catch(error) {if(tx)await tx.rollback().catch(()=>{});console.error(error);res.status(500).json({erreur:'Impossible d’enregistrer la décision'});}
  });
};
