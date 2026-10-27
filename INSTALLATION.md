## Scripts anciens et migration

Le script sql/migrations/003_unites_20261027.sql correspond à la migration du stock historique (NVIDIA et AMD). Il refuse les états incompatibles ou déjà migrés.

Ce script est conservé à titre historique et ne doit pas être exécuté pour une nouvelle installation. Pour installer TechStock sur une base vide, utiliser uniquement sql/000_installation_neuve.sql.
