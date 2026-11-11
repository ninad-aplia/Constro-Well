from fastapi.testclient import TestClient


def test_health_returns_service_identity(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"]
    assert body["version"]
    assert response.headers["x-request-id"]


def test_unknown_route_uses_shared_error_envelope(client: TestClient) -> None:
    response = client.get("/does-not-exist")

    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "not_found"
    assert isinstance(error["message"], str) and error["message"]


def test_openapi_document_is_generated(client: TestClient) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    document = response.json()
    assert document["info"]["title"]
    assert "/health" in document["paths"]
    assert "/health/db" in document["paths"]
