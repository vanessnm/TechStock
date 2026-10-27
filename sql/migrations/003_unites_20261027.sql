-- VERSION 2 : références aux objets nouveaux compilées après leur création.
USE [TechStock];
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
IF DB_NAME()<>N'TechStock' THROW 51000,N'Migration interdite sur cette base.',1;
IF OBJECT_ID(N'dbo.ModelesEquipement') IS NOT NULL OR OBJECT_ID(N'dbo.UnitesEquipement') IS NOT NULL
 OR OBJECT_ID(N'dbo.EquipementsUnitaires') IS NOT NULL
 OR COL_LENGTH(N'dbo.Mouvements',N'unite_id') IS NOT NULL
 OR COL_LENGTH(N'dbo.Signalements',N'unite_id') IS NOT NULL
 OR COL_LENGTH(N'dbo.Signalements',N'etat_initial_unite') IS NOT NULL
 THROW 51001,N'Schéma déjà migré ou partiel : arrêt sans écrasement. Faire inspecter la base avant toute reprise.',1;
IF EXISTS(SELECT 1 FROM dbo.Equipements WHERE quantite IS NULL OR quantite<1) THROW 51002,N'Quantités à vérifier avant migration.',1;
IF NOT EXISTS(SELECT 1 FROM dbo.Equipements WHERE id=1 AND nom=N'NVIDIA RTX 4060' AND quantite=4)
 OR NOT EXISTS(SELECT 1 FROM dbo.Equipements WHERE id=2 AND nom=N'AMD Ryzen 7 7800X3D' AND quantite=2)
 THROW 51003,N'Les fiches à répartir ne correspondent plus aux décisions confirmées.',1;
BEGIN TRY
BEGIN TRANSACTION;
-- Empreintes des données historiques, avant tout ajout de colonne.
DECLARE @equip_avant varbinary(32),@mouv_avant varbinary(32),@sign_avant varbinary(32);
SELECT @equip_avant=HASHBYTES('SHA2_256',(SELECT * FROM dbo.Equipements WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES));
SELECT @mouv_avant=HASHBYTES('SHA2_256',(SELECT id,type_mouvement,date_mouvement,note,equipement_id,utilisateur_id FROM dbo.Mouvements WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES));
SELECT @sign_avant=HASHBYTES('SHA2_256',(SELECT id,equipement_id,employe_id,type_signalement,description,etat_initial,date_signalement,statut,commentaire,traite_par_id,date_decision FROM dbo.Signalements WITH(HOLDLOCK) ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES));
CREATE TABLE dbo.ModelesEquipement(id int IDENTITY PRIMARY KEY,nom nvarchar(150) NOT NULL,categorie_id int NOT NULL REFERENCES dbo.Categories(id),CONSTRAINT UQ_Modeles_nom_categorie UNIQUE(nom,categorie_id));
EXEC(N'INSERT INTO dbo.ModelesEquipement(nom,categorie_id) SELECT DISTINCT nom,categorie_id FROM dbo.Equipements;');
CREATE TABLE dbo.UnitesEquipement(
 id int IDENTITY PRIMARY KEY,equipement_id int NOT NULL REFERENCES dbo.Equipements(id),modele_id int NOT NULL REFERENCES dbo.ModelesEquipement(id),
 code_interne nvarchar(80) NOT NULL UNIQUE,numero_serie nvarchar(100) NULL,description nvarchar(500) NULL,
 etat nvarchar(50) NOT NULL CHECK(etat IN(N'Disponible',N'Attribué',N'En réparation',N'En attente de retour',N'En attente de validation',N'Perdu / Volé',N'À remplacer / Hors service')),
 prix decimal(18,2) NULL,emplacement_id int NOT NULL REFERENCES dbo.Emplacements(id),seuil_minimum int NOT NULL CHECK(seuil_minimum>=0),
 ajoute_par_id int NULL REFERENCES dbo.Utilisateurs(id),valide_par_id int NULL REFERENCES dbo.Utilisateurs(id),
 date_ajout datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),date_validation datetime2 NULL,date_achat date NULL,fin_garantie date NULL,image nvarchar(255) NULL,
 attribue_a_id int NULL REFERENCES dbo.Utilisateurs(id),date_attribution datetime2 NULL,
 version_ligne rowversion NOT NULL,
 CHECK(etat NOT IN(N'Attribué',N'En attente de retour') OR attribue_a_id IS NOT NULL));
