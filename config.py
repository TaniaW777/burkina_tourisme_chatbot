"""
Shim module to re-export the real configuration located at src/backend/config.py.

This allows code that does "from config import ..." to work when the application
is imported as a package (e.g. src.backend.main) or run from the project root.
"""
# Try the common path used when running with the project as a package
try:
    from src.backend.config import *  # type: ignore
except Exception:
    # Fallback for alternate import contexts (e.g., running from backend/ directly)
    from backend.config import *  # type: ignore
