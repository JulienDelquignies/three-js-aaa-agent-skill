# coiffures-rocketbox.py — LES VOLUMES DE COUPE des têtes Rocketbox (lot L5, EX-26 : l'apparence) : mi-long, chignon, boucles, iroquois,
# modélisés par script sur le crâne de la tête A (le n° 18 ; le n° 10 a le même squelette, les mêmes matrices de liaison). LA MÉTHODE EST
# CELLE DE LA CARRIÈRE (foot, scripts/blender/coiffures.py, branche 3d/personnages — ses outils sont repris tels quels plus bas) : la tête
# coiffée d'une épaisseur qui s'amincit jusqu'à la peau à la lisière (une coque remaillée en voxels), retranchée sous une lisière lisse ou en
# pointes, les volumes du style (rideaux, chignon) fondus avec la calotte, les mèches creusées dans le sens des cheveux, leur ombre en
# couleur de sommet, au budget de 3 000 triangles. Ce qui change ici : la peau (le matériau « head » du maillage Rocketbox, sans les yeux ni
# l'intérieur de la bouche), le repère de la tête (les yeux à 1,686 m, mesurés), deux coupes propres à nos joueurs (les boucles courtes,
# l'iroquois : une crête de la lisière du front à la nuque, les côtés rasés par la page), et des pièces exportées dans l'ESPACE DU
# MAILLAGE (mètres, y en haut) : la page les porte dans le repère de l'os de la tête (l'inverse de liaison × la matrice de liaison).
#   ~/opt/blender-4.2.23-linux-x64/blender -b --factory-startup -P tools/coiffures-rocketbox.py -- public/rocketbox/foot-18.glb public/rocketbox [mi_long,chignon,...]
# Deux lots en parallèle (deux processus, deux dossiers), puis : … -P tools/coiffures-rocketbox.py -- --fusion public/rocketbox /tmp/lotA /tmp/lotB
# Sortie : coiffures.glb (une pièce par coupe : « A__mi_long »…) et coiffures.json (les mesures : triangles, sommets devant les yeux).
import bmesh
import bpy
import json
import math
import os
import sys
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

BUDGET_COUPE = 3000
YEUX = 1.686   # la hauteur des yeux de la tête A, mesurée (les îlots des globes oculaires)
COUPES = ['mi_long', 'chignon', 'boucles', 'iroquois']


# ———————————————————————————— les outils de la carrière (foot, scripts/blender/coiffures.py), repris tels quels ————————————————————————————
class Tete:
    """Repère de la tête, mesuré sur la peau : yeux, face, nuque, largeur du crâne."""

    def __init__(self, peau, cils):
        P = [v.co for v in peau.verts]
        if cils:
            self.x0 = (cils[0].x + cils[1].x) / 2
            self.ze = (cils[0].z + cils[1].z) / 2
        else:
            self.x0, self.ze = 0.0, 1.655
        crane = [p for p in P if abs(p.z - (self.ze + 0.04)) < 0.012 and abs(p.x - self.x0) < 0.12]
        self.yf = min(p.y for p in P if abs(p.z - self.ze) < 0.03 and abs(p.x - self.x0) < 0.03)
        self.yb = max(p.y for p in crane)
        self.yav = min(p.y for p in crane)
        self.yc = (self.yav + self.yb) / 2
        self.hx = max(abs(p.x - self.x0) for p in crane)
        self.hy = (self.yb - self.yav) / 2
        self.zt = max(p.z for p in P if abs(p.x - self.x0) < 0.1 and self.yav - 0.02 < p.y < self.yb + 0.02)

    def theta(self, p):
        """0 devant, pi derrière, dans le sens de x."""
        return math.atan2(p.x - self.x0, -(p.y - self.yc))

    def implantation(self, p, bas=0.0, frange=None, dents=0.0):
        """Hauteur de la lisière au-dessus des yeux selon l'angle : front, tempes, oreilles, nuque. Avec dents,
        la lisière descend en pointes de mèches."""
        a = abs(self.theta(p))
        # Nuque arrondie : la lisière descend en douceur derrière l'oreille puis s'aplatit (pas de pointe en V).
        pts = [(0.0, 0.068 if frange is None else frange), (0.9, 0.045), (1.57, 0.03 - bas), (2.2, -0.022 - bas),
               (2.7, -0.052 - bas), (math.pi, -0.06 - bas)]
        h = pts[-1][1]
        for (a0, h0), (a1, h1) in zip(pts, pts[1:]):
            if a <= a1:
                h = lerp(h0, h1, (a - a0) / (a1 - a0))
                break
        return h - dents * pointes(self.theta(p), 14)

    def dans_crane(self, p):
        return (p.x - self.x0) ** 2 / (self.hx + 0.05) ** 2 + (p.y - self.yc) ** 2 / (self.hy + 0.06) ** 2 < 1 and p.z > self.ze - 0.2



