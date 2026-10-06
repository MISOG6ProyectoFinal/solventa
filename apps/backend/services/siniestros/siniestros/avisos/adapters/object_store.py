from datetime import UTC, datetime, timedelta

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from siniestros.avisos.domain.models import ObjetoGuardado
from siniestros.avisos.domain.use_cases import URL_TTL

_MISSING = {"404", "NoSuchKey", "NotFound"}


class S3ObjectStore:
    def __init__(self, bucket: str, region: str, endpoint_url: str | None = None) -> None:
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            config=Config(signature_version="s3v4"),
        )

    def presign_put(self, key: str, content_type: str, size: int) -> tuple[str, dict[str, str], datetime]:
        expires_in = int(URL_TTL.total_seconds())
        url = self.client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
                "ContentLength": size,
            },
            ExpiresIn=expires_in,
        )
        headers = {"Content-Type": content_type, "Content-Length": str(size)}
        return url, headers, datetime.now(UTC) + timedelta(seconds=expires_in)

    def head(self, key: str) -> ObjetoGuardado | None:
        try:
            response = self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            code = exc.response.get("Error", {}).get("Code", "")
            status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if code in _MISSING or status == 404:
                return None
            raise
        return ObjetoGuardado(content_type=response.get("ContentType") or "", size=int(response["ContentLength"]))

    def read_header(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key, Range="bytes=0-31")
        return response["Body"].read()

    def presign_get(self, key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=int(URL_TTL.total_seconds()),
        )
