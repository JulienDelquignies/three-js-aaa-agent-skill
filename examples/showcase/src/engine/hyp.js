// hyp.js — LA RACINE RAPIDE (lot 199, dette perf « le banc est de plus en plus long ») :
// Math.hypot mesuré 4,4× plus lent en V8 que sqrt(a²+b²) sur les 412 sites du moteur — le
// même nombre à ~1 ulp près (le monde re-daté au calibre : bande A/B graines fraîches + banc
// complet font foi). L'arité 3 couvre les sites 3D ; aucun import : le socle sous tous.
export const hyp = (a, b, c) => c === undefined ? Math.sqrt(a * a + b * b) : Math.sqrt(a * a + b * b + c * c);
