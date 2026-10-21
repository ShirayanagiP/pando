# Offline world first-order administrative boundaries

This directory is an input dataset for the private local editor. It does not
publish, register, or deploy a site. Run `python data/external/world/prepare-world.py`
from the project root to regenerate `regions.geojson`, `countries.json`, and
`metadata.json`. Python 3 and Shapely 2 are required; no network is used at build
or runtime once the bundled sources are present. Run `validate-world.py` for
geometry, identifier, language, tier, and overlap checks.

## Natural Earth

- Publisher: Natural Earth / Nathaniel Vaughn Kelso and contributors.
- Release: **v5.1.2**, tag commit
  `f1890d9f152c896d250a77557a5751a93d494776`, dated 2022-05-13.
- Scale: 1:10 million. The source dates vary between countries: this is not a
  claim that every boundary represents 2022 or the present day.
- Original ADM1 file (4,596 features):
  <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_10m_admin_1_states_provinces.geojson>
  SHA-256 `22d0e3ad85eb3e27f17cabf8ba2d50e554fbc27a87796ff891d958185da62fb5`.
- Original ADM0 countries/territories file (258 features):
  <https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_10m_admin_0_countries.geojson>
  SHA-256 `239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255`.
- Dataset description:
  <https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/>
- License: **public domain**.
  <https://www.naturalearthdata.com/about/terms-of-use/>
- Existing `name_ko`, `name_en`, `name_local`, and other source-language fields
  supply most names. Natural Earth's multilingual name data is based in part on
  Wikidata (CC0). Explicit local-script fields take priority for native labels;
  where absent, an existing matching language field or original source name is
  retained. This does not assert that all source romanizations are native script.

## Nepal replacement

The Natural Earth file contains Nepal's 14 former zones rather than its seven
first-order provinces. These geometries are replaced, not relabeled.

- Source publisher: Survey Department of Nepal / OCHA FISS, distributed by
  geoBoundaries gbOpen.
- Represented boundary year: **2020**; metadata source update 2023-01-19;
  geoBoundaries build 2023-12-12.
- Pinned revision `9469f09`; boundary ID `NPL-ADM1-38925275`.
- Original file:
  <https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NPL/ADM1/geoBoundaries-NPL-ADM1.geojson>
  SHA-256 `5c1799924d277df4f63f6c8e29fbcbb2cd61320fd13e013e431c4a68f09656c1`.
- Source dataset:
  <https://data.humdata.org/dataset/administrative-bounadries-of-nepal>
- License: **Creative Commons Attribution 3.0 Intergovernmental Organisations
  (CC BY 3.0 IGO)**, as recorded in bundled `nepal-adm1-metadata.json`.
  <https://creativecommons.org/licenses/by/3.0/igo/>
- Derivation: source province interiors are clipped to the Natural Earth Nepal
  national outline to keep the surrounding countries under one boundary
  convention. Uncovered outline fragments are assigned to the closest source
  province. The adjustment is reported in `metadata.json`; it is not represented
  as a new official international boundary.
- Province 1 and Province 2 retain those old names as search aliases; display
  names use Koshi and Madhesh. Official name references:
  <https://www.koshi.gov.np/>, <https://madhesh.gov.np/>.

## Normalization and first-order corrections

The Natural Earth file's `gadm_level` is not uniform across countries. It is not
used as a blind filter: provinces in Vietnam and Finland, for example, can be
marked 2 in the source while still forming the intended first-order tier.

Known lower-level source collections are dissolved without inventing bridges:

| Country | Source collection | Output tier | Reference |
|---|---:|---:|---|
| France | 101 départements | 18 regions | <https://www.insee.fr/fr/metadonnees/definition/c1696> |
| United Kingdom | 232 local areas | 4 constituent countries | <https://www.ons.gov.uk/explore-local-statistics/areas/K02000001-united-kingdom> |
| Belgium | 11 provinces/capital area | 3 territorial regions | <https://www.belgium.be/en/about_belgium/government/regions> |
| Bosnia and Herzegovina | 18 cantons/regions | 2 entities + Brčko District | <https://www.ohr.int/brcko-supervision/> |
| Nepal | 14 obsolete zones | 7 provinces (replacement source) | sources above |
| Italy | 110 provinces | 20 regions | <https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/> |
| Spain | 52 provinces/autonomous cities | 17 autonomous communities + 2 autonomous cities | <https://www.lamoncloa.gob.es/lang/en/espana/Paginas/state-organization.aspx> |
| Sri Lanka | 25 districts | 9 provinces | <https://www.gov.lk/webdirectory/provincialcouncils> |
| Philippines | 118 provinces/independent cities | 17 source-era administrative regions | source `region` membership; predates BARMM and 2024 Negros Island Region |
| Burkina Faso | 45 provinces | 13 source-era regions | <https://www.geoboundaries.org/api/current/gbOpen/BFA/ADM1/> |
| Guinea | 34 prefectures/governorate | 8 regions | <https://www.geoboundaries.org/api/current/gbOpen/GIN/ADM1/> |
| Malawi | 28 districts | 3 regions | <https://www.geoboundaries.org/api/current/gbOpen/MWI/ADM1/> |
| Hungary | 19 county shapes + 23 cities with county rights + Budapest | 19 geographic counties + Budapest | <https://www.ksh.hu/regionalatlas_counties?lang=en> |

