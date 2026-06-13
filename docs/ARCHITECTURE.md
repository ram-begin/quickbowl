# QuickBowl — System Architecture Document

## 1. Overview

QuickBowl is a cloud-native food delivery platform built using a microservices architecture. Each service is independently deployable, owns its own database, and communicates via REST APIs and asynchronous Kafka events.

---

## 2. Services

### 2.1 API Gateway (Node.js — Port 3000)
Single entry point for all client requests.

**Responsibilities:**
- Route requests to downstream services
- Rate limiting (100 requests / 15 min per IP)
- Circuit breaker per service (opens after 50% failure rate)
- JWT forwarding to downstream services
- Prometheus metrics at /metrics

**Circuit Breaker Config:**
| Setting | Value |
|---|---|
| Timeout | 5000ms |
| Error threshold | 50% |
| Reset timeout | 10s |
| Volume threshold | 3 requests |

---

### 2.2 User Service (Node.js — Port 3001)
Handles authentication and user management.

**Responsibilities:**
- User registration and login
- JWT token generation and validation
- Password hashing with bcrypt
- Profile management

**Database:** PostgreSQL (userdb)

**Key Endpoints:**
| Method | Path | Description |
|---|---|---|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login and get JWT |
| GET | /api/auth/profile | Get user profile |
| PUT | /api/auth/profile | Update profile |

---

### 2.3 Restaurant Service (Python/FastAPI — Port 8001)
Manages restaurant data, menus, and surge pricing.

**Responsibilities:**
- Restaurant CRUD operations
- Menu management
- Surge pricing multiplier
- Discount management
- Restaurant stats tracking

**Database:** MongoDB (restaurantdb)

---

### 2.4 Order Service (Java/Spring Boot — Port 8002)
Core order lifecycle management.

**Responsibilities:**
- Place and track orders
- Scheduled order support (up to 7 days ahead)
- Status transitions with validation
- Cancellation penalty (10% after 5 minutes)
- Publishes Kafka events on order placed and status updated

**Database:** PostgreSQL (orderdb)

**Status Flow:**
PENDING -> CONFIRMED -> PREPARING -> OUT_FOR_DELIVERY -> DELIVERED
PENDING -> CANCELLED
SCHEDULED -> PENDING -> ...

**Kafka Events Published:**
- order.placed
- order.status.updated

---

### 2.5 Payment Service (Node.js — Port 8003)
Handles Razorpay payment processing.

**Responsibilities:**
- Create Razorpay payment orders
- Verify payment signatures
- Process refunds
- Settlement reporting
- Publishes Kafka events on payment completion and refund

**Database:** PostgreSQL (paymentdb)

**Kafka Events Published:**
- payment.completed
- payment.refunded

---

### 2.6 Notification Service (Node.js — Port 8004)
Delivers real-time and async notifications.

**Responsibilities:**
- Consumes Kafka events from order and payment services
- Sends email notifications via Nodemailer
- Sends SMS notifications via Twilio
- Real-time push via Socket.io

**Kafka Topics Consumed:**
- order.placed
- order.status.updated
- payment.completed
- payment.refunded

---

## 3. Event-Driven Architecture (Kafka)

Order Service   -> order.placed          -> Notification Service
Order Service   -> order.status.updated  -> Notification Service
Payment Service -> payment.completed     -> Notification Service
Payment Service -> payment.refunded      -> Notification Service

Kafka is configured with:
- Auto topic creation enabled
- Zookeeper for broker coordination
- KafkaJS (Node.js), Spring Kafka (Java)

---

## 4. Observability

### Metrics (Prometheus + Grafana)
- All Node.js services expose /metrics via prom-client
- Order service exposes /actuator/prometheus via Micrometer
- Prometheus scrapes all services every 15 seconds
- Grafana dashboards show request rate, P95 latency, error rate

### Distributed Tracing (Jaeger + OpenTelemetry)
- All services instrument traces via OpenTelemetry SDK
- Traces exported to OTel Collector via OTLP
- OTel Collector forwards to Jaeger
- Jaeger UI at http://localhost:16686