EXEC(N'CREATE UNIQUE INDEX UX_Unites_NumeroSerie ON dbo.UnitesEquipement(numero_serie) WHERE numero_serie IS NOT NULL;');
DECLARE @e int,@n int,@q int;
DECLARE migration_unites CURSOR LOCAL FAST_FORWARD FOR SELECT id,quantite FROM dbo.Equipements ORDER BY id;
OPEN migration_unites; FETCH NEXT FROM migration_unites INTO @e,@q;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @n=1;
 WHILE @n<=@q
 BEGIN
  EXEC sys.sp_executesql N'INSERT INTO dbo.UnitesEquipement(equipement_id,modele_id,code_interne,numero_serie,description,etat,prix,emplacement_id,seuil_minimum,ajoute_par_id,valide_par_id,date_ajout,date_validation,date_achat,fin_garantie,image,attribue_a_id,date_attribution)
  SELECT e.id,m.id,N''TS-U-''+CONVERT(nvarchar(20),e.id)+N''-''+CONVERT(nvarchar(20),@n),
   CASE WHEN @n=1 THEN NULLIF(LTRIM(RTRIM(e.numero_serie)),N'''') ELSE NULL END,e.description,
   CASE WHEN e.id=1 THEN N''Disponible'' WHEN e.id=2 AND @n=2 THEN N''Disponible'' ELSE e.etat END,
   e.prix,e.emplacement_id,e.seuil_minimum,e.ajoute_par_id,e.valide_par_id,e.date_ajout,e.date_validation,e.date_achat,e.fin_garantie,e.image,
   CASE WHEN @n=1 THEN e.attribue_a_id ELSE NULL END,CASE WHEN @n=1 THEN e.date_attribution ELSE NULL END
  FROM dbo.Equipements e JOIN dbo.ModelesEquipement m ON m.nom=e.nom AND m.categorie_id=e.categorie_id WHERE e.id=@e;',N'@e int,@n int',@e=@e,@n=@n;
  SET @n+=1;
 END;
 FETCH NEXT FROM migration_unites INTO @e,@q;
END;
CLOSE migration_unites; DEALLOCATE migration_unites;
ALTER TABLE dbo.Mouvements ADD unite_id int NULL REFERENCES dbo.UnitesEquipement(id);
EXEC(N'CREATE INDEX IX_Mouvements_Unite ON dbo.Mouvements(unite_id,id);');
ALTER TABLE dbo.Signalements ADD unite_id int NULL REFERENCES dbo.UnitesEquipement(id),etat_initial_unite nvarchar(50) NULL;
-- Une ancienne demande n'est liée automatiquement que si son origine ne comportait qu'une unité.
EXEC(N'UPDATE s SET unite_id=u.id,etat_initial_unite=s.etat_initial
 FROM dbo.Signalements s JOIN dbo.Equipements e ON e.id=s.equipement_id AND e.quantite=1
 JOIN dbo.UnitesEquipement u ON u.equipement_id=e.id;');
IF EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.Signalements') AND name=N'UX_Signalements_Attente')
 DROP INDEX UX_Signalements_Attente ON dbo.Signalements;
EXEC(N'CREATE UNIQUE INDEX UX_Signalements_Unite_Attente ON dbo.Signalements(unite_id,employe_id,type_signalement) WHERE statut=N''En attente'' AND unite_id IS NOT NULL;');
EXEC(N'CREATE UNIQUE INDEX UX_Signalements_Ancien_Attente ON dbo.Signalements(equipement_id,employe_id,type_signalement) WHERE statut=N''En attente'' AND unite_id IS NULL;');
EXEC(N'CREATE VIEW dbo.EquipementsUnitaires AS SELECT u.id,u.equipement_id AS equipement_origine_id,u.modele_id,m.nom,u.description,u.numero_serie,u.code_interne,m.categorie_id,CONVERT(int,1) AS quantite,u.prix,u.emplacement_id,u.seuil_minimum,u.etat,u.date_achat,u.fin_garantie,u.image,u.ajoute_par_id,u.valide_par_id,u.date_ajout,u.date_validation,u.attribue_a_id,u.date_attribution,u.version_ligne FROM dbo.UnitesEquipement u JOIN dbo.ModelesEquipement m ON m.id=u.modele_id;');
EXEC(N'IF (SELECT COUNT(*) FROM dbo.UnitesEquipement)<>(SELECT SUM(quantite) FROM dbo.Equipements) THROW 51004,N''Total incohérent : migration annulée.'',1;');
-- Ne pas valider si une valeur historique a changé.
IF @equip_avant<>HASHBYTES('SHA2_256',(SELECT * FROM dbo.Equipements ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES))
 THROW 51005,N'Les fiches historiques ont changé : annulation.',1;
IF @mouv_avant<>HASHBYTES('SHA2_256',(SELECT id,type_mouvement,date_mouvement,note,equipement_id,utilisateur_id FROM dbo.Mouvements ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES))
 THROW 51006,N'Les mouvements historiques ont changé : annulation.',1;
IF @sign_avant<>HASHBYTES('SHA2_256',(SELECT id,equipement_id,employe_id,type_signalement,description,etat_initial,date_signalement,statut,commentaire,traite_par_id,date_decision FROM dbo.Signalements ORDER BY id FOR JSON PATH,INCLUDE_NULL_VALUES))
 THROW 51007,N'Les signalements historiques ont changé : annulation.',1;
COMMIT;
END TRY
BEGIN CATCH
 IF XACT_STATE()<>0 ROLLBACK TRANSACTION;
 THROW;
END CATCH;
EXEC(N'SELECT m.nom,u.etat,COUNT(*) AS quantite FROM dbo.UnitesEquipement u JOIN dbo.ModelesEquipement m ON m.id=u.modele_id GROUP BY m.nom,u.etat ORDER BY m.nom,u.etat;');
SELECT N'Migration principale autorisée : Les anciennes fiches et tous les anciens mouvements sont conservés.' AS resultat;
