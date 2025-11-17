# Google Calendar 설정 가이드

## 1. credentials.json 파일 준비

Google Cloud Console에서 다운로드한 `credentials.json` 파일을:
```
nova-sonic-tool-use/credentials.json
```
위치에 저장하세요.

## 2. 테스트 실행

```bash
node tests/test-calendar-auth.js
```

## 3. 인증 과정

1. 브라우저가 자동으로 열립니다
2. Google 계정으로 로그인
3. "Nova Sonic이 Google Calendar에 접근하도록 허용" 클릭
4. 인증 완료!

## 4. 결과

- `token.json` 파일이 자동 생성됩니다
- 다음부터는 자동으로 이 토큰을 사용합니다
- 캘린더의 다가오는 이벤트 10개가 출력됩니다

## 문제 해결

### "credentials.json not found"
- Google Cloud Console에서 OAuth 클라이언트 ID를 생성하고
- credentials.json을 다운로드하여 프로젝트 루트에 저장하세요

### "redirect_uri_mismatch"
- Google Cloud Console → Credentials → OAuth 2.0 Client IDs
- Authorized redirect URIs에 `http://localhost:3000/oauth2callback` 추가

### 브라우저가 안 열릴 때
- 터미널에 출력된 URL을 복사해서 브라우저에 직접 붙여넣으세요

## 보안 주의사항

⚠️ **절대 Git에 커밋하지 마세요:**
- `credentials.json` - OAuth 클라이언트 시크릿 포함
- `token.json` - 사용자 액세스 토큰 포함

이 파일들은 `.gitignore`에 이미 추가되어 있습니다.
