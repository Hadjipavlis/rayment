# Rayment API Documentation

## Overview

Rayment provides pay-per-render GPU services with instant crypto payments.

**Base URL:** `https://hub.rayment.io`

**Authentication:** Solana wallet signatures for provider actions.

---

## Public Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "rayment-hub",
  "version": "1.0.0"
}
```

---

### Hub Statistics

```
GET /stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalProviders": 42,
    "onlineProviders": 28,
    "totalJobs": 15420,
    "completedJobs": 14892,
    "totalVolumeSOL": 1542.5,
    "avgRenderTime": 45.2
  }
}
```

---

### List Providers

```
GET /providers
GET /providers?status=online
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `online`, `offline`, `busy` |

**Response:**
```json
{
  "success": true,
  "data": {
    "providers": [
      {
        "id": "uuid",
        "name": "GPU Farm Alpha",
        "wallet": "So1ana...",
        "endpoint": "http://provider.com:4402",
        "spec": {
          "gpus": [{ "name": "RTX 4090", "vram": 24 }],
          "gpuCount": 4,
          "totalVram": 96,
          "maxFileSize": 2000,
          "supportedFormats": [".blend", ".obj"],
          "blenderVersion": "4.0",
          "renderEngines": ["cycles", "eevee"]
        },
        "pricing": {
          "pricePerFrame": 0.001,
          "pricePerSecond": 0.0001,
          "pricePerGb": 0.01,
          "minimumPrice": 0.005,
          "currency": "SOL"
        },
        "status": "online",
        "rating": 4.8,
        "completedJobs": 1542
      }
    ],
    "total": 28
  }
}
```

---

### Get Provider Details

```
GET /providers/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "GPU Farm Alpha",
    // ... full provider object
  }
}
```

---

## Render Flow

### 1. Submit Render Job

```
POST /render
Content-Type: multipart/form-data
```

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | 3D scene file |
| `clientWallet` | string | Yes | Client's Solana wallet |
| `providerId` | string | No | Preferred provider (auto-select if omitted) |
| `settings` | JSON | No | Render settings |

**Settings Object:**
```json
{
  "resolution": { "width": 1920, "height": 1080 },
  "frames": { "start": 1, "end": 1 },
  "engine": "cycles",
  "samples": 128,
  "outputFormat": "PNG"
}
```

**Response (HTTP 402):**
```json
{
  "success": false,
  "error": "Payment Required",
  "payment": {
    "jobId": "uuid",
    "price": 0.0084,
    "breakdown": {
      "basePrice": 0.008,
      "fileSizeFee": 0.001,
      "frameFee": 0.001,
      "estimatedRenderFee": 0.006,
      "platformFee": 0.0004,
      "total": 0.0084
    },
    "payTo": "ProviderWallet...",
    "expiresAt": 1699999999999,
    "memo": "rayment:job-uuid"
  }
}
```

---

### 2. Confirm Payment

```
POST /render/pay
Content-Type: application/json
```

**Request:**
```json
{
  "jobId": "uuid",
  "txSignature": "solana-transaction-signature"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "uuid",
    "status": "queued",
    "message": "Payment confirmed, render queued"
  }
}
```

---

### 3. Check Job Status

```
GET /render/:jobId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "clientWallet": "Client...",
    "providerId": "provider-uuid",
    "status": "rendering",
    "fileName": "scene.blend",
    "fileSize": 104857600,
    "settings": { ... },
    "estimatedPrice": 0.0084,
    "paymentTx": "tx-signature",
    "paymentStatus": "confirmed",
    "createdAt": 1699999000000,
    "startedAt": 1699999100000
  }
}
```

**Status Values:**
| Status | Description |
|--------|-------------|
| `pending_payment` | Waiting for payment |
| `paid` | Payment confirmed |
| `queued` | Waiting for provider |
| `rendering` | Currently rendering |
| `completed` | Render finished |
| `failed` | Render failed |
| `cancelled` | Job cancelled |

---

### 4. Download Result

```
GET /render/:jobId/result
```

**Response:** Binary PNG file

---

## Provider Endpoints

### Register Provider

```
POST /provider/register
Content-Type: application/json
```

**Request:**
```json
{
  "name": "My GPU Farm",
  "wallet": "SolanaWallet...",
  "endpoint": "http://my-server.com:4402",
  "spec": {
    "gpus": [{ "name": "RTX 4090", "vram": 24 }],
    "gpuCount": 4,
    "totalVram": 96,
    "maxFileSize": 2000,
    "supportedFormats": [".blend", ".obj", ".fbx"],
    "blenderVersion": "4.0",
    "renderEngines": ["cycles", "eevee"]
  },
  "pricing": {
    "pricePerFrame": 0.001,
    "pricePerSecond": 0.0001,
    "pricePerGb": 0.01,
    "minimumPrice": 0.005,
    "currency": "SOL"
  },
  "signature": "signed-message"
}
```

**Signature Message:** `register:{wallet}:{name}`

**Response:**
```json
{
  "success": true,
  "data": {
    "providerId": "uuid",
    "message": "Provider registered successfully"
  }
}
```

---

### Update Status

```
PUT /provider/status
Content-Type: application/json
```

**Request:**
```json
{
  "providerId": "uuid",
  "status": "online",
  "signature": "signed-message"
}
```

**Signature Message:** `status:{providerId}:{status}`

---

### Update Pricing

```
PUT /provider/pricing
Content-Type: application/json
```

**Request:**
```json
{
  "providerId": "uuid",
  "pricing": {
    "pricePerFrame": 0.002,
    "pricePerSecond": 0.0002,
    "pricePerGb": 0.02,
    "minimumPrice": 0.01,
    "currency": "SOL"
  },
  "signature": "signed-message"
}
```

---

### Report Job Complete

```
POST /provider/job/:jobId/complete
Content-Type: multipart/form-data
```

**Form Data:**
| Field | Type | Description |
|-------|------|-------------|
| `result` | file | Rendered image |
| `providerId` | string | Provider ID |
| `renderTime` | number | Render time in seconds |
| `signature` | string | Signed message |

---

### Report Job Failed

```
POST /provider/job/:jobId/failed
Content-Type: application/json
```

**Request:**
```json
{
  "providerId": "uuid",
  "error": "Out of memory"
}
```

---

## WebSocket API

**Endpoint:** `wss://hub.rayment.io/ws`

### Authentication

```json
{
  "type": "auth",
  "providerId": "uuid",
  "timestamp": 1699999999999,
  "signature": "signed-message"
}
```

**Signature Message:** `ws:{providerId}:{timestamp}`

### Events

**Job Paid:**
```json
{
  "type": "job:paid",
  "jobId": "uuid",
  "txSignature": "..."
}
```

**Heartbeat:**
```json
{
  "type": "heartbeat"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": "Error message"
}
```

**HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 400 | Bad request |
| 401 | Unauthorized (invalid signature) |
| 402 | Payment required |
| 404 | Not found |
| 429 | Too many requests |
| 500 | Server error |
| 503 | No providers available |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/render` | 10/min per IP |
| `/providers` | 60/min per IP |
| All others | 120/min per IP |

---

## SDKs

- **JavaScript/TypeScript:** `npm install rayment`
- **Python:** Coming soon
- **Rust:** Coming soon
