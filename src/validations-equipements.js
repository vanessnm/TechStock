"use strict";
module.exports=(app,connecterBD,verifierConnexion,verifierAdmin)=>{
 const dernier=`OUTER APPLY (SELECT TOP 1 m.id,m.type_mouvement,m.note,m.date_mouvement,m.utilisateur_id FROM Mouvements m
  WHERE m.equipement_id=e.id AND (m.type_mouvement IN (N'Validation',N'Validation refusée',N'En attente de validation → Disponible (administrateur)')
   OR m.type_mouvement LIKE N'%→ En attente de validation (administrateur)') ORDER BY m.id DESC) v`;
 app.get('/api/validations-equipements',verifierConnexion,async(req,res)=>{
  try{const pool=await connecterBD();const result=await pool.request().input('admin',req.session.utilisateur.role==='Administrateur'?1:0).input('user',req.session.utilisateur.id)
   .query(`SELECT e.id,e.id AS equipement_id,e.nom AS equipement_nom,e.ajoute_par_id AS employe_id,u.nom AS employe_nom,e.description,e.date_ajout AS date_signalement,
    N'Nouvel équipement' AS type_signalement,
    CASE WHEN v.type_mouvement=N'Validation refusée' THEN N'Refusée' WHEN e.etat=N'En attente de validation' THEN N'En attente' ELSE N'Acceptée' END AS statut,
    v.note AS commentaire,v.id AS decision_id,a.nom AS administrateur_nom
    FROM Equipements e JOIN Utilisateurs u ON u.id=e.ajoute_par_id ${dernier}
    LEFT JOIN Utilisateurs a ON a.id=v.utilisateur_id
    WHERE (@admin=1 OR e.ajoute_par_id=@user) AND (e.etat=N'En attente de validation' OR v.type_mouvement IN (N'Validation',N'Validation refusée',N'En attente de validation → Disponible (administrateur)'))
    ORDER BY e.date_ajout DESC,e.id DESC`);res.json(result.recordset);
  }catch(error){console.error(error);res.status(500).json({erreur:'Impossible de charger les validations d’équipements.'});}
 });
 for(const refus of [false,true])app.put('/api/equipements/:id/validation'+(refus?'/refus':''),verifierConnexion,verifierAdmin,async(req,res)=>{
  const id=Number(req.params.id),commentaire=req.body.commentaire??'';
  if(!Number.isInteger(id)||id<=0||typeof commentaire!=='string'||commentaire.trim().length>500)return res.status(400).json({erreur:'Identifiant ou commentaire incorrect (500 caractères maximum).'});
  if(refus&&!commentaire.trim())return res.status(400).json({erreur:'Motif du refus (obligatoire)'});
  let tx;
  try{const pool=await connecterBD();tx=pool.transaction();await tx.begin();
   const e=(await tx.request().input('id',id).query("SELECT etat FROM Equipements WITH (UPDLOCK,HOLDLOCK) WHERE id=@id")).recordset[0];
   const latest=(await tx.request().input('id',id).query(`SELECT e.id,v.type_mouvement FROM Equipements e ${dernier} WHERE e.id=@id`)).recordset[0];
   if(!e||e.etat!=='En attente de validation'||latest?.type_mouvement==='Validation refusée'){await tx.rollback();tx=null;return res.status(409).json({erreur:'Cette demande n’est plus en attente ou a déjà été traitée.'});}
   if(!refus)await tx.request().input('id',id).input('admin',req.session.utilisateur.id).query("UPDATE Equipements SET etat=N'Disponible',valide_par_id=@admin,date_validation=GETDATE() WHERE id=@id");
   await tx.request().input('id',id).input('admin',req.session.utilisateur.id).input('type',refus?'Validation refusée':'Validation').input('note',commentaire.trim())
    .query('INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note) VALUES(@id,@admin,@type,@note)');
   await tx.commit();tx=null;res.json({message:refus?'Ajout refusé. Le motif est visible par l’employé.':'Équipement validé : Disponible.'});
  }catch(error){if(tx)await tx.rollback().catch(()=>{});console.error(error);res.status(500).json({erreur:'Impossible d’enregistrer la décision de validation.'});}
 });
};
