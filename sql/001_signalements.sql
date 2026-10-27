IF OBJECT_ID(N'dbo.Signalements', N'U') IS NULL
BEGIN
 CREATE TABLE dbo.Signalements (
  id int IDENTITY PRIMARY KEY,
  equipement_id int NOT NULL REFERENCES dbo.Equipements(id),
  employe_id int NOT NULL REFERENCES dbo.Utilisateurs(id),
  type_signalement nvarchar(50) NOT NULL CHECK(type_signalement IN (N'Perdu / Volé',N'À remplacer / Hors service')),
  description nvarchar(500) NOT NULL CHECK(LEN(LTRIM(RTRIM(description))) > 0),
  etat_initial nvarchar(50) NOT NULL,
  date_signalement datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
  statut nvarchar(20) NOT NULL DEFAULT N'En attente' CHECK(statut IN (N'En attente',N'Acceptée',N'Refusée')),
  commentaire nvarchar(500) NULL,
  traite_par_id int NULL REFERENCES dbo.Utilisateurs(id),
  date_decision datetime2 NULL,
  CONSTRAINT CK_Signalements_Decision CHECK (
   (statut=N'En attente' AND traite_par_id IS NULL AND date_decision IS NULL) OR
   (statut IN (N'Acceptée',N'Refusée') AND traite_par_id IS NOT NULL AND date_decision IS NOT NULL AND traite_par_id<>employe_id)),
  CONSTRAINT CK_Signalements_Refus CHECK(statut<>N'Refusée' OR (commentaire IS NOT NULL AND LEN(LTRIM(RTRIM(commentaire)))>0))
 );
 CREATE UNIQUE INDEX UX_Signalements_Attente ON dbo.Signalements(equipement_id,employe_id,type_signalement) WHERE statut=N'En attente';
END;
