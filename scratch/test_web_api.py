import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import base64
import numpy as np
import cv2
from fastapi.testclient import TestClient
from src.web.server import app

def generate_blank_image_b64():
    # Create a 200x200 blank test image
    img = np.zeros((200, 200, 3), dtype=np.uint8)
    _, buffer = cv2.imencode('.jpg', img)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

def test_api():
    client = TestClient(app)

    # 1. Test homepage
    print("Testing GET / ...")
    res = client.get("/")
    assert res.status_code == 200
    assert "Sunday AI" in res.text
    print("  [OK] GET / rendered successfully.")

    # 2. Test status endpoint
    print("Testing GET /api/status ...")
    res = client.get("/api/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "online"
    assert "users" in data
    print(f"  [OK] GET /api/status: users={data['users']}, modules={data['modules']}")

    # 3. Test In-Browser Frame Verification endpoint with image payload
    print("Testing POST /api/auth/verify-frame ...")
    test_img = generate_blank_image_b64()
    res = client.post("/api/auth/verify-frame", json={"image": test_img})
    assert res.status_code == 200
    assert "face_detected" in res.json()
    print(f"  [OK] In-browser frame verification responded: {res.json()}")

    # 4. Test In-Browser Frame Registration endpoint
    print("Testing POST /api/auth/register-frame ...")
    res = client.post("/api/auth/register-frame", json={"name": "TestBot", "image": test_img, "shot_index": 1})
    assert res.status_code == 200
    assert res.json()["success"] is True
    print(f"  [OK] In-browser frame registration responded: {res.json()}")

    # Clean up test user
    test_dir = os.path.join("data", "faces", "authorized", "TestBot")
    if os.path.exists(test_dir):
        for f in os.listdir(test_dir):
            os.remove(os.path.join(test_dir, f))
        os.rmdir(test_dir)

    # 5. Test Quick Login
    print("Testing POST /api/auth/quick-login ...")
    res = client.post("/api/auth/quick-login", json={"name": "Sakib"})
    assert res.status_code == 200
    assert res.json()["success"] is True
    print(f"  [OK] Quick login successful: {res.json()['user']}")

    # 6. Test Authorized command execution with Gemini AI Brain
    print("Testing authorized POST /api/command with AI query 'Who are you?'...")
    res = client.post("/api/command", json={"command": "Who are you?"})
    assert res.status_code == 200
    print(f"  [OK] AI Brain response: {res.json()['response']}")

    # 7. Test Logout
    print("Testing POST /api/auth/logout ...")
    res = client.post("/api/auth/logout")
    assert res.status_code == 200
    assert res.json()["success"] is True
    print("  [OK] Logout successful.")

    print("\n==========================================")
    print(" ALL UPDATED WEB SERVER TESTS PASSED!    ")
    print("==========================================")

if __name__ == "__main__":
    test_api()