France uses the supplied `region` membership, UK uses the source regional
membership, Belgium uses Flemish/Walloon/Brussels membership, and Bosnia uses
the ten canton units for the Federation and the seven other entity regions for
Republika Srpska, with Brčko separated explicitly. The source's incorrect parent
metadata for Posavina and Zenica-Doboj is not propagated.

For the other regional dissolves, the source's explicit `region` membership is
used. Malawi's three missing parent fields are completed: Karonga/Chitipa are in
Northern Region and Machinga is in Southern Region. The source misnames Karonga
as another Chitipa, which does not affect its correct northern-region grouping.
Hungarian cities with county rights are merged into their geographic counties
using explicit assignments, each checked against its longest shared county
boundary. Budapest remains an independent first-order unit. Source city names
remain searchable aliases.

The Philippines retains its source-era 17-region system, including ARMM; it is
not silently relabeled BARMM. The source's misnamed "Dinagat Islands (Region
XIII)" parent is displayed as Caraga. The source-era boundaries in Bangladesh
(seven divisions), Burkina Faso (13 regions), Ghana, Indonesia, Kenya,
Norway, Cambodia and Vietnam are also older than recent reforms. These are
enumerated in `historicalAdministrativeSnapshots`. The `hierarchy-audit.json`
file records the decisions for 48 potentially mixed-level source collections.

The private macro editor now explicitly uses Slovenia's 12 statistical regions,
North Macedonia's 8 statistical regions, Kosovo's 7 districts and Moldova's 6
development regions. These are selected editing tiers rather than a claim that
every statistical region is an elected first-order government. Original detailed
features are retained, with the same IDs and geometry, in
`../europe/continental-detail.geojson`. Official membership references and
corrections are recorded in `../../LICENSE-WORLD.md` and `europe_overrides.py`.

Latvia is replaced with the official VARAM **2026-05-07** GeoJSON, **CC0 1.0**,
from <https://data.gov.lv/dati/dataset/atr/resource/f1fe9a47-62af-4156-84ae-b11ac029b00f>.
The original file, SHA-256, EPSG:3059 CRS and transformation details are in
`latvia-2026-source.geojson` and `latvia-2026-source-metadata.json`. Its 35
municipalities and 7 independent state cities follow the July 2025 merger of
Varakļāni into Madona; 36+7 describes the preceding 2021–2025 structure.
Source interiors are simplified with shared boundaries at 150 m, transformed
to WGS84, and fitted to this map's existing international/coastal outline.
Regeneration requires pyproj in addition to Shapely; the running editor remains
offline and dependency-free. Other countries still retain source dates and
historical incompleteness rather than claiming all reforms are current.

The existing editor supplies South Korea, North Korea, China, Mongolia, Japan,
and Taiwan. All eight corresponding Natural Earth source units (KOR, PRK, CHN,
MNG, JPN, TWN, HKG, MAC) are excluded. HKG and MAC are already represented in the
existing Chinese map and must not be duplicated.

Tiny source territories with no ADM1 geometry use an explicit ADM0 fallback;
these are listed individually in `metadata.json`. They include disputed banks,
an unallocated ice field, a buffer zone, and Bir Tawil. They are not turned into
invented states or provinces.

Seven unnamed offshore geometry fragments are merged into existing named units
instead of becoming fake administrative divisions. Known associations include
Malpelo → Valle del Cauca, Alacranes → Yucatán, Isla de Aves → Federal
Dependencies, and Dolgiy → Nenets. References:

- <https://www.parquesnacionales.gov.co/wp-content/uploads/2020/10/plan-de-manejo-sff-malpelo.pdf>
- <https://conanp.gob.mx/conanp/dominios/alacranes/index.php>
- <https://www.fao.org/docrep/019/as176s/as176s.pdf>
- <https://adm-nao.ru/informaciya-o-neneckom-avtonomnom-okruge/obshaya-informaciya-ob-okruge/>

Antarctica and Kiribati merge their fragments into their existing single named
source unit. Anguilla's small offshore islets have no named district ownership
in this source; they are attached cartographically to the closest source
district, and that approximation is explicitly logged in metadata.

## Boundary convention

Natural Earth defaults to de facto control and provides alternative worldview
attributes. This normalization uses the default geometry consistently and does
not mix alternative national claims, add overlapping claim polygons, or infer a
position on sovereignty. Source separated territories and unresolved areas
remain separated. The seven Nepal provincial interiors adopt that same national
outline, rather than introducing a second international outline.

The upstream ADM1 and ADM0 files overlap around Bir Tawil and the Cyprus UN
buffer zone. The separately mapped ADM0 areas take priority and are subtracted
from the overlapping ADM1 features. A tiny source-rounding overlap at the
India–Nepal boundary is similarly removed from India, retaining the Nepal ADM0
outline. Every adjustment is recorded in `sourceOverlapRepairs` in metadata.

Country identities are lower-case ISO3 where unique. Separate Natural Earth
units that inherit their parent's ISO code (ATC, CSI, IOA, BRI, CLP, KAB) use
their stable Natural Earth code to avoid duplicate country identifiers. Official
ISO metadata is retained separately as `countryIsoA3` and `countryIsoA2`.

No simplification or coordinate quantization is applied here. The runtime bundle
builder may simplify the complete coverage consistently at a later step.
