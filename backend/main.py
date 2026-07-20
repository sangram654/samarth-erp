import uvicorn
from app.config import settings

if __name__ == "__main__":
    port = int(settings.PORT)
    print(f"Starting Samarth College ERP Python Backend on port {port}...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
