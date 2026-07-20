import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    EMAIL_USER: str = "samarthcollege29@gmail.com"
    EMAIL_PASS: str = "wxpr gbce efjd mumu"
    JWT_SECRET: str = "mysupersecretkey123@erp"
    JWT_EXPIRE: str = "365d"
    GROQ_API_KEY: str = ""
    PORT: int = 5000
    MONGODB_URI: str = "mongodb://127.0.0.1:27017/ERP_System"
    COLLEGE_UPI_ID: str = "9561563002@ptsbi"
    COLLEGE_NAME: str = "Samarth College of Engineering & Management"
    RAZORPAY_KEY_ID: str = "rzp_test_SamarthERP2026"
    RAZORPAY_KEY_SECRET: str = "secret_key_samarth_erp"
    PAYTM_MID: str = "SAMARTH_COLLEGE_PAYTM_MID_9561563002"
    PAYTM_MERCHANT_KEY: str = "PAYTM_SECRET_KEY_9561563002"
    PAYTM_WEBSITE: str = "DEFAULT"
    
    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        extra = 'ignore'

settings = Settings()
