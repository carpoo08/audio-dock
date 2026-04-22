# Audio Dock 배포 방법

이 프로젝트는 빌드가 필요 없는 정적 사이트입니다.

## 가장 쉬운 방법: Vercel

1. 이 폴더를 GitHub 저장소에 올립니다.
2. [Vercel](https://vercel.com/)에 로그인합니다.
3. `Add New Project`에서 GitHub 저장소를 선택합니다.
4. Framework Preset은 `Other`, Root는 그대로 둡니다.
5. 배포하면 바로 공개 URL이 생성됩니다.

## 가장 쉬운 방법 2: Netlify

1. 이 폴더를 GitHub 저장소에 올립니다.
2. [Netlify](https://www.netlify.com/)에 로그인합니다.
3. `Add new site` -> `Import an existing project`를 선택합니다.
4. GitHub 저장소를 연결하고 배포합니다.

## GitHub Pages

1. GitHub에 새 저장소를 만듭니다.
2. 현재 파일들을 저장소 루트에 업로드합니다.
3. GitHub 저장소의 `Settings` -> `Pages`로 이동합니다.
4. Source를 `Deploy from a branch`로 선택합니다.
5. 브랜치는 `main`, 폴더는 `/ (root)`로 설정합니다.

## 포함된 배포 파일

- `vercel.json`: Vercel용 정적 배포 설정
- `netlify.toml`: Netlify용 배포 설정
- `site.webmanifest`: 모바일 홈 화면 추가용 메타데이터
- `favicon.svg`: 탭 아이콘
