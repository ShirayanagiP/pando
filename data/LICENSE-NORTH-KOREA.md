# North Korean administrative boundaries

- Provider: World Food Programme (WFP), OCHA ROAP; distributed by geoBoundaries gbOpen.
- ADM2: 179 county/city/special-city features, boundary year represented **2019**.
- ADM1: 11 province-level features, boundary year represented **2018**; used only to match ADM2 to its source province. The displayed province outlines are dissolved from ADM2.
- License: **Creative Commons Attribution 3.0 IGO (CC BY 3.0 IGO)**, https://creativecommons.org/licenses/by/3.0/igo/
- Source cited by geoBoundaries: https://data.humdata.org/dataset/dpr-korea-administrative-boundaries
- Metadata: https://www.geoboundaries.org/api/current/gbOpen/PRK/ADM2/ and https://www.geoboundaries.org/api/current/gbOpen/PRK/ADM1/
- Pinned upstream snapshot: https://github.com/wmgeolab/geoBoundaries/tree/9469f09/releaseData/gbOpen/PRK
- Local originals: `prk-adm2.geojson`, `prk-adm1.geojson`. Downloaded 2026-10-19.
- App IDs use the source province ISO plus the source district name, separate from the original South Korean IDs.

Pando modifications: Korean display names (`prk-names.json`), spatial matching to source provinces, planar projection, coordinate precision 0.01 map units, overlap removal in favor of the South Korean source along the source seam, and shared-edge topology. No new administrative regions are fabricated. Eight enclosed gaps touching both sources along the DMZ are filled by extending adjacent northern units, split by proximity to their contacting boundaries where necessary. See `seam-repairs.json` and `scripts/boundary_tools.py`. This is a cartographic alignment rather than reconstruction of the legal border. This is a generalized drawing map.

These 179 **source features are not a statement of the current administrative count**. Most internal wards of Pyongyang and Chongjin are not separate polygons. Rason and Kaesong retain the province grouping in this source; Samjiyon retains the source-era county label. The source is not updated to 2026. Province/district names may differ from current usage. Korean names are paired with the original Romanized names retained as `sourceName`; North Korean initial consonants are also searchable with their common South Korean spellings.

No endorsement by the UN, WFP, OCHA or geoBoundaries is implied. The source provider's designation of boundaries does not imply any opinion concerning legal status or delimitation.
