"""Token-hash and bcrypt compatibility with the existing Next.js implementation."""

from datetime import datetime, timedelta, timezone

from fastapi_app.core.security import hash_session_token, session_is_active, verify_password

# Produced by bcryptjs (cost 12) in the Next.js app for the password "constrowell-demo".
BCRYPTJS_HASH = "$2b$12$wi1PjdyJ.pppWbuSsIPbAOyHx8bDqskMqrBAscIpXTziE36.k1qAq"
# Produced by Node: createHash("sha256").update("portability-token").digest("hex")
NODE_TOKEN_HASH = "27efa710427437b0a46023434ae82add94140f8c10d4f90ea059dfab97305bf9"


def test_token_hash_matches_node_sha256_vector() -> None:
    assert hash_session_token("portability-token") == NODE_TOKEN_HASH


def test_bcryptjs_hash_verifies_in_python() -> None:
    assert verify_password("constrowell-demo", BCRYPTJS_HASH) is True
    assert verify_password("wrong-password", BCRYPTJS_HASH) is False


def test_python_bcrypt_output_is_bcryptjs_compatible() -> None:
    import bcrypt

    digest = bcrypt.hashpw(b"another-secret", bcrypt.gensalt(rounds=12)).decode()
    assert digest.startswith(("$2a$12$", "$2b$12$"))
    assert verify_password("another-secret", digest) is True


def test_malformed_hash_fails_closed() -> None:
    assert verify_password("anything", "not-a-bcrypt-hash") is False
    assert verify_password("", BCRYPTJS_HASH) is False


def test_expiry_is_strict_and_timezone_safe() -> None:
    now = datetime.now(timezone.utc)
    assert session_is_active(now + timedelta(seconds=1), now) is True
    assert session_is_active(now - timedelta(seconds=1), now) is False
    # Prisma stores naive UTC datetimes; treat them as UTC rather than local time.
    assert session_is_active((now + timedelta(minutes=5)).replace(tzinfo=None), now) is True
    assert session_is_active((now - timedelta(minutes=5)).replace(tzinfo=None), now) is False
