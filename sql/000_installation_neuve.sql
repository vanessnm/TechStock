-- Installation neuve uniquement : refuse de modifier une base contenant déjà TechStock.
USE [master];
IF DB_ID(N'TechStock') IS NULL EXEC(N'CREATE DATABASE [TechStock]');
GO
USE [TechStock];
SET NOCOUNT ON; SET XACT_ABORT ON; SET ANSI_NULLS ON; SET QUOTED_IDENTIFIER ON; SET ANSI_PADDING ON; SET ANSI_WARNINGS ON; SET ARITHABORT ON; SET CONCAT_NULL_YIELDS_NULL ON; SET NUMERIC_ROUNDABORT OFF;
IF EXISTS(SELECT 1 FROM sys.tables WHERE name IN(N'Categories',N'Emplacements',N'Utilisateurs',N'Equipements',N'Mouvements',N'Parametres',N'Signalements',N'UnitesEquipement',N'ModelesEquipement')) THROW 51000,N'Installation annulée : données ou schéma existants. Ne pas utiliser sur une base déjà installée.',1;
BEGIN TRY
BEGIN TRANSACTION;
CREATE TABLE dbo.[Categories](
 [id] int IDENTITY(1,1) PRIMARY KEY NOT NULL,
 [nom] nvarchar(100) NOT NULL,
 UNIQUE(nom)
);
CREATE TABLE dbo.[Emplacements](
 [id] int IDENTITY(1,1) PRIMARY KEY NOT NULL,
 [nom] nvarchar(100) NOT NULL,
 [actif] bit NOT NULL DEFAULT 1,
 UNIQUE(nom)
);
CREATE TABLE dbo.[Utilisateurs](
 [id] int IDENTITY(1,1) PRIMARY KEY NOT NULL,
 [nom] nvarchar(150) NOT NULL,
 [email] nvarchar(255) NOT NULL,
 [mot_de_passe] nvarchar(255) NOT NULL,
 [role] nvarchar(20) NOT NULL,
 [actif] bit NOT NULL DEFAULT 1,
 UNIQUE(email),
 CHECK(role IN(N'Administrateur',N'Employé'))
);
CREATE TABLE dbo.[Equipements](
 [id] int IDENTITY(1,1) PRIMARY KEY NOT NULL,
 [nom] nvarchar(150) NOT NULL,
 [description] nvarchar(500) NULL,
 [numero_serie] nvarchar(100) NULL,
 [categorie_id] int NOT NULL,
 [quantite] int NOT NULL DEFAULT 1,
 [prix] decimal(10,2) NULL DEFAULT 0,
 [etat] nvarchar(50) NOT NULL DEFAULT N'Disponible',
 [date_achat] date NULL,
 [fin_garantie] date NULL,
 [seuil_minimum] int NOT NULL DEFAULT 0,
 [image] nvarchar(255) NULL,
 [emplacement_id] int NOT NULL,
 [ajoute_par_id] int NULL,
 [valide_par_id] int NULL,
 [date_ajout] datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
 [date_validation] datetime2(7) NULL,
 [attribue_a_id] int NULL,
 [date_attribution] datetime2(7) NULL,
 FOREIGN KEY([categorie_id]) REFERENCES dbo.[Categories](id),
 FOREIGN KEY([emplacement_id]) REFERENCES dbo.[Emplacements](id),
 FOREIGN KEY([ajoute_par_id]) REFERENCES dbo.[Utilisateurs](id),
 FOREIGN KEY([valide_par_id]) REFERENCES dbo.[Utilisateurs](id),
 FOREIGN KEY([attribue_a_id]) REFERENCES dbo.[Utilisateurs](id)
);
CREATE TABLE dbo.[Mouvements](
 [id] int IDENTITY(1,1) PRIMARY KEY NOT NULL,
 [type_mouvement] nvarchar(100) NOT NULL,
 [date_mouvement] datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
 [note] nvarchar(500) NULL,
 [equipement_id] int NOT NULL,
 [utilisateur_id] int NOT NULL,
 FOREIGN KEY([equipement_id]) REFERENCES dbo.[Equipements](id),
 FOREIGN KEY([utilisateur_id]) REFERENCES dbo.[Utilisateurs](id)
);
CREATE TABLE dbo.[Parametres](
 [id] int IDENTITY(1,1) PRIMARY KEY NOT NULL,
 [cle] nvarchar(100) NOT NULL,
 [valeur] nvarchar(255) NOT NULL,
 [description] nvarchar(500) NULL,
 UNIQUE(cle)
);
CREATE TABLE dbo.[Signalements](
 [id] int IDENTITY(1,1) PRIMARY KEY NOT NULL,
 [equipement_id] int NOT NULL,
 [employe_id] int NOT NULL,
 [type_signalement] nvarchar(50) NOT NULL,
 [description] nvarchar(500) NOT NULL,
 [etat_initial] nvarchar(50) NOT NULL,
 [date_signalement] datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
 [statut] nvarchar(20) NOT NULL DEFAULT N'En attente',
 [commentaire] nvarchar(500) NULL,
 [traite_par_id] int NULL,
 [date_decision] datetime2(7) NULL,
 FOREIGN KEY([equipement_id]) REFERENCES dbo.[Equipements](id),
 FOREIGN KEY([employe_id]) REFERENCES dbo.[Utilisateurs](id),
 FOREIGN KEY([traite_par_id]) REFERENCES dbo.[Utilisateurs](id)
);
ALTER TABLE Signalements ADD CHECK(type_signalement IN(N'Perdu / Volé',N'À remplacer / Hors service',N'En réparation')),CHECK(LEN(LTRIM(RTRIM(description)))>0),CHECK(statut IN(N'En attente',N'Acceptée',N'Refusée')),CHECK((statut=N'En attente' AND traite_par_id IS NULL AND date_decision IS NULL) OR (statut IN(N'Acceptée',N'Refusée') AND traite_par_id IS NOT NULL AND date_decision IS NOT NULL AND traite_par_id<>employe_id)),CHECK(statut<>N'Refusée' OR (commentaire IS NOT NULL AND LEN(LTRIM(RTRIM(commentaire)))>0));
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

INSERT INTO Categories(nom) VALUES(N'Cartes graphiques'),(N'Autres'),(N'Processeurs'),(N'Stockage');
INSERT INTO Emplacements(nom,actif) VALUES(N'Entrepôt A',1),(N'Entrepôt B',1);
IF SUSER_ID(N'techstock_user') IS NOT NULL BEGIN IF USER_ID(N'techstock_user') IS NULL CREATE USER [techstock_user] FOR LOGIN [techstock_user]; ALTER ROLE db_datareader ADD MEMBER [techstock_user]; ALTER ROLE db_datawriter ADD MEMBER [techstock_user]; END;
COMMIT;
END TRY BEGIN CATCH IF XACT_STATE()<>0 ROLLBACK; THROW; END CATCH;
SELECT N'Installation neuve terminée. Créer le premier administrateur avec npm run init-admin.' AS resultat;
