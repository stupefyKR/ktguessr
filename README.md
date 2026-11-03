# Streetlens

Google Street View의 주변 풍경을 관찰하고 지도에서 위치를 추측하는 **개인 지리 연습용 웹 앱**입니다. 한국어 UI를 제공하며 HTML/CSS/JavaScript로 동작합니다.

## 기능

- 거리뷰 제공 지역에서 무작위 출발점 선정
- 거리뷰 이동·회전·확대, 북쪽 정렬, 출발점 복귀
- 지도 클릭 또는 좌표 입력으로 추측 위치 선택
- 정답과 추측 위치를 함께 표시하고 직선거리 오차 계산
- 전 세계·일본·대한민국·아이슬란드·유럽·뉴질랜드 범위 선택
- 최근 100회의 기록, 평균 오차, 최고 기록을 브라우저에 저장

**Google Maps API 키와 인터넷 연결이 필요합니다.** 로컬 실행에는 Python 3.8 이상이 필요하며, Python 추가 패키지나 npm 의존성을 설치할 필요는 없습니다. GitHub Pages에 배포해 쓰는 경우 사용자의 컴퓨터에 Python이 필요하지 않습니다.

## 빠른 시작

1. 저장소를 내려받아 압축을 전부 풉니다.
2. Windows에서는 **`start.cmd`를 더블클릭**합니다. PowerShell에서는 `./start.cmd`를 실행할 수 있습니다.
3. 브라우저에서 `http://127.0.0.1:4173/`이 열립니다.
4. **연습 시작하기**를 누르고 아래 안내에 따라 Google Maps API 키를 연결합니다.
5. 콘솔 창을 유지한 채 연습합니다. 종료할 때 콘솔에서 **Ctrl+C**를 누릅니다.

macOS/Linux:

```sh
sh ./start
# 또는
python3 launcher.py
```

Windows에서 Python 명령으로 직접 실행:

```powershell
python launcher.py
```

`start` 파일은 기존 Python 확인 → 앱 파일 확인 → 로컬 서버 시작 → 기본 브라우저 열기를 수행합니다. API 키 생성과 결제 연결은 본인 Google 계정에서 직접 진행합니다.

## Google Maps API 설정

1. [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials)에서 프로젝트를 선택하거나 생성합니다.
2. 프로젝트에 결제 계정을 연결합니다. 지도·거리뷰 사용량에 따라 Google 요금이 발생할 수 있습니다.
3. **Maps JavaScript API**를 활성화합니다. Places·Geocoding·Routes API는 사용하지 않습니다.
4. API 키를 만들고 **애플리케이션 제한 → 웹사이트(HTTP 리퍼러)**에 로컬 실행 주소를 추가합니다.

```text
http://127.0.0.1:4173/*
http://localhost:4173/*
```

5. **API 제한 → Maps JavaScript API**를 선택합니다.
6. 앱의 API 키 입력란에 키를 붙여넣고 연결합니다.

GitHub Pages에 배포했다면 허용 웹사이트에 자신의 Pages 도메인을 추가합니다.

```text
https://YOUR_USERNAME.github.io/*
```

사용자 지정 도메인이 있으면 해당 도메인도 추가합니다. 설정 변경 직후에는 반영에 시간이 걸릴 수 있습니다.

