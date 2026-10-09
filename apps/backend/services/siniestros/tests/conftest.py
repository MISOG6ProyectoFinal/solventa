import os

# The local .env turns persistent stores on for Compose. Unit tests use the in-memory adapters.
os.environ["PERSISTENT_STORES"] = "false"