---

## 5. Security

| Layer | Mechanism |
|---|---|
| Authentication | JWT (HS256) |
| Password storage | bcrypt (salt rounds: 10) |
| HTTP headers | Helmet.js on all Node services |
| Rate limiting | express-rate-limit (100 req/15min) |
| Circuit breaker | opossum (per-service in API gateway) |
| CORS | Enabled on all services |

---

## 6. Infrastructure

### Docker Compose Services
| Container | Image | Port |
|---|---|---|
| qb-postgres-user | postgres:15-alpine | 5432 |
| qb-postgres-order | postgres:15-alpine | 5433 |
| qb-postgres-payment | postgres:15-alpine | 5434 |
| qb-mongodb | mongo:7-jammy | 27017 |
| qb-redis | redis:7-alpine | 6379 |
| qb-zookeeper | wurstmeister/zookeeper | 2181 |
| qb-kafka | wurstmeister/kafka | 9092 |
| qb-otel-collector | otel/opentelemetry-collector-contrib | 4317/4318 |
| qb-jaeger | jaegertracing/all-in-one | 16686 |
| qb-prometheus | prom/prometheus | 9090 |
| qb-grafana | grafana/grafana | 3002 |
| qb-user-service | quickbowl-user-service | 3001 |
| qb-restaurant-service | quickbowl-restaurant-service | 8001 |
| qb-order-service | quickbowl-order-service | 8002 |
| qb-payment-service | quickbowl-payment-service | 8003 |
| qb-notification-service | quickbowl-notification-service | 8004 |
| qb-api-gateway | quickbowl-api-gateway | 3000 |

---

## 7. Contract Testing (Pact)

Consumer-driven contract tests ensure API compatibility between services.

| Consumer | Provider | Interactions |
|---|---|---|
| api-gateway | user-service | register, login, get profile |

Pact files stored in api-gateway/pacts/.

---

## 8. Technology Stack

| Layer | Technology |
|---|---|
| API Gateway | Node.js, Express |
| User Service | Node.js, Express, PostgreSQL |
| Restaurant Service | Python, FastAPI, MongoDB |
| Order Service | Java 17, Spring Boot 3, PostgreSQL |
| Payment Service | Node.js, Express, Razorpay, PostgreSQL |
| Notification Service | Node.js, Express, Socket.io, Redis |
| Message Broker | Apache Kafka + Zookeeper |
| Metrics | Prometheus, Grafana, prom-client, Micrometer |
| Tracing | OpenTelemetry, Jaeger |
| Containerization | Docker, Docker Compose |
| Contract Testing | Pact (Consumer-Driven) |

## 9. Surge Pricing Design

### Current Implementation
Surge pricing is **restaurant-controlled** — the restaurant owner manually toggles surge on/off from their dashboard. When active, a `surge_multiplier` field on the restaurant document adjusts menu item prices accordingly.

### Customer-Facing Behaviour
Surge pricing is **intentionally hidden from customers**. Item prices silently reflect the surge multiplier without any badge or label shown on the restaurant card. This follows the same approach used by Swiggy and Zomato — customers see the final price, not the reason for it. Only discount badges are shown to customers as those create a positive experience.

### Production Recommendation
In a production system, surge pricing should be **platform-controlled**, not restaurant-controlled. The QuickBowl platform would automatically trigger surge based on real-time signals:

| Signal | Example Threshold |
|---|---|
| High order volume | 50+ orders in last 30 minutes |
| Time of day | 12pm–2pm, 7pm–10pm |
| Low delivery partner availability | Fewer than 10 drivers online |
| Weather conditions | Rain detected via weather API |

A scheduled background job (cron / Kafka Streams) would evaluate these signals every few minutes and set `surge_multiplier` automatically, removing the ability for individual restaurants to manipulate pricing unfairly. This ensures consistency, fairness, and a better customer experience across the platform.