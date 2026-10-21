# 오프라인 지명 사전

`place-names.json`과 루트의 `place-names-data.js`에는 기존 지도 ID에 대응하는 한국어·영어·원어 지명을 넣었습니다. 대륙·거시 지도 전체와 일본 진흥국 14개의 지명을 포함합니다. 현재 지도에 쓰지 않는 옛 아이막 이름도 거시 지도와 검색을 위해 보관합니다. 지도 경계·지역 ID·사용자 범례·색상에는 손대지 않습니다. 웹페이지에서 외부 번역 API에 접속하지 않습니다.

## 출처와 가공

- 중국: [Wikidata](https://www.wikidata.org/)의 한국어·영어 레이블. [P442](https://www.wikidata.org/wiki/Property:P442) 및 [P13971](https://www.wikidata.org/wiki/Property:P13971) 행정코드를 지도 코드와 대조했습니다. 구조화 데이터는 [CC0](https://www.wikidata.org/wiki/Wikidata:Licensing)입니다. 후양허시는 [Q9435117](https://www.wikidata.org/wiki/Q9435117)을 보충했습니다. 기존 지도에서 시인 곳의 오래된 ‘지구’ 접미사는 ‘시’로 맞추고, 원래 레이블도 검색 별칭에 보관했습니다. 영문은 기존 경계 자료의 로마자와 Wikidata 별칭을 함께 사용합니다.
- 일본: [Geolonia 住所データ](https://github.com/geolonia/japanese-addresses)의 국토교통성 자료 기반 가나·로마자 독음. 데이터는 **CC BY 4.0**, 원본 README는 `sources/japan-addresses-README.md`에 있습니다. 정·촌이 아니라 군·지청으로 표시하는 현재 지도에 맞춰 군 이름을 생성하고, 구성 정·촌의 독음은 검색 별칭에 넣었습니다. 정령지정도시 구는 도시와 구를 구분해 한글로 읽습니다. 한글은 일본어 독음의 음역이며 장음은 생략했습니다. 자료에 주소 행이 없는 [利島村](https://toshimamura.org/about/toshima.html)·[湯前町](https://www.town.yunomae.lg.jp/) 독음은 해당 지자체에서 보충했습니다. 홋카이도 진흥국 이름은 [공식 목록](https://www.iburi.pref.hokkaido.lg.jp/gyosei/shicho/index.html)을 대조했습니다. 오호츠크는 통용 한글 이름을 사용합니다.
- 남한·북한·몽골·대만: 기존 지도에 포함된 지명·별칭과 출처 영문을 유지했습니다. 남한의 시군구 이름은 로마자 도구로 표기하되 종로·강릉·울릉 독음을 보정했습니다. 기존 출처와 라이선스는 `data/LICENSE-EAST-ASIA.md` 및 국가별 출처 문서에 있습니다.

지명은 기존 경계 자료의 시기를 따릅니다. 번역의 여러 관용 표기는 기존 별칭과 함께 검색할 수 있습니다. 사용자가 입력한 범례·표시 이름은 번역하지 않습니다.

- 러시아: `external/russia/`의 OSM 원어·영문 이름과 검색용 한국어 음역을 사용합니다.
- 몽골 솜: NSO/OCHA 원어·영문·P-code 및 검색용 한국어 음역을 사용합니다.
- 세계 1차 행정구역: Natural Earth 다국어 지명과 `external/world/`의 계층별 병합 이름을 사용합니다.

## 재생성

`scripts/prepare-place-names.py`는 경계를 재가공하지 않고 사전만 만듭니다. 필요한 원자료 추출본은 이 폴더에 보관했습니다. 원본 다운로드 SHA256, 크기, 저장소 참조, 보충 출처는 `provenance.json`에 있습니다. 전체 일본 주소 CSV는 필요한 8개 행정구역 독음 열을 추출한 뒤 제거했습니다.

개발 시에만 Python의 `korean-romanizer 0.28.0`과 Hangulize 일본어 모델 `0.0.9`가 필요합니다. 현재 개발용 사본은 `.qa/localization-lib`·`.qa/japan-name-tools`에 있습니다. [korean-romanizer](https://github.com/osori/korean-romanizer)는 GPL-3.0, [Hangulize](https://github.com/sublee/hangulize)는 BSD입니다. 이 도구의 실행 코드는 웹페이지에 포함하지 않으며 일반 사용자는 설치할 필요가 없습니다.
