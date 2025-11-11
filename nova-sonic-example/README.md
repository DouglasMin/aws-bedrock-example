# Nova Sonic 실시간 음성 챗봇

AWS Bedrock Nova Sonic 모델을 사용한 실시간 음성 대화 챗봇입니다.

## 🚀 빠른 시작 (Node.js - 추천!)

Node.js는 AWS SDK가 공식 지원하므로 가장 안정적입니다.

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env
# .env 파일을 열어서 AWS 자격 증명 입력

# 3. 서버 실행
npm start

# 4. 브라우저에서 열기
# http://localhost:3000
```

## 📋 요구사항

- Node.js 18 이상
- AWS 계정 및 자격 증명
- Nova Sonic 모델 접근 권한

## ⚙️ 환경 변수

`.env` 파일에 다음 내용을 입력하세요:

```env
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
PORT=3000
```

## 🎤 사용법

1. 브라우저에서 `http://localhost:3000` 접속
2. 음성 선택 (Matthew, Tiffany, Amy 등)
3. "Start Conversation" 버튼 클릭
4. 마이크 권한 허용
5. 말하기 시작!
6. AI의 음성 응답 듣기
7. "Stop Conversation"으로 종료

## 🏗️ 프로젝트 구조

```
nova-sonic-example/
├── server.js           # Node.js WebSocket 서버
├── public/
│   ├── index.html     # 웹 UI
│   └── app.js         # 클라이언트 JavaScript
├── package.json       # Node.js 의존성
├── .env              # 환경 변수 (생성 필요)
└── README.md         # 이 파일
```

## 🐍 Python 버전 (실험적)

Python은 실험적 SDK가 필요하므로 복잡합니다. Node.js 사용을 권장합니다.

### Python 간단 데모 (UI만)

```bash
pip install streamlit pyaudio numpy
streamlit run app_simple.py
```

### Python 완전 구현 (AWS 샘플 사용)

```bash
git clone https://github.com/aws-samples/amazon-nova-samples.git
cd amazon-nova-samples/speech-to-speech/sample-codes/console-python
pip install -r requirements.txt
python nova_sonic_simple.py
```

## 🎯 주요 기능

- ✅ 실시간 양방향 음성 스트리밍
- ✅ 낮은 지연시간 대화
- ✅ 실시간 ASR 전사 (음성 → 텍스트)
- ✅ 자연스러운 음성 응답
- ✅ 11가지 음성 선택 (다국어 지원)
- ✅ WebSocket 기반 실시간 통신

## 📚 참고 문서

- [Nova Sonic 공식 문서](https://docs.aws.amazon.com/nova/latest/userguide/speech.html)
- [AWS 샘플 코드](https://github.com/aws-samples/amazon-nova-samples/tree/main/speech-to-speech)
- [Node.js WebSocket 예제](https://github.com/aws-samples/amazon-nova-samples/tree/main/speech-to-speech/sample-codes/websocket-nodejs)

## 🔧 문제 해결

### 마이크 권한 오류
- 브라우저 설정에서 마이크 권한 확인
- HTTPS 또는 localhost에서만 작동

### WebSocket 연결 오류
- AWS 자격 증명 확인
- Nova Sonic 모델 접근 권한 확인
- 방화벽 설정 확인

### 오디오 재생 안 됨
- 브라우저 오디오 권한 확인
- 스피커/헤드폰 연결 확인
