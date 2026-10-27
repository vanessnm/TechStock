# TechStock
Application web de gestion d'inventaire informatique

# TechStock

**Application web de gestion d'inventaire informatique**

Projet de fin d'études en développement d'applications web — 2026.

## Présentation du projet

**TechStock** est une application web de gestion d'inventaire informatique développée pour faciliter l'organisation, le suivi et l'administration des équipements informatiques au sein d'une organisation.

L'application permet de centraliser les informations sur les équipements, de suivre leur disponibilité, de gérer les attributions aux utilisateurs et de conserver un historique des opérations.

TechStock propose une interface moderne et intuitive, avec un tableau de bord permettant de consulter rapidement les principales informations de l'inventaire.

## Fonctionnalités principales

- **Tableau de bord** : visualisation des indicateurs et de la répartition des équipements.
- **Gestion de l'inventaire** : ajout, consultation et modification des équipements.
- **Gestion des quantités** : regroupement des équipements par modèle et par statut.
- **Numéros de série** : identification des unités physiques individuelles.
- **Attribution des équipements** : suivi du matériel attribué aux utilisateurs.
- **Gestion des retours** : suivi des équipements retournés.
- **Suivi des réparations** : gestion des équipements nécessitant une intervention.
- **Gestion des catégories** : classement des équipements informatiques.
- **Gestion des emplacements** : organisation du matériel selon son emplacement.
- **Gestion des utilisateurs** : administration des comptes et des permissions.
- **Notifications** : signalement des événements nécessitant une attention.
- **Historique des opérations** : traçabilité des actions effectuées.
- **Rapports** : consultation des informations liées à l'inventaire.

Certaines fonctionnalités d'analyse avancée sont prévues pour de futures versions.

## Technologies utilisées

| Technologie | Utilisation |
|---|---|
| HTML5 | Structure des interfaces |
| CSS3 | Mise en page et design |
| JavaScript | Interactivité et logique de l'application |
| Node.js | Environnement d'exécution côté serveur |
| Express.js | Gestion du serveur web et des routes |
| Microsoft SQL Server | Stockage et gestion des données |
| Git et GitHub | Gestion des versions et hébergement du code |

## Aperçu de l'application

### 1. Tableau de bord

Le tableau de bord présente une vue d'ensemble de l'inventaire, des indicateurs principaux et de la répartition des équipements selon leur statut.

![Tableau de bord TechStock](docs/images/Capture%20d%E2%80%99%C3%A9cran%20%28297%29.png)

### 2. Gestion de l'inventaire

Cette interface permet de consulter les équipements informatiques, leurs quantités et leurs différents statuts.

![Inventaire TechStock](docs/images/Capture%20d%E2%80%99%C3%A9cran%20%28298%29.png)

### 3. Ajout d'un équipement

Le formulaire d'ajout permet d'enregistrer de nouveaux équipements dans l'inventaire et de renseigner leurs informations.

![Ajout d'équipement TechStock](docs/images/Capture%20d%E2%80%99%C3%A9cran%20%28299%29.png)

### 4. Gestion des catégories

Les catégories facilitent le classement et l'organisation du matériel informatique.

![Catégories TechStock](docs/images/Capture%20d%E2%80%99%C3%A9cran%20%28300%29.png)

### 5. Gestion des utilisateurs

L'interface d'administration permet de gérer les comptes utilisateurs et leurs autorisations d'accès.

![Utilisateurs TechStock](docs/images/Capture%20d%E2%80%99%C3%A9cran%20%28301%29.png)

### 6. Gestion des emplacements

Cette section permet d'organiser les équipements selon leur emplacement physique.

![Emplacements TechStock](docs/images/Capture%20d%E2%80%99%C3%A9cran%20%28302%29.png)

### 7. Rapports

La section des rapports permet de consulter les informations liées au suivi et à la gestion de l'inventaire informatique.

![Rapports TechStock](docs/images/Capture%20d%E2%80%99%C3%A9cran%20%28303%29.png)

## Architecture de l'application

TechStock repose sur une architecture web comprenant trois composantes principales :

- **Interface utilisateur** : développée avec HTML, CSS et JavaScript.
- **Serveur applicatif** : développé avec Node.js et Express.js.
- **Base de données** : Microsoft SQL Server, utilisée pour conserver les informations sur les équipements, les utilisateurs et les opérations.

Cette séparation facilite l'organisation du code et la maintenance de l'application.

## Installation et configuration

### Prérequis

- Node.js et npm
- Microsoft SQL Server
- Une base de données SQL Server configurée pour TechStock

### Récupération du projet

Cloner le dépôt GitHub :

```bash
git clone https://github.com/vanessnm/TechStock.git
```

Accéder au répertoire du projet :

```bash
cd TechStock
```

Installer les dépendances :

```bash
npm install
```

### Configuration de la base de données

Configurer la connexion à Microsoft SQL Server selon les paramètres attendus par l'application.

Les scripts SQL fournis dans le projet doivent être examinés et exécutés dans l'ordre approprié, selon l'état de la base de données.

### Démarrage

Une fois la base de données configurée, démarrer le serveur avec la commande prévue dans le fichier `package.json`.

L'application peut ensuite être consultée dans un navigateur à l'adresse locale configurée.

## Objectifs pédagogiques

Ce projet de fin d'études a permis de mettre en pratique plusieurs compétences en développement d'applications web :

- Conception d'une interface utilisateur.
- Développement frontend et backend.
- Gestion d'une base de données relationnelle.
- Manipulation et validation des données.
- Gestion des utilisateurs et des autorisations.
- Organisation et maintenance du code.
- Utilisation de Git et GitHub pour le versionnement.
- Vérification et amélioration du fonctionnement d'une application.

## Évolutions futures

TechStock pourrait évoluer avec l'ajout de fonctionnalités supplémentaires, notamment :

- Analyse avancée des données d'inventaire.
- Amélioration des rapports et des statistiques.
- Fonctionnalités d'assistance intelligente.
- Optimisations supplémentaires de l'expérience utilisateur.

## Développement

**Vanessa Noël-Marchand**

Projet de fin d'études en développement d'applications web — 2026.

---

*TechStock — Une solution pour organiser, suivre et gérer les équipements informatiques.*
