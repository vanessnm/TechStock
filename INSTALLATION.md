# Installer et démarrer TechStock

Le README et ses sept captures sont conservés tels que publiés. Ce guide précise les commandes de la livraison du 27 octobre 2026.

## Prérequis

Node.js 20 ou ultérieur avec npm ; SQL Server 2017 ou ultérieur ; SSMS ; connexion SQL Server accessible à Node.js (TCP activé). Le projet utilise une authentification SQL Server, pas une connexion Windows intégrée.

## Nouvelle installation (base vide)

1. Dans SSMS, avec le compte administrateur SQL, créer un login SQL nommé techstock_user et choisir son propre mot de passe. Ne pas attribuer le rôle serveur sysadmin à ce compte applicatif.
2. Ouvrir et exécuter uniquement sql/000_installation_neuve.sql. Il crée TechStock si elle n’existe pas, refuse une base contenant déjà les tables du projet, installe le schéma unitaire, quatre catégories et deux emplacements. Il ne crée aucun équipement fictif ni utilisateur. Le login techstock_user reçoit les rôles db_datareader et db_datawriter sur cette base seulement.
3. Dans le dossier du projet, exécuter npm ci. Copier .env.example vers .env et renseigner le mot de passe SQL et un secret de session aléatoire. Garder DB_DATABASE=TechStock et PORT=3000.
4. Exécuter npm run init-admin pour créer le premier administrateur. Choisir son nom, son courriel et un mot de passe d’au moins 12 caractères. Le script refuse de remplacer un administrateur existant. Le mot de passe est haché avec bcrypt.
5. Exécuter npm run check, puis npm start. Ouvrir http://localhost:3000 et se connecter avec ce compte.
6. Ajouter les employés depuis Utilisateurs, puis les équipements depuis Ajouter un équipement. Une quantité supérieure à 1 crée des unités distinctes ; les séries inconnues restent vides, avec identifiants internes uniques. L’inventaire les regroupe par modèle et statut. Le formulaire peut charger les référentiels même si aucun équipement n’existe encore.

## Base déjà migrée (ordinateur de Vanessa)

Ne réexécuter aucun script d’installation. Les comptes et données existants sont conservés. Utiliser npm run check puis npm start avec le .env local. Une erreur Installation annulée : données ou schéma existants est une protection, pas une raison de supprimer la base.

## Scripts anciens et migration

Les fichiers 01_sauvegarder_et_restaurer_copie.sql, 003_unites_base_test_uniquement.sql, sql/001_signalements.sql et sql/002_signalements_reparation.sql documentent les étapes historiques : ne pas les enchaîner pour une nouvelle installation. sql/migrations/003_unites_20261027.sql correspond à la migration autorisée du stock historique (NVIDIA et AMD) ; il refuse les états incompatibles ou déjà migrés. Il ne remplace pas le script d’installation neuve.

## Commandes

- npm ci : installation des dépendances verrouillées.
- npm run init-admin : premier compte administrateur sur une installation neuve.
- npm run check (ou npm test) : contrôle sans écriture des fichiers JavaScript et du schéma SQL connecté. Ce contrôle ne remplace pas les tests fonctionnels.
- npm start : serveur sur le port configuré (3000 par défaut).

La copie de test sur le port 3001 est indépendante ; elle n’est pas nécessaire au démarrage de cette livraison. .env, mots de passe et fichiers de sauvegarde .bak restent privés et ne doivent pas être publiés. Les essais fonctionnels de migration ont été réalisés sur une restauration fraîche et dans des transactions annulées pour préserver les données.
