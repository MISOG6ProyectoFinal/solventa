from pydantic import BaseModel


class Client(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    password_hash: str
    salt: str


class Session(BaseModel):
    token: str
    client_id: str


class InvalidCredentials(Exception):
    pass


class EmailAlreadyRegistered(Exception):
    pass
