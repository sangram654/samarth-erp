import asyncio
import smtplib
from email.message import EmailMessage
from typing import Optional, Dict, Any
# pyrefly: ignore [missing-import]
import aiosmtplib
from ..config import settings
import requests
import os

def send_email_sync(to_email: str, recipient_name: str, role: str, password: str) -> bool:
    """
    Synchronous helper to send welcome email via Gmail SMTP or Resend API fallback.
    """
    resend_key = settings.RESEND_API_KEY.strip() if settings.RESEND_API_KEY else ""
    email_user = settings.EMAIL_USER.strip() if settings.EMAIL_USER else ""
    email_pass = settings.EMAIL_PASS.replace(" ", "").strip() if settings.EMAIL_PASS else ""

    formatted_role = role.replace("_", " ").title()

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); }}
            .header {{ background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center; color: #ffffff; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }}
            .content {{ padding: 30px; color: #334155; line-height: 1.6; }}
            .welcome-text {{ font-size: 16px; margin-bottom: 20px; }}
            .credentials-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 25px 0; }}
            .cred-item {{ margin: 10px 0; font-size: 15px; }}
            .cred-label {{ font-weight: 600; color: #475569; width: 140px; display: inline-block; }}
            .cred-value {{ color: #0f172a; font-weight: 600; }}
            .password-highlight {{ background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-family: monospace; font-size: 16px; letter-spacing: 1px; }}
            .cta-container {{ text-align: center; margin: 30px 0 20px 0; }}
            .btn-login {{ background-color: #2563eb; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 5px rgba(37, 99, 235, 0.3); }}
            .footer {{ background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎓 Samarth College ERP</h1>
            </div>
            <div class="content">
                <p class="welcome-text">Dear <strong>{recipient_name}</strong>,</p>
                <p>Welcome to <strong>Samarth College ERP Portal</strong>! Your user account has been successfully created as <strong>{formatted_role}</strong>.</p>
                <p>These are your account login credentials to access the ERP portal:</p>
 
                <div class="credentials-box">
                    <div class="cred-item">
                        <span class="cred-label">Portal URL:</span>
                        <span class="cred-value"><a href="http://localhost:3000" style="color: #2563eb;">http://localhost:3000</a></span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">Email ID:</span>
                        <span class="cred-value">{to_email}</span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">Password:</span>
                        <span class="password-highlight">{password}</span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">Assigned Role:</span>
                        <span class="cred-value">{formatted_role}</span>
                    </div>
                </div>
 
                <div class="cta-container">
                    <a href="http://localhost:3000" class="btn-login" target="_blank">Log In to ERP Portal</a>
                </div>
 
                <p style="font-size: 13px; color: #64748b; margin-top: 25px;">
                    <em>Note: For security reasons, we strongly recommend changing your password after your initial login.</em>
                </p>
            </div>
            <div class="footer">
                <p>© 2026 Samarth College ERP System. All rights reserved.</p>
                <p>This is an automated system notification. Please do not reply directly to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Resend API integration (fast and non-blocked HTTP call)
    if resend_key:
        try:
            url = "https://api.resend.com/emails"
            headers = {
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            }
            from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev").strip()
            payload = {
                "from": f"Samarth College ERP <{from_email}>",
                "to": to_email,
                "subject": "Welcome to Samarth College ERP System - Your Account Login Credentials",
                "html": html_content
            }
            res = requests.post(url, json=payload, headers=headers, timeout=10)
            if res.status_code in [200, 201]:
                print(f"[EMAIL SERVICE] Welcome email successfully sent via Resend API to {to_email}")
                return True
            else:
                print(f"[EMAIL SERVICE] Resend API failed with status {res.status_code}: {res.text}, falling back to Gmail SMTP...")
        except Exception as e_resend:
            print(f"[EMAIL SERVICE] Resend API exception: {e_resend}, falling back to Gmail SMTP...")

    if not email_user or not email_pass:
        print("[EMAIL SERVICE] Warning: EMAIL_USER or EMAIL_PASS not configured in .env file.")
        return False

    msg = EmailMessage()
    msg["From"] = f"Samarth College ERP <{email_user}>"
    msg["To"] = to_email
    msg["Subject"] = "Welcome to Samarth College ERP System - Your Account Login Credentials"

    msg.set_content(
        f"Hello {recipient_name},\n\n"
        f"Welcome to Samarth College ERP Portal!\n"
        f"Your account has been created with role: {formatted_role}\n\n"
        f"Login URL: http://localhost:3000\n"
        f"Email: {to_email}\n"
        f"Password: {password}\n\n"
        f"Please log in and update your password."
    )
    msg.add_alternative(html_content, subtype="html")
 
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=12) as server:
            server.login(email_user, email_pass)
            server.send_message(msg)
        print(f"[EMAIL SERVICE] Welcome email successfully sent via SSL 465 to {to_email}")
        return True
    except Exception as e_ssl:
        print(f"[EMAIL SERVICE] SSL 465 failed ({e_ssl}), trying TLS 587...")
        try:
            with smtplib.SMTP("smtp.gmail.com", 587, timeout=12) as server:
                server.starttls()
                server.login(email_user, email_pass)
                server.send_message(msg)
            print(f"[EMAIL SERVICE] Welcome email successfully sent via TLS 587 to {to_email}")
            return True
        except Exception as e_tls:
            print(f"[EMAIL SERVICE] Email sending failed for {to_email}: {e_tls}")
            return False

def send_update_email_sync(to_email: str, recipient_name: str, role: str, password: Optional[str] = None, extra_details: Optional[dict] = None) -> bool:
    """
    Synchronous helper to send welcome email via Gmail SMTP or Resend API fallback.
    """
    resend_key = settings.RESEND_API_KEY.strip() if settings.RESEND_API_KEY else ""
    email_user = settings.EMAIL_USER.strip() if settings.EMAIL_USER else ""
    email_pass = settings.EMAIL_PASS.replace(" ", "").strip() if settings.EMAIL_PASS else ""

    formatted_role = role.replace("_", " ").title()

    password_row = ""
    if password:
        password_row = f"""
        <div class="cred-item">
            <span class="cred-label">New Password:</span>
            <span class="password-highlight">{password}</span>
        </div>
        """

    extra_rows = ""
    if extra_details:
        for key, val in extra_details.items():
            if val is not None and str(val).strip() != "":
                extra_rows += f"""
                <div class="cred-item">
                    <span class="cred-label">{key}:</span>
                    <span class="cred-value">{val}</span>
                </div>
                """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }}
            .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); }}
            .header {{ background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 30px; text-align: center; color: #ffffff; }}
            .header h1 {{ margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; }}
            .content {{ padding: 30px; color: #334155; line-height: 1.6; }}
            .welcome-text {{ font-size: 16px; margin-bottom: 20px; }}
            .credentials-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 25px 0; }}
            .cred-item {{ margin: 10px 0; font-size: 15px; }}
            .cred-label {{ font-weight: 600; color: #475569; width: 140px; display: inline-block; }}
            .cred-value {{ color: #0f172a; font-weight: 600; }}
            .password-highlight {{ background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 4px; font-family: monospace; font-size: 16px; letter-spacing: 1px; }}
            .cta-container {{ text-align: center; margin: 30px 0 20px 0; }}
            .btn-login {{ background-color: #2563eb; color: #ffffff !important; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 2px 5px rgba(37, 99, 235, 0.3); }}
            .footer {{ background-color: #f1f5f9; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎓 Samarth College ERP</h1>
            </div>
            <div class="content">
                <p class="welcome-text">Dear <strong>{recipient_name}</strong>,</p>
                <p>Your user profile and account details on <strong>Samarth College ERP Portal</strong> have been updated by the Administrator.</p>
                <p>These are your updated account login credentials and details to access the ERP portal:</p>

                <div class="credentials-box">
                    <div class="cred-item">
                        <span class="cred-label">Portal URL:</span>
                        <span class="cred-value"><a href="http://localhost:3000" style="color: #2563eb;">http://localhost:3000</a></span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">Name:</span>
                        <span class="cred-value">{recipient_name}</span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">Email ID:</span>
                        <span class="cred-value">{to_email}</span>
                    </div>
                    <div class="cred-item">
                        <span class="cred-label">Assigned Role:</span>
                        <span class="cred-value">{formatted_role}</span>
                    </div>
                    {password_row}
                    {extra_rows}
                </div>

                <div class="cta-container">
                    <a href="http://localhost:3000" class="btn-login" target="_blank">Log In to ERP Portal</a>
                </div>

                <p style="font-size: 13px; color: #64748b; margin-top: 25px;">
                    <em>Note: If you did not request or expect these changes, please contact the college administration immediately.</em>
                </p>
            </div>
            <div class="footer">
                <p>© 2026 Samarth College ERP System. All rights reserved.</p>
                <p>This is an automated system notification. Please do not reply directly to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """

    # Resend API integration (fast and non-blocked HTTP call)
    if resend_key:
        try:
            url = "https://api.resend.com/emails"
            headers = {
                "Authorization": f"Bearer {resend_key}",
                "Content-Type": "application/json"
            }
            from_email = os.getenv("RESEND_FROM_EMAIL", "onboarding@resend.dev").strip()
            payload = {
                "from": f"Samarth College ERP <{from_email}>",
                "to": to_email,
                "subject": "Samarth College ERP - Your Account Details Have Been Updated",
                "html": html_content
            }
            res = requests.post(url, json=payload, headers=headers, timeout=10)
            if res.status_code in [200, 201]:
                print(f"[EMAIL SERVICE] Account update email successfully sent via Resend API to {to_email}")
                return True
            else:
                print(f"[EMAIL SERVICE] Resend API failed with status {res.status_code}: {res.text}, falling back to Gmail SMTP...")
        except Exception as e_resend:
            print(f"[EMAIL SERVICE] Resend API exception: {e_resend}, falling back to Gmail SMTP...")

    if not email_user or not email_pass:
        print("[EMAIL SERVICE] Warning: EMAIL_USER or EMAIL_PASS not configured in .env file.")
        return False

    msg = EmailMessage()
    msg["From"] = f"Samarth College ERP <{email_user}>"
    msg["To"] = to_email
    msg["Subject"] = "Samarth College ERP - Your Account Details Have Been Updated"

    msg.set_content(
        f"Hello {recipient_name},\n\n"
        f"Your account details on Samarth College ERP Portal have been updated.\n"
        f"Email: {to_email}\n"
        f"Role: {formatted_role}\n"
        f"Login URL: http://localhost:3000\n"
    )
    msg.add_alternative(html_content, subtype="html")

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=12) as server:
            server.login(email_user, email_pass)
            server.send_message(msg)
        print(f"[EMAIL SERVICE] Account update email successfully sent via SSL 465 to {to_email}")
        return True
    except Exception as e_ssl:
        print(f"[EMAIL SERVICE] SSL 465 failed ({e_ssl}), trying TLS 587...")
        try:
            with smtplib.SMTP("smtp.gmail.com", 587, timeout=12) as server:
                server.starttls()
                server.login(email_user, email_pass)
                server.send_message(msg)
            print(f"[EMAIL SERVICE] Account update email successfully sent via TLS 587 to {to_email}")
            return True
        except Exception as e_tls:
            print(f"[EMAIL SERVICE] Update email sending failed for {to_email}: {e_tls}")
            return False

async def send_welcome_email(to_email: str, recipient_name: str, role: str, password: str) -> bool:
    """Asynchronous wrapper for send_email_sync."""
    return await asyncio.to_thread(send_email_sync, to_email, recipient_name, role, password)

def trigger_welcome_email(to_email: str, recipient_name: str, role: str, password: str):
    """Fire-and-forget background task to send welcome email."""
    try:
        asyncio.create_task(send_welcome_email(to_email, recipient_name, role, password))
    except Exception as e:
        print(f"[EMAIL SERVICE] Failed to schedule email task: {e}")

async def send_update_email(to_email: str, recipient_name: str, role: str, password: Optional[str] = None, extra_details: Optional[dict] = None) -> bool:
    """Asynchronous wrapper for send_update_email_sync."""
    return await asyncio.to_thread(send_update_email_sync, to_email, recipient_name, role, password, extra_details)

def trigger_update_email(to_email: str, recipient_name: str, role: str, password: Optional[str] = None, extra_details: Optional[dict] = None):
    """Fire-and-forget background task to send account update email."""
    try:
        asyncio.create_task(send_update_email(to_email, recipient_name, role, password, extra_details))
    except Exception as e:
        print(f"[EMAIL SERVICE] Failed to schedule update email task: {e}")
