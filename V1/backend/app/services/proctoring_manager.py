from typing import Dict, List, Any, Optional
from fastapi import WebSocket
from datetime import datetime, timezone
import json
import asyncio

class ProctoringManager:
    def __init__(self):
        # assignment_id -> { "teachers": { user_id: WebSocket }, "students": { user_id: WebSocket } }
        self.rooms: Dict[int, Dict[str, Dict[int, WebSocket]]] = {}
        # assignment_id -> { student_id: { "name": ..., "email": ..., "strikes": 0, "is_fullscreen": True, ... } }
        self.student_states: Dict[int, Dict[int, dict]] = {}

    def _ensure_room(self, assignment_id: int):
        if assignment_id not in self.rooms:
            self.rooms[assignment_id] = {"teachers": {}, "students": {}}
        if assignment_id not in self.student_states:
            self.student_states[assignment_id] = {}

    async def connect(
        self,
        websocket: WebSocket,
        assignment_id: int,
        user_id: int,
        role: str,
        user_name: str,
        user_email: str
    ):
        await websocket.accept()
        self._ensure_room(assignment_id)

        if role == "admin":
            self.rooms[assignment_id]["teachers"][user_id] = websocket
            # Send current active students state to this teacher immediately
            current_states = list(self.student_states[assignment_id].values())
            await websocket.send_json({
                "type": "room_state",
                "students": current_states
            })
        else:
            self.rooms[assignment_id]["students"][user_id] = websocket
            # Initialize or keep state
            if user_id not in self.student_states[assignment_id]:
                self.student_states[assignment_id][user_id] = {
                    "student_id": user_id,
                    "student_name": user_name,
                    "student_email": user_email,
                    "assignment_id": assignment_id,
                    "has_screen_stream": False,
                    "is_fullscreen": True,
                    "current_strikes": 0,
                    "last_event": "Connected",
                    "last_event_time": datetime.now(timezone.utc).isoformat(),
                    "is_online": True
                }
            else:
                self.student_states[assignment_id][user_id]["is_online"] = True
                self.student_states[assignment_id][user_id]["last_event"] = "Reconnected"
                self.student_states[assignment_id][user_id]["last_event_time"] = datetime.now(timezone.utc).isoformat()

            # Broadcast to all teachers in this room
            await self.broadcast_to_teachers(assignment_id, {
                "type": "student_joined",
                "student": self.student_states[assignment_id][user_id]
            })

    async def disconnect(self, assignment_id: int, user_id: int, role: str):
        if assignment_id not in self.rooms:
            return

        if role == "admin":
            self.rooms[assignment_id]["teachers"].pop(user_id, None)
        else:
            self.rooms[assignment_id]["students"].pop(user_id, None)
            if assignment_id in self.student_states and user_id in self.student_states[assignment_id]:
                self.student_states[assignment_id][user_id]["is_online"] = False
                self.student_states[assignment_id][user_id]["last_event"] = "Disconnected"
                self.student_states[assignment_id][user_id]["last_event_time"] = datetime.now(timezone.utc).isoformat()
                
                await self.broadcast_to_teachers(assignment_id, {
                    "type": "student_left",
                    "student_id": user_id
                })

    async def broadcast_to_teachers(self, assignment_id: int, message: dict):
        if assignment_id not in self.rooms:
            return
        teachers = list(self.rooms[assignment_id]["teachers"].items())
        for teacher_id, ws in teachers:
            try:
                await ws.send_json(message)
            except Exception:
                self.rooms[assignment_id]["teachers"].pop(teacher_id, None)

    async def send_to_student(self, assignment_id: int, student_id: int, message: dict):
        if assignment_id not in self.rooms:
            return
        ws = self.rooms[assignment_id]["students"].get(student_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.rooms[assignment_id]["students"].pop(student_id, None)

    async def send_to_teacher(self, assignment_id: int, teacher_id: int, message: dict):
        if assignment_id not in self.rooms:
            return
        ws = self.rooms[assignment_id]["teachers"].get(teacher_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.rooms[assignment_id]["teachers"].pop(teacher_id, None)

    async def handle_message(
        self,
        assignment_id: int,
        user_id: int,
        role: str,
        data: dict
    ):
        msg_type = data.get("type")

        # 1. Anti-cheat violation event from student
        if msg_type == "violation":
            event_type = data.get("event_type")
            strike_count = data.get("strike_count", 1)
            details = data.get("details", "")

            if assignment_id in self.student_states and user_id in self.student_states[assignment_id]:
                state = self.student_states[assignment_id][user_id]
                state["current_strikes"] = strike_count
                state["last_event"] = f"{event_type}: {details}"
                state["last_event_time"] = datetime.now(timezone.utc).isoformat()
                if event_type == "fullscreen_exit":
                    state["is_fullscreen"] = False

            await self.broadcast_to_teachers(assignment_id, {
                "type": "violation_alert",
                "student_id": user_id,
                "event_type": event_type,
                "strike_count": strike_count,
                "details": details,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

        # 2. Fullscreen re-entered
        elif msg_type == "fullscreen_restored":
            if assignment_id in self.student_states and user_id in self.student_states[assignment_id]:
                self.student_states[assignment_id][user_id]["is_fullscreen"] = True
            await self.broadcast_to_teachers(assignment_id, {
                "type": "fullscreen_restored",
                "student_id": user_id
            })

        # 3. WebRTC Signaling: Student -> Teacher (offer or ice_candidate)
        elif msg_type in ("webrtc_offer", "webrtc_ice_candidate"):
            if assignment_id in self.student_states and user_id in self.student_states[assignment_id]:
                self.student_states[assignment_id][user_id]["has_screen_stream"] = True

            # Forward to teachers with student_id attached
            payload = {
                "type": msg_type,
                "student_id": user_id,
                "payload": data.get("payload")
            }
            target_teacher_id = data.get("target_teacher_id")
            if target_teacher_id:
                await self.send_to_teacher(assignment_id, int(target_teacher_id), payload)
            else:
                await self.broadcast_to_teachers(assignment_id, payload)

        # 4. WebRTC Signaling: Teacher -> Student (answer or ice_candidate)
        elif msg_type in ("webrtc_answer", "teacher_ice_candidate"):
            target_student_id = data.get("target_student_id")
            if target_student_id:
                await self.send_to_student(assignment_id, int(target_student_id), {
                    "type": msg_type,
                    "teacher_id": user_id,
                    "payload": data.get("payload")
                })

        # 5. Teacher remote command: Warn or Force Submit
        elif msg_type in ("teacher_warn", "teacher_force_submit"):
            target_student_id = data.get("target_student_id")
            if target_student_id:
                await self.send_to_student(assignment_id, int(target_student_id), {
                    "type": msg_type,
                    "message": data.get("message", "The teacher has requested action.")
                })

    def update_strikes(self, assignment_id: int, student_id: int, strikes: int):
        state = self.student_states.get(assignment_id, {}).get(student_id)
        if state:
            state["current_strikes"] = strikes

    def get_room_summary(self, assignment_id: int) -> List[dict]:
        if assignment_id in self.student_states:
            return list(self.student_states[assignment_id].values())
        return []

proctoring_manager = ProctoringManager()
