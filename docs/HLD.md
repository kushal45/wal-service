# Generic Write-Ahead Log (WAL) Service - High-Level Design (HLD)

**Version:** 1.0  
**Date:** October 3, 2025  
**Authors:** Senior Software Engineer, Senior Software Architect  
**Technology Stack:** NestJS, TypeScript, Node.js

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Principles](#2-architecture-principles)
3. [System Components](#3-system-components)
4. [Component Interactions](#4-component-interactions)
5. [Sequence Diagrams](#5-sequence-diagrams)
6. [Data Flow Patterns](#6-data-flow-patterns)
7. [Scaling Strategy](#7-scaling-strategy)
8. [Failure Scenarios](#8-failure-scenarios)

---

## 1. System Overview

### 1.1 Purpose and Scope

The Generic Write-Ahead Log (WAL) Service provides a unified abstraction layer for reliable, durable, and scalable message processing across different backend systems. It enables applications to achieve strong consistency guarantees, handle delayed processing, manage cross-region replication, and orchestrate multi-partition transactions.

### 1.2 Key Capabilities

- **Unified API**: Single `WriteToLog` endpoint for all WAL operations
- **Pluggable Backends**: Support for Kafka, SQS, Redis Streams
- **Namespace Isolation**: Logical separation with dedicated configurations
- **Delayed Processing**: Configurable message delays with jitter
- **Cross-Region Replication**: Automatic replication across geographic regions
- **Multi-Partition Transactions**: Orchestrated mutations across multiple systems
- **Dead Letter Queue (DLQ)**: Automated failure handling and recovery
- **Horizontal Scaling**: Shard-based scaling model

### 1.3 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              External Systems                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐               │
│  │  Client Apps    │  │  Load Balancer  │  │  Monitoring     │               │
│  │  (REST/gRPC)    │  │  (NGINX/ALB)    │  │  (Prometheus)   │               │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘               │
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            WAL Service Layer                                    │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         API Gateway Layer                                   ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           ││
│  │  │  Authentication │  │  Rate Limiting  │  │  Request        │           ││
│  │  │  & Authorization│  │  & Throttling   │  │  Validation     │           ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                      │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                       Business Logic Layer                                  ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           ││
│  │  │  WAL Core       │  │  Namespace      │  │  Lifecycle      │           ││
│  │  │  Orchestrator   │  │  Manager        │  │  Manager        │           ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                      │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      Message Processing Layer                               ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           ││
│  │  │  Producer       │  │  Consumer       │  │  Message        │           ││
│  │  │  Framework      │  │  Framework      │  │  Router         │           ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────┬───────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         Infrastructure Layer                                   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                        Message Queues                                       ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           ││
│  │  │  Apache Kafka   │  │  Amazon SQS     │  │  Redis Streams  │           ││
│  │  │  (Primary)      │  │  (Delayed Msgs) │  │  (Fast Lane)    │           ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                      │                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         Target Systems                                      ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           ││
│  │  │  Databases      │  │  Cache Systems  │  │  External APIs  │           ││
│  │  │  (SQL/NoSQL)    │  │  (Redis/Memcd)  │  │  (HTTP/gRPC)    │           ││
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Principles

### 2.1 Design Principles

| Principle | Description | Implementation |
|-----------|-------------|----------------|
| **Single Responsibility** | Each component has one clear purpose | Separate modules for producers, consumers, targets |
| **Open/Closed Principle** | Open for extension, closed for modification | Plugin architecture for backends and targets |
| **Dependency Inversion** | Depend on abstractions, not concretions | Interface-based design with DI container |
| **Event-Driven Architecture** | Loose coupling through asynchronous events | Message queues as primary communication |
| **Circuit Breaker Pattern** | Fail fast and recover gracefully | Health checks and automatic retry logic |

### 2.2 Quality Attributes

| Attribute | Target | Measurement |
|-----------|--------|-------------|
| **Availability** | 99.9% | Multi-region deployment, health checks |
| **Scalability** | 10K+ TPS per shard | Horizontal scaling, partitioning |
| **Latency** | P99 < 100ms | Async processing, connection pooling |
| **Durability** | 99.99% | Persistent queues, replication |
| **Consistency** | Eventually consistent | Configurable retry policies |

---

## 3. System Components

### 3.1 Core Components Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Component Hierarchy                                │
│                                                                                 │
│    ┌─────────────────────────────────────────────────────────────────────────┐   │
│    │                           API Layer                                     │   │
│    │                                                                         │   │
│    │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │   │
│    │  │  WAL Controller │    │  Health         │    │  Metrics        │    │   │
│    │  │  - writeToLog() │    │  Controller     │    │  Controller     │    │   │
│    │  │  - getStatus()  │    │  - healthCheck()│    │  - getMetrics() │    │   │
│    │  └─────────────────┘    └─────────────────┘    └─────────────────┘    │   │
│    └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                           │
│    ┌─────────────────────────────────────────────────────────────────────────┐   │
│    │                        Service Layer                                   │   │
│    │                                                                         │   │
│    │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │   │
│    │  │  WAL Service    │    │  Namespace      │    │  Lifecycle      │    │   │
│    │  │  - orchestrate  │    │  Service        │    │  Service        │    │   │
│    │  │  - validate     │    │  - getConfig    │    │  - handleDelay  │    │   │
│    │  │  - route        │    │  - validate     │    │  - manageRetry  │    │   │
│    │  └─────────────────┘    └─────────────────┘    └─────────────────┘    │   │
│    └─────────────────────────────────────────────────────────────────────────┘   │
│                                     │                                           │
│    ┌─────────────────────────────────────────────────────────────────────────┐   │
│    │                      Infrastructure Layer                              │   │
│    │                                                                         │   │
│    │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    │   │
│    │  │  Producer       │    │  Consumer       │    │  Target         │    │   │
│    │  │  Factory        │    │  Framework      │    │  Adapters       │    │   │
│    │  │  - createKafka  │    │  - processMsg   │    │  - executeOp    │    │   │
│    │  │  - createSQS    │    │  - handleError  │    │  - validateTgt  │    │   │
│    │  └─────────────────┘    └─────────────────┘    └─────────────────┘    │   │
│    └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Component Responsibilities

#### 3.2.1 API Layer Components

| Component | Primary Responsibilities | Key Interfaces |
|-----------|-------------------------|----------------|
| **WAL Controller** | HTTP request handling, input validation, response formatting | `writeToLog()`, `getStatus()` |
| **Health Controller** | System health monitoring, dependency checks | `healthCheck()`, `readiness()` |
| **Metrics Controller** | Performance metrics exposure, monitoring data | `getMetrics()`, `getNamespaceMetrics()` |

#### 3.2.2 Service Layer Components

| Component | Primary Responsibilities | Key Interfaces |
|-----------|-------------------------|----------------|
| **WAL Service** | Request orchestration, business logic coordination | `writeToLog()`, `validateRequest()` |
| **Namespace Service** | Configuration management, namespace validation | `getNamespace()`, `validateRules()` |
| **Lifecycle Service** | Message lifecycle management, retry coordination | `scheduleDelay()`, `handleRetry()` |

#### 3.2.3 Infrastructure Layer Components

| Component | Primary Responsibilities | Key Interfaces |
|-----------|-------------------------|----------------|
| **Producer Factory** | Backend producer instantiation, connection management | `getProducer()`, `createProducer()` |
| **Consumer Framework** | Message consumption, error handling, scaling | `consume()`, `handleError()` |
| **Target Adapters** | Target system integration, operation execution | `execute()`, `validate()` |

---

## 4. Component Interactions

### 4.1 Request Flow Interaction Pattern

```
Client Request → API Gateway → Service Layer → Infrastructure Layer → Target Systems
     ↑                                                                        ↓
     └─── Response ←──── Orchestration ←──── Message Queue ←──── Async Processing
```

### 4.2 Inter-Component Communication

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Communication Patterns                                 │
│                                                                                 │
│  ┌─────────────────┐    Synchronous     ┌─────────────────┐                   │
│  │   Controller    │ ─────────────────► │   Service       │                   │
│  │                 │                    │                 │                   │
│  └─────────────────┘                    └─────────────────┘                   │
│                                                   │                           │
│                                         Asynchronous                          │
│                                                   ▼                           │
│  ┌─────────────────┐                    ┌─────────────────┐                   │
│  │   Message       │ ◄─────────────────┤   Producer      │                   │
│  │   Queue         │                    │                 │                   │
│  └─────────────────┘                    └─────────────────┘                   │
│           │                                                                   │
│           │ Event-Driven                                                      │
│           ▼                                                                   │
│  ┌─────────────────┐    Interface       ┌─────────────────┐                   │
│  │   Consumer      │ ─────────────────► │   Target        │                   │
│  │                 │                    │   Adapter       │                   │
│  └─────────────────┘                    └─────────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Sequence Diagrams

### 5.1 Persona #1: Delayed Queue Processing

```mermaid
sequenceDiagram
    participant Client
    participant WALController as WAL Controller
    participant WALService as WAL Service
    participant NamespaceService as Namespace Service
    participant LifecycleService as Lifecycle Service
    participant SQSProducer as SQS Producer
    participant DelayQueue as SQS Delay Queue
    participant Consumer as Consumer Framework
    participant TargetAdapter as Target Adapter
    participant TargetSystem as Target System (Cache)

    Client->>WALController: POST /api/v1/wal/write<br/>{namespace: "bulk-delete", lifecycle: {delay: 300}, payload: {key: "user:123"}}
    
    WALController->>WALController: Validate request format
    WALController->>WALService: writeToLog(writeToLogDto)
    
    WALService->>NamespaceService: getNamespace("bulk-delete")
    NamespaceService->>WALService: NamespaceConfig{backend: SQS, delayEnabled: true}
    
    WALService->>NamespaceService: validateRequest(namespace, dto)
    NamespaceService->>WALService: ValidationResult{valid: true}
    
    WALService->>WALService: generateMessageId()
    WALService->>WALService: enrichMessage(dto, messageId, timestamp)
    
    WALService->>LifecycleService: scheduleDelayed(enrichedMessage, 300s)
    LifecycleService->>SQSProducer: sendDelayed(message, delaySeconds: 300)
    
    SQSProducer->>DelayQueue: SendMessage with DelaySeconds=300
    DelayQueue->>SQSProducer: MessageId, MD5OfBody
    SQSProducer->>LifecycleService: SendResult{messageId, durable: unknown}
    
    LifecycleService->>WALService: ScheduleResult{messageId, status: scheduled}
    WALService->>WALController: WriteToLogResponse{durable: unknown, messageId}
    WALController->>Client: HTTP 202 Accepted
    
    Note over DelayQueue: Message delayed for 300 seconds
    
    DelayQueue->>Consumer: Message becomes visible after delay
    Consumer->>Consumer: Poll message from queue
    Consumer->>TargetAdapter: execute(message)
    
    TargetAdapter->>TargetSystem: DELETE key "user:123"
    TargetSystem->>TargetAdapter: Success
    TargetAdapter->>Consumer: ExecutionResult{success: true}
    Consumer->>DelayQueue: Acknowledge message
```

### 5.2 Persona #2: Cross-Region Replication

```mermaid
sequenceDiagram
    participant Client
    participant WALService as WAL Service (US-East)
    participant LocalCache as Local Cache (US-East)
    participant KafkaProducer as Kafka Producer
    participant CrossRegionTopic as Cross-Region Kafka Topic
    participant EuropeConsumer as Consumer (Europe)
    participant AsiaConsumer as Consumer (Asia)
    participant EuropeCache as Cache (Europe)
    participant AsiaCache as Cache (Asia)
    participant DLQ as Dead Letter Queue

    Client->>WALService: writeToLog{namespace: "cache-replication",<br/>payload: {operation: "SET", key: "session:456", value: {...}},<br/>target: {regions: ["europe", "asia"]}}
    
    WALService->>WALService: Process local operation first
    WALService->>LocalCache: SET session:456 = value
    LocalCache->>WALService: Success
    
    WALService->>Client: WriteToLogResponse{durable: true, messageId}
    
    Note over WALService: Async cross-region replication
    
    WALService->>KafkaProducer: send(cross-region-topic, replicationMessage)
    KafkaProducer->>CrossRegionTopic: Publish to partitions [europe, asia]
    
    par Europe Replication
        CrossRegionTopic->>EuropeConsumer: Consume message (partition: europe)
        EuropeConsumer->>EuropeConsumer: Validate message integrity
        EuropeConsumer->>EuropeCache: SET session:456 = value
        
        alt Success
            EuropeCache->>EuropeConsumer: Success
            EuropeConsumer->>CrossRegionTopic: Acknowledge message
        else Failure
            EuropeCache->>EuropeConsumer: Error
            EuropeConsumer->>EuropeConsumer: Check retry count
            alt Retryable
                EuropeConsumer->>CrossRegionTopic: Negative acknowledge (retry)
            else Max retries exceeded
                EuropeConsumer->>DLQ: Send to DLQ with failure reason
            end
        end
        
    and Asia Replication
        CrossRegionTopic->>AsiaConsumer: Consume message (partition: asia)
        AsiaConsumer->>AsiaConsumer: Validate message integrity
        AsiaConsumer->>AsiaCache: SET session:456 = value
        
        alt Success
            AsiaCache->>AsiaConsumer: Success
            AsiaConsumer->>CrossRegionTopic: Acknowledge message
        else Failure
            AsiaCache->>AsiaConsumer: Error
            AsiaConsumer->>AsiaConsumer: Check retry count
            alt Retryable
                AsiaConsumer->>CrossRegionTopic: Negative acknowledge (retry)
            else Max retries exceeded
                AsiaConsumer->>DLQ: Send to DLQ with failure reason
            end
        end
    end
```

### 5.3 Persona #3: Multi-Partition Transaction Orchestration

```mermaid
sequenceDiagram
    participant Client
    participant WALService as WAL Service
    participant TransactionOrchestrator as Transaction Orchestrator
    participant TransactionDB as Transaction State DB
    participant KafkaProducer as Kafka Producer
    participant PartitionATopic as Partition A Topic
    participant PartitionBTopic as Partition B Topic
    participant PartitionCTopic as Partition C Topic
    participant ConsumerA as Consumer A
    participant ConsumerB as Consumer B
    participant ConsumerC as Consumer C
    participant DatabaseA as Database A
    participant DatabaseB as Database B
    participant DatabaseC as Database C
    participant CompensationService as Compensation Service

    Client->>WALService: writeToLog{namespace: "multi-partition",<br/>payload: {transactions: [<br/>{partition: "A", operation: "INSERT", data: {...}},<br/>{partition: "B", operation: "UPDATE", data: {...}},<br/>{partition: "C", operation: "DELETE", data: {...}}]}}
    
    WALService->>TransactionOrchestrator: createDistributedTransaction(mutations)
    
    TransactionOrchestrator->>TransactionDB: BEGIN TRANSACTION
    TransactionOrchestrator->>TransactionDB: INSERT INTO transactions<br/>(id, status, mutations, created_at)<br/>VALUES (txn_123, 'INITIATED', [...], NOW())
    TransactionDB->>TransactionOrchestrator: Transaction created: txn_123
    
    TransactionOrchestrator->>WALService: TransactionId{txn_123}
    WALService->>Client: WriteToLogResponse{durable: true, transactionId: txn_123}
    
    Note over TransactionOrchestrator: Async processing of mutations
    
    par Partition A Processing
        TransactionOrchestrator->>KafkaProducer: send(partition-a-topic, mutationA)
        KafkaProducer->>PartitionATopic: Publish mutation A
        PartitionATopic->>ConsumerA: Consume mutation A
        ConsumerA->>DatabaseA: INSERT operation
        
        alt Success
            DatabaseA->>ConsumerA: Success
            ConsumerA->>TransactionDB: UPDATE transactions SET partition_a_status='SUCCESS'<br/>WHERE id='txn_123'
        else Failure
            DatabaseA->>ConsumerA: Error
            ConsumerA->>TransactionDB: UPDATE transactions SET partition_a_status='FAILED'<br/>WHERE id='txn_123'
        end
        
    and Partition B Processing
        TransactionOrchestrator->>KafkaProducer: send(partition-b-topic, mutationB)
        KafkaProducer->>PartitionBTopic: Publish mutation B
        PartitionBTopic->>ConsumerB: Consume mutation B
        ConsumerB->>DatabaseB: UPDATE operation
        
        alt Success
            DatabaseB->>ConsumerB: Success
            ConsumerB->>TransactionDB: UPDATE transactions SET partition_b_status='SUCCESS'<br/>WHERE id='txn_123'
        else Failure
            DatabaseB->>ConsumerB: Error
            ConsumerB->>TransactionDB: UPDATE transactions SET partition_b_status='FAILED'<br/>WHERE id='txn_123'
        end
        
    and Partition C Processing
        TransactionOrchestrator->>KafkaProducer: send(partition-c-topic, mutationC)
        KafkaProducer->>PartitionCTopic: Publish mutation C
        PartitionCTopic->>ConsumerC: Consume mutation C
        ConsumerC->>DatabaseC: DELETE operation
        
        alt Success
            DatabaseC->>ConsumerC: Success
            ConsumerC->>TransactionDB: UPDATE transactions SET partition_c_status='SUCCESS'<br/>WHERE id='txn_123'
        else Failure
            DatabaseC->>ConsumerC: Error
            ConsumerC->>TransactionDB: UPDATE transactions SET partition_c_status='FAILED'<br/>WHERE id='txn_123'
        end
    end
    
    Note over TransactionOrchestrator: Check overall transaction status
    
    TransactionOrchestrator->>TransactionDB: SELECT * FROM transactions WHERE id='txn_123'
    TransactionDB->>TransactionOrchestrator: Transaction status details
    
    alt All Partitions Successful
        TransactionOrchestrator->>TransactionDB: UPDATE transactions SET status='COMPLETED'<br/>WHERE id='txn_123'
    else Any Partition Failed
        TransactionOrchestrator->>TransactionDB: UPDATE transactions SET status='COMPENSATION_REQUIRED'<br/>WHERE id='txn_123'
        TransactionOrchestrator->>CompensationService: triggerCompensation(txn_123)
        
        Note over CompensationService: Execute compensation logic
        CompensationService->>CompensationService: Generate reverse operations
        CompensationService->>KafkaProducer: Send compensation messages
    end
```

### 5.4 Dead Letter Queue (DLQ) Management Flow

```mermaid
sequenceDiagram
    participant Consumer
    participant RetryHandler as Retry Handler
    participant BackoffCalculator as Backoff Calculator
    participant KafkaProducer as Kafka Producer
    participant MainTopic as Main Topic
    participant DLQTopic as DLQ Topic
    participant AlertingService as Alerting Service
    participant OperationsTeam as Operations Team
    participant DLQProcessor as DLQ Processor

    Consumer->>Consumer: Process message from main topic
    Consumer->>Consumer: Message processing fails
    
    Consumer->>RetryHandler: handleFailure(message, error, attemptCount)
    RetryHandler->>RetryHandler: Evaluate error type and retry policy
    
    alt Retry Count < Max Retries AND Retryable Error
        RetryHandler->>BackoffCalculator: calculateDelay(attemptCount, errorType)
        Note over BackoffCalculator: Exponential backoff:<br/>delay = baseDelay * (2^attemptCount) + jitter
        BackoffCalculator->>RetryHandler: delayMs = 2000ms
        
        RetryHandler->>RetryHandler: Increment attempt count
        RetryHandler->>KafkaProducer: scheduleRetry(message, delayMs)
        KafkaProducer->>MainTopic: Publish with delay header
        
    else Max Retries Reached OR Non-retryable Error
        RetryHandler->>RetryHandler: Mark message as permanently failed
        RetryHandler->>KafkaProducer: sendToDLQ(message, failureReason)
        
        KafkaProducer->>DLQTopic: Publish message with failure metadata:<br/>{<br/>  originalMessage: {...},<br/>  failureReason: "Connection timeout",<br/>  attemptCount: 3,<br/>  lastAttemptAt: "2025-10-03T10:30:00Z",<br/>  namespace: "cache-replication"<br/>}
        
        DLQTopic->>AlertingService: DLQ message received
        AlertingService->>OperationsTeam: Send alert:<br/>"Message failed permanently in namespace 'cache-replication'"
        
        Note over OperationsTeam: Manual investigation and decision
        
        alt Message Can Be Fixed and Replayed
            OperationsTeam->>DLQProcessor: replayMessage(messageId)
            DLQProcessor->>DLQTopic: Retrieve message
            DLQProcessor->>DLQProcessor: Fix message if needed
            DLQProcessor->>KafkaProducer: sendToMainTopic(fixedMessage)
            KafkaProducer->>MainTopic: Republish message
            
        else Message Cannot Be Recovered
            OperationsTeam->>DLQProcessor: markAsDiscarded(messageId)
            DLQProcessor->>DLQTopic: Update message status to 'DISCARDED'
        end
    end
```

### 5.5 Health Check and System Monitoring

```mermaid
sequenceDiagram
    participant LoadBalancer
    participant HealthController as Health Controller
    participant HealthService as Health Service
    participant NamespaceService as Namespace Service
    participant ProducerFactory as Producer Factory
    participant ConsumerHealth as Consumer Health Monitor
    participant DatabaseHealth as Database Health Check
    participant KafkaHealth as Kafka Health Check
    participant SQSHealth as SQS Health Check
    participant MetricsService as Metrics Service
    participant PrometheusRegistry as Prometheus Registry

    LoadBalancer->>HealthController: GET /health
    HealthController->>HealthService: performHealthCheck()
    
    par Dependency Health Checks
        HealthService->>NamespaceService: checkNamespaceHealth()
        NamespaceService->>DatabaseHealth: pingDatabase()
        DatabaseHealth->>NamespaceService: {status: "UP", responseTime: "5ms"}
        NamespaceService->>HealthService: {namespaces: "UP"}
        
    and Producer Health Checks
        HealthService->>ProducerFactory: checkProducerHealth()
        
        par Kafka Producer Check
            ProducerFactory->>KafkaHealth: ping()
            KafkaHealth->>ProducerFactory: {status: "UP", brokers: 3}
        and SQS Producer Check
            ProducerFactory->>SQSHealth: ping()
            SQSHealth->>ProducerFactory: {status: "UP", queues: 5}
        end
        
        ProducerFactory->>HealthService: {producers: "UP"}
        
    and Consumer Health Checks
        HealthService->>ConsumerHealth: checkConsumerLag()
        ConsumerHealth->>HealthService: {consumers: "UP", avgLag: "100ms"}
    end
    
    HealthService->>HealthService: aggregateHealthStatus()
    HealthService->>HealthController: HealthCheckResult{<br/>  status: "UP",<br/>  components: {<br/>    namespaces: "UP",<br/>    producers: "UP",<br/>    consumers: "UP"<br/>  }<br/>}
    
    HealthController->>LoadBalancer: HTTP 200 OK
    
    Note over MetricsService: Continuous metrics collection
    
    par Metrics Collection
        HealthService->>MetricsService: recordHealthMetric("system_health", 1)
        ProducerFactory->>MetricsService: recordMetric("producer_connections", 8)
        ConsumerHealth->>MetricsService: recordMetric("consumer_lag_ms", 100)
        DatabaseHealth->>MetricsService: recordMetric("db_response_time_ms", 5)
    end
    
    MetricsService->>PrometheusRegistry: pushMetrics()
```

---

## 6. Data Flow Patterns

### 6.1 Request-Response Flow

```
[Client] → [API Gateway] → [Service Layer] → [Message Queue] → [Response]
                                     ↓
[Target System] ← [Target Adapter] ← [Consumer] ← [Message Queue]
```

### 6.2 Event-Driven Processing Flow

```
[Message Producer] → [Message Queue] → [Message Consumer] → [Target Adapter] → [Target System]
                                              ↓
                         [DLQ] ← [Retry Logic] ← [Error Handler]
```

### 6.3 Cross-Region Replication Flow

```
[Region A] → [Cross-Region Topic] → [Region B Consumer] → [Region B Target]
                    ↓
              [Region C Consumer] → [Region C Target]
```

---

## 7. Scaling Strategy

### 7.1 Horizontal Scaling Model

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                             Scaling Topology                                   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                           Load Balancer                                     ││
│  │              (Route traffic across WAL service instances)                   ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                     │                                           │
│                    ┌────────────────┼────────────────┐                          │
│                    ▼                ▼                ▼                          │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐     │
│  │   WAL Instance 1    │  │   WAL Instance 2    │  │   WAL Instance N    │     │
│  │   (Shard 1)         │  │   (Shard 2)         │  │   (Shard N)         │     │
│  │                     │  │                     │  │                     │     │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │     │
│  │ │ Namespace A,B   │ │  │ │ Namespace C,D   │ │  │ │ Namespace Y,Z   │ │     │
│  │ └─────────────────┘ │  │ └─────────────────┘ │  │ └─────────────────┘ │     │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘     │
│                                     │                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                       Shared Message Queue Layer                           ││
│  │                                                                             ││
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        ││
│  │  │ Kafka Cluster   │    │  SQS Queues     │    │ Redis Streams   │        ││
│  │  │ (Partitioned)   │    │ (Per Namespace) │    │ (Fast Lane)     │        ││
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘        ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Scaling Triggers and Thresholds

| Metric | Scale-Out Trigger | Scale-In Trigger |
|--------|-------------------|------------------|
| **CPU Utilization** | > 70% for 5 minutes | < 30% for 15 minutes |
| **Memory Usage** | > 80% for 5 minutes | < 40% for 15 minutes |
| **Request Rate** | > 8K TPS per instance | < 2K TPS per instance |
| **Queue Depth** | > 1000 messages | < 100 messages |
| **Response Latency** | P95 > 150ms | P95 < 50ms |

---

## 8. Failure Scenarios

### 8.1 Component Failure Scenarios

| Failure Type | Impact | Recovery Strategy | RTO/RPO |
|--------------|--------|-------------------|---------|
| **WAL Service Instance** | Reduced capacity | Auto-scaling, health checks | RTO: 2 min, RPO: 0 |
| **Message Queue** | Processing halt | Failover to backup cluster | RTO: 5 min, RPO: 0 |
| **Target System** | Data operations fail | Retry with exponential backoff | RTO: Variable, RPO: 0 |
| **Database (Namespace)** | Configuration unavailable | Read-only mode with cached config | RTO: 1 min, RPO: 5 min |
| **Network Partition** | Cross-region replication fails | Local processing continues | RTO: Auto, RPO: 0 |

### 8.2 Disaster Recovery Scenarios

| Scenario | Recovery Approach | Maximum Acceptable Loss |
|----------|-------------------|-------------------------|
| **Regional Outage** | Failover to secondary region | 15 minutes of processing time |
| **Data Center Loss** | Multi-AZ deployment with failover | 5 minutes of processing time |
| **Kafka Cluster Failure** | Switch to SQS backend temporarily | 0 message loss (queued messages) |
| **Complete Service Failure** | Restore from backup, replay from last checkpoint | 1 hour of configuration changes |

---

**End of High-Level Design Document**