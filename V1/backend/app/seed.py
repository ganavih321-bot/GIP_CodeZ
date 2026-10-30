from app.database import engine, Base, SessionLocal
from app.models.user import User
from app.models.assignment import Assignment
from app.models.question import Question, TestCase

SAMPLE_TEST_TITLE = "GIP Python Screening Test"
LEGACY_DEMO_EMAILS = ["admin@gip.com", "student@gip.com"]

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Remove the demo password accounts created by earlier versions
        demo_ids = [u.id for u in db.query(User).filter(
            User.email.in_(LEGACY_DEMO_EMAILS), User.google_sub.is_(None)
        ).all()]
        if demo_ids:
            db.query(Assignment).filter(Assignment.created_by_id.in_(demo_ids)).update(
                {Assignment.created_by_id: None}, synchronize_session=False
            )
            db.query(User).filter(User.invited_by_id.in_(demo_ids)).update(
                {User.invited_by_id: None}, synchronize_session=False
            )
            for demo in db.query(User).filter(User.id.in_(demo_ids)).all():
                db.delete(demo)
            db.commit()
            print("Removed legacy demo accounts.")

        # Check if already seeded
        if db.query(Assignment).filter(Assignment.title == SAMPLE_TEST_TITLE).first():
            print("Database already seeded.")
            return

        print("Seeding sample test...")

        # 1. Sample proctored test (admins assign it to invited students)
        exam = Assignment(
            title=SAMPLE_TEST_TITLE,
            description="A 45-minute proctored Python test with 4 problems. Screen sharing must stay on and full-screen is enforced. Tab switching or exiting full-screen counts as an anti-cheat strike; 3 strikes auto-submits your test. Read input from stdin and print the answer to stdout.",
            type="exam",
            is_proctored=True,
            time_limit_minutes=45,
            max_strikes=3
        )
        db.add(exam)
        db.flush()

        # 2. Problem 1: Two Sum Target
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
    nums = list(map(int, lines[0].split()))
    target = int(lines[1])

    # Write your solution here: print the two indices, e.g. print(i, j)


if __name__ == "__main__":
    solve()
""",
            constraints="- 2 <= array length <= 10^4\n- -10^9 <= nums[i] <= 10^9\n- Exactly one valid answer exists.",
            points=100
        )
        db.add(q1)
        db.flush()
        db.add_all([
            TestCase(question_id=q1.id, input_data="2 7 11 15\n9", expected_output="0 1", is_hidden=False, explanation="nums[0] + nums[1] = 2 + 7 = 9", order_index=0),
            TestCase(question_id=q1.id, input_data="3 2 4\n6", expected_output="1 2", is_hidden=False, explanation="nums[1] + nums[2] = 2 + 4 = 6", order_index=1),
            TestCase(question_id=q1.id, input_data="3 3\n6", expected_output="0 1", is_hidden=True, order_index=2),
            TestCase(question_id=q1.id, input_data="1 5 8 12 20\n25", expected_output="1 4", is_hidden=True, order_index=3),
            TestCase(question_id=q1.id, input_data="-4 10 -1 7\n6", expected_output="2 3", is_hidden=True, order_index=4),
        ])

        # 3. Problem 2: Valid Palindrome String
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

    # Write your solution here: print "true" or "false"


if __name__ == "__main__":
    is_palindrome()
""",
            constraints="- 1 <= len(s) <= 2 * 10^5\n- s consists only of printable ASCII characters.",
            points=100
        )
        db.add(q2)
        db.flush()
        db.add_all([
            TestCase(question_id=q2.id, input_data="A man, a plan, a canal: Panama", expected_output="true", is_hidden=False, explanation="'amanaplanacanalpanama' is a palindrome", order_index=0),
            TestCase(question_id=q2.id, input_data="race a car", expected_output="false", is_hidden=False, explanation="'raceacar' is not a palindrome", order_index=1),
            TestCase(question_id=q2.id, input_data=" ", expected_output="true", is_hidden=True, order_index=2),
            TestCase(question_id=q2.id, input_data="0P", expected_output="false", is_hidden=True, order_index=3),
        ])

        # 4. Problem 3: Balanced Parentheses & Brackets
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

    # Write your solution here: print "VALID" or "INVALID"


if __name__ == "__main__":
    check_brackets()
""",
            constraints="- 1 <= s.length <= 10^4\n- s consists of parentheses only '()[]{}'.",
            points=100
        )
        db.add(q3)
        db.flush()
        db.add_all([
            TestCase(question_id=q3.id, input_data="()[]{}", expected_output="VALID", is_hidden=False, order_index=0),
            TestCase(question_id=q3.id, input_data="(]", expected_output="INVALID", is_hidden=False, order_index=1),
            TestCase(question_id=q3.id, input_data="([{}])", expected_output="VALID", is_hidden=True, order_index=2),
            TestCase(question_id=q3.id, input_data="((((", expected_output="INVALID", is_hidden=True, order_index=3),
            TestCase(question_id=q3.id, input_data="}{", expected_output="INVALID", is_hidden=True, order_index=4),
        ])

        # 5. Problem 4: Merge Overlapping Intervals
        q4 = Question(
            assignment_id=exam.id,
            title="Merge Overlapping Intervals",
            difficulty="Medium",
            problem_statement="""### Problem Description
You are given `n` closed intervals `[start, end]`. Merge all overlapping intervals (intervals that share at least one point overlap, e.g. `[1,3]` and `[3,5]`) and print the result sorted by start.

#### Input Format
- Line 1: An integer `n`
- Next `n` lines: two integers `start end`

#### Output Format
- One merged interval per line as `start end`, in ascending order of start.
""",
            starter_code="""import sys

def merge_intervals():
    data = sys.stdin.read().split()
    n = int(data[0])
    intervals = [(int(data[1 + 2 * i]), int(data[2 + 2 * i])) for i in range(n)]

    # Write your solution here: print each merged interval as "start end"


if __name__ == "__main__":
    merge_intervals()
""",
            constraints="- 1 <= n <= 10^4\n- 0 <= start <= end <= 10^9",
            points=100
        )
        db.add(q4)
        db.flush()
        db.add_all([
            TestCase(question_id=q4.id, input_data="4\n1 3\n2 6\n8 10\n15 18", expected_output="1 6\n8 10\n15 18", is_hidden=False, explanation="[1,3] and [2,6] overlap into [1,6]", order_index=0),
            TestCase(question_id=q4.id, input_data="2\n1 4\n4 5", expected_output="1 5", is_hidden=False, explanation="Touching intervals are merged", order_index=1),
            TestCase(question_id=q4.id, input_data="3\n5 7\n1 2\n3 4", expected_output="1 2\n3 4\n5 7", is_hidden=True, order_index=2),
            TestCase(question_id=q4.id, input_data="3\n1 10\n2 3\n4 5", expected_output="1 10", is_hidden=True, order_index=3),
            TestCase(question_id=q4.id, input_data="1\n0 0", expected_output="0 0", is_hidden=True, order_index=4),
        ])

        db.commit()
        print("Sample test seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
