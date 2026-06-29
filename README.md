# CleanPro: Home Cleaning AI Scheduling & Appointment Management App

CleanPro is a full-stack web application designed for a home cleaning company. Customers can register, book standard/deep/move cleanings, manage their appointments, and consult a friendly, local AI assistant (via Ollama) inside a floating chat bubble. Admins receive an overview dashboard containing operations metrics, customer databases, and booking control switches.

## Tech Stack

- **Frontend:** React (Vite), React Router v6, Axios, Tailwind CSS, Lucide React (Icons)
- **Backend:** Python 3.8+, FastAPI, SQLAlchemy, SQLite, python-jose (JWT), passlib (Bcrypt), httpx (Ollama integration)
- **AI Engine:** Ollama running locally with `llama3.2:1b` (or other fallback models)

---

## Directory Structure

```text
Miniproject/
├── backend/
│   ├── .env               # JWT secrets & environment variables
│   ├── main.py            # FastAPI endpoints & Ollama connection
│   ├── database.py        # SQLAlchemy SQLite connection setup
│   ├── models.py          # SQLAlchemy schemas (Users, Appointments)
│   ├── schemas.py         # Pydantic validation schemas
│   └── auth.py            # Password hashing and JWT helper functions
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── axios.js   # Intercepts headers to inject JWT
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── ChatWidget.jsx        # Floating chatbot UI
│   │   │   ├── AppointmentCard.jsx   # Interactive status cards
│   │   │   └── ProtectedRoute.jsx    # Guard for customer/admin access
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── CustomerDashboard.jsx
│   │   │   ├── BookAppointment.jsx
│   │   │   ├── MyAppointments.jsx
│   │   │   └── AdminDashboard.jsx
│   │   ├── App.jsx        # Routes layout
│   │   ├── index.css      # Tailwind styling entry
│   │   └── main.jsx
│   ├── tailwind.config.js
│   └── package.json
└── README.md
```

---

## Default Seeding Credentials

On initial startup, the backend automatically seeds a default system admin account if not already present:
- **Email:** `admin@cleanpro.com`
- **Password:** `admin123`

---

## Setup & Running Locally

### 1. AI Setup (Ollama)
Ensure you have [Ollama](https://ollama.com) installed and running. Pull the default scheduling model:
```bash
ollama pull llama3.2:1b
```
*(If Ollama is offline during usage, the chat widget automatically displays a clean support fallback message).*

### 2. Backend Setup
Navigate to the `backend/` directory, configure your environment, install dependencies, and start the development server:
```bash
cd backend

# Install python dependencies
pip install fastapi uvicorn sqlalchemy passlib[bcrypt] python-jose[cryptography] python-multipart httpx python-dotenv

# Run the dev server on port 8000
uvicorn main:app --reload --port 8000
```
This launches the backend API on `http://localhost:8000`. On first load, it creates the SQLite database (`cleanpro.db`) and seeds the admin user.

### 3. Frontend Setup
Navigate to the `frontend/` directory, install packages, and spin up the Vite development server:
```bash
cd frontend

# Install javascript packages (React, Router, Tailwind, Axios, Lucide)
npm install

# Start Vite dev server on http://localhost:5173
npm run dev
```

Open `http://localhost:5173` in your browser. You can now register a customer account or log in with the admin credentials!