[Google 공식 키 설정 안내](https://developers.google.com/maps/documentation/javascript/get-api-key?hl=ko)

### 키와 기록의 보관 방식

- API 키를 코드나 GitHub 저장소에 넣을 필요가 없습니다. **브라우저의 연결 화면에서 입력**합니다.
- 키는 브라우저에서 Google로 직접 전달되며 로컬 서버에 저장하지 않습니다.
- ‘이 브라우저에 키 기억하기’를 선택하면 localStorage에 보관합니다.
- 키 변경 후 SDK를 새로 로드할 때 sessionStorage로 한 번 전달한 뒤 제거합니다.
- 웹사이트용 키는 사용 중 브라우저에서 확인할 수 있으므로 HTTP 리퍼러 및 API 제한을 적용하세요.
- 연습 기록도 localStorage에만 보관합니다. 별도의 계정·데이터베이스는 없습니다.

## GitHub에 업로드하기

현재 폴더의 **내용 전체**를 저장소의 최상위에 올립니다. `.github`, `.gitignore`, `.gitattributes` 같은 숨김 항목도 포함해야 합니다.

새 빈 저장소에 Git으로 업로드하는 예시:

```sh
git init -b main
git add .
git commit -m "Add Streetlens geography practice app"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git push -u origin main
```

`YOUR_USERNAME`과 `YOUR_REPOSITORY`는 자신의 계정·저장소명으로 바꿉니다. 기존 저장소에 넣는 경우 그 저장소를 clone한 뒤 이 폴더의 파일을 복사하고 commit/push하면 됩니다.

이 배포본에는 API 키, 개인 경로, 기존 호스팅 프로젝트 ID, Git 저장소 인증 정보를 포함하지 않습니다. `.gitignore`는 로컬 자격 증명 파일과 개발 산출물을 제외하도록 구성했습니다.

## GitHub Actions와 GitHub Pages

두 개의 워크플로를 제공합니다.

- **Checks:** push·pull request에서 JavaScript 문법, 거리·위치 추출 테스트, Python 서버 테스트를 실행합니다. Linux와 Windows에서 검사합니다.
- **Deploy to GitHub Pages:** **수동 실행**으로 `dist/` 웹 앱만 배포합니다. 소스를 올리는 것만으로 Pages 배포를 시작하지 않습니다.

Pages로 배포하려면:

1. 저장소 **Settings → Pages → Build and deployment → Source**를 **GitHub Actions**로 설정합니다.
2. **Actions → Deploy to GitHub Pages → Run workflow**를 선택합니다.
3. 완료되면 배포 결과에 표시되는 Pages 주소를 엽니다.
4. 그 도메인을 Google API 키의 허용 웹사이트에 추가하고 앱에서 키를 연결합니다.

별도의 Google API 키용 GitHub Secret은 필요하지 않습니다. GitHub Pages는 `dist/`의 정적 파일을 호스팅하며, 키는 접속한 브라우저에서 입력합니다.

[GitHub 공식 Pages 워크플로 안내](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 구조

```text
.
├── start.cmd                 # Windows 실행 파일
├── start                     # macOS/Linux 실행 파일
├── launcher.py               # 표준 라이브러리만 사용하는 로컬 서버
├── dist/                     # 실제 웹 앱 / Pages 배포 대상
│   ├── index.html
│   ├── styles.css
│   ├── app.mjs
│   ├── core.mjs
│   └── favicon.svg
├── tests/
│   ├── core.test.mjs          # 거리·위치 추출 검사
│   ├── test_launcher.py       # 실행기·HTTP 서버 검사
│   ├── serve.mjs              # 개발용 Node 서버
│   └── google-double.js      # UI 검사 전용 모의 SDK
├── .github/workflows/
│   ├── checks.yml
│   └── pages.yml
├── .gitignore
├── .gitattributes
├── package.json
└── README.md
```

## 개발과 검사

실제 앱 소스는 `dist/` 안에서 편집합니다. 빌드 과정은 없습니다.

Node.js 22 이상에서:

```sh
node --check dist/app.mjs
node --check dist/core.mjs
node --test tests/core.test.mjs
```

Python 서버 검사:

```sh
python -B -m unittest discover -s tests -p "test_launcher.py" -v
```

서버·브라우저를 열지 않고 파일 확인:

```sh
python launcher.py --check
```

브라우저를 자동으로 열지 않기:

```sh
python launcher.py --no-browser
```

개발용 Node 서버와 모의 SDK 화면:

```sh
node tests/serve.mjs
```

`http://127.0.0.1:4173/__qa__/`는 UI 검증용이며 실제 Google 이미지가 아닙니다. 모의 SDK는 `dist/`에 없으므로 Pages에 배포되지 않습니다. 실제 Google 지도·거리뷰 연결 검증에는 유효한 API 키가 필요합니다.

## 동작 방식과 한계

- Street View가 있는 여러 검색 구역에서 무작위 지점을 뽑고 Google의 공식 야외 거리뷰를 확인합니다. 전 세계 면적에 비례한 균일 추출은 아닙니다.
- 연속 실패 시 촬영이 알려진 지역 주변으로 검색을 좁힙니다. 검색 횟수와 시간을 제한하며 취소·재시도가 가능합니다.
- 실제 정답은 검색 후보 좌표가 아닌 Google이 반환한 **원래 출발 파노라마의 좌표**입니다.
- 거리 오차는 평균 지구 반지름 6,371,008.8m를 사용하는 Haversine 대권거리입니다. 도로를 따라가는 이동 거리가 아닙니다.
- 개인 연습용 클라이언트 앱입니다. 개발자 도구에 대한 부정행위 방지 기능은 없습니다.
- 거리뷰의 주소·도로명 오버레이는 연습 중 숨기고 Google 저작권·제공자 표시는 유지합니다.
- Google Fonts와 Google Maps를 인터넷으로 불러옵니다. 완전한 오프라인 앱은 아닙니다.

## 실행 문제 해결

- **4173 포트 사용 중:** 같은 파일의 앱이 이미 실행 중이면 기존 주소를 엽니다. 다른 앱이나 다른 버전이면 자동 종료하지 않습니다. 기존 서버를 닫거나 `./start.cmd --port 4174`로 실행하고 Google 허용 웹사이트의 포트도 추가합니다.
- **Python을 찾지 못함:** [Python 공식 사이트](https://www.python.org/downloads/)에서 Python 3을 설치하거나 GitHub Pages 배포본을 사용합니다.
- **파일을 찾지 못함:** ZIP 전체를 풀고 실행기와 `dist/`를 같은 상위 폴더에 둡니다.
- **브라우저가 열리지 않음:** 콘솔의 `Local:` 주소를 직접 엽니다.
- **Google 인증 실패:** API 활성화·키·결제·HTTP 리퍼러 설정을 확인합니다.
- **HTML을 더블클릭해서 열었을 때:** `file://` 대신 `start.cmd`가 여는 HTTP 주소로 접속합니다.
