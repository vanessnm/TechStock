USE [master];
SET NOCOUNT ON;
SET XACT_ABORT ON;
-- À exécuter dans SSMS avec un compte administrateur SQL Server.
-- Ne pas utiliser TechStock pendant cette opération pour comparer les décomptes.
-- Aucune migration, suppression ou restauration sur la base principale.
DECLARE @source sysname=N'TechStock';
DECLARE @copie sysname=N'TechStock_RestaurationTest_20261026_204527';
DECLARE @fichier nvarchar(4000)=N'C:\Program Files\Microsoft SQL Server\MSSQL17.MSSQLSERVER\MSSQL\Backup\TechStock_avant_unites_20261026_204527.bak';
DECLARE @data nvarchar(4000)=CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultDataPath'));
DECLARE @log nvarchar(4000)=CONVERT(nvarchar(4000),SERVERPROPERTY('InstanceDefaultLogPath'));
IF DB_ID(@source) IS NULL THROW 50001,N'Base TechStock introuvable.',1;
IF DB_ID(@copie) IS NOT NULL THROW 50002,N'La base de test existe déjà. Ne pas l’écraser ; demander un nouveau nom.',1;
IF @data IS NULL OR @log IS NULL THROW 50003,N'Dossiers SQL de restauration non déterminés.',1;
IF RIGHT(@data,1)<>N'\' SET @data+=N'\';
IF RIGHT(@log,1)<>N'\' SET @log+=N'\';
IF EXISTS(SELECT 1 FROM sys.master_files WHERE database_id=DB_ID(@source) AND type NOT IN(0,1))
 THROW 50004,N'Cette base contient des fichiers nécessitant un plan de restauration spécifique.',1;
IF EXISTS(SELECT 1 FROM sys.dm_os_file_exists(@fichier) WHERE file_exists=1)
 THROW 50006,N'Le fichier de sauvegarde existe déjà. Ne pas le réutiliser ; demander un nouveau nom.',1;
CREATE TABLE #Avant(table_nom sysname PRIMARY KEY,nombre bigint);
INSERT INTO #Avant VALUES
 (N'Categories',(SELECT COUNT_BIG(*) FROM TechStock.dbo.Categories)),
 (N'Emplacements',(SELECT COUNT_BIG(*) FROM TechStock.dbo.Emplacements)),
 (N'Equipements',(SELECT COUNT_BIG(*) FROM TechStock.dbo.Equipements)),
 (N'Mouvements',(SELECT COUNT_BIG(*) FROM TechStock.dbo.Mouvements)),
 (N'Parametres',(SELECT COUNT_BIG(*) FROM TechStock.dbo.Parametres)),
 (N'Signalements',(SELECT COUNT_BIG(*) FROM TechStock.dbo.Signalements)),
 (N'Utilisateurs',(SELECT COUNT_BIG(*) FROM TechStock.dbo.Utilisateurs));
BACKUP DATABASE @source TO DISK=@fichier WITH COPY_ONLY,CHECKSUM,NOFORMAT,NOINIT,STATS=10;
RESTORE VERIFYONLY FROM DISK=@fichier WITH CHECKSUM;
RESTORE HEADERONLY FROM DISK=@fichier;
-- Un fichier neuf est requis : le jeu attendu est le premier de ce fichier daté.
-- Ne jamais réutiliser ce nom de fichier pour une autre sauvegarde.
DECLARE @moves nvarchar(max)=N'',@logical sysname,@type int,@id int;
DECLARE fichiers CURSOR LOCAL FAST_FORWARD FOR
 SELECT name,type,file_id FROM sys.master_files WHERE database_id=DB_ID(@source) ORDER BY file_id;
OPEN fichiers;
FETCH NEXT FROM fichiers INTO @logical,@type,@id;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @moves+=N', MOVE N'''+REPLACE(@logical,N'''',N'''''')+N''' TO N'''+
  REPLACE(CASE WHEN @type=1 THEN @log ELSE @data END+@copie+N'_'+CONVERT(nvarchar(10),@id)+CASE WHEN @type=1 THEN N'.ldf' ELSE N'.mdf' END,N'''',N'''''')+N'''';
 FETCH NEXT FROM fichiers INTO @logical,@type,@id;
END;
CLOSE fichiers;
DEALLOCATE fichiers;
DECLARE @commande nvarchar(max)=N'RESTORE DATABASE '+QUOTENAME(@copie)+N' FROM DISK=N'''+REPLACE(@fichier,N'''',N'''''')+N''' WITH FILE=1,RECOVERY,CHECKSUM'+@moves+N',STATS=10;';
EXEC sp_executesql @commande;
SET @commande=N'DBCC CHECKDB ('+QUOTENAME(@copie)+N') WITH NO_INFOMSGS,ALL_ERRORMSGS;';
EXEC sp_executesql @commande;
CREATE TABLE #Apres(table_nom sysname PRIMARY KEY,nombre bigint);
DECLARE @table sysname;
DECLARE tables_verif CURSOR LOCAL FAST_FORWARD FOR SELECT table_nom FROM #Avant;
OPEN tables_verif;
FETCH NEXT FROM tables_verif INTO @table;
WHILE @@FETCH_STATUS=0
BEGIN
 SET @commande=N'INSERT INTO #Apres SELECT N'''+@table+N''',COUNT_BIG(*) FROM '+QUOTENAME(@copie)+N'.dbo.'+QUOTENAME(@table)+N';';
 EXEC sp_executesql @commande;
 FETCH NEXT FROM tables_verif INTO @table;
END;
CLOSE tables_verif;
DEALLOCATE tables_verif;
SELECT a.table_nom,a.nombre AS lignes_avant_sauvegarde,b.nombre AS lignes_restaurees,
 CASE WHEN a.nombre=b.nombre THEN N'OK' ELSE N'ÉCART À EXAMINER' END AS resultat
 FROM #Avant a JOIN #Apres b ON a.table_nom=b.table_nom ORDER BY a.table_nom;
IF EXISTS(SELECT 1 FROM #Avant a JOIN #Apres b ON a.table_nom=b.table_nom WHERE a.nombre<>b.nombre)
 THROW 50005,N'Écart de décomptes : ne pas migrer. Vérifier une éventuelle activité durant la sauvegarde.',1;
SELECT @fichier AS sauvegarde_sql,@copie AS base_restauree;
PRINT N'Opération terminée. Vérifier les messages de RESTORE VERIFYONLY et DBCC CHECKDB avant de déclarer la sauvegarde validée.';