def lerp(a, b, t):
    return a + (b - a) * t


def lisse(e0, e1, x):
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def pointes(a, n, graine=0.0):
    """Profil en dents de scie autour du crâne : 1 à la pointe d'une mèche, 0 entre deux, longueurs inégales."""
    x = a / (2 * math.pi) * n + 0.5 + graine
    tri = 1 - abs(2 * (x - math.floor(x)) - 1)
    return tri ** 1.6 * (0.65 + 0.35 * math.sin(math.floor(x) * 2.39 + graine * 7))


def coque(peau, pred, epaisseur, dedans=0.004):
    """Coque fermée sur les faces de peau retenues : dessus à epaisseur(p), dessous juste sous la peau (dedans,
    constant ou fonction du point)."""
    faces = [f for f in peau.faces if all(pred(v.co) for v in f.verts)]
    bm = bmesh.new()
    ext, inte = {}, {}
    for f in faces:
        for v in f.verts:
            if v.index not in ext:
                ext[v.index] = bm.verts.new(v.co + v.normal * epaisseur(v.co))
                inte[v.index] = bm.verts.new(v.co - v.normal * (dedans(v.co) if callable(dedans) else dedans))
    compte = {}
    for f in faces:
        ids = [v.index for v in f.verts]
        bm.faces.new([ext[i] for i in ids])
        bm.faces.new([inte[i] for i in reversed(ids)])
        for a, b in zip(ids, ids[1:] + ids[:1]):
            k = (min(a, b), max(a, b))
            compte[k] = compte.get(k, 0) + 1
    for (a, b), c in compte.items():
        if c == 1:
            bm.faces.new((ext[a], ext[b], inte[b], inte[a]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def ajouter(dst, src):
    me = bpy.data.meshes.new('tmp')
    src.to_mesh(me)
    dst.from_mesh(me)
    bpy.data.meshes.remove(me)


def ellipsoide(bm, centre, rayons, seg=24):
    res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0,
                                    matrix=Matrix.Translation(centre) @ Matrix.Diagonal((*rayons, 1)))
    return res


def queue(bm, a, b, ra, rb, seg=14, n=12, ecart=0.022):
    """Queue de cheval : tube fermé de a vers b qui s'écarte de la nuque puis retombe, et finit en pointe."""
    anneaux = []
    for i in range(n + 1):
        k = i / n
        c = a.lerp(b, k) + Vector((0, ecart * math.sin(math.pi * k * 0.8), 0))
        r = lerp(ra, rb, k ** 0.7) * (1 - 0.45 * lisse(0.85, 1.0, k))
        suite = a.lerp(b, min(1.0, k + 0.05)) + Vector((0, ecart * math.sin(math.pi * min(1.0, k + 0.05) * 0.8), 0))
        axe = (suite - c).normalized() if (suite - c).length > 1e-6 else (b - a).normalized()
        u = axe.orthogonal().normalized()
        v = axe.cross(u)
        anneaux.append([bm.verts.new(c + (u * math.cos(2 * math.pi * j / seg) * 1.15 + v * math.sin(2 * math.pi * j / seg)) * r) for j in range(seg)])
    for i in range(n):
        for j in range(seg):
            bm.faces.new((anneaux[i][j], anneaux[i][(j + 1) % seg], anneaux[i + 1][(j + 1) % seg], anneaux[i + 1][j]))
    bm.faces.new(list(reversed(anneaux[0])))
    bm.faces.new(anneaux[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)


def rayon(t, bvh, a, z, defaut):
    """Distance de l'axe de la tête à la peau, dans la direction de l'angle a, à la hauteur z."""
    o = Vector((t.x0, t.yc, z))
    hit = bvh.ray_cast(o, Vector((math.sin(a), -math.cos(a), 0)), 0.4)[0]
    return (hit - o).length if hit else defaut


def rideau(bm, t, bvh, a0, a1, z0, z1, e0, e1, n=30, m=14, ourlet=0.015, serre=0.2, graine=0.0, avant=None):
    """Chevelure qui tombe entre les angles a0..a1, jusqu'à z0 (hauteur, ou fonction de l'angle) : posée sur
    la peau (joues, nuque), droite sous la mâchoire, épaisse de e1 en haut, affinée à e0 aux pointes, bas en
    mèches pointues. avant : angle du bord côté visage, qui s'affine et recule vers l'oreille en descendant."""
    zref = t.ze - 0.02
    grille = []
    for i in range(n + 1):
        a = lerp(a0, a1, i / n)
        f = 0.0 if avant is None else lisse(0.3, 0.0, abs(a - avant) / abs(a1 - a0))
        rref = rayon(t, bvh, a, zref, t.hx)
        zb = z0(a) if callable(z0) else z0
        bas = zb - ourlet * pointes(a, 2 * math.pi / max(1e-3, a1 - a0) * n / 3, graine)
        ligne = []
        for j in range(m + 1):
            k = j / m
            z = lerp(bas, z1, k)
            aa = a + math.copysign(0.4, a) * f * (1 - k)
            # Sous la joue, la mèche tombe droit (un peu rentrée vers les pointes) au lieu de suivre le cou.
            r = max(rayon(t, bvh, aa, z, rref), rref * (1 - serre * lisse(zref, zb, z))) + 0.002
            # Aminci en haut pour rentrer sous la calotte (sinon rebord), et aux pointes.
            e = lerp(e0, e1, lisse(0.0, 0.45, k)) * lerp(1.0, 0.35, lisse(0.7, 1.0, k)) * lerp(1.0, 0.2, f)
            d = Vector((math.sin(aa), -math.cos(aa), 0))
            c = Vector((t.x0, t.yc, z))
            ligne.append((bm.verts.new(c + d * (r + e)), bm.verts.new(c + d * r)))
        grille.append(ligne)
    for i in range(n):
        for j in range(m):
            (o00, i00), (o01, i01) = grille[i][j], grille[i][j + 1]
            (o10, i10), (o11, i11) = grille[i + 1][j], grille[i + 1][j + 1]
            bm.faces.new((o00, o10, o11, o01))
            bm.faces.new((i00, i01, i11, i10))
    for i in range(n):
        for j in (0, m):
            (oa, ia), (ob, ib) = grille[i][j], grille[i + 1][j]
            bm.faces.new((oa, ob, ib, ia))
    for i in (0, n):
        for j in range(m):
            (oa, ia), (ob, ib) = grille[i][j], grille[i][j + 1]
            bm.faces.new((oa, ob, ib, ia))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)


def sous_lisiere(t, bas, frange, dents=0.0, n=192):
    """Solide qui occupe tout ce qui est sous la lisière (anneau autour de l'axe de la tête) : on le retranche."""
    bm = bmesh.new()
    r1, r2, zb = 0.03, 0.35, t.ze - 0.6
    anneau = []
    for i in range(n):
        a = 2 * math.pi * i / n - math.pi
        h = t.ze + t.implantation(Vector((t.x0 + math.sin(a) * 0.1, t.yc - math.cos(a) * 0.1, 0)), bas, frange, dents)
        anneau.append([bm.verts.new((t.x0 + math.sin(a) * r, t.yc - math.cos(a) * r, z)) for r, z in ((r1, zb), (r2, zb), (r2, h), (r1, h))])
    for i in range(n):
        a, b = anneau[i], anneau[(i + 1) % n]
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def appliquer(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.clear()
    ob.data = me
    return me


def uv_meches(me, t, barbe_=False):
    """Coordonnées de texture dans [0, 1] (la compression les quantifie) : u fait le tour du crâne sur 0..0,45
    (0,9 au plus avec la couture), v compte les mètres depuis 50 cm sous les yeux. Les brins suivent le méridien."""
    uv = me.uv_layers.new(name='UVMap')
    tour = 0.45
    for poly in me.polygons:
        us = []
        for li in poly.loop_indices:
            p = me.vertices[me.loops[li].vertex_index].co
            u = (p.x - t.x0 + 0.5) * 0.5 if barbe_ else (math.atan2(p.x - t.x0, -(p.y - t.yc)) + math.pi) / (2 * math.pi) * tour
            us.append([u, p.z - t.ze + 0.5])
        # Couture derrière la tête : une face à cheval reprend le tour du bon côté.
        if not barbe_ and max(u[0] for u in us) - min(u[0] for u in us) > tour / 2:
            for u in us:
                if u[0] < tour / 2:
                    u[0] += tour
        for li, u in zip(poly.loop_indices, us):
            uv.data[li].uv = u


def objet(nom, bm, mat):
    me = bpy.data.meshes.new(nom)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(nom, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def _h(k, graine):
    return (math.sin(k * 127.1 + graine * 311.7) * 43758.5453) % 1.0


def bruit_tour(a, k, graine=0.0):
    """Bruit lissé autour du crâne, périodique : k cellules sur un tour (a en radians), valeurs dans [0, 1]."""
    x = (a / (2 * math.pi) % 1.0) * k
    i = math.floor(x)
    f = x - i
    return lerp(_h(i % k, graine), _h((i + 1) % k, graine), f * f * (3 - 2 * f))


def bruit_tour_z(a, z, k, pas_z, graine=0.0):
    """Le même bruit, qui change aussi avec la hauteur (une cellule tous les pas_z mètres)."""
    y = z / pas_z
    j = math.floor(y)
    g = y - j
    return lerp(bruit_tour(a, k, graine + j * 7.31), bruit_tour(a, k, graine + (j + 1) * 7.31), g * g * (3 - 2 * g))


def sillons(me, t, amp, n=26):
    """Mèches : sillons le long du sens des cheveux (méridiens), poussés le long des normales, et assombris au
    fond (couleur de sommet) : c'est l'ombre des creux qui dessine les mèches de loin. Espacement et profondeur
    tirés d'un bruit lissé, mèches interrompues le long des cheveux : pas de plis de bonnet de bain. Effacés au
    sommet du crâne, où ils convergent."""
    ombre = me.color_attributes['Col'].data
    for v in me.vertices:
        f = amp(v.co)
        if not f:
            continue
        a, z = t.theta(v.co), v.co.z
        u = a * n / 2 + 2.2 * (bruit_tour(a, 9) - 0.5) + 0.8 * (bruit_tour_z(a, z, 17, 0.05, 1.0) - 0.5)
        f *= (0.35 + 0.65 * bruit_tour_z(a, z, 13, 0.04, 3.0)) * lisse(0.012, 0.05, math.hypot(v.co.x - t.x0, v.co.y - t.yc))
        r = abs(math.sin(u)) ** 0.5
        v.co = v.co + v.normal * (f * (r - 0.6))
        g = lerp(1.0, lerp(0.62, 1.0, r), min(1.0, f / 0.003))
        ombre[v.index].color = (g, g, g, 1.0)


def finir(ob, t, voxel, trous, budget, amp=None, bosses=0.0, grain=0.018, n=26):
    """Remaillage en voxels (un volume propre), dégagement du visage, lissage, mèches, réduction au budget."""
    if voxel:
        r = ob.modifiers.new('fusion', 'REMESH')
        r.mode = 'VOXEL'
        r.voxel_size = voxel
    for i, c in enumerate(trous):
        b = ob.modifiers.new(f'visage{i}', 'BOOLEAN')
        b.operation = 'DIFFERENCE'
        b.solver = 'EXACT'
        b.object = c
    s = ob.modifiers.new('lisse', 'SMOOTH')
    s.factor = 0.6
    s.iterations = 4
    if bosses:
        tex = bpy.data.textures.get(f'bosses{grain}') or bpy.data.textures.new(f'bosses{grain}', 'CLOUDS')
        tex.noise_scale = grain
        d = ob.modifiers.new('bosses', 'DISPLACE')
        d.texture = tex
        d.strength = bosses
        d.mid_level = 0.5
    me = appliquer(ob)
    col = me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    for c in col.data:
        c.color = (1.0, 1.0, 1.0, 1.0)
    me.color_attributes.active_color = col
    if amp:
        sillons(me, t, amp, n)
        me.update()
    dg = bpy.context.evaluated_depsgraph_get()
    tris = sum(len(p.vertices) - 2 for p in ob.evaluated_get(dg).data.polygons)
    if tris > budget:
        dec = ob.modifiers.new('budget', 'DECIMATE')
        dec.ratio = budget / tris * 0.97
    me = appliquer(ob)
    for p in me.polygons:
        p.use_smooth = True
    me.validate()
    for c in trous:
        bpy.data.objects.remove(c, do_unlink=True)
    return ob


def devant_visage(t, mat):
    """Ce qui passerait devant le visage, sous la frange : un ovale, pas une boîte (sinon coupe au cutter)."""
    bm = bmesh.new()
    ellipsoide(bm, Vector((t.x0, t.yf - 0.03, t.ze - 0.09)), (0.07, 0.075, 0.125), 32)
    return objet('devant', bm, mat)


def sans_ilots(me, part=0.1):
    """Retire les morceaux détachés (moins de part des faces du plus gros) : les bandes trop fines du masque en
    laissent après le remaillage, en miettes sur le visage."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    vus, morceaux = set(), []
    for f in bm.faces:
        if f.index in vus:
            continue
        pile, m = [f], []
        vus.add(f.index)
        while pile:
            g = pile.pop()
            m.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in vus:
                        vus.add(h.index)
                        pile.append(h)
        morceaux.append(m)
    plus = max(len(m) for m in morceaux)
    miettes = [f for m in morceaux if len(m) < part * plus for f in m]
    bmesh.ops.delete(bm, geom=miettes, context='FACES')
    bm.to_mesh(me)
    bm.free()
    return len(morceaux)




def peau_rocketbox(chemin):
    """La peau de la tête (le matériau « head »), soudée aux coutures d'UV, en mètres (le repère du glTF, axes de Blender), sans les îlots
    intérieurs (les yeux, les dents, la langue : on garde le plus grand morceau)."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=chemin, guess_original_bind_pose=False)
    corps = next(o for o in bpy.context.scene.objects if o.type == 'MESH' and any(m and m.name == 'head' for m in o.data.materials))
    i_tete = next(k for k, m in enumerate(corps.data.materials) if m and m.name == 'head')
    bm = bmesh.new()
    bm.from_mesh(corps.data)
    bm.transform(corps.matrix_world)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != i_tete], context='FACES')
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bm.faces.ensure_lookup_table()
    vus, morceaux = set(), []
    for f in bm.faces:
        if f.index in vus:
            continue
        pile, m = [f], []
        vus.add(f.index)
        while pile:
            g = pile.pop()
            m.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in vus:
                        vus.add(h.index)
                        pile.append(h)
        morceaux.append(m)
    plus = max(morceaux, key=len)
    bmesh.ops.delete(bm, geom=[f for m in morceaux if m is not plus for f in m], context='FACES')
    bm.normal_update()
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    return bm


def coupe(nom, style, peau, t, mat):
    """Une coupe (la méthode de la carrière, coiffures.py coupe()) : la tête coiffée d'une épaisseur qui s'amincit jusqu'à la peau à la
    lisière, découpée sous la lisière, les volumes du style par-dessus, des mèches creusées dans le sens des cheveux."""
    ze = t.ze
    bvh = BVHTree.FromBMesh(peau)

    def ep(dessus, cotes, arriere=None, plume=0.03, bosse=None):
        arriere = cotes if arriere is None else arriere
        def f(p):
            haut = lisse(ze + 0.03, ze + 0.1, p.z)
            dos = lisse(0.3, -0.5, math.cos(t.theta(p)))
            e = lerp(lerp(cotes, arriere, dos), dessus, haut) + (bosse(p) if bosse else 0)
            h = p.z - (ze + t.implantation(p, bas, frange))
            return e * lerp(0.08, 1.0, lisse(0.0, plume, h))
        return f

    def amp(force):
        def f(p):
            h = p.z - (ze + t.implantation(p, bas, frange))
            return force * lisse(0.0, 0.025, abs(h))
        return f

    bas, frange, dents = 0.0, None, 0.0
    volumes = bmesh.new()
    voxel, sill, bosses, grain, tombe = 0.003, amp(0.0035), 0.0, 0.018, False
    garder = lambda p: t.dans_crane(p) and p.z > ze - 0.13
    if style == 'mi_long':
        # Mi-long (le « bob » de la carrière, porté par un homme — vu le 3 octobre : la frange droite et 2 cm de dessus faisaient un casque) :
        # le front dégagé (la lisière naturelle, les cheveux tirés en arrière), un dessus à plat, des mèches jusqu'à la mâchoire derrière les
        # tempes et dans la nuque, fines.
        e, bas, tombe, sill = ep(0.012, 0.008, 0.01, plume=0.03), 0.03, True, amp(0.005)
        dents = 0.008
        bout = ze - 0.095
        rideau(volumes, t, bvh, 1.3, 1.95, bout, ze + 0.045, 0.003, 0.012, ourlet=0.03, serre=0.12, graine=0.3, avant=1.3)
        rideau(volumes, t, bvh, -1.95, -1.3, bout, ze + 0.045, 0.003, 0.012, ourlet=0.03, serre=0.12, graine=0.7, avant=-1.3)
        rideau(volumes, t, bvh, 1.85, 2 * math.pi - 1.85, ze - 0.105, ze + 0.05, 0.003, 0.015, n=40, ourlet=0.025, serre=0.12)
    elif style == 'chignon':
        # Le chignon d'homme : les cheveux tirés en arrière, une boule haut derrière le crâne.
        e, sill = ep(0.007, 0.006, plume=0.015), amp(0.0015)
        ellipsoide(volumes, Vector((t.x0, t.yb + 0.012, ze + 0.085)), (0.036, 0.034, 0.033))
    elif style == 'boucles':
        # Les boucles (vu le 3 octobre : un volume égal de 3 cm faisait un champignon) : bouclées sur le dessus (3 cm), dégradées sur les côtés
        # et la nuque (1 cm), le volume qui monte lentement depuis la lisière ; les boucles en bosses d'un centimètre, leurs creux assombris.
        e, sill = ep(0.03, 0.01, 0.011, plume=0.05), None
        bosses, grain, voxel = 0.012, 0.008, 0.003
    elif style == 'iroquois':
        # L'iroquois (Hamšík) : une crête au milieu du crâne, de la lisière du front à la nuque — haute sur le dessus (3,6 cm), basse au front
        # (elle ne fait pas visière) et dans la nuque, dentelée en mèches ; les côtés restent nus (la page les peint rasés). Vu le 3 octobre :
        # 4,8 cm partout et 3 cm de large, c'était un cimier.
        bas, frange, sill = 0.05, 0.064, amp(0.003)
        zc = ze - 0.02
        def e(p):
            crete = lisse(0.022, 0.006, abs(p.x - t.x0))
            haut = 0.25 + 0.75 * lisse(ze - 0.05, ze + 0.08, p.z)
            front = lerp(0.45, 1.0, lisse(t.yav + 0.01, t.yav + 0.06, p.y))
            mech = 0.78 + 0.22 * pointes(math.atan2(p.z - zc, p.y - t.yc) % (2 * math.pi), 44)
            return 0.0015 + 0.036 * crete * haut * front * mech
        garder = lambda p: t.dans_crane(p) and p.z > ze - 0.13 and abs(p.x - t.x0) < 0.028
    else:
        raise ValueError(style)

    tete = objet(nom, coque(peau, garder, e), mat)
    r = tete.modifiers.new('fusion', 'REMESH')
    r.mode = 'VOXEL'
    r.voxel_size = 0.0018
    lisiere = objet('lisiere', sous_lisiere(t, bas, frange, dents), mat)
    b = tete.modifiers.new('lisiere', 'BOOLEAN')
    b.operation = 'DIFFERENCE'
    b.solver = 'EXACT'
    b.object = lisiere
    me = appliquer(tete)
    bpy.data.objects.remove(lisiere, do_unlink=True)
    fondre = len(volumes.verts) > 0
    if fondre:
        bm = bmesh.new()
        bm.from_mesh(me)
        ajouter(bm, volumes)
        bm.to_mesh(me)
        bm.free()
    volumes.free()
    trous = [devant_visage(t, mat)] if tombe else []
    ob = finir(tete, t, voxel if fondre or style == 'boucles' else None, trous, BUDGET_COUPE, sill, bosses, grain)
    if bosses:
        creux(ob.data, 0.0025)
    uv_meches(ob.data, t)
    return ob


def creux(me, echelle):
    """L'ombre des creux (les boucles) : chaque sommet assombri de sa profondeur sous la moyenne de ses voisins, le long de sa normale
    (le laplacien) — les bosses restent claires, leurs creux sombres : c'est ce qui dessine des boucles de loin."""
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    bm.normal_update()
    ombre = me.color_attributes['Col'].data
    for v in bm.verts:
        if not v.link_edges:
            continue
        m = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
        prof = (m - v.co).dot(v.normal)
        g = max(0.45, min(1.0, 1.0 - 0.55 * prof / echelle))
        c = ombre[v.index].color
        ombre[v.index].color = (c[0] * g, c[1] * g, c[2] * g, 1.0)
    bm.free()


def mesurer(ob, t):
    P = [v.co for v in ob.data.vertices]
    yeux = sum(1 for p in P if abs(p.x - t.x0) < 0.055 and -0.015 < p.z - t.ze < 0.018 and p.y < t.yf + 0.03)
    return dict(triangles=sum(len(p.vertices) - 2 for p in ob.data.polygons), yeux=yeux, bas=round(min(p.z for p in P) - t.ze, 4), haut=round(max(p.z for p in P) - t.ze, 4))


def fusion(sortie, lots):
    """Fusionner des lots (des dossiers qui ont chacun leur coiffures.glb et leur coiffures.json) en un seul."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    meta = {}
    for d in lots:
        bpy.ops.import_scene.gltf(filepath=os.path.join(d, 'coiffures.glb'))
        with open(os.path.join(d, 'coiffures.json')) as f:
            meta.update(json.load(f)['pieces'])
    for ob in bpy.data.objects:
        ob.select_set(ob.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.join(sortie, 'coiffures.glb'), export_format='GLB', use_selection=True,
                              export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_animations=False)
    with open(os.path.join(sortie, 'coiffures.json'), 'w') as f:
        json.dump(dict(tete='A (foot-18.glb)', yeux=YEUX, pieces=meta), f, indent=1, ensure_ascii=False)


def main():
    args = sys.argv[sys.argv.index('--') + 1:]
    if args[0] == '--fusion':
        return fusion(args[1], args[2:])
    source, sortie = args[0], args[1]
    seules = args[2].split(',') if len(args) > 2 and args[2] else COUPES
    os.makedirs(sortie, exist_ok=True)
    mat = bpy.data.materials.new('cheveux')
    mat.diffuse_color = (0.1, 0.07, 0.05, 1)
    peau = peau_rocketbox(source)
    t = Tete(peau, (Vector((-0.03, 0, YEUX)), Vector((0.03, 0, YEUX))))
    print(f'tête : x0 {t.x0:.3f} yeux {t.ze:.3f} face {t.yf:.3f} crâne {t.yav:.3f}..{t.yb:.3f} demi-largeur {t.hx:.3f} sommet {t.zt:.3f}')
    finals, meta = [], {}
    for style in seules:
        ob = coupe(f'A__{style}', style, peau, t, mat)
        finals.append(ob)
        meta[f'A__{style}'] = mesurer(ob, t)
        print(f'A__{style:10s} {meta[f"A__{style}"]}')
    peau.free()
    for ob in list(bpy.data.objects):
        if ob not in finals:
            bpy.data.objects.remove(ob, do_unlink=True)
    for ob in finals:
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(sortie, 'coiffures.glb'), export_format='GLB', use_selection=True,
                              export_yup=True, export_texcoords=True, export_normals=True, export_materials='EXPORT',
                              export_vertex_color='ACTIVE', export_animations=False)
    with open(os.path.join(sortie, 'coiffures.json'), 'w') as f:
        json.dump(dict(tete='A (foot-18.glb)', yeux=YEUX, pieces=meta), f, indent=1, ensure_ascii=False)


if __name__ == '__main__':
    main()
