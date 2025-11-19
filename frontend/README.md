# University of Vavuniya - Attendance Management System

A comprehensive, production-ready MERN stack attendance management system with dark mode, real-time updates, and advanced analytics designed for university standards.

## Features

### Core Functionality
- **Student Management**: Complete CRUD operations with registration number as primary key
- **Real-time Attendance Tracking**: WebSocket-powered live attendance updates
- **Comprehensive Analytics**: Monthly, daily, and semester-wise attendance reports
- **Dark Mode**: Elegant UI with full dark mode support
- **80% Attendance Tracking**: Automatic calculation and monitoring of attendance requirements
- **Top/Bottom Performers**: Real-time leaderboards for attendance rates

### Analytics & Reports
- Monthly attendance pie charts
- Day-wise attendance tracking
- 6-month semester overview with trend analysis
- Line graphs for attendance patterns
- Individual student detailed analytics
- Course-wise breakdown
- Top 3 and bottom 3 attendees

## Quick Start

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your MongoDB URI
npm run seed
npm run dev
```

### Frontend
```bash
npm install
cp .env.example .env
npm run dev
```

**Login**: admin@university.edu / password123

Visit: `http://localhost:5173`

## Tech Stack
- **Backend**: Node.js, Express, MongoDB, Mongoose, JWT, WebSocket
- **Frontend**: React 19, Vite, Tailwind CSS, Recharts
- **Real-time**: WebSocket for live updates
- **Security**: bcrypt, helmet, rate limiting, CORS

## Key Pages
1. **Dashboard**: Overview with stats, charts, top performers
2. **Students**: Full CRUD, search, view details
3. **Student Details**: Individual analytics, 6-month trends, day-wise attendance

## Default Users
- Admin: `admin@university.edu` / `password123`
- Instructor: `instructor@university.edu` / `password123`

---

**University of Vavuniya, Northern Province, Sri Lanka**
---

## Troubleshooting

- If you encounter issues starting the backend, ensure MongoDB is running and accessible on the URI configured in your `.env`.
- For errors during `npm run seed`, verify that your collections are empty and credentials in `.env` are correct.
- If frontend changes don't appear, try clearing Vite's cache:
  ```bash
  rm -rf node_modules/.vite
  npm run dev
  ```
- For "CORS" or API errors, check your backend server is running and that both frontend and backend use matching API URLs.

## Support

For further support:
- Open an issue on the GitHub repository.

