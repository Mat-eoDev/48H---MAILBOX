# Morpius

## Message intercepté

Tu as trouvé la pièce jointe.

Ce n'est pas un jeu pour passer le temps.
C'est un test.

Tu es coincé dans une session compromise, tu cherches à remonter jusqu'au code qui te permettra de stopper ce que j'ai lancé sur cette machine, et moi je décide du rythme.
Chaque épreuve que je t'envoie doit être résolue avant que je t'accorde la suite.

Morpius est l'une de ces épreuves.
Un faux petit morpion, simple en apparence, assez sale en pratique.
Tu veux gagner vite.
Le plateau préfère te corriger.

Si tu réussis, je t'enverrai un nouveau message.
Si tu échoues, tu recommenceras jusqu'à comprendre où se trouve vraiment le piège.

## Ce que Morpius cherche à provoquer

Morpius est conçu pour produire une sensation très précise :
- tu crois avoir trouvé le bon coup
- le plateau dérape juste assez pour t'enlever la récompense
- tu perds du progrès
- tu relances immédiatement

Le jeu n'est pas censé être impossible.
Il est censé être mauvais pour les nerfs.

## Lecture narrative du jeu

Dans Morpius, rien n'est totalement stable.
Tu poses un pion, mais le plateau garde le dernier mot.
Une victoire te fait avancer.
Une défaite peut t'effacer une partie du chemin.

Le mensonge de départ fait partie de l'expérience.
Le jeu te laisse croire qu'une seule victoire suffit.
Puis il te montre sa vraie règle au moment le plus agaçant possible.

Et si tu t'acharnes assez longtemps sans y arriver, même le système finit par admettre que tu n'y arriveras pas proprement.
À ce moment-là, il t'accorde une version facilitée pour te laisser atteindre la suite malgré tout.

## Boucle de progression

- Le joueur commence par croire qu'une seule victoire suffit.
- La première victoire révèle que l'épreuve en demande en réalité trois.
- Les défaites contre l'IA remettent normalement la progression à zéro.
- Après assez de progression perdue, le mode facile s'active.
- Une fois ce mode actif, les victoires sont sauvegardées et une seule victoire suffit pour conclure Morpius.

## Lancer le jeu

1. Ouvrir [index.html](C:\Users\geoff\Documents\GitHub\48H---MAILBOX\Morpius\index.html) dans un navigateur.
2. Jouer immédiatement, sans installation ni dépendance.

## Règles du jeu

Tu joues `X`.
L'IA joue `O`.

Le plateau est une grille `3x3`.

Quand un pion est posé :
- il peut ne rien se passer
- il peut glisser d'une case en haut, en bas, à gauche ou à droite
- s'il rencontre une autre pièce, il peut la pousser dans la même direction
- la poussée peut provoquer une chaîne domino
- s'il sort de la grille, le pion disparaît et le tour est quand même consommé
- côté joueur, un flip rare peut retourner le pion posé en symbole adverse

Une victoire n'est vérifiée qu'après stabilisation complète du plateau.

## Réglages et logique

Dans [script.js](C:\Users\geoff\Documents\GitHub\48H---MAILBOX\Morpius\script.js), on peut ajuster rapidement :
- les probabilités de modification du coup
- le ratio déplacement / flip côté joueur
- les délais d'animation et d'enchaînement
- les textes de popup et de statut
- le seuil d'activation du mode facile

## Stack et fichiers

- [index.html](C:\Users\geoff\Documents\GitHub\48H---MAILBOX\Morpius\index.html) : structure du jeu
- [style.css](C:\Users\geoff\Documents\GitHub\48H---MAILBOX\Morpius\style.css) : interface, responsive, animations
- [script.js](C:\Users\geoff\Documents\GitHub\48H---MAILBOX\Morpius\script.js) : moteur, IA, progression, popups

Stack utilisée :
- HTML
- CSS
- JavaScript vanilla

## Intention de design

Morpius doit ressembler à une pièce jointe propre, lisible, presque sérieuse.
Le fond et l'interface doivent inspirer une communication piégée.
Le gameplay, lui, doit rester mesquin, instable et légèrement malhonnête.
