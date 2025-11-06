# Attendance System Backend

Production-ready MERN backend for barcode-enabled real-time university attendance tracking.

## Features

- JWT authentication (access + refresh tokens)
- MongoDB with Mongoose
- Real-time WebSocket updates
- Barcode scan processing
- Attendance analytics
- Device management
- Rate limiting on scan endpoint

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Update `.env` with your MongoDB URI and secrets

4. Seed the database:
```bash
npm run seed
```

5. Start the server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Students
- `GET /api/students` - List students (search, pagination)
- `GET /api/students/:id` - Get student
- `POST /api/students` - Create student (admin)
- `PUT /api/students/:id` - Update student (admin)
- `DELETE /api/students/:id` - Delete student (admin)

### Courses
- `GET /api/courses` - List courses
- `POST /api/courses` - Create course (admin/instructor)
- `GET /api/courses/:id` - Get course
- `PUT /api/courses/:id` - Update course (admin/instructor)
- `DELETE /api/courses/:id` - Delete course (admin)

### Sessions
- `GET /api/courses/:courseId/sessions` - List course sessions
- `POST /api/courses/:courseId/sessions` - Create session (admin/instructor)
- `GET /api/sessions/:sessionId` - Get session
- `PATCH /api/sessions/:sessionId/status` - Update session status

### Scans
- `POST /api/scans/ingest` - Ingest barcode scan (requires x-device-key header)

### Attendance
- `GET /api/sessions/:sessionId/attendance` - Get session attendance
- `PUT /api/sessions/:sessionId/attendance/:studentId` - Update attendance
- `GET /api/students/:studentId/attendance` - Get student attendance history

### Analytics
- `GET /api/analytics/monthly?month=YYYY-MM` - Monthly attendance summary

### Devices
- `GET /api/devices` - List devices (admin)
- `POST /api/devices` - Create device (admin)
- `PATCH /api/devices/:id` - Update device (admin)
- `POST /api/devices/:id/rotate-key` - Rotate device API key (admin)

## WebSocket

Connect to `ws://localhost:5000/ws` to receive real-time events:

- `scan.ingested` - When a barcode is scanned
- `attendance.updated` - When attendance is manually updated
- `session.status` - When session status changes

## Testing Scan Endpoint

After seeding, use the provided device API key and sample barcodes:

```bash
curl -X POST http://localhost:5000/api/scans/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: YOUR_DEVICE_API_KEY" \
  -d '{"barcode":"YOUR_BARCODE","timestamp":"2025-10-05T10:00:00Z"}'
```

## Default Users

- Admin: `admin@university.edu` / `password123`
- Instructor: `instructor@university.edu` / `password123`
