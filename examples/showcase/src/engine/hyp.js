// hyp.js — LA RACINE RAPIDE (lot 199, dette perf « le banc est de plus en plus long ») :
// Math.hypot mesuré 4,4× plus lent en V8 que sqrt(a²+b²) sur les 412 sites du moteur — le
// même nombre à ~1 ulp près (le monde re-daté au calibre : bande A/B graines fraîches + banc
// complet font foi). L'arité 3 couvre les sites 3D ; aucun import : le socle sous tous.
// …ET L'ARITÉ EST VARIADIQUE (206, le gros problème à l'écran : le sed 199 a remplacé des
// Math.hypot(...q) de QUATERNIONS — 4 composantes, animkit/gesture-layer/kit — dont hyp(a,b,c)
// ignorait la 4e : normes fausses, rotations corrompues, rendu NOIR déployé. Le chemin 2-3
// args reste la racine crue au bit ; l'au-delà retombe sur le variadique vrai.
export const hyp = (a, b, c, ...r) => r.length ? Math.hypot(a, b, c, ...r) : c === undefined ? Math.sqrt(a * a + b * b) : Math.sqrt(a * a + b * b + c * c);
