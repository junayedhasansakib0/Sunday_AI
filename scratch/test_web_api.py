import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
from fastapi.testclient import TestClient
from src.web.server import app


def test_api():
    client = TestClient(app)

    # 1. Test homepage
    print("Testing GET / ...")
    res = client.get("/")
    assert res.status_code == 200, f"GET / failed: {res.status_code}"
    assert "Sunday AI" in res.text
    print("  [OK] GET / rendered successfully.")

    # 2. Test status endpoint
    print("Testing GET /api/status ...")
    res = client.get("/api/status")
    assert res.status_code == 200, f"GET /api/status failed: {res.status_code}"
    data = res.json()
    assert data["status"] == "online"
    assert "users" in data
    print(f"  [OK] GET /api/status: users={data['users']}, modules={data['modules']}")

    # 3. Test auth users endpoint
    print("Testing GET /api/auth/users ...")
    res = client.get("/api/auth/users")
    assert res.status_code == 200
    print(f"  [OK] GET /api/auth/users: {res.json()}")

    # 4. Test unauthorized command execution (should return 401)
    print("Testing unauthorized POST /api/command ...")
    res = client.post("/api/command", json={"command": "time"})
    assert res.status_code == 401, f"Expected 401, got {res.status_code}"
    print("  [OK] Unauthorized command correctly blocked (401).")

    # 5. Test Quick Login
    print("Testing POST /api/auth/quick-login ...")
    res = client.post("/api/auth/quick-login", json={"name": "Sakib"})
    assert res.status_code == 200, f"Login failed: {res.text}"
    assert res.json()["success"] is True
    print(f"  [OK] Quick login successful: {res.json()}")

    # 6. Test Authorized command execution
    print("Testing authorized POST /api/command with 'time'...")
    res = client.post("/api/command", json={"command": "time"})
    assert res.status_code == 200
    assert res.json()["success"] is True
    print(f"  [OK] Command 'time' response: {res.json()['response']}")

    print("Testing authorized POST /api/command with 'system info'...")
    res = client.post("/api/command", json={"command": "system info"})
    assert res.status_code == 200
    print(f"  [OK] Command 'system info' response:\n{res.json()['response']}")

    # 7. Test Logout
    print("Testing POST /api/auth/logout ...")
    res = client.post("/api/auth/logout")
    assert res.status_code == 200
    assert res.json()["success"] is True
    print("  [OK] Logout successful.")

    # 8. Verify locked again
    res = client.post("/api/command", json={"command": "time"})
    assert res.status_code == 401
    print("  [OK] Session locked again after logout.")

    print("\n==========================================")
    print(" ALL WEB SERVER TESTS PASSED SUCCESSFULLY! ")
    print("==========================================")

if __name__ == "__main__":
    test_api()
