import os
import cv2
import face_recognition


AUTHORIZED_DIR = "data/faces/authorized"


class FaceRecognizer:

    def __init__(self):
        self.known_face_encodings = []
        self.known_face_names = []

        self.load_known_faces()

    def load_known_faces(self):
        self.known_face_encodings = []
        self.known_face_names = []

        if not os.path.exists(AUTHORIZED_DIR):
            print("[WARN] Authorized directory not found.")
            return

        for person_name in os.listdir(AUTHORIZED_DIR):

            person_folder = os.path.join(
                AUTHORIZED_DIR,
                person_name
            )

            if not os.path.isdir(person_folder):
                continue

            print(f"Loading faces for: {person_name}")

            for image_name in os.listdir(person_folder):

                image_path = os.path.join(
                    person_folder,
                    image_name
                )

                try:

                    image = face_recognition.load_image_file(
                        image_path
                    )

                    encodings = face_recognition.face_encodings(
                        image
                    )

                    if not encodings:
                        print(
                            f"  [WARN] No face found: {image_name}"
                        )
                        continue

                    self.known_face_encodings.append(
                        encodings[0]
                    )

                    self.known_face_names.append(
                        person_name
                    )

                    print(f"  [OK] {image_name}")

                except Exception as error:

                    print(
                        f"  [ERROR] Failed loading {image_name}: "
                        f"{error}"
                    )

    def recognize(self, frame):

        small_frame = cv2.resize(
            frame,
            (0, 0),
            fx=0.25,
            fy=0.25
        )

        rgb_frame = cv2.cvtColor(
            small_frame,
            cv2.COLOR_BGR2RGB
        )

        face_locations = face_recognition.face_locations(
            rgb_frame
        )

        face_encodings = face_recognition.face_encodings(
            rgb_frame,
            face_locations
        )

        results = []

        for face_encoding in face_encodings:

            name = "Unknown"

            if self.known_face_encodings:

                matches = face_recognition.compare_faces(
                    self.known_face_encodings,
                    face_encoding,
                    tolerance=0.5
                )

                face_distances = face_recognition.face_distance(
                    self.known_face_encodings,
                    face_encoding
                )

                best_match_index = face_distances.argmin()

                if matches[best_match_index]:

                    name = self.known_face_names[
                        best_match_index
                    ]

            results.append(name)

        return face_locations, results