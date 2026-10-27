USE [TechStock];
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.Signalements',N'U') IS NULL
 THROW 50001, 'La table Signalements doit être créée avant cette migration.', 1;
DECLARE @sql nvarchar(max)=N'';
SELECT @sql=@sql+N'ALTER TABLE dbo.Signalements DROP CONSTRAINT '+QUOTENAME(name)+N';'
FROM sys.check_constraints
WHERE parent_object_id=OBJECT_ID(N'dbo.Signalements') AND definition LIKE N'%type_signalement%';
EXEC sp_executesql @sql;
ALTER TABLE dbo.Signalements WITH CHECK ADD CONSTRAINT CK_Signalements_Type
 CHECK(type_signalement IN (N'Perdu / Volé',N'À remplacer / Hors service',N'En réparation'));
COMMIT TRANSACTION;
