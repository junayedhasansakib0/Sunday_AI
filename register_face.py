# pyrefly: ignore [missing-import]
import cv2
import os


def register_face(name=None):
    """
    Opens the webcam and captures 5 photos for facial recognition registration.
    Returns (success: bool, username: str).
    """
    if not name:
        name = input("\nEnter name for face registration: ").strip()
        if not name:
            print("[INFO] Registration cancelled (empty name).")
            return False, None

    save_dir = os.path.join("data", "faces", "authorized", name)
    os.makedirs(save_dir, exist_ok=True)

    camera = cv2.VideoCapture(0)
    if not camera.isOpened():
        print("[ERROR] Could not access webcam.")
        return False, name

    print("=" * 50)
    print("        Sunday AI - Face Registration")
    print("=" * 50)
    print(f"Registering face profile for: {name}")
    print("Instructions:")
    print("  - Look directly at the camera.")
    print("  - Press SPACE to capture a photo (5 required).")
    print("  - Press Q to cancel.\n")

    count = 0
    registered = False

    while True:
        success, frame = camera.read()
        if not success:
            print("[ERROR] Failed to read frame from webcam.")
            break

        # Render UI info overlay
        cv2.putText(
            frame,
            f"User: {name} | Photos: {count}/5",
            (20, 40),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (0, 255, 0),
            2,
        )
        cv2.putText(
            frame,
            "SPACE = Capture Photo  |  Q = Cancel",
            (20, 75),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2,
        )

        cv2.imshow("Sunday AI - Face Registration", frame)

        key = cv2.waitKey(1) & 0xFF

        # Capture image on SPACE
        if key == ord(" "):
            photo_filename = os.path.join(save_dir, f"{name}_{count + 1}.jpg")
            cv2.imwrite(photo_filename, frame)
            count += 1
            print(f"  [OK] Captured photo {count}/5 -> {photo_filename}")

            if count >= 5:
                print("\n[SUCCESS] Face registration completed successfully!")
                registered = True
                break

        # Cancel on 'q'
        elif key == ord("q"):
            print("\n[INFO] Face registration cancelled by user.")
            break

    camera.release()
    cv2.destroyAllWindows()
    return registered, name


if __name__ == "__main__":
    register_face()