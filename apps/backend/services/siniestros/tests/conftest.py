import os

# The local .env turns persistent stores on for Compose. Unit tests use the in-memory adapters.
os.environ["PERSISTENT_STORES"] = "false"

# A developer's ~/.aws profile (for example `aws login`) must not change how tests build boto3 clients.
os.environ["AWS_CONFIG_FILE"] = os.devnull
os.environ["AWS_SHARED_CREDENTIALS_FILE"] = os.devnull
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
