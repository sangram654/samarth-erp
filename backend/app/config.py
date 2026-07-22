import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    EMAIL_USER: str = os.getenv("EMAIL_USER", "samarthcollege29@gmail.com")
    EMAIL_PASS: str = os.getenv("EMAIL_PASS", "wxpr gbce efjd mumu")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "mysupersecretkey123@erp")
    JWT_EXPIRE: str = os.getenv("JWT_EXPIRE", "365d")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    PORT: int = int(os.getenv("PORT", 5000))
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017/ERP_System")
    COLLEGE_UPI_ID: str = os.getenv("COLLEGE_UPI_ID", "9561563002@ptsbi")
    COLLEGE_NAME: str = os.getenv("COLLEGE_NAME", "Samarth College of Engineering & Management")
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "rzp_test_SamarthERP2026")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "secret_key_samarth_erp")
    PAYTM_MID: str = os.getenv("PAYTM_MID", "SAMARTH_COLLEGE_PAYTM_MID_9561563002")
    PAYTM_MERCHANT_KEY: str = os.getenv("PAYTM_MERCHANT_KEY", "PAYTM_SECRET_KEY_9561563002")
    PAYTM_WEBSITE: str = os.getenv("PAYTM_WEBSITE", "DEFAULT")
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        extra = 'ignore'

settings = Settings()

# Force override MONGODB_URI if provided in system environment (e.g. Railway)
if "MONGODB_URI" in os.environ and os.environ["MONGODB_URI"].strip():
    settings.MONGODB_URI = os.environ["MONGODB_URI"].strip()
