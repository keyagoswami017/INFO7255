# INFO 7255-API

INFO722-API — Healthcare Plans Service

A Node.js REST API for storing, retrieving, updating, deleting, and searching healthcare plan JSON objects, built with:
- **Redis** — Key-Value store for fast CRUD operations.  
- **Elasticsearch** — Advanced search with parent–child document relationships.
- **Kibana** — Visualization and Dev Tools for Elasticsearch.
- **RabbitMQ** — Messaging for POST, PATCH, DELETE events.  
- **Docker** — Containerized setup for all services.  
- **ETag** — Conditional GET/PATCH for concurrency control. 

## 🚀 Features

- Create, Read, Update, Delete healthcare plan JSON objects.  
- Store root and nested objects separately in Redis with keys like:  
  - `plan : <planId>`  
  - `membercostshare : <objectId>`  
  - `service : <objectId>`  
  - `planservice : <objectId>`  
- Index documents in Elasticsearch with **parent–child relationships**.  
- Publish POST, PATCH, DELETE events to RabbitMQ.  
- Support complex search queries (`has_child`, `has_parent`, `wildcard`, `term`, `match`).  
- ETag-based concurrency control for GET/PATCH requests.  

## 🗄 Redis Key Structure

- `plan : <id>`
- `membercostshare : <id>`
- `planservice : <id>`
- `service : <id>`

## 📚 Data Relationships

- `plan` → `linkedPlanServices`, `planCostShares`
- `linkedPlanServices` → `linkedService`, `planserviceCostShares`

---

## 🔍 Advanced Features

- **Advanced Elasticsearch queries:** `has_child`, `has_parent`, `term`, `wildcard`, `range`
- **ETag headers** for safe GET/PATCH (optimistic concurrency control)
- **PATCH** removes orphan Elasticsearch documents before reindexing
- **DELETE** fully removes data from Redis (including ETag key) and Elasticsearch

---

## 🛠 Tech Stack

- **Node.js** (Express)
- **Redis** — Key-Value store for fast CRUD operations
- **Elasticsearch 8.x** — Parent–child search & indexing
- **RabbitMQ** — Messaging for POST, PATCH, DELETE events
- **Docker & docker-compose**
- **AJV** — JSON Schema validation

---

## 📦 Setup

### 1️⃣ Clone & Configure
```bash
git clone <repo-url>
cd INFO722-API
cp .env.example .env
# Adjust environment variables if needed
```
### 2️⃣ Start services
```
docker compose up -d --build
```

### 3️⃣ Service URLs
```
	•	API: http://localhost:3000
	•	Elasticsearch: http://localhost:9200
	•	RabbitMQ UI: http://localhost:15672 (guest/guest)
	•	Kibana: http://localhost:5601 (if enabled)
```
### ⚙️ Environment Variables

| Variable      | Description                               |
|---------------|-------------------------------------------|
| `PORT`        | API port                                  |
| `REDIS_HOST`  | Redis hostname (e.g., `redis`)            |
| `REDIS_PORT`  | Redis port (default `6379`)                |
| `ELASTIC_NODE`| Elasticsearch URL                         |
| `RABBITMQ_URL`| RabbitMQ connection string                |
| `QUEUE_NAME`  | RabbitMQ queue name                       |


### 📄 Example Plan JSON

```json
{
  "objectId": "12xvxc345ssdsds-508",
  "objectType": "plan",
  "planType": "inNetwork",
  "creationDate": "12-12-2017",
  "planCostShares": {
    "deductible": 2000,
    "_org": "example.com",
    "copay": 23,
    "objectId": "1234vxc2324sdf-501",
    "objectType": "membercostshare"
  },
  "linkedPlanServices": [
    {
      "linkedService": {
        "_org": "example.com",
        "objectId": "1234520xvc30asdf-502",
        "objectType": "service",
        "name": "Yearly physical"
      },
      "planserviceCostShares": {
        "deductible": 10,
        "_org": "example.com",
        "copay": 0,
        "objectId": "1234512xvc1314asdfs-503",
        "objectType": "membercostshare"
      },
      "_org": "example.com",
      "objectId": "27283xvx9asdff-504",
      "objectType": "planservice"
    }
  ]
}
```
### 🔌 API Endpoints

**Create a plan**

POST /plans

	•	Validates JSON Schema.
	•	Stores all nested objects in Redis.
	•	Indexes in Elasticsearch with parent–child mapping.
	•	Sends PLAN_CREATED event to RabbitMQ.

**Get a plan (with ETag)**

GET /plans/:objectId

	•	Returns 304 Not Modified if If-None-Match header matches the ETag.

**Patch a plan**

PATCH /plans/:objectId

	•	Merges with existing data.
	•	Deletes orphan Elasticsearch docs.
	•	Sends PLAN_UPDATED event to RabbitMQ.
	•	Returns updated ETag.

**Delete a plan**

DELETE /plans/:objectId

	•	Deletes all related Redis keys.
	•	Deletes root + children + grandchildren in Elasticsearch.
	•	Sends PLAN_DELETED event to RabbitMQ.

**Search in Elasticsearch**

POST /elastic/search

	•	Pass any Elasticsearch DSL query.

🔍 Elasticsearch Mapping
```
"join_field": {
  "type": "join",
  "relations": {
    "plan": ["linkedPlanServices", "planCostShares"],
    "linkedPlanServices": ["linkedService", "planserviceCostShares"]
  }
}
```

### 📊 Example Queries

•	Has child:
```
{
  "query": {
    "has_child": {
      "type": "linkedPlanServices",
      "query": { "match_all": {} }
    }
  }
}
```
•	Wildcard:
```
{
  "query": { "wildcard": { "_org": { "value": "example*" } } }
}
```
•	Term:
```
{
  "query": {
    "bool": {
      "must": [
        { "term": { "copay": 175 } },
        { "term": { "deductible": 10 } }
      ]
    }
  }
}
```
### 🧪 Steps
```
•	POST a plan → verify in Redis + Elasticsearch.
•	GET plan → check ETag.
•	PATCH → verify count stability and updated fields.
•	DELETE → verify cascade deletion in Redis & ES.
•	Run sample ES queries.
```

---
## ⚠️ Disclaimer
This repository is intended solely for evaluation purposes to showcase my coding skills, design practices, and technical expertise.

## Usage Restrictions
- Unauthorized use, reproduction, modification, or distribution of the code in this repository is strictly prohibited.
- If you wish to use any part of this code, please contact me directly to obtain explicit permission.

## Contact Information
If you have any questions or require further information, feel free to reach out:

- Name: Keya Goswami
- Email: goswami.ke@northeastern.edu
- LinkedIn: https://linkedin.com/in/keya--goswami
