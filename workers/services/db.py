"""Supabase client factory."""
import os
from supabase import create_client, Client


def get_db() -> Client:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError(
            "Missing required env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
        )
    return create_client(url, key)


def nse(db: Client):
    """Return a query builder scoped to the nse schema."""
    return db.schema("nse")
