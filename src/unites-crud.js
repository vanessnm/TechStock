"use strict";
module.exports=(app,connecterBD,verifierConnexion,verifierAdmin)=>{
 const protectedFields=['etat','statut','attribue_a_id','utilisateur_id','date_attribution','valide_par_id','date_validation','ajoute_par_id','unite_id','modele_id'];
 const role=(req,res)=>{if(!['Employé','Administrateur'].includes(req.session.utilisateur.role)){res.status(403).json({erreur:'Rôle non autorisé.'});return false;}if(req.session.utilisateur.role==='Employé'&&protectedFields.some(k=>Object.hasOwn(req.body,k))){res.status(403).json({erreur:'Le statut et l’attribution passent uniquement par les actions autorisées.'});return false;}return true;};
 const valide=(b)=>typeof b.nom==='string'&&b.nom.trim().length>0&&b.nom.trim().length<=150&&Number.isInteger(b.categorie_id)&&b.categorie_id>0&&Number.isInteger(b.emplacement_id)&&b.emplacement_id>0&&Number.isInteger(b.seuil_minimum)&&b.seuil_minimum>=0&&Number.isFinite(b.prix)&&b.prix>=0&&(!b.description||typeof b.description==='string'&&b.description.length<=500);
 async function modele(tx,b){let row=(await tx.request().input('nom',b.nom.trim()).input('cat',b.categorie_id).query('SELECT id FROM ModelesEquipement WITH(UPDLOCK,HOLDLOCK) WHERE nom=@nom AND categorie_id=@cat')).recordset[0];if(!row)row=(await tx.request().input('nom',b.nom.trim()).input('cat',b.categorie_id).query('INSERT INTO ModelesEquipement(nom,categorie_id) OUTPUT inserted.id VALUES(@nom,@cat)')).recordset[0];return row.id;}
 const erreur=(res,e)=>res.status([2601,2627].includes(e.number)?409:e.number===547?400:500).json({erreur:[2601,2627].includes(e.number)?'Ce numéro de série existe déjà. Aucune unité n’a été modifiée.':e.number===547?'Catégorie ou emplacement invalide.':'Impossible d’enregistrer cette opération unitaire.'});
 app.get('/api/referentiels',verifierConnexion,async(req,res)=>{
  if(!['Administrateur','Employé'].includes(req.session.utilisateur.role))return res.status(403).json({erreur:'Rôle non autorisé.'});
  try{const p=await connecterBD();const rows=(await p.request().query('SELECT id,nom FROM Categories ORDER BY nom; SELECT id,nom FROM Emplacements WHERE actif=1 ORDER BY nom;')).recordsets;res.json({categories:rows[0],emplacements:rows[1]});}
  catch(e){console.error(e);res.status(500).json({erreur:'Impossible de charger les catégories et emplacements.'});}
 });
 app.get('/api/equipements',verifierConnexion,async(req,res)=>{try{const pool=await connecterBD();const rows=await pool.request().query(`SELECT e.*,c.nom AS categorie,em.nom AS emplacement,
 COUNT(*) OVER(PARTITION BY e.modele_id) AS stock_total,
 SUM(CASE WHEN e.etat=N'Disponible' AND e.attribue_a_id IS NULL AND e.date_attribution IS NULL THEN 1 ELSE 0 END) OVER(PARTITION BY e.modele_id) AS stock_disponible
 FROM EquipementsUnitaires e JOIN Categories c ON c.id=e.categorie_id JOIN Emplacements em ON em.id=e.emplacement_id ORDER BY e.modele_id,e.id`);res.json(rows.recordset);}catch(e){console.error(e);res.status(500).json({erreur:'Impossible de charger les unités. Vérifier la migration de la base de test.'});}});
 app.post('/api/equipements',verifierConnexion,async(req,res)=>{
  if(!role(req,res))return;const b=req.body;if(!valide(b)||!Number.isInteger(b.quantite)||b.quantite<1||b.quantite>1000)return res.status(400).json({erreur:'Informations invalides ou quantité hors limites (1 à 1000).'});
  const extra=Array.isArray(b.numeros_serie)?b.numeros_serie:typeof b.numeros_serie==='string'&&b.numeros_serie.trim()?b.numeros_serie.split(/\r?\n/):[];
  const series=[b.numero_serie??'',...extra].map(x=>typeof x==='string'?x.trim():null);
  if(series.some(x=>x===null||x.length>100)||series.length>b.quantite||new Set(series.filter(Boolean)).size!==series.filter(Boolean).length)return res.status(400).json({erreur:'Numéros de série invalides, trop nombreux ou dupliqués.'});
  let tx;try{const p=await connecterBD();tx=p.transaction();await tx.begin();const model=await modele(tx,b),etat=req.session.utilisateur.role==='Administrateur'?'Disponible':'En attente de validation';
   const parent=(await tx.request().input('nom',b.nom.trim()).input('description',b.description||'').input('serie',series[0]||null).input('cat',b.categorie_id).input('q',b.quantite).input('prix',b.prix).input('em',b.emplacement_id).input('seuil',b.seuil_minimum).input('etat',etat).input('user',req.session.utilisateur.id)
    .query('INSERT INTO Equipements(nom,description,numero_serie,categorie_id,quantite,prix,emplacement_id,seuil_minimum,etat,ajoute_par_id) OUTPUT inserted.id VALUES(@nom,@description,@serie,@cat,@q,@prix,@em,@seuil,@etat,@user)')).recordset[0].id;
   const ids=[];for(let i=0;i<b.quantite;i++){
    const u=(await tx.request().input('parent',parent).input('model',model).input('description',b.description||'').input('serie',series[i]||null).input('prix',b.prix).input('em',b.emplacement_id).input('seuil',b.seuil_minimum).input('etat',etat).input('user',req.session.utilisateur.id)
     .query("INSERT INTO UnitesEquipement(equipement_id,modele_id,code_interne,description,numero_serie,prix,emplacement_id,seuil_minimum,etat,ajoute_par_id) OUTPUT inserted.id VALUES(@parent,@model,N'TS-U-'+CONVERT(nvarchar(36),NEWID()),@description,@serie,@prix,@em,@seuil,@etat,@user)")).recordset[0].id;ids.push(u);
    await tx.request().input('p',parent).input('u',u).input('user',req.session.utilisateur.id).query("INSERT INTO Mouvements(equipement_id,unite_id,utilisateur_id,type_mouvement,note) VALUES(@p,@u,@user,N'Création unité',N'')");
   }
   await tx.commit();tx=null;res.status(201).json({message:ids.length+' unité(s) créée(s).',unite_ids:ids});
  }catch(e){if(tx)await tx.rollback().catch(()=>{});console.error(e);erreur(res,e);}
 });
 app.put('/api/equipements/:id',verifierConnexion,async(req,res)=>{
  if(!role(req,res))return;const b=req.body,id=Number(req.params.id);if(!valide(b)||!Number.isInteger(id)||id<=0||b.quantite!==1||b.numero_serie!=null&&(typeof b.numero_serie!=='string'||b.numero_serie.trim().length>100))return res.status(400).json({erreur:'Une modification concerne une unité. La quantité ne peut pas être remplacée manuellement.'});
  let tx;try{const pool=await connecterBD();tx=pool.transaction();await tx.begin();const before=(await tx.request().input('id',id).query('SELECT equipement_id FROM UnitesEquipement WITH(UPDLOCK,HOLDLOCK) WHERE id=@id')).recordset[0];if(!before){await tx.rollback();tx=null;return res.status(404).json({erreur:'Unité introuvable.'});}
   const model=await modele(tx,b);await tx.request().input('id',id).input('model',model).input('description',b.description||'').input('serie',b.numero_serie?.trim()||null).input('prix',b.prix).input('em',b.emplacement_id).input('seuil',b.seuil_minimum)
    .query('UPDATE UnitesEquipement SET modele_id=@model,description=@description,numero_serie=@serie,prix=@prix,emplacement_id=@em,seuil_minimum=@seuil WHERE id=@id');
   await tx.request().input('p',before.equipement_id).input('u',id).input('user',req.session.utilisateur.id).query("INSERT INTO Mouvements(equipement_id,unite_id,utilisateur_id,type_mouvement,note) VALUES(@p,@u,@user,N'Modification unité',N'')");
   await tx.commit();tx=null;res.json({message:'Informations de cette unité enregistrées.'});
  }catch(e){if(tx)await tx.rollback().catch(()=>{});console.error(e);erreur(res,e);}
 });
 app.get('/api/equipements/:id/historique',verifierConnexion,async(req,res)=>{
  try{const pool=await connecterBD();const id=Number(req.params.id);if(!Number.isInteger(id)||id<=0)return res.status(400).json({erreur:'Unité invalide.'});const u=(await pool.request().input('id',id).query('SELECT equipement_id FROM UnitesEquipement WHERE id=@id')).recordset[0];if(!u)return res.status(404).json({erreur:'Unité introuvable.'});
   const rows=await pool.request().input('id',id).input('parent',u.equipement_id).query('SELECT m.*,a.nom AS auteur FROM Mouvements m JOIN Utilisateurs a ON a.id=m.utilisateur_id WHERE m.unite_id=@id OR (m.unite_id IS NULL AND m.equipement_id=@parent) ORDER BY m.id DESC');res.json({unite:rows.recordset.filter(m=>m.unite_id===id),ancienne_fiche:rows.recordset.filter(m=>m.unite_id==null)});
  }catch(e){console.error(e);res.status(500).json({erreur:'Historique indisponible.'});}
 });
 app.put('/api/signalements/:id/unite',verifierConnexion,verifierAdmin,async(req,res)=>{
  const id=Number(req.params.id),u=req.body.unite_id;if(!Number.isInteger(id)||!Number.isInteger(u)||id<=0||u<=0)return res.status(400).json({erreur:'Unité invalide.'});let tx;
  try{const pool=await connecterBD();tx=pool.transaction();await tx.begin();const s=(await tx.request().input('id',id).query('SELECT * FROM Signalements WITH(UPDLOCK,HOLDLOCK) WHERE id=@id')).recordset[0];const unit=(await tx.request().input('u',u).query('SELECT equipement_id,etat FROM UnitesEquipement WHERE id=@u')).recordset[0];
   if(!s||s.statut!=='En attente'||s.unite_id!=null||!unit||unit.equipement_id!==s.equipement_id){await tx.rollback();tx=null;return res.status(409).json({erreur:'Association non autorisée pour cette ancienne demande.'});}
   await tx.request().input('id',id).input('u',u).input('etat',unit.etat).query('UPDATE Signalements SET unite_id=@u,etat_initial_unite=@etat WHERE id=@id');await tx.commit();tx=null;res.json({message:'Ancienne demande associée à l’unité choisie.'});
  }catch(e){if(tx)await tx.rollback().catch(()=>{});console.error(e);erreur(res,e);}
 });
};
