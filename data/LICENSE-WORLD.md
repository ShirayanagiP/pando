# 거시판도학 · 세계 지도

세계 지도는 유럽 중심 `world-map-data.js` 또는 아시아 중심 `world-asia-map-data.js` 중 하나만 불러옵니다. 대륙판도학의 군급 지도를 함께 로드하지 않습니다. 지역별 상세 자료는 [external/world/LICENSE-SOURCES.md](external/world/LICENSE-SOURCES.md), 고정 원자료·보정·이름·집계는 같은 폴더의 `metadata.json`과 `prepare-world.py`에 있습니다.

## 원출처

- [Natural Earth 10m Admin 1](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/) 및 Admin 0, [고정 v5.1.2 저장소 스냅샷](https://github.com/nvkelso/natural-earth-vector/tree/v5.1.2/geojson). 레이어별 내부 버전과 저장소 스냅샷 버전은 다를 수 있습니다. Natural Earth 자료는 [public domain](https://www.naturalearthdata.com/about/terms-of-use/)입니다.
- 네팔의 7개 주: geoBoundaries의 고정 2020년 자료, 원출처·CC BY 3.0 IGO 조건은 `external/world/`에 보관했습니다. Natural Earth의 옛 14개 존을 현재의 주라고 표시하지 않습니다.
- 한국·북한·중국·일본·몽골·대만: 기존 독립 출처의 지역들을 요청한 광역 단위로 병합했습니다. [동아시아 국가별 출처](LICENSE-EAST-ASIA.md)를 함께 적용합니다. 몽골은 기존 2017년 아이막 21개·울란바토르, 대만은 NLSC 시·현을 2개 성과 6개 직할시로 병합합니다.

## 행정 단계와 표시

Natural Earth는 국가에 따라 서로 다른 행정 단계를 제공하므로, 확인되는 프랑스·영국·벨기에·보스니아·이탈리아·스페인·스리랑카·필리핀 등의 하위 구역은 원자료의 상위 소속으로 병합했습니다. 국가별 정확한 병합 목록·코드·예외는 `external/world/metadata.json`에 있습니다. 통계 지역을 실제 지방정부의 상위 계층이라고 임의로 치환하지 않습니다. 별도 1차 구역 자료가 없는 작은 국가·영토는 국가 전체를 한 편집 단위로 표시합니다.

## 작은 섬의 편집 단위

거시판도학에서는 면적 9,000km² 미만의 섬에 있는 여러 세부 구역을 섬마다 국가별로 병합합니다. 섬의 면적은 포함된 Natural Earth v5.1.2 육지 도형 전체를 WGS84 타원체에서 계산합니다. 국가가 차지한 부분 면적을 섬 전체 면적으로 사용하지 않습니다. 공동 점유 섬도 국가 경계를 유지하며 국가별 여러 구역을 합칩니다. 이미 한 편집 단위인 섬과 여러 섬에 걸친 기존 편집 단위는 섬별 병합에서 제외합니다.

몰타 68개 구역은 몰타섬과 고조섬 2개로, 바베이도스 11개와 나우루 14개는 각각 1개로 합칩니다. 36개 섬 묶음으로 246개 구역을 줄입니다. 추가로 번들 국가 도형의 WGS84 면적이 5,000km² 이하인 경우 서로 닿는 행정구역을 묶고 떨어진 섬·월경지는 남깁니다. 11개 연결부 묶음으로 38개를 추가로 줄여 최종 3,212개입니다. 국가 면적은 최신 측량값을 주장하는 값이 아닌 이 번들 도형에 따른 판정값입니다. 두 지도 중심에 같은 ID를 적용하며 원본 ADM1과 육지 도형은 유지합니다. 소속표와 면적은 `external/world/small-country-merges.json`, 상세 기준은 [README-SMALL-ISLANDS.md](external/world/README-SMALL-ISLANDS.md)에 있습니다.

확대 지도는 동일한 원출처의 일반화 전 경계를 `insetD`로 보관해 사용합니다. `scripts/inset_geometry.py`에서 재현하며 별도 경계 출처를 추가하지 않습니다. 각 국가 칸의 위치·축척은 독립적입니다. 본지도와 같은 ID에 색을 배정하며 면적이 작은 도형은 위치 점도 함께 표시합니다.

## 남극 주장 구역

남극 육지 도형을 7개국의 주장 범위에 따라 11개 편집 단위로 분할합니다. 영국·아르헨티나·칠레의 중첩 구간은 주장국 조합마다 별도로 나누며, 하나의 국가에 임의로 귀속하지 않습니다. 미주장 구역과 노르웨이가 주장하는 페테르 1세섬도 구분합니다. 아래 공식 안내의 도 단위 경도를 사용하는 지도용 일반화이며 법적 경계 측량이 아닙니다. 바다 전체를 채우는 부채꼴이 아니라 기존 육지 도형을 분할합니다.

- [호주 남극 프로그램: 주장 현황과 남극조약](https://www.antarctica.gov.au/about-antarctica/law-and-treaty/history/antarctic-territorial-claims/).
- [영국 BAS](https://www.bas.ac.uk/about/where-we-work/britain-in-antarctica/): 서경 80–20도.
- [아르헨티나 외교부](https://cancilleria.gob.ar/es/politica-exterior/antartida-argentina): 서경 74–25도.
- [칠레 통계청](https://www.ine.gob.cl/docs/default-source/variables-basicas-ambientales/publicaciones-y-anuarios/informe-anual-de-medio-ambiente/informe-anual-de-medio-ambiente-2000-2004.pdf): 서경 90–53도.
- [노르웨이 극지연구소](https://npolar.no/en/themes/dronning-maud-land/): 서경 20도–동경 45도. [노르웨이 정부](https://www.regjeringen.no/en/topics/foreign-affairs/international-law/continental-shelf--questions-and-answers/id448309/)의 페테르 1세섬 주장도 반영합니다.
- [Geoscience Australia](https://www.ga.gov.au/scientific-topics/national-location-information/dimensions/remote-offshore-territories/australian-antarctic-territory): 호주는 동경 45–160도 중 프랑스 아델리랜드(동경 136–142도)를 제외합니다.
- [뉴질랜드 LINZ](https://www.linz.govt.nz/guidance/geodetic-system/coordinate-systems-used-new-zealand/geodetic-datums/ross-sea-region-geodetic-datum-2000-rsrgd2000): 로스 구역은 동경 160도–서경 150도입니다.

주장이 없는 서경 150–90도 구간은 위 범위의 여집합으로 계산합니다(페테르 1세섬 제외). 분할은 `scripts/world_geometry.py`에서 재현합니다.

## 화면 렌더링과 좌우 연결

유럽 중심은 동경 11.5도, 아시아 중심은 동경 150도를 기준으로 360도 창을 만듭니다. 날짜변경선을 넘는 도형 조각은 평행 이동 후 다시 합칩니다. 지역 ID와 색칠 소속은 두 보기에서 동일하며 SVG/PNG도 선택한 중심을 사용합니다. 전체 세계 보기의 좌우 반복 도형은 SVG 참조로 재사용하며, 반복 영역의 색칠도 원래 지역에 적용합니다.

세계 전체의 이미지 출력은 고정된 끝선을 사용합니다. 아시아 중심은 서경 30도에서 동경 330도까지, 유럽 중심은 서경 168.5도에서 동경 191.5도까지의 360도 창입니다. 후자는 사용자가 지정한 세인트로렌스섬과 알래스카 본토·누니박섬 사이입니다. 도형도 이 끝선에 맞춰 다시 이어 붙여 브라질 같은 영역의 라벨이 이전 끝선에서 분리되지 않게 합니다. SVG 내부의 좌우 반복 참조를 포함해 빈 구간이나 도형 누락 없이 자릅니다. 범례·글자·색칠·경계도 함께 이동하며 PNG와 SVG는 동일한 출력 문서를 사용합니다. 국가·대륙별 출력은 해당 국가·대륙의 전체 경계를 포함합니다.

화면의 실제 픽셀 축척에 따라 공유 경계와 육지를 100·25 지도 단위로 단순화하거나 원래 정밀도로 표시합니다. 축소 시 같은 국가 안의 경계와 픽셀보다 작은 선 조각을 생략하며, 중간 단계에서는 충분히 넓은 구역의 경계부터 표시합니다. 화면 밖의 지역과 경계는 공간 색인으로 제외합니다. 이미지 내보내기는 원래 정밀도를 사용합니다.

원자료는 전 세계의 동일한 기준일을 뜻하지 않습니다. 예를 들어 방글라데시는 원자료의 7개 디비전, 러시아는 Natural Earth의 85개 단위를 사용합니다. 러시아의 거시 지도는 Natural Earth의 기본 de facto 경계, 대륙 지도는 geoBoundaries의 2017년 극동·시베리아 자료를 사용하므로 두 모드의 출처·범위가 다릅니다. 영유권이 겹치는 모양을 두 번 색칠하지 않으며 경계 표시는 별도의 영유권 주장이 아닙니다.

## 유럽의 거시 편집 단위

사용자가 정한 축척에 맞춰 아래 국가들은 세부 지방자치단체 대신 광역 그룹을 사용합니다. 통계·개발지역을 모두 법률상 1차 지방정부라고 부르지 않으며, 화면의 구역 단위에도 통계 지방·개발지역·구를 각각 표시합니다.

| 국가 | 기존 세부 구역 | 현재 거시 지도 |
| --- | ---: | --- |
| 슬로베니아 | 193 | 통계 지방 12 |
| 북마케도니아 | 84 | 통계 지방 8 |
| 코소보 | 30 | 구 7 |
| 몰도바 | 40 | 개발지역 6 |
| 라트비아 | 119 | 군 35 + 독립 국가급 도시 7 |

- 슬로베니아: [SURS 지방 목록](https://www.stat.si/obcine/en). 기존 도형을 병합하되 [2015년 변경](https://www.stat.si/StatWeb/en/News/Index/6208)에 맞춰 Litija는 Zasavska, Radeče·Bistrica ob Sotli는 Posavska로 옮깁니다. Šmartno pri Litiji는 Central Slovenia에 유지합니다. Posavska와 Primorsko-notranjska의 현재 명칭을 사용합니다.
- 북마케도니아: [국가통계청, Regions 2022, p.13](https://www.stat.gov.mk/publikacii/2022/Regionite%20vo%20RM%202022.WEB.pdf)의 소속을 대조했습니다. 원자료의 비어 있거나 잘못된 `region`을 그대로 쓰지 않고 명시적인 전체 소속표로 8개 지방을 구성합니다. 예를 들어 Lipkovo는 북동부, Resen은 Pelagonia, Makedonski Brod는 남서부입니다.
- 코소보: [통계청의 지방별 인구](https://ask.rks-gov.net/PopulationStats/PopulationByRegion), [지역개발부의 7개 지방 기준](https://mzhr.rks-gov.net/desk/inc/media/C83587CF-C645-4967-B9C2-165F1740E005.pdf)을 사용합니다. 기존 자료의 `type_en=District`가 붙은 30개 단체는 7개 구보다 세부 단계이므로 상위 소속으로 병합합니다.
- 몰도바: [통계청의 개발지역 소속](https://statistica.gov.md/en/tips-for-creating-using-maps-in-the-statbank-databank-113_4026.html), [정부의 지역개발 전략](https://adrcentru.md/public/publications/1187344_en_nsrd_english_m.pdf)에 따라 북부·중부·남부·키시너우·가가우지아·트란스니스트리아를 사용합니다. 4개 통계 구역과 혼동하지 않습니다. 원자료의 동명이역 Rezina 중 MDA-1644는 중부, MDA-1645는 트란스니스트리아 쪽 도형이며 Dubăsari 소속 MDA-1628은 중부에 둡니다.
- 라트비아: [VARAM의 2026년 경계 GeoJSON](https://data.gov.lv/dati/dataset/atr/resource/f1fe9a47-62af-4156-84ae-b11ac029b00f), CC0 1.0. 원본은 `external/world/latvia-2026-source.geojson`, 해시·좌표계·가공은 같은 이름의 `-metadata.json`에 있습니다. [현행 제도](https://www.varam.gov.lv/lv/pasvaldibas)는 2025년 7월 이후 35개 군·7개 독립 도시이며, 그 전의 36+7에서 Varakļāni가 Madona로 합쳐졌습니다. EPSG:3059에서 공유 경계를 150 m로 단순화한 뒤 WGS84로 변환하고 세계 지도의 기존 외곽선에 맞춰 국가 간 틈을 방지합니다. 행정구역 내부는 2026년 원본을 사용합니다.

앞의 네 국가의 기존 피처·ID·좌표 347개는 [대륙판도학 유럽용 자료](external/europe/README.md)로 그대로 보관합니다. 거시 페이지는 이를 불러오지 않습니다. 거시 지도는 새 경계 버전만 저장·불러오며 이전 파일의 변환은 구현하지 않습니다.

공유 경계 단순화(4.5 지도 단위), 좌표 정밀도 통일, 중복 면의 단일 소속 처리는 `scripts/build-levels.py`와 `scripts/map_builder.py`에서 재현합니다. 기존 동아시아 출처를 우선해 세계 출처와 중복되지 않게 합니다. 호수 구멍은 유지하며 라벨·테두리·색칠·PNG/SVG 출력은 공통 편집기를 사용합니다. 큰 세계 지도에서 작업해도 시군구·솜·라욘 수준 도형은 로드하지 않습니다.

지명 사전의 출처는 [localization/README.md](localization/README.md), 원어 문자 보완용 Noto 웹폰트의 라이선스와 원출처는 `fonts/world/`에 있습니다.
