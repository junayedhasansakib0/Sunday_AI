import cv2
import time
import os
from src.face_recognition import FaceRecognizer
from src.authentication import AuthenticationManager
from src.assistant.command_processor import CommandProcessor
from src.assistant.voice.voice_controller import VoiceController
from src.assistant.state import AssistantState
from register_face import register_face


def face_login(recognizer: FaceRecognizer, state: AssistantState, auth_manager: AuthenticationManager):
    """
    Opens the webcam, verifies the user's face, automatically closes the camera
    upon successful recognition, and returns the authenticated username (or None).
    """
    if not recognizer.known_face_names:
        print("\n[WARN] No authorized faces found in database.")
        print("[INFO] Please register a new face first (Option 2).\n")
        return None

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("\n[ERROR] Could not access webcam for login.")
        return None

    print("\n[INFO] Camera active. Scanning for registered face...")
    print("       (Press 'q' in camera window to cancel login)\n")

    authenticated_user = None

    while True:
        ret, frame = cap.read()
        if not ret:
            time.sleep(0.05)
            continue

        # Run face recognition on frame
        face_locations, names = recognizer.recognize(frame)

        for (top, right, bottom, left), name in zip(face_locations, names):
            top *= 4
            right *= 4
            bottom *= 4
            left *= 4

            is_auth = (name != "Unknown")
            box_color = (0, 255, 0) if is_auth else (0, 0, 255)

            # Draw bounding box
            cv2.rectangle(frame, (left, top), (right, bottom), box_color, 2)

            # Draw label banner
            label = f"{name} - Authorized" if is_auth else "Unknown"
            cv2.rectangle(frame, (left, bottom - 25), (right, bottom), box_color, cv2.FILLED)
            cv2.putText(
                frame,
                label,
                (left + 6, bottom - 6),
                cv2.FONT_HERSHEY_DUPLEX,
                0.55,
                (0, 0, 0) if is_auth else (255, 255, 255),
                1,
            )

            if is_auth and not authenticated_user:
                authenticated_user = name

        # Overlay status banner
        if authenticated_user:
            cv2.putText(
                frame,
                f"ACCESS GRANTED: Welcome, {authenticated_user}!",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.75,
                (0, 255, 0),
                2,
            )
            cv2.imshow("Sunday AI - Face Login", frame)
            cv2.waitKey(800)  # Brief visual confirmation before closing
            break
        else:
            cv2.putText(
                frame,
                "STATUS: SCANNING (Press 'q' to Cancel)",
                (20, 35),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 0, 255),
                2,
            )

        cv2.imshow("Sunday AI - Face Login", frame)

        # Cancel on 'q'
        if cv2.waitKey(1) & 0xFF == ord("q"):
            print("\n[INFO] Login cancelled by user.")
            break

    # Power off & release camera immediately after verification
    cap.release()
    cv2.destroyAllWindows()
    print("[INFO] Camera turned off.")

    if authenticated_user:
        state.authenticate(authenticated_user)
        auth_manager.authenticate(authenticated_user)
        return authenticated_user

    return None


def run_command_console(state: AssistantState, auth_manager: AuthenticationManager):
    """
    Active command console loop for Sunday AI.
    Runs until the user logs out or exits.
    """
    command_processor = CommandProcessor(state=state)

    # ── Start Voice Controller (Phase 06) ────────────────────
    voice_controller = VoiceController(
        state=state,
        command_processor=command_processor,
    )
    voice_controller.start()

    print("\n" + "=" * 55)
    print(f"       SUNDAY AI - ACCESS GRANTED: Welcome, {state.current_user}!")
    print("=" * 55)
    print("Type or speak commands. Say 'help' for available commands.")
    print("Type 'logout' to lock session and return to Main Menu.")
    print("Type 'exit' to shut down Sunday.")
    print("=" * 55 + "\n")

    while state.is_authenticated and state.is_running:
        try:
            user_input = input("Sunday Console > ").strip()

            if not user_input:
                continue

            if user_input.lower() in ["exit", "quit"]:
                print("[SYSTEM] Shutting down Sunday...")
                voice_controller.stop()
                state.stop()
                break

            response = command_processor.process(user_input)
            print(f"Sunday: {response}\n")

            if user_input.lower() == "logout":
                voice_controller.stop()
                auth_manager.logout()
                break

        except (EOFError, KeyboardInterrupt):
            print("\n[SYSTEM] Session interrupted.")
            voice_controller.stop()
            state.logout()
            auth_manager.logout()
            break


def main_menu():
    """Main interactive menu loop for Sunday AI."""
    recognizer = FaceRecognizer()
    state = AssistantState()
    auth_manager = AuthenticationManager()

    while state.is_running:
        print("\n" + "=" * 50)
        print("             SUNDAY AI - MAIN MENU            ")
        print("=" * 50)
        print("  1. Login with Face Recognition")
        print("  2. Register New Face")
        print("  3. Exit")
        print("=" * 50)

        choice = input("Select an option (1-3): ").strip()

        if choice == "1":
            user = face_login(recognizer, state, auth_manager)
            if user:
                run_command_console(state, auth_manager)

        elif choice == "2":
            success, registered_name = register_face()
            if success:
                # Reload face encodings in memory immediately
                print(f"[INFO] Reloading face recognition database for {registered_name}...")
                recognizer.load_known_faces()
                print("[INFO] Database successfully updated. You can now log in.\n")

        elif choice == "3":
            print("\n[SYSTEM] Exiting Sunday AI. Goodbye!")
            state.stop()
            break

        else:
            print("[ERROR] Invalid selection. Please enter 1, 2, or 3.")


if __name__ == "__main__":
    try:
        main_menu()
    except KeyboardInterrupt:
        print("\n\n[SYSTEM] Sunday AI terminated.")