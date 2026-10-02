import json

from solventa_common.events import Event, parse_sqs_body


def test_parse_raw_and_sns_envelope():
    event = Event(event_type="siniestro.creado", source="siniestros", idempotency_key="s-1", payload={"a": 1})
    raw = event.model_dump_json()
    assert parse_sqs_body(raw) == event
    envelope = json.dumps({"TopicArn": "arn:aws:sns:x", "Message": raw})
    assert parse_sqs_body(envelope) == event
