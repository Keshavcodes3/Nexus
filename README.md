Nexus

«A real-time community infrastructure platform built from the ground up with TypeScript.»

Nexus is a backend-first platform for building persistent online communities, real-time rooms, presence, messaging, events, and live interactions.

The goal isn't to clone Discord.

The goal is to understand and engineer the systems underneath real-time social platforms.

---

⚡ What is Nexus?

Nexus provides a real-time environment where users can:

- Create and join communities
- Participate in persistent channels
- Join live rooms
- Exchange real-time messages
- Track user presence
- Receive events over WebSockets
- Reconnect without losing state
- Discover active communities and rooms

Underneath the product is a distributed event-driven architecture designed to eventually support thousands of concurrent connections and multiple WebSocket nodes.

                    Nexus
                      │
       ┌──────────────┼──────────────┐
       │              │              │
  Communities       Rooms         Presence
       │              │              │
       └──────────────┼──────────────┘
                      │
                 Event System
                      │
            ┌─────────┼─────────┐
            ↓         ↓         ↓
         Redis     PostgreSQL  Workers
            │
       WebSocket
        Gateway

---

🎯 Engineering Goals

Nexus is primarily a systems-engineering project.

The core objectives are:

- Real-time communication
- Horizontal WebSocket scaling
- Distributed presence
- Event-driven architecture
- Reliable message delivery
- Connection recovery
- Backpressure handling
- Idempotent event processing
- Efficient fanout
- Observability
- Failure recovery

The project will evolve from a single-node application into a distributed system.

---

🧱 Architecture

Current target

                    Clients
                       │
                WebSocket / HTTP
                       │
                       ▼
                ┌─────────────┐
                │ API Gateway │
                └──────┬──────┘
                       │
              ┌────────┴────────┐
              │                 │
              ▼                 ▼
        Command Layer      Query Layer
              │                 │
              └────────┬────────┘
                       ▼
                 Event System
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Redis        PostgreSQL    Workers
          │
          ▼
    WebSocket Nodes

Eventually:

                         Load Balancer
                              │
             ┌────────────────┼────────────────┐
             ▼                ▼                ▼
         Gateway A         Gateway B        Gateway C
             │                │                │
             └────────────────┼────────────────┘
                              │
                         Redis Cluster
                              │
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                Presence    Events    Queues
                              │
                         PostgreSQL

---

🔌 Real-Time Protocol

Nexus communicates with clients through a typed WebSocket protocol.

Client → Server

{
  "type": "room.join",
  "roomId": "room_123"
}

{
  "type": "message.send",
  "roomId": "room_123",
  "content": "hello nexus"
}

Server → Client

{
  "type": "message.created",
  "roomId": "room_123",
  "messageId": "msg_456",
  "userId": "user_789",
  "content": "hello nexus",
  "timestamp": 1788345600000
}

The protocol will eventually support:

- Event IDs
- Sequence numbers
- Heartbeats
- Acknowledgements
- Resume tokens
- Event replay
- Binary encoding

---

🧠 Presence

Presence is modeled around connections, not simply a boolean user state.

User
 ├── Mobile Session
 ├── Browser Session
 └── Desktop Session

A user is considered online when at least one active session exists.

[
Online(u) \iff |{s \mid alive(s)=true}| > 0
]

Connections use heartbeats and TTL-based expiration to detect stale sessions.

---

📡 Event Architecture

Every meaningful real-time action becomes an event.

User Action
     │
     ▼
Command
     │
     ▼
Domain Event
     │
 ┌───┼──────────────┐
 ▼   ▼              ▼
Chat Presence    Analytics
 │
 ▼
WebSocket Fanout

This allows Nexus to eventually support:

- Event replay
- Audit history
- Analytics
- Notifications
- Independent consumers
- Reliable asynchronous processing

---

🔄 Connection Recovery

Real networks fail.

Nexus clients should be able to reconnect without blindly downloading the entire world again.

Client
  │
  │ lastEventId = 9281
  │
  X──── connection lost
  │
  │ reconnect
  ▼
Gateway
  │
  ├── events 9282 → 9347
  │
  ▼
Client state recovered

The long-term objective is:

[
State_{client} =
State_{client} + Events_{lastSeen+1...current}
]

