# 세계 지명용 보완 글꼴

공식 [Noto 저장소](https://github.com/notofonts/noto-fonts/tree/ffebf8c1ee449e544955a7e813c54f9b73848eac)의 고정된 static Regular TTF를 사용합니다. 아랍어, 타이어, 데바나가리, 아르메니아어, 히브리어 5종이며 [SIL OFL 1.1](OFL.txt)을 유지합니다. 원본 TTF와 가공 WOFF, 출처·해시는 이 폴더에 함께 보관합니다.

`data/external/world/regions.geojson`의 실제 `nativeName` 문자로 subset을 만들었습니다. 아랍어는 기존 751개 presentation form과 원본에 있는 아랍 문자·기호도 보존합니다. 기존 글꼴에 현재 자료의 그리스어·키릴 문자가 모두 있어 이를 중복해서 넣지는 않았습니다. U+200E는 방향 제어 문자로, 화면에 그리는 글리프가 없어도 정상입니다.

`world-font-data.js`는 CommonJS에서 배열을 내보내고 브라우저에서는 `globalThis.PANDO_WORLD_FONTS`를 만듭니다. 각 항목은 `{ id, data, format: 'woff', mime: 'font/woff' }`이며 `data`가 base64 글꼴입니다. 이 자산 작업에서는 기존 런타임 파일을 수정하지 않았습니다.

현재 OpenType.js로 5종의 WOFF와 모든 실제 원어 문자의 글리프·경로를 검증합니다. 원본 Arabic 가변 TTF도 기본 축의 파싱과 경로 생성은 가능하지만 가변 축 적용을 확인한 것은 아니므로, 포함한 실행 자산은 static 글꼴입니다.

이 자산은 빠진 글리프를 보완합니다. 아랍어·인도계 문자의 조형과 양방향 문장 배치는 렌더러에서 별도로 처리해야 합니다.

```powershell
python fonts/world/prepare-world-fonts.py
node fonts/world/verify-world-fonts.cjs
```
