"use strict";
module.exports=(app,connecterBD,verifierConnexion,verifierAdmin)=>{
 const statuts=['Disponible','Attribué','En réparation','En attente de retour','En attente de validation','Perdu / Volé','À remplacer / Hors service'];
 app.put('/api/equipements/:id/statut-administrateur',verifierConnexion,verifierAdmin,async(req,res)=>{
  const id=Number(req.params.id),{etat,utilisateur_id}=req.body,commentaire=req.body.commentaire??'';
  const attribution=['Attribué','En attente de retour'].includes(etat);
  if(!Number.isInteger(id)||id<=0||!statuts.includes(etat)||typeof commentaire!=='string'||commentaire.trim().length>500||
    (attribution&&(!Number.isInteger(utilisateur_id)||utilisateur_id<=0)))return res.status(400).json({erreur:'Statut, employé ou commentaire invalide.'});
  let tx;
  try{
   const pool=await connecterBD();tx=pool.transaction();await tx.begin();
   const e=(await tx.request().input('id',id).query('SELECT etat,attribue_a_id FROM Equipements WITH (UPDLOCK,HOLDLOCK) WHERE id=@id')).recordset[0];
   if(!e){await tx.rollback();tx=null;return res.status(404).json({erreur:'Équipement introuvable.'});}
   if(attribution){const u=(await tx.request().input('user',utilisateur_id).query("SELECT id FROM Utilisateurs WHERE id=@user AND actif=1 AND role=N'Employé'")).recordset;
    if(!u.length){await tx.rollback();tx=null;return res.status(400).json({erreur:'Sélectionnez un employé actif.'});}}
   await tx.request().input('id',id).input('etat',etat).input('ancien',e.etat).input('employe',attribution?utilisateur_id:null).input('admin',req.session.utilisateur.id)
    .query(`UPDATE Equipements SET etat=@etat,
      attribue_a_id=CASE WHEN @etat IN (N'Attribué',N'En attente de retour') THEN @employe WHEN @etat=N'En réparation' THEN attribue_a_id ELSE NULL END,
      date_attribution=CASE WHEN @etat IN (N'Attribué',N'En attente de retour') THEN CASE WHEN attribue_a_id=@employe AND date_attribution IS NOT NULL THEN date_attribution ELSE GETDATE() END WHEN @etat=N'En réparation' THEN date_attribution ELSE NULL END,
      valide_par_id=CASE WHEN @etat=N'En attente de validation' THEN NULL WHEN @ancien=N'En attente de validation' THEN @admin ELSE valide_par_id END,
      date_validation=CASE WHEN @etat=N'En attente de validation' THEN NULL WHEN @ancien=N'En attente de validation' THEN GETDATE() ELSE date_validation END
      WHERE id=@id`);
   const type=e.etat+' → '+etat+' (administrateur)';
   const note=(attribution?'Employé '+utilisateur_id+'. ':e.attribue_a_id!=null&&etat!=='En réparation'?'Ancienne attribution : '+e.attribue_a_id+'. ':'')+commentaire.trim();
   // Le commentaire intégral est conservé; les identifiants d'attribution ont leur propre mouvement si nécessaire.
   await tx.request().input('id',id).input('admin',req.session.utilisateur.id).input('type',type).input('note',commentaire.trim())
    .query('INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note) VALUES(@id,@admin,@type,@note)');
   if(attribution||e.attribue_a_id!=null&&etat!=='En réparation')await tx.request().input('id',id).input('admin',req.session.utilisateur.id).input('note',note.slice(0,note.length-commentaire.trim().length).trim())
    .query("INSERT INTO Mouvements(equipement_id,utilisateur_id,type_mouvement,note) VALUES(@id,@admin,N'Attribution administrateur',@note)");
   await tx.commit();tx=null;res.json({message:'Statut enregistré : '+etat+'.'});
  }catch(error){if(tx)await tx.rollback().catch(()=>{});console.error(error);res.status(500).json({erreur:'Impossible d’enregistrer le statut administrateur.'});}
 });
};
