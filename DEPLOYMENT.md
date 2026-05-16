# LUCID Cloud Run Deployment

## Clean Local Verification

```bash
rm -rf .next node_modules dist build out .turbo
npm ci --cache /tmp/lucid-npm-cache
npm run build
PORT=8080 HOSTNAME=0.0.0.0 npm start
```

Open:

```bash
http://127.0.0.1:8080/
http://127.0.0.1:8080/agent
```

## Recommended Cloud Run Docker Deploy

Set values:

```bash
export PROJECT_ID="lucid-agent-project"
export REGION="us-central1"
export REPOSITORY="lucid"
export SERVICE="lucid-cognitive-triage-agent"
```

Configure gcloud:

```bash
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com aiplatform.googleapis.com
```

Create Artifact Registry repo once:

```bash
gcloud artifacts repositories create "$REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="LUCID Docker images"
```

Deploy with Cloud Build:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _REGION="$REGION",_REPOSITORY="$REPOSITORY",_SERVICE="$SERVICE"
```

Get public URL:

```bash
gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --format="value(status.url)"
```

## If The Artifact Repo Already Exists

Skip repository creation and run only:

```bash
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions _REGION="us-central1",_REPOSITORY="lucid",_SERVICE="lucid-cognitive-triage-agent"
```

## Runtime Environment Variables

Set these in Cloud Run after deploy, or add them during deploy if needed:

```bash
gcloud run services update "$SERVICE" \
  --region "$REGION" \
  --set-env-vars GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY",GOOGLE_API_MODE="vertex_express",GOOGLE_MODEL="gemini-2.5-flash",MONGODB_URI="YOUR_MONGODB_URI",MONGODB_DB="lucid"
```

If MongoDB is not ready, omit `MONGODB_URI`; LUCID will use fallback patterns.

## Direct Docker Commands

```bash
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/$SERVICE:latest"

gcloud builds submit --tag "$IMAGE"

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 3
```
