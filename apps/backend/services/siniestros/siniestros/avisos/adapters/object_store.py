import logging
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from siniestros.avisos.domain.models import ObjetoGuardado
from siniestros.avisos.domain.use_cases import URL_TTL

log = logging.getLogger("solventa.s3")

# A missing object. NoSuchBucket is also HTTP 404 and must not be treated as one.
_MISSING = {"404", "NoSuchKey", "NotFound"}


class S3ObjectStore:
    def __init__(self, bucket: str, region: str, endpoint_url: str | None = None) -> None:
        self.bucket = bucket
        self.client = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url,
            config=Config(
                signature_version="s3v4",
                # endpoint_url=None still reads AWS_ENDPOINT_URL. Ignore it for real S3.
                ignore_configured_endpoint_urls=endpoint_url is None,
            ),
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
        log.info(
            "presign put bucket=%s key=%s host=%s",
            self.bucket,
            key,
            urlparse(url).netloc,
        )
        headers = {"Content-Type": content_type, "Content-Length": str(size)}
        return url, headers, datetime.now(UTC) + timedelta(seconds=expires_in)

    def head(self, key: str) -> ObjetoGuardado | None:
        try:
            response = self.client.head_object(Bucket=self.bucket, Key=key)
        except ClientError as exc:
            if self._missing(exc):
                log.info("s3 head missing bucket=%s key=%s", self.bucket, key)
                return None
            self._log_error("head", key, exc)
            raise
        return ObjetoGuardado(content_type=response.get("ContentType") or "", size=int(response["ContentLength"]))

    def read_header(self, key: str) -> bytes:
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=key, Range="bytes=0-31")
        except ClientError as exc:
            self._log_error("get", key, exc)
            raise
        return response["Body"].read()

    def _missing(self, exc: ClientError) -> bool:
        return exc.response.get("Error", {}).get("Code", "") in _MISSING

    def _log_error(self, operation: str, key: str, exc: ClientError) -> None:
        error = exc.response.get("Error", {})
        status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        log.error(
            "s3 %s failed bucket=%s key=%s code=%s status=%s endpoint=%s",
            operation,
            self.bucket,
            key,
            error.get("Code", ""),
            status,
            self.client.meta.endpoint_url,
        )

    def presign_get(self, key: str) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=int(URL_TTL.total_seconds()),
        )
