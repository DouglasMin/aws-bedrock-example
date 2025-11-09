# AWS Bedrock Nova 모델 사용 가이드

이 저장소는 AWS Bedrock의 Nova 모델을 사용하여 이미지와 비디오를 생성하는 Streamlit 애플리케이션 예제를 제공합니다.

## 개요

AWS Bedrock Nova는 Amazon에서 개발한 최신 생성형 AI 모델 패밀리입니다:
- **Nova Canvas**: 텍스트로 이미지 생성 및 이미지 편집 (인페인팅)
- **Nova Reel**: 텍스트로 비디오 생성

이 저장소는 두 가지 실용적인 예제 애플리케이션을 포함합니다.

## 프로젝트 구조

```
bedrock-test/
├── image-generation-test/    # Nova Canvas 이미지 생성 앱
│   ├── app.py                # Streamlit 이미지 생성 애플리케이션
│   ├── requirements.txt      # Python 의존성
│   ├── .env                  # AWS 자격증명 (생성 필요)
│   └── README.md            # 상세 사용 가이드
│
├── video-generation-test/    # Nova Reel 비디오 생성 앱
│   ├── app.py                # Streamlit 비디오 생성 애플리케이션
│   ├── .streamlit/
│   │   └── secrets.toml     # AWS 자격증명 (생성 필요)
│   └── README.md            # 상세 사용 가이드
│
└── README.md                 # 이 파일
```

## 사전 요구사항

- AWS 계정 및 Bedrock 액세스 권한
- Python 3.8 이상
- AWS 자격증명 (Access Key ID, Secret Access Key)
- 필요한 IAM 권한:
  - `bedrock-runtime:InvokeModel` (이미지 생성용)
  - `bedrock-runtime:StartAsyncInvoke` (비디오 생성용)
  - `bedrock-runtime:GetAsyncInvoke` (비디오 생성용)
  - `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` (비디오 생성용)

## 빠른 시작

### 1. 이미지 생성 앱 (Nova Canvas)

텍스트 프롬프트로 이미지를 생성하거나 기존 이미지를 편집할 수 있습니다.

```bash
cd image-generation-test
pip install -r requirements.txt

# .env 파일 생성 및 AWS 자격증명 입력
echo "AWS_ACCESS_KEY_ID=your-key" > .env
echo "AWS_SECRET_ACCESS_KEY=your-secret" >> .env
echo "AWS_REGION=us-east-1" >> .env

streamlit run app.py
```

**주요 기능:**
- 텍스트-이미지 생성: 프롬프트로 새 이미지 생성
- 인페인팅: 이미지의 특정 영역을 마스크로 선택하여 수정
- 대화형 캔버스: 마우스로 편집할 영역 직접 그리기
- 파라미터 조정: CFG Scale, Seed 등으로 결과 제어

**자세한 내용:** [image-generation-test/README.md](image-generation-test/README.md)

### 2. 비디오 생성 앱 (Nova Reel)

텍스트 프롬프트로 짧은 비디오를 생성합니다.

```bash
cd video-generation-test
pip install -r requirements.txt

# .streamlit/secrets.toml 파일 생성 및 AWS 자격증명 입력
mkdir -p .streamlit
cat > .streamlit/secrets.toml << EOF
AWS_ACCESS_KEY_ID = "your-key"
AWS_SECRET_ACCESS_KEY = "your-secret"
AWS_REGION_NAME = "us-east-1"
EOF

streamlit run app.py
```

**주요 기능:**
- 텍스트-비디오 생성: 프롬프트로 6초 비디오 생성
- S3 통합: 생성된 비디오를 S3 버킷에 자동 저장
- 실시간 상태 확인: 비디오 생성 진행 상황 모니터링
- 자동 재생: 생성 완료 후 앱에서 바로 재생

**자세한 내용:** [video-generation-test/README.md](video-generation-test/README.md)

## 중요 구현 참고사항

### 이미지 생성 (Nova Canvas)

⚠️ **마스크 로직 주의**: 인페인팅 시 마스크 색상이 일반적인 이미지 편집 도구와 반대입니다.
- **흰색 (255)**: 유지할 영역
- **검은색 (0)**: 수정할 영역

### 비디오 생성 (Nova Reel)

⚠️ **필수 필드**:
1. `videoGenerationConfig`는 반드시 포함되어야 합니다 (fps, durationSeconds, dimension, seed)
2. S3 URI는 반드시 디렉토리를 가리켜야 하며 끝에 슬래시(`/`)가 있어야 합니다
   - ✅ 올바름: `s3://my-bucket/`
   - ❌ 잘못됨: `s3://my-bucket`

## 보안 주의사항

🔒 **자격증명 관리**:
- `.env` 및 `secrets.toml` 파일은 절대 Git에 커밋하지 마세요
- 두 파일 모두 `.gitignore`에 포함되어 있습니다
- 프로덕션 환경에서는 IAM 역할이나 AWS Secrets Manager 사용을 권장합니다

## 문제 해결

### AWS 자격증명 오류
- `.env` 또는 `secrets.toml` 파일이 올바른 위치에 있는지 확인
- AWS 자격증명이 유효하고 필요한 권한이 있는지 확인
- 리전이 올바른지 확인 (Nova 모델은 us-east-1에서 사용 가능)

### 비디오 생성 실패
- S3 버킷 이름이 올바르고 액세스 권한이 있는지 확인
- S3 URI 형식이 올바른지 확인 (끝에 `/` 포함)
- `videoGenerationConfig`가 모든 필수 필드를 포함하는지 확인

### 이미지 인페인팅이 예상과 다르게 동작
- 마스크 색상 로직 확인: 검은색 = 수정, 흰색 = 유지
- 캔버스에 최소 하나의 사각형을 그렸는지 확인

## 참고 자료

- [AWS Bedrock 공식 문서](https://docs.aws.amazon.com/bedrock/)
- [Nova Canvas 문서](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-nova-canvas.html)
- [Nova Reel 문서](https://docs.aws.amazon.com/bedrock/latest/userguide/bedrock-runtime_example_bedrock-runtime_Scenario_AmazonNova_TextToVideo_section.html)
- [Bedrock Runtime API 참조](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_Operations_Amazon_Bedrock_Runtime.html)

## 라이선스

이 프로젝트는 교육 및 데모 목적으로 제공됩니다. AWS 서비스 사용 시 해당 서비스의 요금이 부과될 수 있습니다.

## 기여

이슈나 개선 사항이 있으면 자유롭게 제안해주세요!
