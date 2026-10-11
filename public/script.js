const formConnexion = document.getElementById('formConnexion');
const messageConnexion = document.getElementById('messageConnexion');

formConnexion.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const motDePasse = document.getElementById('motDePasse').value;

    const reponse = await fetch('/api/connexion', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: email,
            mot_de_passe: motDePasse
        })
    });

    const donnees = await reponse.json();

    if (reponse.ok) {
        messageConnexion.textContent = 'Connexion réussie';
        verifierSession();
    } else {
        messageConnexion.textContent = donnees.erreur;
    }
});

const btnDeconnexion = document.getElementById('btnDeconnexion');

btnDeconnexion.addEventListener('click', async () => {
    const reponse = await fetch('/api/deconnexion', {
        method: 'POST'
    });

    const donnees = await reponse.json();

   if (reponse.ok) {
    document.getElementById('email').value = '';
    document.getElementById('motDePasse').value = '';

    messageConnexion.textContent = donnees.message;
    verifierSession();
}
});

async function verifierSession() {
    const reponse = await fetch('/api/session');
    const donnees = await reponse.json();

    const connecte = Boolean(donnees.utilisateur);

    document.getElementById('sectionConnexion').style.display =
        connecte ? 'none' : 'block';

    const sectionInventaire = document.getElementById('sectionInventaire');

    sectionInventaire.hidden = !connecte;

    if (connecte) {
        await chargerInventaire();
    } else {
        document.getElementById('listeEquipements').replaceChildren();
        document.getElementById('messageInventaire').textContent = '';
    }
}

async function chargerInventaire() {
    const sectionInventaire = document.getElementById('sectionInventaire');
    const listeEquipements = document.getElementById('listeEquipements');
    const messageInventaire = document.getElementById('messageInventaire');

    try {
        const reponse = await fetch('/api/equipements');

        if (!reponse.ok) {
            throw new Error('Impossible de récupérer les équipements');
        }

        const equipements = await reponse.json();

        listeEquipements.replaceChildren();
        messageInventaire.textContent = '';

        equipements.forEach(equipement => {
            const ligne = document.createElement('tr');

            [
                equipement.nom,
                equipement.categorie,
                equipement.etat,
                equipement.emplacement
            ].forEach(valeur => {
                const cellule = document.createElement('td');
                cellule.textContent = valeur ?? '';
                ligne.appendChild(cellule);
            });

            listeEquipements.appendChild(ligne);
        });

        sectionInventaire.hidden = false;

    } catch (erreur) {
        messageInventaire.textContent = erreur.message;
    }
}

verifierSession();
