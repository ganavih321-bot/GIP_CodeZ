from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.models.user import User
from app.models.classroom import Classroom, ClassroomEnrollment
from app.models.assignment import Assignment
from app.models.question import Question, TestCase
from app.core.security import get_password_hash

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Check if already seeded
        teacher = db.query(User).filter(User.email == "teacher@gip.com").first()
        if teacher:
            print("Database already seeded.")
            return

        print("Seeding initial demo data...")

        # 1. Create Teacher
        teacher = User(
            name="Prof. Alan Turing",
            email="teacher@gip.com",
            hashed_password=get_password_hash("teacher123"),
            role="teacher"
        )
        db.add(teacher)

        # 2. Create Student
        student = User(
            name="Ada Lovelace",
            email="student@gip.com",
            hashed_password=get_password_hash("student123"),
            role="student"
        )
        db.add(student)
        db.flush()

        # 3. Create Classroom
        classroom = Classroom(
            title="CS101: Python Algorithms & Data Structures",
            description="Welcome to CS101! Official course platform for hands-on Python coding exercises and proctored examinations.",
            code="PY101A",
            teacher_id=teacher.id
        )
        db.add(classroom)
        db.flush()

        # 4. Enroll Student
        enrollment = ClassroomEnrollment(
            classroom_id=classroom.id,
            student_id=student.id
        )
        db.add(enrollment)
        db.flush()

        # 5. Create Proctored Exam
        exam = Assignment(
            classroom_id=classroom.id,
            title="Midterm Proctored Exam: Python Core",
            description="This is a live proctored coding exam. Ensure your screen sharing is active. Fullscreen is enforced. Tab switching or exiting fullscreen will count as an anti-cheat strike.",
            type="exam",
            is_proctored=True,
            time_limit_minutes=45,
            max_strikes=3
        )
        db.add(exam)
        db.flush()

        # 6. Add Problem 1: Two Sum Target
        q1 = Question(
            assignment_id=exam.id,
            title="Two Sum Target Indices",
            difficulty="Easy",
            problem_statement="""### Problem Description
Given a list of space-separated integers on the first line and a target integer on the second line, find the **0-based indices** of the two numbers such that they add up to the target.

Print the two indices separated by a space in ascending order. You may assume each input has exactly one valid solution, and you cannot use the same element twice.

#### Input Format
- Line 1: Space-separated integers (e.g. `2 7 11 15`)
- Line 2: An integer target (e.g. `9`)

#### Output Format
- Print the two indices separated by a space (e.g. `0 1`)
""",
            starter_code="""import sys

def solve():
    lines = sys.stdin.read().splitlines()
    if not lines:
        return
    nums = list(map(int, lines[0].strip().split()))
    target = int(lines[1].strip())
    
    # Write your solution here
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            print(f"{seen[diff]} {i}")
            return
        seen[num] = i

if __name__ == "__main__":
    solve()
""",
            constraints="- 2 <= array length <= 10^4\n- -10^9 <= nums[i] <= 10^9\n- Exactly one valid answer exists.",
            points=100
        )
        db.add(q1)
        db.flush()

        # Q1 Test Cases:
        tc1_1 = TestCase(question_id=q1.id, input_data="2 7 11 15\n9", expected_output="0 1", is_hidden=False, explanation="nums[0] + nums[1] = 2 + 7 = 9", order_index=0)
        tc1_2 = TestCase(question_id=q1.id, input_data="3 2 4\n6", expected_output="1 2", is_hidden=False, explanation="nums[1] + nums[2] = 2 + 4 = 6", order_index=1)
        tc1_3 = TestCase(question_id=q1.id, input_data="3 3\n6", expected_output="0 1", is_hidden=True, order_index=2)
        tc1_4 = TestCase(question_id=q1.id, input_data="1 5 8 12 20\n25", expected_output="1 4", is_hidden=True, order_index=3)
        db.add_all([tc1_1, tc1_2, tc1_3, tc1_4])

        # 7. Add Problem 2: Valid Palindrome String
        q2 = Question(
            assignment_id=exam.id,
            title="Valid Cleaned Palindrome",
            difficulty="Easy",
            problem_statement="""### Problem Description
A phrase is a **palindrome** if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.

Alphanumeric characters include letters and numbers.

Given a single line string `s`, print `true` if it is a palindrome, or `false` otherwise.

#### Input Format
- A single line containing string `s`.

#### Output Format
- Print `true` or `false` (lowercase).
""",
            starter_code="""import sys

def is_palindrome():
    s = sys.stdin.read().strip()
    # Write your solution here
    cleaned = ''.join(c.lower() for c in s if c.isalnum())
    if cleaned == cleaned[::-1]:
        print("true")
    else:
        print("false")

if __name__ == "__main__":
    is_palindrome()
""",
            constraints="- 1 <= len(s) <= 2 * 10^5\n- s consists only of printable ASCII characters.",
            points=100
        )
        db.add(q2)
        db.flush()

        tc2_1 = TestCase(question_id=q2.id, input_data="A man, a plan, a canal: Panama", expected_output="true", is_hidden=False, explanation="'amanaplanacanalpanama' is a palindrome", order_index=0)
        tc2_2 = TestCase(question_id=q2.id, input_data="race a car", expected_output="false", is_hidden=False, explanation="'raceacar' is not a palindrome", order_index=1)
        tc2_3 = TestCase(question_id=q2.id, input_data=" ", expected_output="true", is_hidden=True, order_index=2)
        tc2_4 = TestCase(question_id=q2.id, input_data="0P", expected_output="false", is_hidden=True, order_index=3)
        db.add_all([tc2_1, tc2_2, tc2_3, tc2_4])

        # 8. Add Problem 3: Balanced Parentheses & Brackets
        q3 = Question(
            assignment_id=exam.id,
            title="Balanced Bracket Sequences",
            difficulty="Medium",
            problem_statement="""### Problem Description
Given a string containing just the characters `(`, `)`, `{`, `}`, `[` and `]`, determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.

#### Input Format
- A single line string of bracket characters.

#### Output Format
- Print `VALID` if valid, or `INVALID` otherwise.
""",
            starter_code="""import sys

def check_brackets():
    s = sys.stdin.read().strip()
    # Write your solution here
    stack = []
    mapping = {')': '(', '}': '{', ']': '['}
    for char in s:
        if char in mapping.values():
            stack.append(char)
        elif char in mapping:
            if not stack or stack.pop() != mapping[char]:
                print("INVALID")
                return
        else:
            print("INVALID")
            return
    if not stack:
        print("VALID")
    else:
        print("INVALID")

if __name__ == "__main__":
    check_brackets()
""",
            constraints="- 1 <= s.length <= 10^4\n- s consists of parentheses only '()[]{}'.",
            points=100
        )
        db.add(q3)
        db.flush()

        tc3_1 = TestCase(question_id=q3.id, input_data="()[]{}", expected_output="VALID", is_hidden=False, order_index=0)
        tc3_2 = TestCase(question_id=q3.id, input_data="(]", expected_output="INVALID", is_hidden=False, order_index=1)
        tc3_3 = TestCase(question_id=q3.id, input_data="([{}])", expected_output="VALID", is_hidden=True, order_index=2)
        tc3_4 = TestCase(question_id=q3.id, input_data="((((", expected_output="INVALID", is_hidden=True, order_index=3)
        db.add_all([tc3_1, tc3_2, tc3_3, tc3_4])

        db.commit()
        print("Demo data seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
