class AcceptingScanner:
    # The use case calls this only after the header matches the declared type.
    def scan(self, key: str, header: bytes, content_type: str) -> str:
        return "clean"
