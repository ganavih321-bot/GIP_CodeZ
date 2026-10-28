from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.classroom import Classroom, ClassroomEnrollment
from app.schemas.classroom import ClassroomCreate, ClassroomJoin, ClassroomOut, ClassroomDetailOut
from app.core.security import get_current_user, require_teacher

router = APIRouter(prefix="/classrooms", tags=["Classrooms"])

@router.get("", response_model=List[ClassroomOut])
def get_user_classrooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "teacher":
        classes = db.query(Classroom).filter(Classroom.teacher_id == current_user.id).all()
    else:
        enrollments = db.query(ClassroomEnrollment).filter(ClassroomEnrollment.student_id == current_user.id).all()
        classes = [e.classroom for e in enrollments]

    # Populate enrolled students count
    res = []
    for c in classes:
        out = ClassroomOut.model_validate(c)
        out.enrolled_students_count = len(c.enrollments)
        res.append(out)
    return res

@router.post("", response_model=ClassroomOut)
def create_classroom(
    class_in: ClassroomCreate,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    classroom = Classroom(
        title=class_in.title,
        description=class_in.description,
        teacher_id=current_user.id
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    out = ClassroomOut.model_validate(classroom)
    out.enrolled_students_count = 0
    return out

@router.post("/join", response_model=ClassroomOut)
def join_classroom(
    join_in: ClassroomJoin,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    cleaned_code = join_in.code.strip().upper()
    classroom = db.query(Classroom).filter(Classroom.code == cleaned_code).first()
    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No classroom found with this join code. Please verify and try again."
        )

    if classroom.teacher_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are the teacher of this classroom."
        )

    existing = db.query(ClassroomEnrollment).filter(
        ClassroomEnrollment.classroom_id == classroom.id,
        ClassroomEnrollment.student_id == current_user.id
    ).first()
    if existing:
        out = ClassroomOut.model_validate(classroom)
        out.enrolled_students_count = len(classroom.enrollments)
        return out

    enrollment = ClassroomEnrollment(
        classroom_id=classroom.id,
        student_id=current_user.id
    )
    db.add(enrollment)
    db.commit()
    db.refresh(classroom)

    out = ClassroomOut.model_validate(classroom)
    out.enrolled_students_count = len(classroom.enrollments)
    return out

@router.get("/{classroom_id}", response_model=ClassroomDetailOut)
def get_classroom_detail(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Verify authorization
    is_teacher = (classroom.teacher_id == current_user.id)
    is_enrolled = any(e.student_id == current_user.id for e in classroom.enrollments)
    if not (is_teacher or is_enrolled):
        raise HTTPException(status_code=403, detail="Not authorized to view this classroom")

    out = ClassroomDetailOut.model_validate(classroom)
    out.enrolled_students_count = len(classroom.enrollments)
    out.enrolled_students = [e.student for e in classroom.enrollments]
    return out

@router.delete("/{classroom_id}")
def delete_classroom(
    classroom_id: int,
    current_user: User = Depends(require_teacher),
    db: Session = Depends(get_db)
):
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found or unauthorized")

    db.delete(classroom)
    db.commit()
    return {"message": "Classroom deleted successfully"}
