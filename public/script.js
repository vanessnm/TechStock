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

    console.log(donnees);

    document.getElementById('sectionConnexion').style.display =
    donnees.utilisateur ? 'none' : 'block';
}

verifierSession();