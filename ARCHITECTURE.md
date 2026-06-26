
# CodeScout Pro - Backend Architecture & Schema Recommendation

This document outlines the recommended production architecture if migrating from the current client-side IndexedDB prototype to a full server-side solution.

## 1. Database Schema (PostgreSQL)

We recommend a relational database to handle structured metadata and efficient spatial queries (using PostGIS for location matching).

### `libraries` (User Namespaces)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| user_id | UUID | Owner ID (Auth) |
| name | String | "My Personal Library" |
| created_at | Timestamp | |

### `documents` (Stored Files)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| library_id | UUID | Foreign Key -> libraries.id |
| title | String | Display Name |
| storage_path | String | S3/GCS Object Key (e.g., `docs/uid/doc_123.pdf`) |
| source_url | String | (Optional) If Link type, stores the URL |
| source_type | Enum | `PDF` or `LINK` |
| file_size | Integer | Bytes |
| mime_type | String | `application/pdf` |
| country | String | ISO Code or Name (Indexed) |
| city | String | Normalized City Name (Indexed) |
| district | String | Optional |
| authority | String | e.g. "RCRC", "Municipality" |
| code_type | Enum | `ZONING`, `BUILDING`, `FIRE`, `OTHER`, etc. |
| code_type_custom | String | (Optional) If code_type is OTHER |
| coverage | Enum | `CITY_WIDE`, `DISTRICT`, `PLOT` |
| year | Integer | e.g. 2024 |
| embedding_status | Enum | `PENDING`, `COMPLETED`, `FAILED` |
| created_at | Timestamp | |

### `document_embeddings` (Vector Search - Optional but Recommended)
| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary Key |
| document_id | UUID | Foreign Key -> documents.id |
| chunk_index | Integer | Order of the text chunk |
| content | Text | Extracted text chunk |
| embedding | Vector(768) | For semantic search (pgvector) |

---

## 2. API Route Design (REST / Next.js API)

### Library Management

#### Create Document
*   **POST** `/api/documents`
*   **Content-Type:** `multipart/form-data`
*   **Body:**
    *   `file`: (Binary) Required if source_type=PDF
    *   `url`: (String) Required if source_type=LINK
    *   `title`: (String)
    *   `country`, `city`, `district`: (String)
    *   `code_type`: (Enum)
    *   `code_type_custom`: (String)
*   **Logic:**
    1. Validate inputs (Code Type Other requires Custom field).
    2. If PDF, upload to S3.
    3. Save metadata to Postgres.
    4. Trigger embedding worker.
*   **Response:** `201 Created` { id: "..." }

#### List Documents
*   **GET** `/api/documents`
*   **Query Params:** `?country=Saudi&city=Riyadh&type=ZONING`
*   **Response:** `200 OK` [ { id, title, type, year, ... } ]

#### Delete Document
*   **DELETE** `/api/documents/:id`
*   **Logic:**
    1. Check ownership.
    2. Delete from Postgres.
    3. Async job to delete from S3 and Embeddings table.
*   **Response:** `204 No Content` or `200 OK` { success: true }

### Search & Retrieval
*   `GET /api/documents/search`: Keyword search using Postgres Full-Text Search (`tsvector`).
    *   `Query`: `?q=residential+height&city=Riyadh`
*   `POST /api/documents/semantic-search`: (Advanced) Vector search against `document_embeddings`.
    *   `Body`: `{ query: "What are the setbacks for R-3 zone?", filter: { city: "Riyadh" } }`

---

## 3. Storage Strategy
*   **Object Storage (AWS S3 / Google Cloud Storage):**
    *   Store original PDFs.
    *   Enable Versioning to handle code updates (2023 vs 2024 versions).
    *   Lifecycle rules to move old versions to Cold Storage (Glacier) for cost savings.

---

## 4. MVP vs Advanced Implementation

### MVP (Current Client-Side Implementation)
*   **Storage:** IndexedDB (Browser).
*   **Search:** Filter by Metadata (City/Country) + AI reads entire PDF content injected into context.
*   **Cost:** $0 (User's device).

### Phase 2 (Server-Side Simple)
*   **Storage:** Postgres (Supabase/Neon) + S3.
*   **Search:** SQL `LIKE` queries on metadata.
*   **AI:** Fetch file URL from S3, pass URL to Gemini (if public) or download buffer and pass to Gemini.

### Phase 3 (Advanced - Enterprise)
*   **Storage:** Postgres + S3.
*   **Processing:** Worker queue (BullMQ) to OCR scanned PDFs and generate Embeddings (OpenAI/Gemini Embeddings).
*   **Retrieval:** RAG (Retrieval Augmented Generation). Instead of sending the whole PDF to the AI, search the Vector DB for the top 5 relevant chunks and only send those to save tokens and improve accuracy.
