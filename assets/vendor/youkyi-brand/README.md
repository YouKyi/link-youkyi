# youkyi · identité officielle

Copie locale de `youkyi-brand` v2.1.1 : design system 2.0.2, logos scellés de `brand/`, polices WOFF2 et trois pictogrammes Lucide. Les fichiers source restent intacts ; les adaptations de mise en page sont dans `src/input.css`.

À la demande d'Alexandre, les styles locaux restaurent la police système d'origine de `link` (pile sans-serif par défaut de Tailwind), ainsi que le chevron « › » des cartes standard.

Entrée CSS : `styles.css`, importée par `src/input.css` et regroupée au build pour éviter la cascade de requêtes CSS. `postcss.config.cjs` conserve les URL locales des fontes, sans modifier les fichiers du kit. Les liens utilisent les classes glassmorph de `src/input.css`, pas les composants mats du kit. Les logos des réseaux sociaux restent ceux de `data/networks.mjs`, avec leurs couleurs.

Alexandre a explicitement demandé de garder le glassmorphism et d'ajouter un peu d'orange dans les accents et le décor 3D, après avoir rejeté les surfaces mates et le bouton orange plein. Cette décision s'applique aux deux pages : verre, transparence et reflets conservés ; orange limité au contact, au focus et à quelques rampes lumineuses. Les logos scellés sont conservés.
