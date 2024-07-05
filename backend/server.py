import asyncio
import websockets
import json
import cv2
import pandas as pd
import numpy as np
from ultralytics import YOLO
import time

model = YOLO('yolov8s.pt')

def RGB(event, x, y, flags, param):
    if event == cv2.EVENT_MOUSEMOVE:
        colorsBGR = [x, y]
        print(colorsBGR)

cv2.namedWindow('RGB')
cv2.setMouseCallback('RGB', RGB)

async def parking_detection(websocket, path):
    cap = cv2.VideoCapture('/mnt/data/p2.mp4')  # Updated video file path

    my_file = open("coco.txt", "r")
    data = my_file.read()
    class_list = data.split("\n")

    areas = [
        [(396, 338), (426, 404), (479, 399), (439, 334)],
        [(458, 333), (494, 397), (543, 390), (495, 330)],
        [(511, 327), (557, 388), (603, 383), (549, 324)],
        [(564, 323), (615, 381), (654, 372), (596, 315)],
        [(616, 316), (666, 369), (703, 363), (642, 312)],
        [(674, 311), (730, 360), (764, 355), (707, 308)],
    ]

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        time.sleep(1)
        frame = cv2.resize(frame, (1020, 500))

        results = model.predict(frame)
        a = results[0].boxes.data
        px = pd.DataFrame(a).astype("float")

        area_occupancies = [[] for _ in range(len(areas))]

        for index, row in px.iterrows():
            x1 = int(row[0])
            y1 = int(row[1])
            x2 = int(row[2])
            y2 = int(row[3])
            d = int(row[5])
            c = class_list[d]
            if 'car' in c:
                cx = int((x1 + x2) // 2)
                cy = int((y1 + y2) // 2)

                for i, area in enumerate(areas):
                    result = cv2.pointPolygonTest(np.array(area, np.int32), (cx, cy), False)
                    if result >= 0:
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.circle(frame, (cx, cy), 3, (0, 0, 255), -1)
                        area_occupancies[i].append(c)
                        cv2.putText(frame, str(c), (x1, y1), cv2.FONT_HERSHEY_COMPLEX, 0.5, (255, 255, 255), 1)

        for i, area in enumerate(areas):
            if len(area_occupancies[i]) == 1:
                color = (0, 0, 255)
                text_color = (0, 0, 255)
            else:
                color = (0, 255, 0)
                text_color = (255, 255, 255)

            cv2.polylines(frame, [np.array(area, np.int32)], True, color, 2)
            cv2.putText(frame, str(i + 1), (int(np.mean(np.array(area)[:, 0])), int(np.mean(np.array(area)[:, 1]) + 30)), cv2.FONT_HERSHEY_COMPLEX, 0.5, text_color, 1)

        space = sum(1 for occ in area_occupancies if len(occ) == 0)
        cv2.putText(frame, str(space), (23, 30), cv2.FONT_HERSHEY_PLAIN, 3, (255, 255, 255), 2)

        cv2.imshow("RGB", frame)

        any_slot_available = any(len(occupancies) == 0 for occupancies in area_occupancies)
        status = '1' if any_slot_available else '0'
        await websocket.send(json.dumps({'status': status}))
        print(status)

        if cv2.waitKey(1) & 0xFF == 27:
            break

    cap.release()
    cv2.destroyAllWindows()

start_server = websockets.serve(parking_detection, "localhost", 6789)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
