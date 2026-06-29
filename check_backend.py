import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend'))
import main
from database import SessionLocal
import models

db = SessionLocal()
try:
    print("Database connection opened successfully.")
    
    # Query admin user
    admin = db.query(models.User).filter_by(email="admin@cleanpro.com").first()
    if admin:
        print(f"Admin user found: {admin.name}, role: {admin.role}")
        print(f"User columns: saved_addresses={admin.saved_addresses}, preferred_staff_id={admin.preferred_staff_id}, cleaning_notes={admin.cleaning_notes}")
    else:
        print("Admin user not found.")
        
    # Query stats
    pending_count = db.query(models.Appointment).filter(models.Appointment.status == "Pending").count()
    print(f"Pending appointments count: {pending_count}")
    
    # Query reviews stats
    total_reviews = db.query(models.Review).count()
    print(f"Total reviews: {total_reviews}")
    
    print("All backend database queries succeeded!")
except Exception as e:
    print(f"Error during backend checks: {e}")
    import traceback
    traceback.print_exc()
finally:
    db.close()
