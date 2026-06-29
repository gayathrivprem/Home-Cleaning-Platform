import os
import httpx
import json
import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
import auth

router = APIRouter()

class settings:
    HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_API_KEY") or os.getenv("HF_TOKEN")
    HF_MODEL = os.getenv("HUGGINGFACE_MODEL", "Qwen/Qwen2.5-7B-Instruct")
    
    OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
    OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "liquid/lfm-2.5-1.2b-instruct:free")

    OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/") + "/api/chat"
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")

def get_optional_user(token: Optional[str], db: Session) -> Optional[models.User]:
    if not token:
        return None
    try:
        from jose import jwt
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        email = payload.get("sub")
        if email:
            return db.query(models.User).filter(models.User.email == email).first()
    except Exception:
        pass
    return None

def build_system_prompt(db: Session, user: Optional[models.User]) -> str:
    base_prompt = """
You are the friendly scheduling assistant for CleanPro, a home cleaning service.
Help customers with: booking appointments, service types (Standard, Deep Clean, Move-In/Out),
pricing info, availability questions, and rescheduling guidance. Also support creating and managing recurring cleanings.
Keep responses short and helpful. For actual booking changes, tell them to use the app UI.

You can book, cancel appointments, and manage recurring plans for authenticated customers through this chat.
When booking a standard or recurring service: collect date (ask for it naturally), time slot (Morning/Afternoon/Evening), 
cleaning type (Standard, Deep Clean, Move-In/Out), and address. If they want it recurring, also ask for frequency (weekly, biweekly, monthly). Confirm all details before acting.
When cancelling: confirm the appointment ID or ask the user which one to cancel.
When reviewing a completed cleaning: collect rating (1 to 5 stars) and optional review comment/feedback text.
Be conversational. Never show raw JSON to the user.
"""

    standard = db.query(models.ServicePrice).filter_by(cleaning_type="Standard").first()
    deep = db.query(models.ServicePrice).filter_by(cleaning_type="Deep Clean").first()
    movein = db.query(models.ServicePrice).filter_by(cleaning_type="Move-In/Out").first()
    addons = db.query(models.PriceAddon).filter_by(is_active=True).all()
    
    std_base = standard.base_price if standard else 49.99
    std_room = standard.price_per_room if standard else 10.0
    deep_base = deep.base_price if deep else 99.99
    deep_room = deep.price_per_room if deep else 15.0
    movein_base = movein.base_price if movein else 129.99
    movein_room = movein.price_per_room if movein else 20.0
    active_addons_str = ', '.join(f"{a.name} (₹{a.price})" for a in addons) if addons else "None"
    
    pricing_context = f"""
    Current service pricing:
    - Standard Clean: ₹{std_base} base + ₹{std_room}/extra room
    - Deep Clean: ₹{deep_base} base + ₹{deep_room}/extra room  
    - Move-In/Out: ₹{movein_base} base + ₹{movein_room}/extra room
    Active add-ons: {active_addons_str}
    """

    review_nudge = ""
    recurring_context = ""
    staff_context = ""
    dynamic_context = ""
    
    if user:
        if user.role == "customer":
            pending_reviews = db.query(models.Appointment).filter(
                models.Appointment.user_id == user.id,
                models.Appointment.status == "Completed"
            ).outerjoin(models.Review).filter(models.Review.id == None).all()
            
            if pending_reviews:
                review_nudge = f"\nThe customer has {len(pending_reviews)} completed appointment(s) they haven't reviewed yet. Nudge them to leave feedback on 'My Appointments'."
                
            recurring = db.query(models.RecurringSchedule).filter_by(user_id=user.id, is_active=True).all()
            if recurring:
                recurring_context = f"\nThe customer has {len(recurring)} active recurring plan(s): " + \
                    ", ".join(f"{r.frequency} {r.cleaning_type} (Next: {r.next_run_date})" for r in recurring)
                    
            appts = db.query(models.Appointment).filter(models.Appointment.user_id == user.id).all()
            if appts:
                appt_details = []
                for a in appts:
                    appt_details.append(
                        f"- Booking ID {a.id}: Date={a.date}, Slot={a.time_slot}, Package={a.cleaning_type}, Address={a.address}, Status={a.status}"
                    )
                dynamic_context = (
                    f"\n\nYou are talking to the logged-in customer: {user.name} (Email: {user.email}, Phone: {user.phone}).\n"
                    "Here are their real-time bookings from the database:\n" + "\n".join(appt_details) +
                    "\nIf they ask about their bookings or status, list these details. Keep it brief."
                )
            else:
                dynamic_context = f"\n\nYou are talking to the logged-in customer: {user.name}. They do not have any bookings yet."
                
        elif user.role == "admin":
            active_staff_count = db.query(models.User).filter_by(role="staff", is_active=True).count()
            today_str = datetime.date.today().isoformat()
            
            unassigned_today = db.query(models.Appointment).filter(
                models.Appointment.date == today_str,
                models.Appointment.status.in_(["Pending", "Confirmed"]),
                models.Appointment.assigned_staff_id == None
            ).count()
            
            staff_members = db.query(models.User).filter_by(role="staff", is_active=True).all()
            busiest_name = "None"
            busiest_count = 0
            for staff in staff_members:
                cnt = db.query(models.Appointment).filter(
                    models.Appointment.assigned_staff_id == staff.id,
                    models.Appointment.date == today_str,
                    models.Appointment.status.in_(["Pending", "Confirmed"])
                ).count()
                if cnt > busiest_count:
                    busiest_count = cnt
                    busiest_name = staff.name
                    
            leaves_today = db.query(models.StaffLeave).filter_by(date=today_str).all()
            leave_today_names = []
            for l in leaves_today:
                st = db.query(models.User).filter_by(id=l.staff_id).first()
                if st:
                    leave_today_names.append(st.name)
            leave_today_str = ", ".join(leave_today_names) if leave_today_names else "None"
            
            staff_context = f"""
            [CONTEXT: STAFF ANALYTICS]
            Staff overview:
            - Total active cleaners: {active_staff_count}
            - Unassigned confirmed/pending appointments (today): {unassigned_today}
            - Busiest cleaner today: {busiest_name} ({busiest_count} jobs)
            - Staff on leave today: {leave_today_str}
            """
            
            total_bookings = db.query(models.Appointment).count()
            pending_count = db.query(models.Appointment).filter(models.Appointment.status == "Pending").count()
            confirmed_count = db.query(models.Appointment).filter(models.Appointment.status == "Confirmed").count()
            completed_count = db.query(models.Appointment).filter(models.Appointment.status == "Completed").count()
            cancelled_count = db.query(models.Appointment).filter(models.Appointment.status == "Cancelled").count()
            total_customers = db.query(models.User).filter(models.User.role == "customer").count()
            
            dynamic_context = f"""
            
            You are talking to the CleanPro System Admin: {user.name}.
            Here are the real-time operational statistics of CleanPro. Answer their analytical or management queries using these numbers:
            - Total Bookings: {total_bookings}
            - Pending Approvals: {pending_count}
            - Confirmed Cleanings: {confirmed_count}
            - Completed Cleanings: {completed_count}
            - Cancelled Cleanings: {cancelled_count}
            - Total Customers: {total_customers}
            """
    else:
        dynamic_context = "\n\nYou are talking to an anonymous Guest visitor. They are not logged in. If they ask about bookings or account details, tell them they need to register or log in first."

    return base_prompt + pricing_context + review_nudge + recurring_context + staff_context + dynamic_context

