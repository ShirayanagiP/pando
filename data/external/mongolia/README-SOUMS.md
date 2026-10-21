# 몽골 솜·울란바토르 구 경계

`soums.geojson`은 **2021년 기준 솜 330개와 울란바토르 구 9개**, 총 339개를 담습니다. 기존 거시 지도용 `regions.geojson`의 아이막 21개·울란바토르 1개는 그대로 유지합니다.

경계는 [geoBoundaries MNG ADM2 고정 커밋 9469f09](https://github.com/wmgeolab/geoBoundaries/tree/9469f09/releaseData/gbOpen/MNG/ADM2)의 원래 도형을 유지했습니다. 원저작자는 **몽골 국가통계청 / OCHA ROAP**, 라이선스는 **[CC BY 3.0 IGO](https://creativecommons.org/licenses/by/3.0/igo/)**입니다. 출처·라이선스를 표시하고 가공 내역을 알리는 조건으로 복제와 가공이 허용됩니다. 이 ADM2 자료의 라이선스는 기존 OSM 기반 ADM1 자료의 ODbL과 다릅니다.

몽골어 원명, NSO 로마자명, 행정 P-code, 소속 아이막은 [NSO/OCHA의 공개 원자료 서비스](https://services-ap1.arcgis.com/QIJaUt9oyULFXfLr/ArcGIS/rest/services/mng_admbnda_adm2_nso_20201019/FeatureServer/0)에서 가져왔습니다. 표준화 전후의 도형을 교차 비교하여 339개를 일대일 연결했고, 가장 낮은 교집합/합집합 비율도 99.999937%입니다. 같은 이름의 솜은 소속 아이막과 P-code로 구별합니다.

- `id`: `MN-S-4804`처럼 기존 아이막 ID와 겹치지 않는 NSO 행정코드 기반 ID
- `name`: NSO의 몽골어 키릴 문자 원명
- `nameKo`: 읽기·검색을 위한 한글 음역과 `솜`/`구` 구분. 공식 한국어 지명이라고 주장하지 않으며 다른 음역이 가능합니다.
- `englishName`: NSO 로마자명을 `c → ts`, `x → kh`, `o' → ö`, `u' → ü`로 정규화한 이름과 `Soum`/`District` 구분. 정규화 전 표기도 `aliases`에 유지합니다.
- `provinceId`: 기존 아이막 ID. 원자료의 `ADM1_MN`을 기존 몽골어 아이막명과 일치시킵니다.

2021년 세부 경계와 기존 2017년 거시 경계는 국토 범위가 99.95% 이상 겹치지만 일부 아이막 사이 경계는 상당히 다릅니다. 특히 울란바토르의 바가노르·바가항가이 월경지에서는 차이가 큽니다. 세부 모드의 아이막 외곽선은 솜들을 `provinceId`로 합쳐 그리는 편이 정확하며, 옛 거시 경계에 맞춰 솜을 자르지 않습니다. 이 자료를 2026년 최신 경계라고 표시하지 않습니다.

대륙판도학 지도 생성 시에는 중국 자료와 맞닿는 솜의 국경 틈을 보정합니다. 거의 일직선인 경계의 접촉 판정에는 출력 좌표 간격의 절반(0.005 지도 단위)을 허용하고, 최종 공유 경계에도 빈 면이 남지 않도록 처리합니다. 부이르호를 비롯한 호수 수역은 보존합니다. 이 가공은 `soums.geojson` 원본이나 거시판도학 아이막을 수정하지 않으며, 내역은 `data/continental-water-repairs.json`과 `data/continental-precision-repairs.json`에 기록합니다.

재생성은 네트워크 없이 실행됩니다.

```powershell
python data/external/mongolia/prepare-soums.py
```

Python 3와 Shapely 2가 필요합니다. 원본 파일 SHA-256, 고정 URL, 339개 소속·도형 연결 검증, 항목별 차이는 `soums-provenance.json`, `soums-name-joins.json`에 기록됩니다. 한글 음역은 `soums-korean-transcriptions.txt`에서 수정할 수 있습니다.