---

📈 Scaling Strategy

The first version will run on one process.

The architecture will progressively evolve toward:

              N WebSocket Nodes
                      │
                      ▼
               Redis Event Bus
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       Presence     Fanout      Workers
          │
          ▼
      PostgreSQL

Key scaling problems to investigate:

- Connection distribution
- Room membership across nodes
- Cross-node broadcasts
- Presence consistency
- Hot rooms
- Fanout amplification
- Redis memory pressure
- Consumer lag
- Backpressure

---

🛠️ Tech Stack

Layer| Technology
Language| TypeScript
Runtime| Node.js
HTTP| Fastify
Realtime| WebSockets
Database| PostgreSQL
Event / Cache| Redis
Jobs| BullMQ
Validation| Zod
Logging| Pino
Observability| OpenTelemetry
Testing| Vitest
Infrastructure| Docker

---

📂 Project Structure

nexus/
├── src/
│   ├── config/
│   │
│   ├── infrastructure/
│   │   ├── postgres/
│   │   ├── redis/
│   │   ├── websocket/
│   │   └── queue/
│   │
│   ├── modules/
│   │   ├── users/
│   │   ├── communities/
│   │   ├── rooms/
│   │   ├── messages/
│   │   └── presence/
│   │
│   ├── workers/
│   │
│   └── shared/
│       ├── errors/
│       ├── logger/
│       └── types/
│
├── migrations/
├── tests/
├── docker-compose.yml
├── package.json
└── README.md

---

🚧 Roadmap

Phase 1 · Foundation

- [ ] TypeScript backend
- [ ] Fastify server
- [ ] PostgreSQL connection
- [ ] Redis connection
- [ ] Configuration system
- [ ] Structured logging
- [ ] Error handling

Phase 2 · Communities

- [ ] Users
- [ ] Communities
- [ ] Memberships
- [ ] Channels
- [ ] Permissions

Phase 3 · Realtime

- [ ] WebSocket gateway
- [ ] Room manager
- [ ] Message protocol
- [ ] Broadcasting
- [ ] Heartbeats
- [ ] Presence

Phase 4 · Distributed Realtime

- [ ] Redis Pub/Sub
- [ ] Multiple WebSocket nodes
- [ ] Cross-node broadcasting
- [ ] Distributed presence
- [ ] Connection recovery

Phase 5 · Event Infrastructure

- [ ] Event IDs
- [ ] Sequence numbers
- [ ] Event persistence
- [ ] Replay
- [ ] Idempotent consumers
- [ ] Dead-letter queues
- [ ] Outbox pattern

Phase 6 · Scale

- [ ] Load testing
- [ ] Backpressure
- [ ] Hot-room handling
- [ ] Connection benchmarking
- [ ] Redis optimization
- [ ] PostgreSQL optimization

Phase 7 · Production Hardening

- [ ] OpenTelemetry
- [ ] Metrics
- [ ] Distributed tracing
- [ ] Failure injection
- [ ] Graceful shutdown
- [ ] Horizontal scaling
- [ ] Security hardening

---

🧪 Failure Engineering

Nexus will intentionally be tested under failure.

Examples:

Redis unavailable
PostgreSQL unavailable
WebSocket node crashes
Worker crashes
Duplicate events
Delayed events
Out-of-order events
Network latency
Connection storms
Hot rooms
Consumer lag

A distributed system isn't interesting when everything works.

Nexus is designed to understand what happens when it doesn't.

---

📊 Performance Targets

Initial targets:

10,000 concurrent WebSocket connections
1,000+ events/sec
<100ms internal event propagation
zero message loss after acknowledged persistence
graceful node failure
recoverable consumer failures

These are engineering targets, not assumptions.

Every target will be benchmarked.

---

🧭 Philosophy

Nexus is being built backend-first.

No frontend is required to validate the core system.

The first client will be a simple CLI/WebSocket client capable of:

nexus connect
nexus community create engineering
nexus room join systems
nexus send "hello"
nexus presence

The UI comes later.

The infrastructure comes first.

---

📜 License

MIT


This gives the repo a clear identity: **real-time infrastructure first, social product second**. We can keep evolving the README as the architecture grows, rather than pretending v0.1 already runs NASA. 🚀