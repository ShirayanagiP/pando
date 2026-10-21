# Russia: eastern district map and world subject map

`regions.geojson` contains **567** district-level units in the **21** federal
subjects of the Far Eastern and Siberian federal districts: **230** in the Far
East and **337** in Siberia. It includes equivalent independent city/urban
districts so that cities do not leave holes in the surrounding rayon coverage.
`subjects.geojson` contains all **83** federal subjects in the source for the
world-level map. No geometry is loaded from the internet at runtime.

## Sources and date

- [geoBoundaries Russia ADM2 metadata](https://www.geoboundaries.org/api/current/gbOpen/RUS/ADM2/),
  boundary ID `RUS-ADM2-50074027`, represented year **2017**.
- [Pinned original ADM2 source archive](https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/sourceData/gbOpen/RUS_ADM2.zip),
  commit `9469f09`, OpenStreetMap / Wambacher. The original shapefile preserves
  OSM relation IDs, used as stable application IDs (`RU-<relation ID>`).
- [Pinned ADM1 GeoJSON](https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/RUS/ADM1/geoBoundaries-RUS-ADM1.geojson),
  boundary ID `RUS-ADM1-28173009`, represented year **2017**.
- [Russian Ministry of Transport: Far Eastern district](https://mintrans.gov.ru/transport_of_russian/4)
  and [Siberian district](https://mintrans.gov.ru/transport_of_russian/5) list
  the 11 and 10 subjects respectively. Buryatia and Zabaykalsky are assigned to
  the Far East, following their 2018 transfer; old geometry is not being used to
  infer the federal district membership.
- Subject names outside the eastern 21 use Unicode CLDR 48, pinned commit
  `acd6d88ae493633240e19a87a721076a8a75c310`:
  [Korean](https://raw.githubusercontent.com/unicode-org/cldr/acd6d88ae493633240e19a87a721076a8a75c310/common/subdivisions/ko.xml),
  [Russian](https://raw.githubusercontent.com/unicode-org/cldr/acd6d88ae493633240e19a87a721076a8a75c310/common/subdivisions/ru.xml),
  [English](https://raw.githubusercontent.com/unicode-org/cldr/acd6d88ae493633240e19a87a721076a8a75c310/common/subdivisions/en.xml).

These are **2017 district geometries**, not a claim that all municipal reforms
through 2026 have been incorporated. Current OSM tags can refer to merged
municipalities, so the frozen name dictionary uses original boundary names and
the relations' first-version Russian names. Contemporary tags are used for
missing/truncated spellings and searchable aliases. Original `улус` and
`кожуун` descriptors are preserved in native names. Korean spellings use the
build-only [Hangulize Russian model](https://github.com/sublee/hangulize)
(0.0.9, BSD) plus OSM Korean names where supplied; English falls back to a
documented character transcription when no published English spelling exists.
No machine translation service or runtime transcription dependency is used.

## Rebuilding

Install Python `pyshp`, `shapely>=2`, and `numpy`, then run:

```powershell
python data/external/russia/prepare-russia.py
```

The script consumes the bundled original ADM2 archive, ADM1 source, and frozen
name dictionaries. It checks the archive SHA-256 before building, reassigns
every district to its containing federal subject, asserts all 21 parents and
the expected counts, and writes both normalized GeoJSON files. To reproduce
phonetic names, install Hangulize 0.0.9 and run `prepare-names.py`; an optional
`--hangulize-path` accepts a directory containing that package.

`selected-relations.json`, `counts.json`, and `geometry-repairs.json` record
membership, counts, and the three repaired source ring self-intersections.
Coordinates remain geographic WGS84 longitude/latitude, including negative
longitudes in Chukotka. Unwrap negative longitudes by adding 360 before planar
geometry operations or projection for East Asia. Temporary unwrapping is used
for parent assignment and repairs; it is reversed in the output.

The source coverage audit found all 21 subjects represented. ADM2 union covers
at least 99.992% of each ADM1 polygon by unwrapped planar area; the remaining
small differences are source coastline/islet differences, not missing rayons.
Sakha, Chukotka, and all three Kuril districts are included.

## License and attribution

Boundary data and OSM name tags: **© OpenStreetMap contributors**,
[Open Database License 1.0](https://www.openstreetmap.org/copyright), distributed
through geoBoundaries / William & Mary geoLab. The metadata explicitly names
ODbL; the dataset should not be relabeled CC BY merely because it is in gbOpen.
The normalized boundary/name database is an adapted ODbL database. Retain
attribution when displaying/exporting a map and retain these sources/license
notes when redistributing the database.

Unicode CLDR names: Unicode License v3; see `LICENSE-UNICODE.txt`.
Build-only Hangulize code is not embedded in the runtime dictionary.
