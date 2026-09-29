const formConnexion = document.getElementById('formConnexion');

formConnexion.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document.getElementById('email').value;
    const motDePasse = document.getElementById('motDePasse').value;

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
    } else {
        messageConnexion.textContent = donnees.erreur;
    }
});
});

