from fastapi_app.core.config import to_asyncpg_url


def test_converts_prisma_style_url_for_asyncpg() -> None:
    url = to_asyncpg_url("postgresql://user:secret@localhost:5432/constrowell?schema=public&sslmode=disable")

    assert url.startswith("postgresql+asyncpg://")
    assert "schema=" not in url
    assert "sslmode=disable" in url


def test_rejects_non_postgres_urls() -> None:
    try:
        to_asyncpg_url("mysql://user:secret@localhost/db")
    except ValueError as error:
        assert "PostgreSQL" in str(error)
    else:  # pragma: no cover - defensive
        raise AssertionError("expected ValueError")
