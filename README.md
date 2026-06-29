# CleanPro: Home Cleaning ERP AI Platform

CleanPro is a fully responsive, production-ready full-stack Enterprise Resource Planning (ERP) and Scheduling web application designed for a home cleaning company. It runs entirely on **FREE services** without requiring any local installation for end-users.

## Features & Modules
* **Customer Portal**: Booking management, appointment scheduling, recurring plans, billing/invoicing, profile settings.
* **Admin Dashboard**: System metrics/analytics, active bookings status control, customer management, pricing configurations, staff management.
* **AI Chatbot**: Real-time customer support chatbot, FAQ answering, booking assistance, and service recommendations using Hugging Face serverless Inference API (or OpenRouter) instead of local Ollama.
* **Responsive Design**: Mobile-first premium user interface optimized for phones, tablets, laptops, and desktops.

---

## Tech Stack
* **Frontend**: React (Vite), React Router, Axios, Tailwind CSS, Lucide Icons
* **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Uvicorn, Python-Jose (JWT), Passlib (Bcrypt)
* **Database**: PostgreSQL (Neon / Supabase) for production; SQLite for local development
* **AI Engine**: Hugging Face Inference API (Free Tier) or OpenRouter Free Models

---

## Directory Structure
```text
Miniproject/
├── backend/
│   ├── routes/            # API Routers (auth, chat, staff, pricing, recurring, availability)
│   ├── utils/             # Scheduling and database helper utilities
│   ├── main.py            # FastAPI main application
│   ├── database.py        # Database connection pool setup (Postgres/SQLite)
│   ├── models.py          # SQLAlchemy models
│   ├── schemas.py         # Pydantic validation schemas
│   └── auth.py            # JWT token signing & password hashing
├── frontend/
│   ├── src/               # React application source code
│   │   ├── api/axios.js   # Intercepted Axios instance
│   │   ├── components/    # Navbar, ChatWidget, AppointmentCard, Skeletons, etc.
│   │   ├── pages/         # Dashboard, Bookings, Pricing, Reviews, Admin Panels
│   │   ├── App.jsx        # Routing & Layout
│   │   └── main.jsx       # React entry
│   ├── package.json
│   ├── vercel.json        # Frontend deployment configuration
│   └── vite.config.js
├── render.yaml            # Render Blueprint specification
├── requirements.txt       # Production Python dependencies
├── .env.example           # Reference environment configuration
└── README.md              # Documentation
```

---

## Setup & Running Locally

### 1. Backend Setup
Navigate to the root directory and create a virtual environment:
```bash
# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate   # On Windows
source venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file inside the `backend/` directory or root based on `.env.example`:
```env
DATABASE_URL=sqlite:///./cleanpro.db
SECRET_KEY=generate_your_own_secret_key_here
HUGGINGFACE_API_KEY=your_hugging_face_token
```

Start the backend:
```bash
uvicorn backend.main:app --reload --port 8000
```
*Note: Default admin credentials are automatically seeded: `admin@cleanpro.com` / `admin123`.*

### 2. Frontend Setup
Navigate to the `frontend/` directory, install Node packages, and run the developer server:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` to view the app locally.

---

## Production Deployment (FREE Services)

### 1. Database Setup (Neon PostgreSQL)
1. Go to [Neon.tech](https://neon.tech/) and sign up for a free account.
2. Create a new project and select **PostgreSQL**.
3. Copy the **Connection String** (which looks like `postgresql://user:password@host/dbname?sslmode=require`).

### 2. Backend Deployment (Render)
1. Sign up on [Render.com](https://render.com/).
2. Create a **New Blueprints** project and connect your GitHub repository.
3. Render will read `render.yaml` automatically and prompt you to input the environment variables:
   * `DATABASE_URL`: Your Neon PostgreSQL Connection String.
   * `SECRET_KEY`: A secure random secret key.
   * `HUGGINGFACE_API_KEY`: Your free Hugging Face API Token.
   * `ALLOWED_ORIGINS`: Comma-separated Vercel frontend URLs (e.g. `https://your-app.vercel.app`).
4. Click deploy. Render will spin up the FastAPI service on their free Python tier.

### 3. Frontend Deployment (Vercel)
1. Sign up on [Vercel.com](https://vercel.json).
2. Click **Add New > Project** and import your GitHub repository.
3. Configure the Project settings:
   * **Framework Preset**: Vite
   * **Root Directory**: `frontend`
   * **Environment Variables**: Add `VITE_API_BASE_URL` pointing to your Render backend URL (e.g. `https://cleanpro-backend.onrender.com`).
4. Click **Deploy**. Vercel will build and deploy the React client.

---

## API Documentation
Once the backend is running, the interactive Swagger UI and REST API documentation are available at:
* Local: `http://localhost:8000/docs`
* Production: `https://your-backend-url.onrender.com/docs`