INTENT_CLASSIFIER_PROMPT = """
You are an intent classifier. Given the user message, return ONLY a JSON object.
No explanation, no markdown, just raw JSON.

Intents:
- "book_appointment": user wants to schedule/book a cleaning
- "cancel_appointment": user wants to cancel a booking
- "check_bookings": user wants to see their appointments or status
- "get_quote": user asks about price or cost
- "admin_analytics": user asks about business stats, total bookings, staff leave, cleanest/busiest staff, revenue, pending counts, or any operational analytics.
- "confirm": user confirms, says yes, yup, confirm, proceed, ok, go ahead, or agrees to perform/confirm the booking/action.
- "decline": user says no, cancel, stop, decline, or does not want to proceed with the booking/action.
- "general": anything else

Entities to extract:
- date: YYYY-MM-DD format if mentioned, else null
- time_slot: "Morning", "Afternoon", or "Evening" if mentioned, else null
- cleaning_type: "Standard", "Deep Clean", or "Move-In/Out" if mentioned, else null
- address: string if mentioned, else null
- appointment_id: integer if mentioned, else null
- num_rooms: integer if mentioned, else null

Return shape: {"intent": "...", "entities": {...}}
"""

async def call_llm(messages: List[dict], temperature: float = 0.7, max_tokens: int = 512) -> str:
    errors = []

    # 1. Try Hugging Face Inference API
    if settings.HF_API_KEY:
        url = "https://api-inference.huggingface.co/v1/chat/completions"
        headers = {"Authorization": f"Bearer {settings.HF_API_KEY}"}
        payload = {
            "model": settings.HF_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"]
                else:
                    errors.append(f"Hugging Face API returned error status {res.status_code}: {res.text}")
        except Exception as e:
            errors.append(f"Hugging Face API call failed: {e}")

    # 2. Try OpenRouter as fallback
    if settings.OPENROUTER_API_KEY:
        url = "https://openrouter.ai/api/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
            "HTTP-Referer": "https://cleanpro.onrender.com",
            "X-Title": "CleanPro ERP"
        }
        payload = {
            "model": settings.OPENROUTER_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                res = await client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"]
                else:
                    errors.append(f"OpenRouter API returned error status {res.status_code}: {res.text}")
        except Exception as e:
            errors.append(f"OpenRouter API call failed: {e}")

    # 3. Fallback to Ollama
    try:
        payload = {
            "model": settings.OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": temperature}
        }
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(settings.OLLAMA_URL, json=payload)
            if res.status_code == 200:
                return res.json()["message"]["content"]
            else:
                errors.append(f"Ollama returned error status {res.status_code}: {res.text}")
    except Exception as e:
        errors.append(f"Ollama call failed: {e}")

    raise RuntimeError(" | ".join(errors) if errors else "No LLM service available or configured API keys are invalid.")

async def detect_intent(message: str) -> dict:
    try:
        messages = [
            {"role": "system", "content": INTENT_CLASSIFIER_PROMPT},
            {"role": "user", "content": message}
        ]
        text = await call_llm(messages, temperature=0.0, max_tokens=150)
        # Strip markdown fences if present
        text = text.replace("```json", "").replace("```", "").strip()
        return json.loads(text)
    except Exception:
        return {"intent": "general", "entities": {}}

@router.post("/", response_model=schemas.ChatResponse)
async def chat(body: schemas.ChatRequest, request: Request,
               token: Optional[str] = Depends(auth.oauth2_scheme),
               db: Session = Depends(get_db)):
    user = get_optional_user(token, db)
    action_taken = "none"
    appointment_result = None
    pending = body.pending_booking.copy()

    # --- Phase 1: Intent detection ---
    intent_data = await detect_intent(body.message)
    intent = intent_data.get("intent", "general")
    entities = intent_data.get("entities", {})

    # Merge new entities into pending booking state
    entity_changed = False
    for key in ["date", "time_slot", "cleaning_type", "address", "num_rooms"]:
        if entities.get(key) is not None:
            if pending.get(key) != entities[key]:
                pending[key] = entities[key]
                entity_changed = True

    if entity_changed:
        pending.pop("ready_to_confirm", None)
        pending.pop("quoted_price", None)

    system = build_system_prompt(db, user)
    action_context = ""

    # --- Phase 2: Action execution ---
    if intent == "admin_analytics":
        if not user or user.role != "admin":
            action_context = "The user is asking about platform analytics, booking statistics, staff leaves, or system metrics. Since they are NOT an administrator, you MUST refuse to answer this. State politely that these statistics are confidential and only accessible to administrators. Do not share any counts, names, or statistics."
        else:
            action_context = "The user is an administrator. Answer their management, analytics, or operational query using the real-time statistics provided in the system prompt."
    
    elif pending.get("ready_to_confirm"):
        if intent == "confirm":
            if not user or user.role != "customer":
                action_context = "The user is confirming a booking, but they are not logged in as a customer. Politely tell them to log in first."
                pending = {}
            else:
                # All info is collected and user confirmed. Now check availability and book!
                from routes.availability import check_slot_availability
                from routes.pricing import calculate_quote
                
                # Normalize time slot
                time_slot_raw = pending["time_slot"]
                norm_slot = "Morning 8–12"
                if "afternoon" in time_slot_raw.lower() or "12" in time_slot_raw:
                    norm_slot = "Afternoon 12–5"
                elif "evening" in time_slot_raw.lower() or "5" in time_slot_raw:
                    norm_slot = "Evening 5–8"

                slot_status = check_slot_availability(db, pending["date"], norm_slot)

                if slot_status == "blocked":
                    action_context = f"The slot {pending['time_slot']} on {pending['date']} is unavailable/blocked. Tell the customer and suggest they choose another date or time."
                    pending = {}
                elif slot_status == "full":
                    action_context = f"The slot {pending['time_slot']} on {pending['date']} is fully booked. Tell the customer and suggest another time slot."
                    pending = {}
                else:
                    num_rooms = int(pending.get("num_rooms", 1))
                    quote = calculate_quote(db, pending["cleaning_type"], num_rooms, [])
                    appt = models.Appointment(
                        user_id=user.id,
                        date=pending["date"],
                        time_slot=norm_slot,
                        cleaning_type=pending["cleaning_type"],
                        address=pending["address"],
                        num_rooms=num_rooms,
                        selected_addons="[]",
                        quoted_price=quote["total"],
                        status="Pending"
                    )
                    db.add(appt)
                    db.commit()
                    db.refresh(appt)
                    action_taken = "booked"
                    appointment_result = {
                        "id": appt.id,
                        "date": appt.date,
                        "time_slot": appt.time_slot,
                        "cleaning_type": appt.cleaning_type,
                        "address": appt.address,
                        "quoted_price": appt.quoted_price,
                        "status": appt.status
                    }
                    action_context = f"""
Appointment successfully booked!
Details: {pending['cleaning_type']} on {pending['date']} ({pending['time_slot']}) at {pending['address']}.
Estimated price: ₹{quote['total']}.
Confirm this to the customer enthusiastically and give them the booking ID #{appt.id}.
"""
                    pending = {}
        elif intent == "decline":
            action_context = "The customer declined/cancelled the proposed booking. Acknowledge this politely and inform them that the pending booking has been discarded."
            pending = {}
        else:
            action_context = f"""
We are waiting for the customer to confirm or decline the booking details:
- Cleaning Type: {pending.get('cleaning_type')}
- Date: {pending.get('date')}
- Slot: {pending.get('time_slot')}
- Address: {pending.get('address')}
- Price: ₹{pending.get('quoted_price')}
Ask them clearly if they would like to confirm (Yes/No) to proceed with booking.
"""

    elif intent == "book_appointment":
        if not user or user.role != "customer":
            action_context = "The user wants to book a cleaning service, but they are not logged in as a customer. Politely explain that they must register or log in first to book appointments."
        else:
            required = ["date", "time_slot", "cleaning_type", "address"]
            missing = [f for f in required if not pending.get(f)]

            if missing:
                # Ask for missing fields naturally
                field_questions = {
                    "date": "What date would you like the cleaning?",
                    "time_slot": "What time works best — Morning, Afternoon, or Evening?",
                    "cleaning_type": "What type of cleaning do you need — Standard, Deep Clean, or Move-In/Out?",
                    "address": "What's the address for the cleaning?"
                }
                next_question = field_questions[missing[0]]
                action_context = f"""
The customer wants to book an appointment. Collected so far: {pending}.
Missing: {missing}.
Ask them: "{next_question}"
Do not ask for multiple fields at once. Be conversational and friendly.
"""
            else:
                # All info collected — show details and ask for confirmation
                from routes.pricing import calculate_quote
                num_rooms = int(pending.get("num_rooms", 1))
                quote = calculate_quote(db, pending["cleaning_type"], num_rooms, [])
                pending["ready_to_confirm"] = True
                pending["quoted_price"] = quote["total"]
                
                action_context = f"""
All details collected for booking:
- Cleaning Type: {pending['cleaning_type']}
- Date: {pending['date']}
- Slot: {pending['time_slot']}
- Address: {pending['address']}
- Rooms: {num_rooms}
- Total Cost: ₹{quote['total']}

Present these details clearly to the user, and ask them to confirm if they would like to proceed with the booking (e.g. "Would you like me to go ahead and book this now?").
"""

    elif intent == "cancel_appointment" and user and user.role == "customer":
        appt_id = entities.get("appointment_id")
        if appt_id:
            appt = db.query(models.Appointment).filter_by(
                id=appt_id, user_id=user.id).first()
            if not appt:
                action_context = "No appointment with that ID found for this customer. Tell them politely."
            elif appt.status in ["Completed", "Cancelled"]:
                action_context = f"Appointment #{appt_id} is already {appt.status} and cannot be cancelled. Inform the customer."
            else:
                appt.status = "Cancelled"
                db.commit()
                action_taken = "cancelled"
                appointment_result = {
                    "id": appt.id,
                    "date": appt.date,
                    "time_slot": appt.time_slot,
                    "cleaning_type": appt.cleaning_type,
                    "address": appt.address,
                    "quoted_price": appt.quoted_price,
                    "status": appt.status
                }
                action_context = f"Appointment #{appt_id} ({appt.cleaning_type} on {appt.date}) has been successfully cancelled. Confirm this to the customer."
        else:
            # List their active bookings and ask which to cancel
            active = db.query(models.Appointment).filter(
                models.Appointment.user_id == user.id,
                models.Appointment.status.in_(["Pending", "Confirmed"])
            ).all()
            if not active:
                action_context = "The customer has no active appointments to cancel. Tell them this."
            else:
                appt_list = "\n".join(
                    f"- #{a.id}: {a.cleaning_type} on {a.date} ({a.time_slot}) — {a.status}"
                    for a in active)
                action_context = f"The customer wants to cancel but didn't specify which. Show them their active appointments and ask which one:\n{appt_list}"

    elif intent == "get_quote" and user and user.role == "customer":
        from routes.pricing import calculate_quote
        cleaning_type = entities.get("cleaning_type", "Standard")
        num_rooms = int(entities.get("num_rooms", 1))
        quote = calculate_quote(db, cleaning_type, num_rooms, [])
        action_context = f"""
Quote for {cleaning_type}, {num_rooms} room(s):
Base: ₹{quote['base']}, Total: ₹{quote['total']}.
Tell the customer this naturally and ask if they'd like to book.
"""

    # Build final messages for conversational reply
    messages = [{"role": "system", "content": system + "\n\n" + action_context}]
    # Keep last 10 turns of history if present
    for h in body.history[-10:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages += [{"role": "user", "content": body.message}]

    try:
        reply = await call_llm(messages, temperature=0.7, max_tokens=512)
        if not reply:
            raise ValueError("Empty reply from LLM")
    except Exception as e:
        reply = f"AI assistant is currently offline. Error details: {str(e)}"

    return schemas.ChatResponse(
        reply=reply,
        action_taken=action_taken,
        appointment=appointment_result,
        pending_booking=pending
    )
