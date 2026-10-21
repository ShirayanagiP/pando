# 거시판도학의 작은 섬별 묶음

개인용 거시 지도에서 세부 구역이 과도하게 많은 작은 섬을 줄이기 위한 편집 단위입니다. 법률상 행정구역을 새로 주장하는 것이 아니며, 대륙·미시 지도와 원본 `regions.geojson`은 바꾸지 않습니다.

## 병합 기준

1. 포함된 Natural Earth 10m 육지의 연결된 섬 전체 면적이 **9,000km² 미만**이어야 합니다. pyproj의 WGS84 지오데식 면적으로 판정하며, 지도 화면의 투영 면적이나 한 국가가 점유한 부분 면적을 사용하지 않습니다.
2. 둘 이상의 국가·지역이 들어 있는 섬은 국가별로 묶습니다. 어느 한쪽이 이미 단일 구역이면 유지합니다. 생마르탱의 국가 간 경계는 그대로이며 각 국가 쪽 구역이 여러 개인 경우에만 따로 병합합니다. 티모르와 같이 큰 섬은 부분 면적만 보고 병합하지 않습니다.
3. 한 섬에 이미 하나의 편집 구역만 있으면 유지합니다. 괌, 퀴라소, 푸에르토리코 등은 기존 ID를 그대로 사용합니다.
4. 여러 섬을 포함하는 기존 행정구역은 분할하거나 흡수하지 않습니다. 같은 섬에 다른 단일 섬 구역들이 둘 이상 있으면 그 구역들만 병합합니다. 미크로네시아 연방과 통가의 기존 다도 구역들도 유지합니다.
5. 서로 다른 섬은 같은 국가라도 합치지 않습니다. 몰타 본섬의 54개 구역과 고조섬의 14개 구역은 각각 별개의 구역이 됩니다. 36개 묶음으로 246개 편집 구역을 줄입니다.
6. 이후 국토 도형 면적 **5,000km² 이하**의 국가·지역에서는 서로 닿는 구역들을 연결부마다 합칩니다. 떨어진 독립 섬이나 월경지는 따로 남깁니다. 기존 멀티폴리곤을 자르지 않으며 다른 국가와 합치지 않습니다. 11개 연결부 묶음으로 38개를 추가로 줄여 최종 거시 지도는 3,212개입니다. 안도라, 리히텐슈타인, 룩셈부르크, 산마리노는 각각 한 구역이고 몰타는 섬별 두 구역을 유지합니다.

육지 마스크와 행정 경계의 해안 일반화 차이 때문에 생기는 지역 면적의 0.01% 미만 교차 조각은 섬 소속 판정에서 무시합니다. 의미 있는 별도 원본 도형이 육지 마스크에 없더라도 다도 구역으로 보호합니다. 이 기준은 원본 도형을 자르거나 새 육지를 만드는 데 사용하지 않습니다. 병합 도형은 **기존 구역 전체의 합집합**입니다. 따라서 근처 부속 도서와 원래 육지 면적을 보존합니다.

지도 축척의 물리적 육지 연결을 기준으로 하므로 작은 수로와 섬 사이 연결의 표현은 Natural Earth 일반화를 따릅니다. 실제 측량 면적이나 최신 해안선 자료가 아닙니다. 지명용 폴리곤의 외곽선을 섬 면적 판정에 사용하지 않습니다.

## 재현 및 파일

```powershell
python scripts/prepare-small-islands.py
python scripts/build-levels.py world
python scripts/prepare-place-names.py
```

Shapely 2와 pyproj가 필요합니다. 일반 사용에는 필요하지 않으며, 생성 도구는 외부에 접속하지 않습니다. 거시 경계 버전은 `macro-world-2026-10-v5`이며 이전 세부 단위의 색상 변환은 수행하지 않습니다.

- `small-island-merges.json`: 전체 병합 ID, 원래 지역 ID, 실제 판정에 사용한 섬 면적, 다도 구역 제외 목록, 병합하지 않은 섬의 사유, 입력 SHA-256.
- `small-country-merges.json`: 국가별 면적 판정값, 연결부별 소속 ID, 추가 병합 수, 원본·섬별 계획 SHA-256. 판정 면적은 번들 경계의 WGS84 도형 면적이며 최신 측량 면적을 뜻하지 않습니다.
- `small-island-names.json`: 물리적 섬 도형의 해시로 고정한 표시 이름. Natural Earth 지명과 실용적인 한글 표기를 대조하고 고조섬 등은 명시적으로 구별했습니다. 법정 행정명이나 공식 한국어 외래 지명으로 주장하지 않습니다.
- 새 지역의 `islandMemberIds`와 `sourceMemberCodes`에 원본 소속을 남깁니다. 옛 지명은 검색 별칭으로 보관하므로 발레타를 검색하면 병합된 몰타섬을 찾을 수 있습니다.

## 추가로 사용한 원자료

모두 기존 지도와 같은 Natural Earth 벡터 저장소 고정 커밋 `f1890d9f152c896d250a77557a5751a93d494776`(v5.1.2 번들)이며 public domain입니다.

- 육지: `../china/natural-earth-land.geojson`, [10m Land](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/). 육지 원자료의 고정 URL과 라이선스는 `../china/provenance.json`에도 보관되어 있습니다.
- 지명: [Physical Labels](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-physical-labels/), `ne_10m_geography_regions_polys.geojson` 및 `ne_10m_geography_regions_points.geojson`. 한국어·영어와 별칭 대조에만 사용합니다.
- 고정 지명 원본: [areas](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_10m_geography_regions_polys.geojson), [points](https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_10m_geography_regions_points.geojson). 파일 해시는 병합 계획에 기록합니다.

검증: `python -m unittest discover -s tests -p test_island_merges.py` 및 `node --test tests/world-rendering.test.cjs tests/region-search.test.cjs`.
